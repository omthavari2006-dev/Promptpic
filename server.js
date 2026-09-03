const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');
const multer = require('multer');
const compression = require('compression'); // added for response compression

const app = express();
app.set('trust proxy', 1); // Trust reverse proxy (e.g., Nginx, Cloudflare for stigz.xyz)

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 25 * 1024 * 1024 // 25MB max socket payload size for high-res images
});

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'challenge-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Load challenges library (starts empty - admin provides images)
let challenges = [];
try {
  const challengesPath = path.join(__dirname, 'data', 'challenges.json');
  if (fs.existsSync(challengesPath)) {
    challenges = JSON.parse(fs.readFileSync(challengesPath, 'utf8'));
  }
} catch (err) {
  console.error('Error loading challenges:', err);
}

// In-Memory Competition State Store
// Map<roomCode, CompetitionState>
const competitions = new Map();

/**
 * State Machine Statuses:
 * - 'LOBBY'
 * - 'CHALLENGE' (Submissions open)
 * - 'SUBMISSIONS_CLOSED'
 * - 'VOTING' (Peer voting open)
 * - 'VOTING_CLOSED'
 * - 'ROUND_WINNER'
 * - 'FINAL_LEADERBOARD'
 * - 'CANCELLED'
 */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createCompetitionState(roomCode, config = {}) {
  return {
    roomCode,
    title: config.title || 'AI Prompt Battle Arena',
    hostSocketId: null,
    createdAt: new Date().toISOString(),
    status: 'LOBBY',
    currentRound: 0,
    roundDuration: config.roundDuration || 90, // in seconds
    timerRemaining: 0,
    timerInterval: null,
    usedChallengeIds: [],
    currentChallenge: null,
    // Map<participantId, Participant>
    participants: {},
    // Map<submissionId, Submission> (keyed by participantId for current round)
    submissions: {},
    // Array of { voterId, submissionId, roundNumber, timestamp }
    votes: [],
    // History of rounds: Array of RoundSummary
    roundHistory: [],
    // Custom challenge pool for this room
    customChallenges: [...challenges]
  };
}

// Clean sanitized state for public broadcasting
function getSanitizedRoomState(comp, requesterParticipantId = null) {
  if (!comp) return null;

  // Prepare participants array
  const participantList = Object.values(comp.participants).map(p => ({
    id: p.id,
    name: p.name,
    teamName: p.teamName,
    avatar: p.avatar,
    totalScore: p.totalScore || 0,
    roundWins: p.roundWins || 0,
    isReady: p.isReady || false,
    isConnected: p.isConnected !== false
  }));

  // Prepare submissions array (safely masked during voting or open phase)
  const submissionList = Object.values(comp.submissions).map(s => {
    const isOwnSubmission = requesterParticipantId && requesterParticipantId === s.participantId;
    return {
      id: s.participantId, // using author participantId as submissionId
      participantId: s.participantId,
      participantName: s.participantName,
      teamName: s.teamName,
      avatar: s.avatar,
      promptText: s.promptText,
      submittedAt: s.submittedAt,
      isOwnSubmission: !!isOwnSubmission,
      // Vote count is hidden during voting phase unless revealed
      voteCount: (comp.status === 'ROUND_WINNER' || comp.status === 'FINAL_LEADERBOARD') ? s.voteCount : undefined
    };
  });

  // Calculate voter status for requester
  let hasVotedInCurrentRound = false;
  let votedSubmissionId = null;
  if (requesterParticipantId) {
    const existingVote = comp.votes.find(
      v => v.voterId === requesterParticipantId && v.roundNumber === comp.currentRound
    );
    if (existingVote) {
      hasVotedInCurrentRound = true;
      votedSubmissionId = existingVote.submissionId;
    }
  }

  // Calculate cumulative leaderboard
  const leaderboard = [...participantList].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return (b.roundWins || 0) - (a.roundWins || 0);
  });

  // Last round winner details
  let lastRoundWinner = null;
  if (comp.roundHistory.length > 0) {
    lastRoundWinner = comp.roundHistory[comp.roundHistory.length - 1];
  }

  return {
    roomCode: comp.roomCode,
    title: comp.title,
    status: comp.status,
    currentRound: comp.currentRound,
    roundDuration: comp.roundDuration,
    timerRemaining: comp.timerRemaining,
    currentChallenge: comp.currentChallenge,
    participants: participantList,
    participantCount: participantList.length,
    submissionsCount: Object.keys(comp.submissions).length,
    submissions: submissionList,
    votesCount: comp.votes.filter(v => v.roundNumber === comp.currentRound).length,
    hasVotedInCurrentRound,
    votedSubmissionId,
    lastRoundWinner,
    roundHistory: comp.roundHistory,
    leaderboard,
    challenges: comp.customChallenges || []
  };
}

function broadcastState(roomCode) {
  const comp = competitions.get(roomCode);
  if (!comp) return;

  // Send tailored state to each participant socket
  Object.values(comp.participants).forEach(p => {
    if (p.socketId) {
      const state = getSanitizedRoomState(comp, p.id);
      io.to(p.socketId).emit('competition-state', state);
    }
  });

  // Send generic state to admin and display screens in the room
  const genericState = getSanitizedRoomState(comp, null);
  io.to(`room_${roomCode}_admin`).emit('competition-state', genericState);
  io.to(`room_${roomCode}_display`).emit('competition-state', genericState);
}

function startTimer(roomCode, durationInSeconds, onComplete) {
  const comp = competitions.get(roomCode);
  if (!comp) return;

  if (comp.timerInterval) {
    clearInterval(comp.timerInterval);
    comp.timerInterval = null;
  }

  comp.timerRemaining = durationInSeconds;
  io.to(`room_${roomCode}`).emit('timer-tick', { remaining: comp.timerRemaining });

  comp.timerInterval = setInterval(() => {
    comp.timerRemaining -= 1;
    io.to(`room_${roomCode}`).emit('timer-tick', { remaining: Math.max(0, comp.timerRemaining) });

    if (comp.timerRemaining <= 0) {
      clearInterval(comp.timerInterval);
      comp.timerInterval = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }
  }, 1000);
}

function stopTimer(comp) {
  if (comp && comp.timerInterval) {
    clearInterval(comp.timerInterval);
    comp.timerInterval = null;
  }
}

function calculateRoundResults(comp) {
  const currentRound = comp.currentRound;
  const submissionsArray = Object.values(comp.submissions);
  
  // Reset vote counts
  submissionsArray.forEach(s => {
    s.voteCount = 0;
  });

  // Count votes for current round
  const currentVotes = comp.votes.filter(v => v.roundNumber === currentRound);
  currentVotes.forEach(vote => {
    if (comp.submissions[vote.submissionId]) {
      comp.submissions[vote.submissionId].voteCount = (comp.submissions[vote.submissionId].voteCount || 0) + 1;
    }
  });

  // Sort submissions by votes descending
  const rankedSubmissions = [...submissionsArray].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

  let winners = [];
  let highestVotes = 0;

  if (rankedSubmissions.length > 0) {
    highestVotes = rankedSubmissions[0].voteCount || 0;
    // Handle co-winners in case of ties
    winners = rankedSubmissions.filter(s => (s.voteCount || 0) === highestVotes);
  }

  // Update cumulative scores and wins
  rankedSubmissions.forEach(sub => {
    const participant = comp.participants[sub.participantId];
    if (participant) {
      // Add round votes directly to totalScore
      participant.totalScore = (participant.totalScore || 0) + (sub.voteCount || 0);
    }
  });

  // Mark round wins
  if (highestVotes > 0) {
    winners.forEach(w => {
      const participant = comp.participants[w.participantId];
      if (participant) {
        participant.roundWins = (participant.roundWins || 0) + 1;
      }
    });
  }

  const roundSummary = {
    roundNumber: currentRound,
    challenge: comp.currentChallenge,
    totalVotes: currentVotes.length,
    submissionsCount: rankedSubmissions.length,
    highestVotes,
    winners: winners.map(w => ({
      participantId: w.participantId,
      participantName: w.participantName,
      teamName: w.teamName,
      avatar: w.avatar,
      promptText: w.promptText,
      voteCount: w.voteCount
    })),
    rankings: rankedSubmissions.map((s, idx) => ({
      rank: idx + 1,
      participantId: s.participantId,
      participantName: s.participantName,
      teamName: s.teamName,
      avatar: s.avatar,
      promptText: s.promptText,
      voteCount: s.voteCount || 0
    }))
  };

  // Add to round history if not already recorded
  const existingIdx = comp.roundHistory.findIndex(r => r.roundNumber === currentRound);
  if (existingIdx >= 0) {
    comp.roundHistory[existingIdx] = roundSummary;
  } else {
    comp.roundHistory.push(roundSummary);
  }
    return roundSummary;
}

// Middleware
const helmet = require('helmet'); // security headers
app.use(helmet({ contentSecurityPolicy: false })); // apply security middleware, disable CSP for inline assets
app.use(compression()); // enable gzip compression for all responses
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// API Routes
app.get('/api/challenges', (req, res) => {
  res.json({ success: true, challenges });
});

// Image Upload Endpoint for Admin Custom Challenges
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }
    const relativeUrl = `/uploads/${req.file.filename}`;
    // Respond immediately; the file is already written to disk by multer.
    res.json({
      success: true,
      imageUrl: relativeUrl,
      filename: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/room/:roomCode', (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase();
  const comp = competitions.get(roomCode);
  if (!comp) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  res.json({ success: true, state: getSanitizedRoomState(comp) });
});

app.get('/api/qrcode/:roomCode', async (req, res) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const host = req.get('host');
    const protocol = req.protocol;
    const joinUrl = `${protocol}://${host}/?room=${roomCode}`;
    const qrDataUrl = await QRCode.toDataURL(joinUrl, {
      margin: 2,
      color: {
        dark: '#00ffff',
        light: '#0a0d14'
      },
      width: 320
    });
    res.json({ success: true, joinUrl, qrDataUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HTML Interface Routing
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Real-Time Socket Connection Handlers
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentRole = null; // 'admin' | 'participant' | 'display'
  let participantId = null;

  // --- ADMIN: Create Competition ---
  socket.on('admin:create-competition', async (data, callback) => {
    let roomCode = generateRoomCode();
    while (competitions.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const comp = createCompetitionState(roomCode, {
      title: data.title || 'AI Prompt Battle Arena',
      roundDuration: parseInt(data.roundDuration, 10) || 90
    });
    comp.hostSocketId = socket.id;
    competitions.set(roomCode, comp);

    currentRoom = roomCode;
    currentRole = 'admin';

    socket.join(`room_${roomCode}`);
    socket.join(`room_${roomCode}_admin`);

    console.log(`[Admin] Competition created: ${roomCode} by ${socket.id}`);

    let joinUrl = '';
    let qrDataUrl = '';
    try {
      const host = socket.handshake.headers.host || 'stigz.xyz';
      const protocol = socket.handshake.headers['x-forwarded-proto'] || (socket.handshake.secure ? 'https' : 'http');
      joinUrl = `${protocol}://${host}/?room=${roomCode}`;
      qrDataUrl = await QRCode.toDataURL(joinUrl, {
        margin: 2,
        color: { dark: '#00ffff', light: '#0a0d14' },
        width: 320
      });
    } catch (e) {
      console.error('QR generation error on room creation:', e);
    }

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        joinUrl,
        qrDataUrl,
        state: getSanitizedRoomState(comp)
      });
    }

    broadcastState(roomCode);
  });

  // --- ADMIN: Join Existing Room as Admin ---
  socket.on('admin:join-room', ({ roomCode }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const comp = competitions.get(code);

    if (!comp) {
      if (typeof callback === 'function') callback({ success: false, error: 'Competition room not found' });
      return;
    }

    currentRoom = code;
    currentRole = 'admin';
    comp.hostSocketId = socket.id;

    socket.join(`room_${code}`);
    socket.join(`room_${code}_admin`);

    if (typeof callback === 'function') {
      callback({ success: true, roomCode: code, state: getSanitizedRoomState(comp) });
    }
    broadcastState(code);
  });

  // --- DISPLAY: Join Room for Projector / Big Screen ---
  socket.on('display:join-room', ({ roomCode }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const comp = competitions.get(code);

    if (!comp) {
      if (typeof callback === 'function') callback({ success: false, error: 'Competition room not found' });
      return;
    }

    currentRoom = code;
    currentRole = 'display';

    socket.join(`room_${code}`);
    socket.join(`room_${code}_display`);

    console.log(`[Display] Big Screen joined room: ${code}`);

    if (typeof callback === 'function') {
      callback({ success: true, state: getSanitizedRoomState(comp) });
    }
    broadcastState(code);
  });

  // --- PARTICIPANT: Join Competition ---
  socket.on('participant:join', ({ roomCode, name, teamName, avatar, participantId: existingId }, callback) => {
    const code = (roomCode || '').toUpperCase().trim();
    const comp = competitions.get(code);

    if (!comp) {
      if (typeof callback === 'function') callback({ success: false, error: 'Competition room not found' });
      return;
    }

    const pId = existingId || `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const cleanName = (name || 'Anonymous Creator').trim().slice(0, 30);
    const cleanTeam = (teamName || '').trim().slice(0, 30);

    // Save or update participant
    if (!comp.participants[pId]) {
      comp.participants[pId] = {
        id: pId,
        socketId: socket.id,
        name: cleanName,
        teamName: cleanTeam,
        avatar: avatar || '🤖',
        totalScore: 0,
        roundWins: 0,
        isReady: true,
        isConnected: true,
        joinedAt: new Date().toISOString()
      };
    } else {
      // Reconnection
      comp.participants[pId].socketId = socket.id;
      comp.participants[pId].isConnected = true;
      comp.participants[pId].name = cleanName;
      if (cleanTeam) comp.participants[pId].teamName = cleanTeam;
      if (avatar) comp.participants[pId].avatar = avatar;
    }

    currentRoom = code;
    currentRole = 'participant';
    participantId = pId;

    socket.join(`room_${code}`);
    socket.join(`room_${code}_participants`);

    console.log(`[Participant] ${cleanName} (${pId}) joined room ${code}`);

    if (typeof callback === 'function') {
      callback({
        success: true,
        participantId: pId,
        state: getSanitizedRoomState(comp, pId)
      });
    }

    // Emit event for live entrance fanfare on display/admin
    io.to(`room_${code}`).emit('participant-joined', {
      participant: comp.participants[pId],
      totalCount: Object.keys(comp.participants).length
    });

    broadcastState(code);
  });

  // --- PARTICIPANT: Submit Prompt ---
  socket.on('participant:submit-prompt', ({ promptText }, callback) => {
    if (!currentRoom || !participantId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not joined in any competition' });
      return;
    }

    const comp = competitions.get(currentRoom);
    if (!comp) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    // Validation: Status must be CHALLENGE
    if (comp.status !== 'CHALLENGE') {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Submissions are currently closed for this round.' });
      }
      return;
    }

    const text = (promptText || '').trim();
    if (!text) {
      if (typeof callback === 'function') callback({ success: false, error: 'Caption cannot be empty.' });
      return;
    }

    const participant = comp.participants[participantId];
    if (!participant) {
      if (typeof callback === 'function') callback({ success: false, error: 'Participant not recognized.' });
      return;
    }

    // Save or update submission
    comp.submissions[participantId] = {
      participantId: participantId,
      participantName: participant.name,
      teamName: participant.teamName,
      avatar: participant.avatar,
      promptText: text,
      roundNumber: comp.currentRound,
      submittedAt: new Date().toISOString(),
      voteCount: 0
    };

    console.log(`[Submission] ${participant.name} submitted caption for round ${comp.currentRound}`);

    if (typeof callback === 'function') {
      callback({ success: true, message: 'Caption submitted successfully!' });
    }

    // Notify room of submission progress
    io.to(`room_${currentRoom}`).emit('submission-received', {
      participantId,
      participantName: participant.name,
      totalSubmissions: Object.keys(comp.submissions).length,
      totalParticipants: Object.keys(comp.participants).length
    });

    broadcastState(currentRoom);
  });

  // --- PARTICIPANT: Cast Vote ---
  socket.on('participant:cast-vote', ({ submissionId }, callback) => {
    if (!currentRoom || !participantId) {
      if (typeof callback === 'function') callback({ success: false, error: 'Not joined in competition' });
      return;
    }

    const comp = competitions.get(currentRoom);
    if (!comp) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room not found' });
      return;
    }

    // Validation 1: Round must be in VOTING phase
    if (comp.status !== 'VOTING') {
      if (typeof callback === 'function') callback({ success: false, error: 'Voting is not active.' });
      return;
    }

    // Validation 2: Participant cannot vote for their own submission (ANTI-SELF-VOTING)
    if (submissionId === participantId) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Cheating Prevention: You cannot vote for your own caption!' });
      }
      return;
    }

    // Validation 3: Target submission must exist in current round
    if (!comp.submissions[submissionId]) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid submission selected.' });
      return;
    }

    // Validation 4: One vote per participant per round (ANTI-DUPLICATE-VOTING)
    const existingVoteIndex = comp.votes.findIndex(
      v => v.voterId === participantId && v.roundNumber === comp.currentRound
    );

    if (existingVoteIndex >= 0) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'You have already voted in this round.' });
      }
      return;
    }

    // Record vote
    comp.votes.push({
      voterId: participantId,
      submissionId: submissionId,
      roundNumber: comp.currentRound,
      timestamp: new Date().toISOString()
    });

    console.log(`[Vote] ${participantId} voted for ${submissionId} in round ${comp.currentRound}`);

    if (typeof callback === 'function') {
      callback({ success: true, message: 'Vote recorded!' });
    }

    io.to(`room_${currentRoom}`).emit('vote-cast', {
      voterId: participantId,
      totalVotes: comp.votes.filter(v => v.roundNumber === comp.currentRound).length
    });

    broadcastState(currentRoom);
  });

  // --- ADMIN CONTROLS ---

  // 1. START ROUND (Lobby / Next -> Challenge)
  socket.on('admin:start-round', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    // Select Challenge
    let selectedChallenge = null;
    if (data && data.challengeId) {
      selectedChallenge = comp.customChallenges.find(c => c.id === data.challengeId);
    } else if (data && data.customChallenge) {
      selectedChallenge = data.customChallenge;
    } else if (comp.customChallenges && comp.customChallenges.length > 0) {
      // Pick first unused or first available custom challenge
      const unused = comp.customChallenges.filter(c => !comp.usedChallengeIds.includes(c.id));
      selectedChallenge = unused.length > 0 ? unused[0] : comp.customChallenges[0];
    }

    if (!selectedChallenge) {
      console.log(`[Admin] Start round blocked in ${currentRoom}: No challenge image provided.`);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: 'No image provided! Please upload and select a challenge picture for this round first.'
        });
      }
      return;
    }

    stopTimer(comp);

    comp.currentRound += 1;
    comp.status = 'CHALLENGE';
    comp.submissions = {}; // Clear previous round submissions

    if (selectedChallenge.id) {
      comp.usedChallengeIds.push(selectedChallenge.id);
    }
    comp.currentChallenge = selectedChallenge;

    const duration = (data && parseInt(data.duration, 10)) || comp.roundDuration || 90;
    comp.roundDuration = duration;

    console.log(`[Admin] Round ${comp.currentRound} started in room ${currentRoom} (Duration: ${duration}s)`);

    // Broadcast round start event
    io.to(`room_${currentRoom}`).emit('round-started', {
      roundNumber: comp.currentRound,
      challenge: comp.currentChallenge,
      duration: duration
    });

    // Start countdown timer
    startTimer(currentRoom, duration, () => {
      // Auto-close submissions when timer expires
      if (comp.status === 'CHALLENGE') {
        comp.status = 'SUBMISSIONS_CLOSED';
        console.log(`[Timer] Auto-closing submissions for round ${comp.currentRound}`);
        io.to(`room_${currentRoom}`).emit('submissions-closed', { roundNumber: comp.currentRound });
        broadcastState(currentRoom);
      }
    });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 2. CLOSE SUBMISSIONS
  socket.on('admin:close-submissions', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'SUBMISSIONS_CLOSED';

    console.log(`[Admin] Submissions closed for round ${comp.currentRound}`);
    io.to(`room_${currentRoom}`).emit('submissions-closed', { roundNumber: comp.currentRound });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 3. START VOTING
  socket.on('admin:start-voting', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'VOTING';

    const votingDuration = (data && parseInt(data.duration, 10)) || 60; // 60 seconds default voting window

    console.log(`[Admin] Voting opened for round ${comp.currentRound} (${votingDuration}s)`);
    io.to(`room_${currentRoom}`).emit('voting-started', {
      roundNumber: comp.currentRound,
      duration: votingDuration,
      submissionsCount: Object.keys(comp.submissions).length
    });

    startTimer(currentRoom, votingDuration, () => {
      if (comp.status === 'VOTING') {
        comp.status = 'VOTING_CLOSED';
        console.log(`[Timer] Auto-closing voting for round ${comp.currentRound}`);
        calculateRoundResults(comp);
        io.to(`room_${currentRoom}`).emit('voting-closed', { roundNumber: comp.currentRound });
        broadcastState(currentRoom);
      }
    });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 4. END VOTING
  socket.on('admin:end-voting', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'VOTING_CLOSED';
    calculateRoundResults(comp);

    console.log(`[Admin] Voting ended manually for round ${comp.currentRound}`);
    io.to(`room_${currentRoom}`).emit('voting-closed', { roundNumber: comp.currentRound });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 5. SHOW WINNER
  socket.on('admin:show-winner', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'ROUND_WINNER';
    const roundSummary = calculateRoundResults(comp);

    console.log(`[Admin] Round ${comp.currentRound} winner revealed`);
    io.to(`room_${currentRoom}`).emit('round-winner-revealed', roundSummary);

    if (typeof callback === 'function') callback({ success: true, roundSummary, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 6. NEXT ROUND (Sets back to ready state, advances count)
  socket.on('admin:next-round', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'LOBBY';
    comp.currentChallenge = null;
    comp.submissions = {};

    console.log(`[Admin] Preparing for next round in room ${currentRoom}`);
    io.to(`room_${currentRoom}`).emit('next-round-ready', { currentRound: comp.currentRound });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 7. END COMPETITION (Grand Finale Leaderboard)
  socket.on('admin:end-competition', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'FINAL_LEADERBOARD';

    console.log(`[Admin] Competition ended in room ${currentRoom}`);
    io.to(`room_${currentRoom}`).emit('competition-ended', {
      leaderboard: getSanitizedRoomState(comp).leaderboard,
      roundHistory: comp.roundHistory
    });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 8. CANCEL ROUND
  socket.on('admin:cancel-round', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    stopTimer(comp);
    comp.status = 'CANCELLED';
    comp.submissions = {};

    console.log(`[Admin] Round ${comp.currentRound} cancelled`);
    io.to(`room_${currentRoom}`).emit('round-cancelled', { roundNumber: comp.currentRound });

    if (typeof callback === 'function') callback({ success: true, state: getSanitizedRoomState(comp) });
    broadcastState(currentRoom);
  });

  // 9. KICK PARTICIPANT
  socket.on('admin:kick-participant', ({ participantId: targetId }, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    const target = comp.participants[targetId];
    if (target) {
      if (target.socketId) {
        io.to(target.socketId).emit('kicked', { message: 'You were removed from the competition by the admin.' });
      }
      delete comp.participants[targetId];
      delete comp.submissions[targetId];
      // Clean up votes
      comp.votes = comp.votes.filter(v => v.voterId !== targetId && v.submissionId !== targetId);

      console.log(`[Admin] Kicked participant ${targetId} from ${currentRoom}`);
    }

    if (typeof callback === 'function') callback({ success: true });
    broadcastState(currentRoom);
  });

  // 10. ADD CUSTOM CHALLENGE (Admin upload/custom image)
  socket.on('admin:add-custom-challenge', (data, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    if (!data || !data.imageUrl) {
      if (typeof callback === 'function') callback({ success: false, error: 'Image URL or upload required' });
      return;
    }

    const newChal = {
      id: 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title: data.title || 'Custom Challenge',
      category: data.category || 'Custom Visual',
      difficulty: data.difficulty || 'Medium',
      hint: data.hint || 'Focus on style, lighting, and detail.',
      imageUrl: data.imageUrl,
      description: data.description || 'Write a caption for this image.',
      isCustom: true
    };

    comp.customChallenges.unshift(newChal);
    console.log(`[Admin] Added custom challenge: "${newChal.title}" in room ${currentRoom}`);

    if (typeof callback === 'function') {
      callback({ success: true, challenge: newChal, challenges: comp.customChallenges });
    }
    broadcastState(currentRoom);
  });

  // 11. DELETE CUSTOM CHALLENGE
  socket.on('admin:delete-custom-challenge', ({ challengeId }, callback) => {
    if (!currentRoom) return;
    const comp = competitions.get(currentRoom);
    if (!comp) return;

    comp.customChallenges = comp.customChallenges.filter(c => c.id !== challengeId);
    console.log(`[Admin] Deleted challenge: ${challengeId} in room ${currentRoom}`);

    if (typeof callback === 'function') {
      callback({ success: true, challenges: comp.customChallenges });
    }
    broadcastState(currentRoom);
  });

  // --- DISCONNECT HANDLER ---
  socket.on('disconnect', () => {
    if (currentRoom && participantId) {
      const comp = competitions.get(currentRoom);
      if (comp && comp.participants[participantId]) {
        comp.participants[participantId].isConnected = false;
        console.log(`[Disconnect] Participant ${participantId} disconnected`);
        broadcastState(currentRoom);
      }
    }
  });
});

// Start Server
const os = require('os');

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over internal (i.e. 127.0.0.1) and non‑IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIPv4();
  console.log('🚀 AI Prompt Battle Server');
  console.log('\nLocal:');
  console.log(`  Participant: http://localhost:${PORT}/`);
  console.log(`  Admin:       http://localhost:${PORT}/admin`);
  console.log(`  Display:     http://localhost:${PORT}/display`);
  console.log('\nNetwork:');
  console.log(`  Participant: http://${localIP}:${PORT}/`);
  console.log(`  Admin:       http://${localIP}:${PORT}/admin`);
  console.log(`  Display:     http://${localIP}:${PORT}/display`);
  console.log('\n📱 Devices on the same Wi‑Fi can access the Network URLs.');
});
