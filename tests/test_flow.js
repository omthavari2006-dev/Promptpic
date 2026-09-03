/**
 * Automated End-to-End Test Suite for AI Prompt Battle Platform
 */

const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 Starting AI Prompt Battle automated test suite...\n');

  // 1. Connect Admin Client
  const adminSocket = io(SERVER_URL);
  await new Promise(resolve => adminSocket.on('connect', resolve));
  console.log('✅ 1. Admin socket connected');

  // 2. Create Competition
  let roomCode = null;
  await new Promise(resolve => {
    adminSocket.emit('admin:create-competition', { title: 'Hackathon AI Prompt Arena', roundDuration: 60 }, (res) => {
      assert.strictEqual(res.success, true);
      assert.ok(res.roomCode);
      roomCode = res.roomCode;
      console.log(`✅ 2. Admin created room: ${roomCode}`);
      resolve();
    });
  });

  // 3. Connect 3 Participants (Alice, Bob, Charlie)
  const aliceSocket = io(SERVER_URL);
  const bobSocket = io(SERVER_URL);
  const charlieSocket = io(SERVER_URL);

  await Promise.all([
    new Promise(r => aliceSocket.on('connect', r)),
    new Promise(r => bobSocket.on('connect', r)),
    new Promise(r => charlieSocket.on('connect', r))
  ]);

  let aliceId, bobId, charlieId;

  await new Promise(resolve => {
    aliceSocket.emit('participant:join', { roomCode, name: 'Alice Cyber', teamName: 'Alpha', avatar: '🧙‍♂️' }, (res) => {
      assert.strictEqual(res.success, true);
      aliceId = res.participantId;
      resolve();
    });
  });

  await new Promise(resolve => {
    bobSocket.emit('participant:join', { roomCode, name: 'Bob Synth', teamName: 'Beta', avatar: '🤖' }, (res) => {
      assert.strictEqual(res.success, true);
      bobId = res.participantId;
      resolve();
    });
  });

  await new Promise(resolve => {
    charlieSocket.emit('participant:join', { roomCode, name: 'Charlie Vox', teamName: 'Gamma', avatar: '🦊' }, (res) => {
      assert.strictEqual(res.success, true);
      charlieId = res.participantId;
      resolve();
    });
  });

  console.log(`✅ 3. Participants joined: Alice (${aliceId}), Bob (${bobId}), Charlie (${charlieId})`);

  // 3a. Verify that starting round WITHOUT any challenge image is rejected
  await new Promise(resolve => {
    adminSocket.emit('admin:start-round', {}, (res) => {
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('No image provided'));
      console.log('✅ 3a. Round start rejection without image verified');
      resolve();
    });
  });

  // 3b. Admin adds a custom challenge picture for Round 1
  let customChallengeId = null;
  await new Promise(resolve => {
    adminSocket.emit('admin:add-custom-challenge', {
      title: 'Admin Cyberpunk Android Warrior',
      category: 'Sci-Fi Character',
      difficulty: 'Hard',
      imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
      description: 'A futuristic android with glowing violet neon optic cables in rain.',
      hint: 'Include chrome plating and atmospheric fog.'
    }, (res) => {
      assert.strictEqual(res.success, true);
      assert.ok(res.challenge);
      customChallengeId = res.challenge.id;
      console.log(`✅ 3b. Admin added custom challenge picture: "${res.challenge.title}" (ID: ${customChallengeId})`);
      resolve();
    });
  });

  // 4. Admin starts Round 1 with the Custom Challenge
  await new Promise(resolve => {
    adminSocket.emit('admin:start-round', { challengeId: customChallengeId, duration: 30 }, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state.status, 'CHALLENGE');
      assert.strictEqual(res.state.currentRound, 1);
      assert.strictEqual(res.state.currentChallenge.id, customChallengeId);
      console.log(`✅ 4. Admin started Round 1 with Admin-Provided Challenge: "${res.state.currentChallenge.title}"`);
      resolve();
    });
  });

  await sleep(100);

  // 5. Participants submit prompts
  const alicePrompt = 'Cinematic 8k photograph of a futuristic neon city drenched in rain with towering holographic skyscrapers and flying spinners, octane render.';
  const bobPrompt = 'Retro 1980s synthwave moonbase with geodesic domes and neon laser grids under starry nebula.';

  await new Promise(resolve => {
    aliceSocket.emit('participant:submit-prompt', { promptText: alicePrompt }, (res) => {
      assert.strictEqual(res.success, true);
      console.log('✅ 5a. Alice submitted prompt');
      resolve();
    });
  });

  await new Promise(resolve => {
    bobSocket.emit('participant:submit-prompt', { promptText: bobPrompt }, (res) => {
      assert.strictEqual(res.success, true);
      console.log('✅ 5b. Bob submitted prompt');
      resolve();
    });
  });

  // 6. Admin closes submissions and starts peer voting
  await new Promise(resolve => {
    adminSocket.emit('admin:close-submissions', {}, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state.status, 'SUBMISSIONS_CLOSED');
      console.log('✅ 6a. Submissions closed');
      resolve();
    });
  });

  await new Promise(resolve => {
    adminSocket.emit('admin:start-voting', { duration: 30 }, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state.status, 'VOTING');
      console.log('✅ 6b. Peer voting opened');
      resolve();
    });
  });

  // 7. Test Anti-Cheating & Voting Rules
  // Rule 7a: Alice attempts to vote for herself -> MUST BE REJECTED
  await new Promise(resolve => {
    aliceSocket.emit('participant:cast-vote', { submissionId: aliceId }, (res) => {
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('cannot vote for your own'));
      console.log('✅ 7a. Self-voting prevention verified (Alice rejected from voting for Alice)');
      resolve();
    });
  });

  // Rule 7b: Charlie votes for Alice -> VALID
  await new Promise(resolve => {
    charlieSocket.emit('participant:cast-vote', { submissionId: aliceId }, (res) => {
      assert.strictEqual(res.success, true);
      console.log('✅ 7b. Valid vote cast (Charlie -> Alice)');
      resolve();
    });
  });

  // Rule 7c: Charlie attempts to vote a second time -> MUST BE REJECTED
  await new Promise(resolve => {
    charlieSocket.emit('participant:cast-vote', { submissionId: bobId }, (res) => {
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('already voted'));
      console.log('✅ 7c. Duplicate voting prevention verified (Charlie rejected from second vote)');
      resolve();
    });
  });

  // Rule 7d: Bob votes for Alice -> VALID
  await new Promise(resolve => {
    bobSocket.emit('participant:cast-vote', { submissionId: aliceId }, (res) => {
      assert.strictEqual(res.success, true);
      console.log('✅ 7d. Valid vote cast (Bob -> Alice)');
      resolve();
    });
  });

  // 8. Admin ends voting & reveals Round 1 winner
  await new Promise(resolve => {
    adminSocket.emit('admin:show-winner', {}, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.roundSummary.roundNumber, 1);
      assert.strictEqual(res.roundSummary.highestVotes, 2);
      assert.strictEqual(res.roundSummary.winners[0].participantId, aliceId);
      console.log(`✅ 8. Round 1 Winner verified: ${res.roundSummary.winners[0].participantName} with ${res.roundSummary.highestVotes} votes!`);
      resolve();
    });
  });

  // 9. Verify Leaderboard update
  await new Promise(resolve => {
    adminSocket.emit('admin:end-competition', {}, (res) => {
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state.status, 'FINAL_LEADERBOARD');
      const top1 = res.state.leaderboard[0];
      assert.strictEqual(top1.id, aliceId);
      assert.strictEqual(top1.totalScore, 2);
      assert.strictEqual(top1.roundWins, 1);
      console.log(`✅ 9. Grand Finale Leaderboard verified: Champion is ${top1.name} (Score: ${top1.totalScore}, Wins: ${top1.roundWins})`);
      resolve();
    });
  });

  // Clean up
  adminSocket.disconnect();
  aliceSocket.disconnect();
  bobSocket.disconnect();
  charlieSocket.disconnect();

  console.log('\n🎉 ALL 9 TEST SUITES PASSED FLAWLESSLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
