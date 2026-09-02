/**
 * Participant Client Controller
 * Manages participant joining, state transitions, prompt submission, peer voting, and sound effects.
 */

(function () {
  const socket = io();

  // State
  let currentRoom = null;
  let participantId = localStorage.getItem('prompt_participant_id') || null;
  let selectedAvatar = '🤖';
  let mySubmittedPrompt = '';
  let currentState = null;

  // DOM Elements
  const headerStatusDot = document.getElementById('header-status-dot');
  const headerStatusText = document.getElementById('header-status-text');

  // Views
  const viewJoin = document.getElementById('view-join');
  const viewLobby = document.getElementById('view-lobby');
  const viewChallenge = document.getElementById('view-challenge');
  const viewVoting = document.getElementById('view-voting');
  const viewWinner = document.getElementById('view-winner');
  const viewLeaderboard = document.getElementById('view-leaderboard');

  // Join Form Elements
  const formJoin = document.getElementById('form-join');
  const inputRoomCode = document.getElementById('input-room-code');
  const inputName = document.getElementById('input-name');
  const inputTeam = document.getElementById('input-team');
  const avatarPicker = document.getElementById('avatar-picker');

  // Challenge Form Elements
  const challengeRoundBadge = document.getElementById('challenge-round-badge');
  const challengeTimerDisplay = document.getElementById('challenge-timer-display');
  const challengeTimerBox = document.getElementById('challenge-timer-box');
  const challengeImage = document.getElementById('challenge-image');
  const challengeCategory = document.getElementById('challenge-category');
  const challengeDifficulty = document.getElementById('challenge-difficulty');
  const challengeTitle = document.getElementById('challenge-title');
  const challengeDesc = document.getElementById('challenge-desc');
  const challengeHint = document.getElementById('challenge-hint');
  const formSubmitPrompt = document.getElementById('form-submit-prompt');
  const textareaPrompt = document.getElementById('textarea-prompt');
  const promptCounter = document.getElementById('prompt-counter');
  const btnSubmitPrompt = document.getElementById('btn-submit-prompt');
  const submissionStatusFeedback = document.getElementById('submission-status-feedback');

  // Voting Elements
  const votingRoundBadge = document.getElementById('voting-round-badge');
  const votingTimerDisplay = document.getElementById('voting-timer-display');
  const votingTimerBox = document.getElementById('voting-timer-box');
  const votingSubmissionsContainer = document.getElementById('voting-submissions-container');

  // Winner Elements
  const winnerRoundBadge = document.getElementById('winner-round-badge');
  const winnerNameDisplay = document.getElementById('winner-name-display');
  const winnerVoteCount = document.getElementById('winner-vote-count');
  const winnerPromptText = document.getElementById('winner-prompt-text');
  const roundStandingsList = document.getElementById('round-standings-list');

  // Toast Helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span style="font-size: 0.9rem; font-weight: 500;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // View Switcher Helper
  function switchView(viewElement) {
    [viewJoin, viewLobby, viewChallenge, viewVoting, viewWinner, viewLeaderboard].forEach(v => {
      if (v) v.style.display = 'none';
    });
    if (viewElement) {
      viewElement.style.display = 'block';
    }
  }

  // Parse Query Parameters (e.g. ?room=ABCD)
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam && inputRoomCode) {
    inputRoomCode.value = roomParam.toUpperCase();
  }

  // Pre-fill Name if previously stored
  const savedName = localStorage.getItem('prompt_participant_name');
  if (savedName && inputName) inputName.value = savedName;

  const savedTeam = localStorage.getItem('prompt_participant_team');
  if (savedTeam && inputTeam) inputTeam.value = savedTeam;

  // Avatar Selection
  if (avatarPicker) {
    avatarPicker.querySelectorAll('.avatar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        avatarPicker.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedAvatar = opt.getAttribute('data-avatar');
      });
    });
  }

  // Textarea Word & Character Counter
  if (textareaPrompt) {
    textareaPrompt.addEventListener('input', () => {
      const text = textareaPrompt.value.trim();
      const words = text.length > 0 ? text.split(/\s+/).length : 0;
      const chars = textareaPrompt.value.length;
      promptCounter.textContent = `${words} words | ${chars} / 600 chars`;
    });
  }

  // Format Time helper (mm:ss)
  function formatTime(seconds) {
    const s = Math.max(0, parseInt(seconds, 10) || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Join Form Submit Handler
  if (formJoin) {
    formJoin.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = inputRoomCode.value.toUpperCase().trim();
      const name = inputName.value.trim();
      const team = inputTeam.value.trim();

      if (!code || !name) {
        showToast('Please fill in room code and your name', 'error');
        return;
      }

      localStorage.setItem('prompt_participant_name', name);
      localStorage.setItem('prompt_participant_team', team);

      // Trigger Web Audio resume on user gesture
      if (window.soundEngine) window.soundEngine.init();

      socket.emit('participant:join', {
        roomCode: code,
        name: name,
        teamName: team,
        avatar: selectedAvatar,
        participantId: participantId
      }, (res) => {
        if (!res || !res.success) {
          showToast(res ? res.error : 'Failed to connect to room', 'error');
          return;
        }

        currentRoom = code;
        participantId = res.participantId;
        localStorage.setItem('prompt_participant_id', participantId);
        localStorage.setItem('prompt_room_code', currentRoom);

        showToast(`Welcome to Arena, ${name}!`, 'success');
        renderState(res.state);
      });
    });
  }

  // Submit Prompt Handler
  if (formSubmitPrompt) {
    formSubmitPrompt.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = textareaPrompt.value.trim();

      if (!text) {
        showToast('Please enter your prompt formulation.', 'warning');
        return;
      }

      btnSubmitPrompt.disabled = true;
      btnSubmitPrompt.innerHTML = '<span>⏳ Submitting...</span>';

      socket.emit('participant:submit-prompt', { promptText: text }, (res) => {
        btnSubmitPrompt.disabled = false;
        btnSubmitPrompt.innerHTML = '<span>🚀 Update My Prompt</span>';

        if (!res || !res.success) {
          showToast(res ? res.error : 'Failed to submit prompt', 'error');
          return;
        }

        mySubmittedPrompt = text;
        if (window.soundEngine) window.soundEngine.playSubmit();
        showToast('Prompt successfully submitted!', 'success');
        if (submissionStatusFeedback) {
          submissionStatusFeedback.style.display = 'block';
        }
      });
    });
  }

  // Cast Vote Handler
  function castVote(submissionId) {
    if (!submissionId) return;

    if (submissionId === participantId) {
      showToast('You cannot vote for your own submission!', 'error');
      return;
    }

    if (window.soundEngine) window.soundEngine.playVote();

    socket.emit('participant:cast-vote', { submissionId }, (res) => {
      if (!res || !res.success) {
        showToast(res ? res.error : 'Failed to record vote', 'error');
        return;
      }

      showToast('Vote successfully cast!', 'success');
    });
  }

  // Render Full State Machine UI
  function renderState(state) {
    if (!state) return;
    currentState = state;

    // Update Header Status
    if (headerStatusDot && headerStatusText) {
      headerStatusDot.className = 'status-dot active';
      headerStatusText.textContent = `Room ${state.roomCode} • R${state.currentRound}`;
    }

    switch (state.status) {
      case 'LOBBY':
        renderLobby(state);
        break;

      case 'CHALLENGE':
        renderChallenge(state);
        break;

      case 'SUBMISSIONS_CLOSED':
        renderSubmissionsClosed(state);
        break;

      case 'VOTING':
        renderVoting(state);
        break;

      case 'VOTING_CLOSED':
        renderVotingClosed(state);
        break;

      case 'ROUND_WINNER':
        renderWinner(state);
        break;

      case 'FINAL_LEADERBOARD':
        renderLeaderboard(state);
        break;

      default:
        renderLobby(state);
    }
  }

  function renderLobby(state) {
    switchView(viewLobby);

    document.getElementById('lobby-room-badge').textContent = `ROOM: ${state.roomCode}`;
    document.getElementById('lobby-competition-title').textContent = state.title || 'AI Prompt Battle Arena';
    document.getElementById('lobby-participant-count').textContent = state.participantCount || 0;

    const listEl = document.getElementById('lobby-participants-list');
    listEl.innerHTML = '';
    (state.participants || []).forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'participant-pill';
      pill.innerHTML = `<span>${p.avatar || '🤖'}</span> <span>${p.name}</span>`;
      listEl.appendChild(pill);
    });
  }

  function renderChallenge(state) {
    switchView(viewChallenge);

    if (challengeRoundBadge) challengeRoundBadge.textContent = `ROUND ${state.currentRound}`;

    const challenge = state.currentChallenge;
    if (challenge) {
      if (challengeImage) challengeImage.src = challenge.imageUrl || '';
      if (challengeCategory) challengeCategory.textContent = challenge.category || 'Visual Prompt';
      if (challengeDifficulty) challengeDifficulty.textContent = challenge.difficulty || 'Normal';
      if (challengeTitle) challengeTitle.textContent = challenge.title || 'Recreate Reference Visual';
      if (challengeDesc) challengeDesc.textContent = challenge.description || 'Describe the visual elements.';
      if (challengeHint) challengeHint.textContent = challenge.hint || 'Focus on colors, composition, and mood.';
    }

    // Check if participant already has a submission
    const ownSubmission = (state.submissions || []).find(s => s.participantId === participantId);
    if (ownSubmission && textareaPrompt && !mySubmittedPrompt) {
      textareaPrompt.value = ownSubmission.promptText;
      mySubmittedPrompt = ownSubmission.promptText;
      if (submissionStatusFeedback) submissionStatusFeedback.style.display = 'block';
    }

    if (textareaPrompt) textareaPrompt.disabled = false;
    if (btnSubmitPrompt) btnSubmitPrompt.disabled = false;
  }

  function renderSubmissionsClosed(state) {
    switchView(viewChallenge);
    if (textareaPrompt) textareaPrompt.disabled = true;
    if (btnSubmitPrompt) {
      btnSubmitPrompt.disabled = true;
      btnSubmitPrompt.innerHTML = '<span>🔒 Submissions Closed</span>';
    }
    if (submissionStatusFeedback) {
      submissionStatusFeedback.innerHTML = '⏳ Submissions have closed! Preparing peer voting phase...';
      submissionStatusFeedback.style.display = 'block';
      submissionStatusFeedback.style.color = 'var(--accent-amber)';
    }
  }

  function renderVoting(state) {
    switchView(viewVoting);

    if (votingRoundBadge) votingRoundBadge.textContent = `ROUND ${state.currentRound} PEER VOTING`;

    votingSubmissionsContainer.innerHTML = '';

    const hasVoted = state.hasVotedInCurrentRound;
    const votedId = state.votedSubmissionId;

    (state.submissions || []).forEach(sub => {
      const card = document.createElement('div');
      const isOwn = sub.participantId === participantId;
      const isVotedForThis = votedId === sub.id;

      card.className = `submission-card ${isOwn ? 'is-own' : ''} ${isVotedForThis ? 'voted-for' : ''}`;

      let actionButtonHtml = '';
      if (isOwn) {
        actionButtonHtml = `<span class="badge badge-gold">Your Submission (Self-Vote Disabled)</span>`;
      } else if (hasVoted) {
        if (isVotedForThis) {
          actionButtonHtml = `<span class="badge badge-cyan" style="border-color: var(--accent-emerald); color: var(--accent-emerald);">✔ Your Vote</span>`;
        } else {
          actionButtonHtml = `<button class="btn btn-outline btn-sm" disabled>Vote</button>`;
        }
      } else {
        actionButtonHtml = `<button class="btn btn-cyan btn-sm btn-vote" data-id="${sub.id}">🗳️ Vote for Prompt</button>`;
      }

      card.innerHTML = `
        <div class="submission-header">
          <div class="author-meta">
            <div class="author-avatar">${sub.avatar || '🤖'}</div>
            <div>
              <div class="author-name">${sub.participantName}</div>
              ${sub.teamName ? `<div class="author-team">${sub.teamName}</div>` : ''}
            </div>
          </div>
          ${isOwn ? '<span class="badge badge-gold">You</span>' : ''}
        </div>
        
        <div class="prompt-content-box">
          "${escapeHtml(sub.promptText)}"
        </div>

        <div class="vote-action-footer">
          ${actionButtonHtml}
        </div>
      `;

      votingSubmissionsContainer.appendChild(card);
    });

    // Attach click handlers to vote buttons
    votingSubmissionsContainer.querySelectorAll('.btn-vote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subId = e.currentTarget.getAttribute('data-id');
        castVote(subId);
      });
    });
  }

  function renderVotingClosed(state) {
    switchView(viewVoting);
    const voteBtns = votingSubmissionsContainer.querySelectorAll('.btn-vote');
    voteBtns.forEach(btn => {
      btn.disabled = true;
      btn.textContent = 'Voting Closed';
    });
  }

  function renderWinner(state) {
    switchView(viewWinner);

    if (window.confettiEngine) window.confettiEngine.burst(80);
    if (window.soundEngine) window.soundEngine.playFanfare();

    const winnerSummary = state.lastRoundWinner;
    if (winnerSummary && winnerSummary.winners && winnerSummary.winners.length > 0) {
      const topWinner = winnerSummary.winners[0];
      if (winnerRoundBadge) winnerRoundBadge.textContent = `ROUND ${winnerSummary.roundNumber} CHAMPION`;
      if (winnerNameDisplay) winnerNameDisplay.textContent = `${topWinner.avatar || '🤖'} ${topWinner.participantName}`;
      if (winnerVoteCount) winnerVoteCount.textContent = `${topWinner.voteCount}`;
      if (winnerPromptText) winnerPromptText.textContent = `"${topWinner.promptText}"`;
    }

    // Render Round Standings List
    if (roundStandingsList && winnerSummary && winnerSummary.rankings) {
      roundStandingsList.innerHTML = '';
      winnerSummary.rankings.forEach((r, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '0.6rem 0';
        row.style.borderBottom = '1px solid var(--border-subtle)';

        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: ${idx === 0 ? '#ffd700' : 'var(--text-secondary)'};">#${r.rank}</span>
            <span>${r.avatar || '🤖'}</span>
            <span style="font-weight: 600;">${r.participantName}</span>
          </div>
          <div style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">
            ${r.voteCount} votes
          </div>
        `;
        roundStandingsList.appendChild(row);
      });
    }
  }

  function renderLeaderboard(state) {
    switchView(viewLeaderboard);

    if (window.confettiEngine) window.confettiEngine.burst(150);
    if (window.soundEngine) window.soundEngine.playFanfare();

    const leaderboard = state.leaderboard || [];
    const podiumEl = document.getElementById('leaderboard-podium');
    const tableEl = document.getElementById('leaderboard-full-table');

    // Podium Rendering
    if (podiumEl) {
      podiumEl.innerHTML = '';
      const top1 = leaderboard[0];
      const top2 = leaderboard[1];
      const top3 = leaderboard[2];

      if (top2) {
        podiumEl.innerHTML += `
          <div class="podium-column podium-second">
            <div class="podium-card">
              <div class="podium-medal">🥈</div>
              <div class="podium-avatar">${top2.avatar || '🤖'}</div>
              <div class="podium-name">${top2.name}</div>
              <div class="podium-score">${top2.totalScore} pts</div>
            </div>
          </div>
        `;
      }

      if (top1) {
        podiumEl.innerHTML += `
          <div class="podium-column podium-first">
            <div class="podium-card">
              <div class="podium-medal">🥇</div>
              <div class="podium-avatar">${top1.avatar || '👑'}</div>
              <div class="podium-name">${top1.name}</div>
              <div class="podium-score">${top1.totalScore} pts</div>
            </div>
          </div>
        `;
      }

      if (top3) {
        podiumEl.innerHTML += `
          <div class="podium-column podium-third">
            <div class="podium-card">
              <div class="podium-medal">🥉</div>
              <div class="podium-avatar">${top3.avatar || '🤖'}</div>
              <div class="podium-name">${top3.name}</div>
              <div class="podium-score">${top3.totalScore} pts</div>
            </div>
          </div>
        `;
      }
    }

    // Table Rendering
    if (tableEl) {
      tableEl.innerHTML = `
        <div class="leaderboard-row header">
          <div>RANK</div>
          <div>AVATAR</div>
          <div>PARTICIPANT</div>
          <div>ROUNDS WON</div>
          <div style="text-align: right;">TOTAL VOTES</div>
        </div>
      `;

      leaderboard.forEach((p, idx) => {
        const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
          <div class="rank-badge ${rankClass}">${rankMedal}</div>
          <div style="font-size: 1.4rem;">${p.avatar || '🤖'}</div>
          <div>
            <div style="font-weight: 700;">${p.name} ${p.id === participantId ? '<span class="badge badge-cyan" style="font-size: 0.65rem;">YOU</span>' : ''}</div>
            ${p.teamName ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${p.teamName}</div>` : ''}
          </div>
          <div style="font-family: var(--font-mono); color: var(--accent-amber); font-weight: 600;">${p.roundWins || 0} 🏆</div>
          <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.1rem; color: var(--accent-cyan); text-align: right;">${p.totalScore}</div>
        `;
        tableEl.appendChild(row);
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

  // Socket State Listeners
  socket.on('competition-state', (state) => {
    renderState(state);
  });

  socket.on('timer-tick', ({ remaining }) => {
    const formatted = formatTime(remaining);
    if (challengeTimerDisplay) challengeTimerDisplay.textContent = formatted;
    if (votingTimerDisplay) votingTimerDisplay.textContent = formatted;

    if (remaining <= 10 && remaining > 0) {
      if (challengeTimerBox) challengeTimerBox.classList.add('urgent');
      if (votingTimerBox) votingTimerBox.classList.add('urgent');
      if (window.soundEngine) window.soundEngine.playUrgentTick();
    } else {
      if (challengeTimerBox) challengeTimerBox.classList.remove('urgent');
      if (votingTimerBox) votingTimerBox.classList.remove('urgent');
    }

    if (remaining === 0) {
      if (window.soundEngine) window.soundEngine.playBuzzer();
    }
  });

  socket.on('submissions-closed', () => {
    showToast('Submissions closed! Preparing peer voting phase.', 'warning');
    if (window.soundEngine) window.soundEngine.playBuzzer();
  });

  socket.on('voting-started', () => {
    showToast('Peer voting is now live! Choose the best prompt.', 'info');
    if (window.soundEngine) window.soundEngine.playSubmit();
  });

  socket.on('voting-closed', () => {
    showToast('Voting ended! Tallying peer scores...', 'warning');
    if (window.soundEngine) window.soundEngine.playBuzzer();
  });

  socket.on('round-winner-revealed', (summary) => {
    if (window.confettiEngine) window.confettiEngine.burst(80);
    if (window.soundEngine) window.soundEngine.playFanfare();
  });

  socket.on('next-round-ready', () => {
    mySubmittedPrompt = '';
    if (textareaPrompt) textareaPrompt.value = '';
    if (submissionStatusFeedback) submissionStatusFeedback.style.display = 'none';
    showToast('Preparing for next round!', 'info');
  });

  socket.on('kicked', ({ message }) => {
    alert(message || 'You have been removed from the session.');
    window.location.reload();
  });

  // Re-authenticate / reconnect if participant had active session
  socket.on('connect', () => {
    if (headerStatusDot && headerStatusText) {
      headerStatusDot.className = 'status-dot';
      headerStatusText.textContent = 'Connected';
    }

    const savedRoom = localStorage.getItem('prompt_room_code');
    const savedId = localStorage.getItem('prompt_participant_id');
    const savedName = localStorage.getItem('prompt_participant_name');

    if (savedRoom && savedId && savedName) {
      socket.emit('participant:join', {
        roomCode: savedRoom,
        name: savedName,
        teamName: localStorage.getItem('prompt_participant_team') || '',
        avatar: selectedAvatar,
        participantId: savedId
      }, (res) => {
        if (res && res.success) {
          currentRoom = savedRoom;
          participantId = savedId;
          renderState(res.state);
        }
      });
    }
  });

  socket.on('disconnect', () => {
    if (headerStatusDot && headerStatusText) {
      headerStatusDot.className = 'status-dot waiting';
      headerStatusText.textContent = 'Reconnecting...';
    }
  });

})();
