/**
 * Live Projector Display Controller
 * Manages big screen presentations, animations, countdown timers, sound effects, and celebratory reveals
 */

(function () {
  const socket = io();

  let currentRoom = null;
  let currentState = null;

  // Header Elements
  const displayEventTitle = document.getElementById('display-event-title');
  const displayRoundPill = document.getElementById('display-round-pill');
  const displayStatusDot = document.getElementById('display-status-dot');
  const displayStatusLabel = document.getElementById('display-status-label');

  // Stages
  const dispViewRoomSelect = document.getElementById('disp-view-room-select');
  const dispViewLobby = document.getElementById('disp-view-lobby');
  const dispViewChallenge = document.getElementById('disp-view-challenge');
  const dispViewVoting = document.getElementById('disp-view-voting');
  const dispViewWinner = document.getElementById('disp-view-winner');
  const dispViewLeaderboard = document.getElementById('disp-view-leaderboard');

  // Connect Form
  const formDisplayRoom = document.getElementById('form-display-room');
  const inputDisplayPin = document.getElementById('input-display-pin');

  // Lobby Stage Elements
  const dispQrImg = document.getElementById('disp-qr-img');
  const dispPinText = document.getElementById('disp-pin-text');
  const dispLobbyCount = document.getElementById('disp-lobby-count');
  const dispLobbyAvatarStream = document.getElementById('disp-lobby-avatar-stream');

  // Challenge Stage Elements
  const dispChalTitle = document.getElementById('disp-chal-title');
  const dispChalImg = document.getElementById('disp-chal-img');
  const dispChalCategory = document.getElementById('disp-chal-category');
  const dispChalDesc = document.getElementById('disp-chal-desc');
  const dispSubmissionTally = document.getElementById('disp-submission-tally');
  const dispTimerClock = document.getElementById('disp-timer-clock');
  const dispTimerBox = document.getElementById('disp-timer-box');

  // Voting Stage Elements
  const dispVoteTally = document.getElementById('disp-vote-tally');
  const dispVotingTimerClock = document.getElementById('disp-voting-timer-clock');
  const dispVotingGrid = document.getElementById('disp-voting-grid');

  // Winner Stage Elements
  const dispWinnerRoundBadge = document.getElementById('disp-winner-round-badge');
  const dispWinnerTitle = document.getElementById('disp-winner-title');
  const dispWinnerVotes = document.getElementById('disp-winner-votes');
  const dispWinnerPromptText = document.getElementById('disp-winner-prompt-text');

  // Leaderboard Stage Elements
  const dispPodiumContainer = document.getElementById('disp-podium-container');
  const dispLeaderboardTable = document.getElementById('disp-leaderboard-table');

  function switchStage(stageEl) {
    [dispViewRoomSelect, dispViewLobby, dispViewChallenge, dispViewVoting, dispViewWinner, dispViewLeaderboard].forEach(s => {
      if (s) s.style.display = 'none';
    });
    if (stageEl) {
      stageEl.style.display = 'block';
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, parseInt(seconds, 10) || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Check URL params for room code
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam && inputDisplayPin) {
    inputDisplayPin.value = roomParam.toUpperCase();
  }

  // Connect to room form submit
  if (formDisplayRoom) {
    formDisplayRoom.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = inputDisplayPin.value.toUpperCase().trim();
      if (!code) return;

      if (window.soundEngine) window.soundEngine.init();

      joinDisplayRoom(code);
    });
  }

  function joinDisplayRoom(code) {
    socket.emit('display:join-room', { roomCode: code }, (res) => {
      if (!res || !res.success) {
        alert(res ? res.error : 'Room not found');
        return;
      }

      currentRoom = code;
      localStorage.setItem('prompt_display_room', code);

      fetchQrCode(code);
      renderDisplayState(res.state);
    });
  }

  async function fetchQrCode(code) {
    try {
      const res = await fetch(`/api/qrcode/${code}`);
      const data = await res.json();
      if (data.success && data.qrDataUrl) {
        if (dispQrImg) dispQrImg.src = data.qrDataUrl;
        if (dispPinText) dispPinText.textContent = code;
      }
    } catch (e) {
      console.warn('Could not fetch QR code:', e);
    }
  }

  // Render Display State Machine
  function renderDisplayState(state) {
    if (!state) return;
    currentState = state;

    if (displayEventTitle) displayEventTitle.textContent = state.title || 'AI PROMPT BATTLE';
    if (displayRoundPill) displayRoundPill.textContent = `ROUND ${state.currentRound || 0}`;
    if (displayStatusLabel) displayStatusLabel.textContent = state.status;

    switch (state.status) {
      case 'LOBBY':
        renderLobbyStage(state);
        break;

      case 'CHALLENGE':
        renderChallengeStage(state);
        break;

      case 'SUBMISSIONS_CLOSED':
        renderSubmissionsClosedStage(state);
        break;

      case 'VOTING':
        renderVotingStage(state);
        break;

      case 'VOTING_CLOSED':
        renderVotingClosedStage(state);
        break;

      case 'ROUND_WINNER':
        renderWinnerStage(state);
        break;

      case 'FINAL_LEADERBOARD':
        renderLeaderboardStage(state);
        break;

      default:
        renderLobbyStage(state);
    }
  }

  function renderLobbyStage(state) {
    switchStage(dispViewLobby);

    if (dispLobbyCount) dispLobbyCount.textContent = state.participantCount || 0;
    if (dispPinText) dispPinText.textContent = state.roomCode;

    if (dispLobbyAvatarStream) {
      dispLobbyAvatarStream.innerHTML = '';
      (state.participants || []).forEach(p => {
        const bubble = document.createElement('div');
        bubble.className = 'avatar-bubble';
        bubble.innerHTML = `<span>${p.avatar || '🤖'}</span> <span>${p.name}</span>`;
        dispLobbyAvatarStream.appendChild(bubble);
      });
    }
  }

  function renderChallengeStage(state) {
    switchStage(dispViewChallenge);

    const c = state.currentChallenge;
    if (c) {
      if (dispChalTitle) dispChalTitle.textContent = c.title;
      if (dispChalImg) dispChalImg.src = c.imageUrl;
      if (dispChalCategory) dispChalCategory.textContent = c.category || 'Prompt Target';
      if (dispChalDesc) dispChalDesc.textContent = c.description || 'Describe the visual composition, subject, and style.';
    }

    if (dispSubmissionTally) {
      dispSubmissionTally.textContent = `${state.submissionsCount || 0} / ${state.participantCount || 0}`;
    }
  }

  function renderSubmissionsClosedStage(state) {
    switchStage(dispViewChallenge);
    if (dispSubmissionTally) {
      dispSubmissionTally.textContent = `Locked (${state.submissionsCount || 0} / ${state.participantCount || 0})`;
    }
  }

  function renderVotingStage(state) {
    switchStage(dispViewVoting);

    if (dispVoteTally) {
      dispVoteTally.textContent = `${state.votesCount || 0} / ${state.participantCount || 0}`;
    }

    if (dispVotingGrid) {
      dispVotingGrid.innerHTML = '';
      (state.submissions || []).forEach(sub => {
        const card = document.createElement('div');
        card.className = 'submission-card';
        card.innerHTML = `
          <div class="submission-header">
            <div class="author-meta">
              <div class="author-avatar">${sub.avatar || '🤖'}</div>
              <div>
                <div class="author-name" style="font-size: 1.15rem;">${sub.participantName}</div>
                ${sub.teamName ? `<div class="author-team">${sub.teamName}</div>` : ''}
              </div>
            </div>
          </div>
          
          <div class="prompt-content-box" style="font-size: 1.05rem; min-height: 100px;">
            "${escapeHtml(sub.promptText)}"
          </div>

          <div class="vote-action-footer">
            <div class="vote-live-count" style="font-size: 1.2rem;">
              <span>🗳️</span>
              <span>Vote on your phone</span>
            </div>
          </div>
        `;
        dispVotingGrid.appendChild(card);
      });
    }
  }

  function renderVotingClosedStage(state) {
    switchStage(dispViewVoting);
    if (dispVoteTally) {
      dispVoteTally.textContent = `Completed (${state.votesCount || 0} / ${state.participantCount || 0})`;
    }
  }

  function renderWinnerStage(state) {
    switchStage(dispViewWinner);

    if (window.confettiEngine) window.confettiEngine.burst(150);
    if (window.soundEngine) window.soundEngine.playFanfare();

    const winnerSummary = state.lastRoundWinner;
    if (winnerSummary && winnerSummary.winners && winnerSummary.winners.length > 0) {
      const topWinner = winnerSummary.winners[0];
      if (dispWinnerRoundBadge) dispWinnerRoundBadge.textContent = `ROUND ${winnerSummary.roundNumber} CHAMPION`;
      if (dispWinnerTitle) dispWinnerTitle.textContent = `${topWinner.avatar || '👑'} ${topWinner.participantName}`;
      if (dispWinnerVotes) dispWinnerVotes.textContent = `${topWinner.voteCount}`;
      if (dispWinnerPromptText) dispWinnerPromptText.textContent = `"${topWinner.promptText}"`;
    }
  }

  function renderLeaderboardStage(state) {
    switchStage(dispViewLeaderboard);

    if (window.confettiEngine) window.confettiEngine.burst(200);
    if (window.soundEngine) window.soundEngine.playFanfare();

    const leaderboard = state.leaderboard || [];

    // Grand Podium
    if (dispPodiumContainer) {
      dispPodiumContainer.innerHTML = '';
      const top1 = leaderboard[0];
      const top2 = leaderboard[1];
      const top3 = leaderboard[2];

      if (top2) {
        dispPodiumContainer.innerHTML += `
          <div class="podium-column podium-second">
            <div class="podium-card" style="height: 260px;">
              <div class="podium-medal" style="font-size: 3rem;">🥈</div>
              <div class="podium-avatar" style="font-size: 3.5rem;">${top2.avatar || '🤖'}</div>
              <div class="podium-name" style="font-size: 1.5rem;">${top2.name}</div>
              <div class="podium-score" style="font-size: 1.3rem;">${top2.totalScore} pts (${top2.roundWins || 0} wins)</div>
            </div>
          </div>
        `;
      }

      if (top1) {
        dispPodiumContainer.innerHTML += `
          <div class="podium-column podium-first">
            <div class="podium-card" style="height: 330px;">
              <div class="podium-medal" style="font-size: 3.5rem;">🥇</div>
              <div class="podium-avatar" style="font-size: 4rem;">${top1.avatar || '👑'}</div>
              <div class="podium-name" style="font-size: 1.8rem; font-weight: 900;">${top1.name}</div>
              <div class="podium-score" style="font-size: 1.5rem; color: #ffd700;">${top1.totalScore} pts (${top1.roundWins || 0} wins)</div>
            </div>
          </div>
        `;
      }

      if (top3) {
        dispPodiumContainer.innerHTML += `
          <div class="podium-column podium-third">
            <div class="podium-card" style="height: 210px;">
              <div class="podium-medal" style="font-size: 2.5rem;">🥉</div>
              <div class="podium-avatar" style="font-size: 3rem;">${top3.avatar || '🤖'}</div>
              <div class="podium-name" style="font-size: 1.3rem;">${top3.name}</div>
              <div class="podium-score" style="font-size: 1.2rem;">${top3.totalScore} pts (${top3.roundWins || 0} wins)</div>
            </div>
          </div>
        `;
      }
    }

    // Full Leaderboard Table
    if (dispLeaderboardTable) {
      dispLeaderboardTable.innerHTML = `
        <div class="leaderboard-row header" style="font-size: 1rem; padding: 1.2rem 2rem;">
          <div>RANK</div>
          <div>AVATAR</div>
          <div>PARTICIPANT</div>
          <div>ROUNDS WON</div>
          <div style="text-align: right;">TOTAL VOTES</div>
        </div>
      `;

      leaderboard.forEach((p, idx) => {
        const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        const rankMedal = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`;

        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.style.padding = '1.2rem 2rem';
        row.style.fontSize = '1.2rem';
        row.innerHTML = `
          <div class="rank-badge ${rankClass}" style="font-size: 1.3rem;">${rankMedal}</div>
          <div style="font-size: 2rem;">${p.avatar || '🤖'}</div>
          <div>
            <div style="font-weight: 800;">${p.name}</div>
            ${p.teamName ? `<div style="font-size: 0.9rem; color: var(--text-secondary);">${p.teamName}</div>` : ''}
          </div>
          <div style="font-family: var(--font-mono); color: var(--accent-amber); font-weight: 700;">${p.roundWins || 0} 🏆</div>
          <div style="font-family: var(--font-mono); font-weight: 900; font-size: 1.4rem; color: var(--accent-cyan); text-align: right;">${p.totalScore}</div>
        `;
        dispLeaderboardTable.appendChild(row);
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Socket Events
  socket.on('competition-state', (state) => {
    renderDisplayState(state);
  });

  socket.on('timer-tick', ({ remaining }) => {
    const formatted = formatTime(remaining);
    if (dispTimerClock) dispTimerClock.textContent = formatted;
    if (dispVotingTimerClock) dispVotingTimerClock.textContent = formatted;

    if (remaining <= 10 && remaining > 0) {
      if (dispTimerBox) dispTimerBox.classList.add('urgent');
      if (window.soundEngine) window.soundEngine.playUrgentTick();
    } else {
      if (dispTimerBox) dispTimerBox.classList.remove('urgent');
    }

    if (remaining === 0) {
      if (window.soundEngine) window.soundEngine.playBuzzer();
    }
  });

  socket.on('participant-joined', ({ participant }) => {
    if (currentState && currentState.status === 'LOBBY') {
      if (dispLobbyAvatarStream) {
        const bubble = document.createElement('div');
        bubble.className = 'avatar-bubble';
        bubble.innerHTML = `<span>${participant.avatar || '🤖'}</span> <span>${participant.name}</span>`;
        dispLobbyAvatarStream.appendChild(bubble);
      }
      if (dispLobbyCount) {
        dispLobbyCount.textContent = (parseInt(dispLobbyCount.textContent, 10) || 0) + 1;
      }
    }
  });

  socket.on('submission-received', ({ totalSubmissions, totalParticipants }) => {
    if (dispSubmissionTally) {
      dispSubmissionTally.textContent = `${totalSubmissions} / ${totalParticipants}`;
    }
  });

  socket.on('vote-cast', ({ totalVotes }) => {
    if (dispVoteTally && currentState) {
      dispVoteTally.textContent = `${totalVotes} / ${currentState.participantCount || 0}`;
    }
  });

  // Auto connect if room in URL or localStorage
  socket.on('connect', () => {
    const savedRoom = roomParam || localStorage.getItem('prompt_display_room');
    if (savedRoom) {
      joinDisplayRoom(savedRoom.toUpperCase());
    }
  });

})();
