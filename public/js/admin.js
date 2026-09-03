/**
 * Admin Dashboard Controller
 * Full lifecycle state machine management and Custom Challenge Image Uploader for AI Prompt Battle host
 */

(function () {
  const socket = io();

  let currentRoom = null;
  let currentState = null;
  let allChallenges = [];
  let customImageFile = null;
  let customImageUrl = '';
  let activeImageSource = 'file'; // 'file' | 'url'

  // DOM Elements
  const adminStatusDot = document.getElementById('admin-status-dot');
  const adminStatusText = document.getElementById('admin-status-text');
  const btnOpenProjector = document.getElementById('btn-open-projector');

  // Views
  const adminSetupView = document.getElementById('admin-setup-view');
  const adminDashboardView = document.getElementById('admin-dashboard-view');

  // Create Form
  const formCreateCompetition = document.getElementById('form-create-competition');
  const inputCompTitle = document.getElementById('input-competition-title');
  const selectRoundDuration = document.getElementById('select-round-duration');

  // Dashboard Header Elements
  const dashCompTitle = document.getElementById('dash-comp-title');
  const dashStatusBadge = document.getElementById('dash-status-badge');
  const dashRoomCode = document.getElementById('dash-room-code');
  const btnShowQr = document.getElementById('btn-show-qr');
  const btnCopyJoinLink = document.getElementById('btn-copy-join-link');

  // Stats
  const statParticipants = document.getElementById('stat-participants');
  const statRound = document.getElementById('stat-round');
  const statSubmissions = document.getElementById('stat-submissions');
  const statVotes = document.getElementById('stat-votes');
  const statTimer = document.getElementById('stat-timer');

  // Control Buttons
  const ctrlStartRound = document.getElementById('ctrl-start-round');
  const ctrlCloseSubmissions = document.getElementById('ctrl-close-submissions');
  const ctrlStartVoting = document.getElementById('ctrl-start-voting');
  const ctrlEndVoting = document.getElementById('ctrl-end-voting');
  const ctrlShowWinner = document.getElementById('ctrl-show-winner');
  const ctrlNextRound = document.getElementById('ctrl-next-round');
  const ctrlEndComp = document.getElementById('ctrl-end-comp');
  const ctrlCancelRound = document.getElementById('ctrl-cancel-round');

  // Challenge Selector & Preview
  const selectChallengePicker = document.getElementById('select-challenge-picker');
  const adminChallengeImg = document.getElementById('admin-challenge-img');
  const adminChallengeTitle = document.getElementById('admin-challenge-title');
  const adminChallengeDesc = document.getElementById('admin-challenge-desc');

  // Custom Challenge Uploader Elements
  const btnToggleUploadForm = document.getElementById('btn-toggle-upload-form');
  const toggleUploadText = document.getElementById('toggle-upload-text');
  const customUploadContainer = document.getElementById('custom-upload-container');
  const tabSrcFile = document.getElementById('tab-src-file');
  const tabSrcUrl = document.getElementById('tab-src-url');
  const boxUploadFile = document.getElementById('box-upload-file');
  const boxUploadUrl = document.getElementById('box-upload-url');
  const dropzoneArea = document.getElementById('dropzone-area');
  const inputChallengeFile = document.getElementById('input-challenge-file');
  const inputCustomUrl = document.getElementById('input-custom-url');
  const customImagePreviewWrapper = document.getElementById('custom-image-preview-wrapper');
  const customImagePreview = document.getElementById('custom-image-preview');
  const formAddChallenge = document.getElementById('form-add-challenge');
  const inputCustomTitle = document.getElementById('input-custom-title');
  const inputCustomCategory = document.getElementById('input-custom-category');
  const selectCustomDifficulty = document.getElementById('select-custom-difficulty');
  const inputCustomDesc = document.getElementById('input-custom-desc');
  const inputCustomHint = document.getElementById('input-custom-hint');
  const btnCancelCustomUpload = document.getElementById('btn-cancel-custom-upload');
  const btnSaveCustomChallenge = document.getElementById('btn-save-custom-challenge');
  const challengesPoolCount = document.getElementById('challenges-pool-count');
  const adminChallengesGallery = document.getElementById('admin-challenges-gallery');

  // Lists
  const adminParticipantsTotal = document.getElementById('admin-participants-total');
  const adminParticipantsList = document.getElementById('admin-participants-list');
  const adminSubmissionsFeed = document.getElementById('admin-submissions-feed');
  const adminLeaderboardTable = document.getElementById('admin-leaderboard-table');

  // QR Modal
  const qrModal = document.getElementById('qr-modal');
  const qrModalImage = document.getElementById('qr-modal-image');
  const qrModalPin = document.getElementById('qr-modal-pin');
  const btnCloseQrModal = document.getElementById('btn-close-qr-modal');

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

  function formatTime(seconds) {
    const s = Math.max(0, parseInt(seconds, 10) || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Load Challenges list from API or state
  async function loadChallenges() {
    try {
      const res = await fetch('/api/challenges');
      const data = await res.json();
      if (data.success && data.challenges) {
        allChallenges = data.challenges;
        renderChallengesPool();
      }
    } catch (e) {
      console.warn('Could not load challenge list:', e);
    }
  }

  function renderChallengesPool() {
    const adminChallengeWrapper = document.getElementById('admin-challenge-wrapper');
    const adminChallengeEmptyHint = document.getElementById('admin-challenge-empty-hint');

    // 1. Populate Dropdown
    if (selectChallengePicker) {
      const currentSelected = selectChallengePicker.value;
      selectChallengePicker.innerHTML = '';

      if (allChallenges.length === 0) {
        selectChallengePicker.innerHTML = '<option value="">-- No Images Uploaded Yet (Add Above) --</option>';
        if (adminChallengeImg) adminChallengeImg.style.display = 'none';
        if (adminChallengeEmptyHint) adminChallengeEmptyHint.style.display = 'block';
        if (adminChallengeTitle) adminChallengeTitle.textContent = 'Awaiting Challenge Image';
        if (adminChallengeDesc) adminChallengeDesc.textContent = 'Upload or link a picture above to begin the round.';
      } else {
        allChallenges.forEach((c, idx) => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `⭐ ${c.title} (${c.category || 'Custom'})`;
          selectChallengePicker.appendChild(opt);
        });

        // Retain or select first
        if (currentSelected && allChallenges.find(c => c.id === currentSelected)) {
          selectChallengePicker.value = currentSelected;
        } else if (allChallenges.length > 0) {
          selectChallengePicker.value = allChallenges[0].id;
        }
        updatePreviewWithChallenge(selectChallengePicker.value);
      }
    }

    if (challengesPoolCount) {
      challengesPoolCount.textContent = allChallenges.length;
    }

    // 2. Render Visual Gallery
    if (adminChallengesGallery) {
      adminChallengesGallery.innerHTML = '';

      if (allChallenges.length === 0) {
        adminChallengesGallery.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: rgba(0,0,0,0.25); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📷</div>
            <div style="font-weight: 700; color: #cbd5e1; margin-bottom: 0.25rem;">No Challenge Pictures Added Yet</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Upload an image file or paste a web URL in the form above to prepare your competition rounds.</div>
          </div>
        `;
        return;
      }

      allChallenges.forEach((c, idx) => {
        const card = document.createElement('div');
        card.className = `glass-card highlight-magenta`;
        card.style.padding = '0.9rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

        const isCurrentlySelected = selectChallengePicker && selectChallengePicker.value === c.id;

        card.innerHTML = `
          <div>
            <div style="position: relative; height: 130px; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 0.6rem; border: 1px solid var(--border-subtle);">
              <img src="${c.imageUrl}" alt="${c.title}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; top: 0.4rem; left: 0.4rem; display: flex; gap: 0.3rem;">
                <span class="badge badge-magenta" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">
                  ${c.category || 'Custom Picture'}
                </span>
                <span class="badge badge-gold" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">
                  ${c.difficulty || 'Medium'}
                </span>
              </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.title}">
              ⭐ ${c.title}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${c.description || 'Challenge prompt objective.'}
            </div>
          </div>

          <div style="display: flex; gap: 0.4rem; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
            <button type="button" class="btn ${isCurrentlySelected ? 'btn-emerald' : 'btn-outline-cyan'} btn-sm btn-pick-chal" data-id="${c.id}" style="flex: 1; font-size: 0.78rem; padding: 0.4rem 0.6rem;">
              <span>${isCurrentlySelected ? '✔ Active For Round' : '🎯 Pick For This Round'}</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-del-chal" data-id="${c.id}" title="Delete Picture" style="color: var(--accent-magenta); padding: 0.4rem 0.6rem;">
              🗑️
            </button>
          </div>
        `;

        adminChallengesGallery.appendChild(card);
      });

      // Attach pick handlers
      adminChallengesGallery.querySelectorAll('.btn-pick-chal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (selectChallengePicker) {
            selectChallengePicker.value = id;
            updatePreviewWithChallenge(id);
            renderChallengesPool();
            showToast('Image selected for upcoming round!', 'success');
          }
        });
      });

      // Attach delete handlers (Instant delete without confirmation alert)
      adminChallengesGallery.querySelectorAll('.btn-del-chal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (!id) return;
          socket.emit('admin:delete-custom-challenge', { challengeId: id }, (res) => {
            if (res && res.success) {
              allChallenges = res.challenges || [];
              renderChallengesPool();
              showToast('Challenge picture deleted', 'info');
            }
          });
        });
      });
    }
  }

  function updatePreviewWithChallenge(id) {
    const adminChallengeEmptyHint = document.getElementById('admin-challenge-empty-hint');
    if (!id) {
      if (adminChallengeImg) adminChallengeImg.style.display = 'none';
      if (adminChallengeEmptyHint) adminChallengeEmptyHint.style.display = 'block';
      if (adminChallengeTitle) adminChallengeTitle.textContent = 'Awaiting Challenge Image';
      if (adminChallengeDesc) adminChallengeDesc.textContent = 'Upload or select a picture above to begin the round.';
      return;
    }

    const found = allChallenges.find(c => c.id === id);
    if (found) {
      if (adminChallengeImg) {
        adminChallengeImg.src = found.imageUrl;
        adminChallengeImg.style.display = 'block';
      }
      if (adminChallengeEmptyHint) adminChallengeEmptyHint.style.display = 'none';
      if (adminChallengeTitle) adminChallengeTitle.textContent = `⭐ ${found.title}`;
      if (adminChallengeDesc) adminChallengeDesc.textContent = found.description || 'Describe the visual composition, subject, and style.';
    }
  }

  // Challenge Selector Dropdown Change Handler
  if (selectChallengePicker) {
    selectChallengePicker.addEventListener('change', () => {
      const val = selectChallengePicker.value;
      updatePreviewWithChallenge(val);
      renderChallengesPool();
    });
  }

  // --- CUSTOM IMAGE UPLOADER UI HANDLERS ---

  // 1. Toggle Form Visibility
  if (btnToggleUploadForm && customUploadContainer) {
    btnToggleUploadForm.addEventListener('click', () => {
      const isHidden = customUploadContainer.style.display === 'none';
      customUploadContainer.style.display = isHidden ? 'block' : 'none';
      toggleUploadText.textContent = isHidden ? '✖ Close Uploader' : '+ Add Custom Image Challenge';
    });
  }

  if (btnCancelCustomUpload && customUploadContainer) {
    btnCancelCustomUpload.addEventListener('click', () => {
      customUploadContainer.style.display = 'none';
      if (toggleUploadText) toggleUploadText.textContent = '+ Add Custom Image Challenge';
    });
  }

  // 2. Source Tabs (File Upload vs Web URL)
  if (tabSrcFile && tabSrcUrl) {
    tabSrcFile.addEventListener('click', () => {
      activeImageSource = 'file';
      tabSrcFile.className = 'btn btn-cyan btn-sm';
      tabSrcUrl.className = 'btn btn-outline btn-sm';
      boxUploadFile.style.display = 'block';
      boxUploadUrl.style.display = 'none';
    });

    tabSrcUrl.addEventListener('click', () => {
      activeImageSource = 'url';
      tabSrcUrl.className = 'btn btn-cyan btn-sm';
      tabSrcFile.className = 'btn btn-outline btn-sm';
      boxUploadFile.style.display = 'none';
      boxUploadUrl.style.display = 'block';
    });
  }

  // 3. Drag & Drop and File Selection Handlers
  if (dropzoneArea && inputChallengeFile) {
    dropzoneArea.addEventListener('click', () => {
      inputChallengeFile.click();
    });

    dropzoneArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneArea.style.borderColor = 'var(--accent-cyan)';
      dropzoneArea.style.background = 'rgba(0, 243, 255, 0.1)';
    });

    dropzoneArea.addEventListener('dragleave', () => {
      dropzoneArea.style.borderColor = 'var(--border-medium)';
      dropzoneArea.style.background = 'rgba(0, 243, 255, 0.03)';
    });

    dropzoneArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneArea.style.borderColor = 'var(--border-medium)';
      dropzoneArea.style.background = 'rgba(0, 243, 255, 0.03)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });

    inputChallengeFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleSelectedFile(e.target.files[0]);
      }
    });
  }

  /**
   * Fast Client-Side Image Compressor
   * Resizes large camera photos to max 1600px and compresses to JPEG format
   * Dramatically speeds up upload to stigz.xyz (<100ms)
   */
  async function compressImageFile(file, maxDimension = 1600, quality = 0.85) {
    if (!file || !file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;

        if (width <= maxDimension && height <= maxDimension && file.size < 400 * 1024) {
          resolve(file);
          return;
        }

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  async function handleSelectedFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WEBP)', 'error');
      return;
    }

    // Compress file in background for instant preview & ultra-fast upload
    const compressed = await compressImageFile(file, 1600, 0.85);
    customImageFile = compressed;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (customImagePreview) customImagePreview.src = e.target.result;
      if (customImagePreviewWrapper) customImagePreviewWrapper.style.display = 'block';
    };
    reader.readAsDataURL(compressed);

    // Auto fill title if empty
    if (inputCustomTitle && !inputCustomTitle.value) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      inputCustomTitle.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }
  }

  // 4. URL Live Preview
  if (inputCustomUrl) {
    inputCustomUrl.addEventListener('input', () => {
      const url = inputCustomUrl.value.trim();
      customImageUrl = url;
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        if (customImagePreview) customImagePreview.src = url;
        if (customImagePreviewWrapper) customImagePreviewWrapper.style.display = 'block';
      }
    });
  }

  // 5. Submit Custom Challenge Form
  if (formAddChallenge) {
    formAddChallenge.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = inputCustomTitle.value.trim();
      const category = inputCustomCategory.value.trim() || 'Custom Art';
      const difficulty = selectCustomDifficulty.value || 'Medium';
      const description = inputCustomDesc.value.trim() || 'Write a prompt to replicate this visual artwork.';
      const hint = inputCustomHint.value.trim() || 'Focus on style, lighting, and detail.';

      if (!title) {
        showToast('Challenge title is required', 'warning');
        return;
      }

      btnSaveCustomChallenge.disabled = true;
      btnSaveCustomChallenge.innerHTML = '<span>⏳ Uploading...</span>';

      try {
        let finalImageUrl = '';

        if (activeImageSource === 'file') {
          if (!customImageFile) {
            showToast('Please choose an image file to upload', 'warning');
            btnSaveCustomChallenge.disabled = false;
            btnSaveCustomChallenge.innerHTML = '<span>➕ Add to Challenge Library</span>';
            return;
          }

          // Ensure file is compressed before sending
          const uploadFile = await compressImageFile(customImageFile, 1600, 0.85);

          // Try server disk upload first
          try {
            const formData = new FormData();
            formData.append('image', uploadFile);

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            });

            if (uploadRes.ok) {
              const contentType = uploadRes.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const uploadData = await uploadRes.json();
                if (uploadData && uploadData.success && uploadData.imageUrl) {
                  finalImageUrl = uploadData.imageUrl;
                }
              }
            }
          } catch (uploadErr) {
            console.warn('Server upload endpoint error, using Base64 fallback:', uploadErr);
          }

          // Automatic fallback to client-side Data URL (Base64)
          if (!finalImageUrl) {
            finalImageUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error('Failed to read image file'));
              reader.readAsDataURL(customImageFile);
            });
          }
        } else {
          finalImageUrl = inputCustomUrl.value.trim();
          if (!finalImageUrl) {
            showToast('Please enter a valid image URL', 'warning');
            btnSaveCustomChallenge.disabled = false;
            btnSaveCustomChallenge.innerHTML = '<span>➕ Add to Challenge Library</span>';
            return;
          }
        }

        // Emit socket event to save into room challenge pool
        socket.emit('admin:add-custom-challenge', {
          title,
          category,
          difficulty,
          description,
          hint,
          imageUrl: finalImageUrl
        }, (res) => {
          btnSaveCustomChallenge.disabled = false;
          btnSaveCustomChallenge.innerHTML = '<span>➕ Add to Challenge Library</span>';

          if (!res || !res.success) {
            showToast(res ? res.error : 'Failed to add challenge', 'error');
            return;
          }

          allChallenges = res.challenges;
          renderChallengesPool();

          // Auto-select the newly added challenge for upcoming round
          if (selectChallengePicker && res.challenge) {
            selectChallengePicker.value = res.challenge.id;
            selectChallengePicker.dispatchEvent(new Event('change'));
          }

          // Reset Form
          formAddChallenge.reset();
          customImageFile = null;
          customImageUrl = '';
          if (customImagePreviewWrapper) customImagePreviewWrapper.style.display = 'none';
          if (customUploadContainer) customUploadContainer.style.display = 'none';
          if (toggleUploadText) toggleUploadText.textContent = '+ Add Custom Image Challenge';

          showToast(`"${title}" added to Challenge Pool & selected for Next Round!`, 'success');
        });

      } catch (err) {
        console.error('Error adding challenge:', err);
        btnSaveCustomChallenge.disabled = false;
        btnSaveCustomChallenge.innerHTML = '<span>➕ Add to Challenge Library</span>';
        showToast(err.message || 'Failed to process image upload', 'error');
      }
    });
  }

  // --- CREATE COMPETITION FORM ---
  if (formCreateCompetition) {
    formCreateCompetition.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = inputCompTitle.value.trim() || 'AI Prompt Battle Arena';
      const roundDuration = parseInt(selectRoundDuration.value, 10) || 90;

      if (window.soundEngine) window.soundEngine.init();

      socket.emit('admin:create-competition', { title, roundDuration }, (res) => {
        if (!res || !res.success) {
          showToast('Failed to create competition', 'error');
          return;
        }

        currentRoom = res.roomCode;
        localStorage.setItem('prompt_admin_room', currentRoom);

        showToast(`Competition Created! PIN: ${currentRoom}`, 'success');
        showDashboard(res.state);
      });
    });
  }

  function showDashboard(state) {
    if (adminSetupView) adminSetupView.style.display = 'none';
    if (adminDashboardView) adminDashboardView.style.display = 'block';
    if (btnOpenProjector) {
      btnOpenProjector.style.display = 'inline-flex';
      btnOpenProjector.href = `/display?room=${state.roomCode}`;
    }
    renderAdminState(state);
  }

  // Admin Button State Transitions
  function updateActionButtons(status) {
    [ctrlStartRound, ctrlCloseSubmissions, ctrlStartVoting, ctrlEndVoting, ctrlShowWinner, ctrlNextRound].forEach(b => {
      if (b) b.disabled = true;
    });

    switch (status) {
      case 'LOBBY':
        if (ctrlStartRound) ctrlStartRound.disabled = false;
        break;

      case 'CHALLENGE':
        if (ctrlCloseSubmissions) ctrlCloseSubmissions.disabled = false;
        break;

      case 'SUBMISSIONS_CLOSED':
        if (ctrlStartVoting) ctrlStartVoting.disabled = false;
        break;

      case 'VOTING':
        if (ctrlEndVoting) ctrlEndVoting.disabled = false;
        break;

      case 'VOTING_CLOSED':
        if (ctrlShowWinner) ctrlShowWinner.disabled = false;
        break;

      case 'ROUND_WINNER':
        if (ctrlNextRound) ctrlNextRound.disabled = false;
        break;

      case 'FINAL_LEADERBOARD':
        break;

      case 'CANCELLED':
        if (ctrlStartRound) ctrlStartRound.disabled = false;
        break;
    }
  }

  // Render Full Admin State
  function renderAdminState(state) {
    if (!state) return;
    currentState = state;

    if (state.challenges && state.challenges.length > 0) {
      allChallenges = state.challenges;
      renderChallengesPool();
    }

    // Header updates
    if (adminStatusDot && adminStatusText) {
      adminStatusDot.className = 'status-dot active';
      adminStatusText.textContent = `Live: Room ${state.roomCode}`;
    }

    if (dashCompTitle) dashCompTitle.textContent = state.title || 'Competition Arena';
    if (dashRoomCode) dashRoomCode.textContent = state.roomCode;
    if (dashStatusBadge) {
      dashStatusBadge.textContent = state.status;
      dashStatusBadge.className = `badge ${state.status === 'VOTING' ? 'badge-magenta' : state.status === 'CHALLENGE' ? 'badge-cyan' : 'badge-gold'}`;
    }

    // Stats updates
    if (statParticipants) statParticipants.textContent = state.participantCount || 0;
    if (statRound) statRound.textContent = `Round ${state.currentRound}`;
    if (statSubmissions) statSubmissions.textContent = `${state.submissionsCount || 0} / ${state.participantCount || 0}`;
    if (statVotes) statVotes.textContent = `${state.votesCount || 0} / ${state.participantCount || 0}`;

    // Action button state machine updates
    updateActionButtons(state.status);

    // Render Challenge image if active
    if (state.currentChallenge) {
      if (adminChallengeImg) adminChallengeImg.src = state.currentChallenge.imageUrl;
      if (adminChallengeTitle) adminChallengeTitle.textContent = `${state.currentChallenge.isCustom ? '⭐ ' : ''}${state.currentChallenge.title}`;
      if (adminChallengeDesc) adminChallengeDesc.textContent = state.currentChallenge.description;
    }

    // Render Participants with Kick button
    if (adminParticipantsTotal) adminParticipantsTotal.textContent = state.participantCount || 0;
    if (adminParticipantsList) {
      adminParticipantsList.innerHTML = '';
      (state.participants || []).forEach(p => {
        const pill = document.createElement('div');
        pill.className = 'participant-pill';
        pill.innerHTML = `
          <span>${p.avatar || '🤖'}</span>
          <span>${p.name}</span>
          <button class="btn-kick" title="Kick participant" data-id="${p.id}">✖</button>
        `;
        adminParticipantsList.appendChild(pill);
      });

      adminParticipantsList.querySelectorAll('.btn-kick').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = e.currentTarget.getAttribute('data-id');
          if (confirm('Are you sure you want to remove this participant?')) {
            socket.emit('admin:kick-participant', { participantId: targetId });
          }
        });
      });
    }

    // Render Submissions Feed
    if (adminSubmissionsFeed) {
      adminSubmissionsFeed.innerHTML = '';
      if ((state.submissions || []).length === 0) {
        adminSubmissionsFeed.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; grid-column: 1 / -1; text-align: center; padding: 2rem;">No submissions yet for this round.</div>';
      } else {
        state.submissions.forEach(sub => {
          const card = document.createElement('div');
          card.className = 'submission-card';
          card.innerHTML = `
            <div class="submission-header">
              <div class="author-meta">
                <div class="author-avatar">${sub.avatar || '🤖'}</div>
                <div>
                  <div class="author-name">${sub.participantName}</div>
                  ${sub.teamName ? `<div class="author-team">${sub.teamName}</div>` : ''}
                </div>
              </div>
            </div>
            
            <div class="prompt-content-box">
              "${escapeHtml(sub.promptText)}"
            </div>

            <div class="vote-action-footer">
              ${sub.voteCount !== undefined ? `
                <div class="vote-live-count">
                  <span>🗳️</span>
                  <span>${sub.voteCount} votes</span>
                </div>
              ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Submitted</span>'}
            </div>
          `;
          adminSubmissionsFeed.appendChild(card);
        });
      }
    }

    // Render Cumulative Leaderboard Table
    if (adminLeaderboardTable) {
      adminLeaderboardTable.innerHTML = `
        <div class="leaderboard-row header">
          <div>RANK</div>
          <div>AVATAR</div>
          <div>PARTICIPANT</div>
          <div>WINS</div>
          <div style="text-align: right;">TOTAL VOTES</div>
        </div>
      `;

      (state.leaderboard || []).forEach((p, idx) => {
        const rankClass = idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : '';
        const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
          <div class="rank-badge ${rankClass}">${rankMedal}</div>
          <div style="font-size: 1.4rem;">${p.avatar || '🤖'}</div>
          <div>
            <div style="font-weight: 700;">${p.name}</div>
            ${p.teamName ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${p.teamName}</div>` : ''}
          </div>
          <div style="font-family: var(--font-mono); color: var(--accent-amber); font-weight: 600;">${p.roundWins || 0} 🏆</div>
          <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.1rem; color: var(--accent-cyan); text-align: right;">${p.totalScore}</div>
        `;
        adminLeaderboardTable.appendChild(row);
      });
    }
  }

  // --- BUTTON EVENT HANDLERS ---

  // 1. START ROUND
  if (ctrlStartRound) {
    ctrlStartRound.addEventListener('click', () => {
      let challengeId = selectChallengePicker ? selectChallengePicker.value : null;

      if (!challengeId || allChallenges.length === 0) {
        showToast('Please upload or select a challenge picture for this round first!', 'warning');
        if (customUploadContainer) {
          customUploadContainer.style.display = 'block';
          customUploadContainer.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      socket.emit('admin:start-round', { challengeId }, (res) => {
        if (res && !res.success) {
          showToast(res.error || 'Failed to start round', 'error');
          return;
        }
        if (res && res.success) {
          showToast(`Round started!`, 'success');
        }
      });
    });
  }

  // 2. CLOSE SUBMISSIONS
  if (ctrlCloseSubmissions) {
    ctrlCloseSubmissions.addEventListener('click', () => {
      socket.emit('admin:close-submissions', {}, (res) => {
        if (res && res.success) {
          showToast('Submissions closed.', 'info');
        }
      });
    });
  }

  // 3. START VOTING
  if (ctrlStartVoting) {
    ctrlStartVoting.addEventListener('click', () => {
      socket.emit('admin:start-voting', { duration: 60 }, (res) => {
        if (res && res.success) {
          showToast('Peer voting is now live!', 'success');
        }
      });
    });
  }

  // 4. END VOTING
  if (ctrlEndVoting) {
    ctrlEndVoting.addEventListener('click', () => {
      socket.emit('admin:end-voting', {}, (res) => {
        if (res && res.success) {
          showToast('Voting concluded.', 'info');
        }
      });
    });
  }

  // 5. SHOW WINNER
  if (ctrlShowWinner) {
    ctrlShowWinner.addEventListener('click', () => {
      socket.emit('admin:show-winner', {}, (res) => {
        if (res && res.success) {
          if (window.confettiEngine) window.confettiEngine.burst(100);
          showToast('Winner revealed on all screens!', 'success');
        }
      });
    });
  }

  // 6. NEXT ROUND
  if (ctrlNextRound) {
    ctrlNextRound.addEventListener('click', () => {
      socket.emit('admin:next-round', {}, (res) => {
        if (res && res.success) {
          showToast('Ready for next round!', 'info');
        }
      });
    });
  }

  // 7. END COMPETITION
  if (ctrlEndComp) {
    ctrlEndComp.addEventListener('click', () => {
      if (confirm('End competition and display Grand Finale leaderboard?')) {
        socket.emit('admin:end-competition', {}, (res) => {
          if (res && res.success) {
            if (window.confettiEngine) window.confettiEngine.burst(150);
            showToast('Grand Finale leaderboard displayed!', 'success');
          }
        });
      }
    });
  }

  // 8. CANCEL ROUND
  if (ctrlCancelRound) {
    ctrlCancelRound.addEventListener('click', () => {
      if (confirm('Cancel this round? (No scores will be recorded)')) {
        socket.emit('admin:cancel-round', {}, (res) => {
          if (res && res.success) {
            showToast('Round cancelled.', 'warning');
          }
        });
      }
    });
  }

  // QR Modal Handlers
  if (btnShowQr) {
    btnShowQr.addEventListener('click', async () => {
      if (!currentRoom) return;
      try {
        const res = await fetch(`/api/qrcode/${currentRoom}`);
        const data = await res.json();
        if (data.success && data.qrDataUrl) {
          qrModalImage.src = data.qrDataUrl;
          qrModalPin.textContent = currentRoom;
          qrModal.style.display = 'flex';
        }
      } catch (e) {
        showToast('Failed to generate QR Code', 'error');
      }
    });
  }

  if (btnCloseQrModal) {
    btnCloseQrModal.addEventListener('click', () => {
      qrModal.style.display = 'none';
    });
  }

  if (btnCopyJoinLink) {
    btnCopyJoinLink.addEventListener('click', () => {
      if (!currentRoom) return;
      const joinUrl = `${window.location.origin}/?room=${currentRoom}`;
      navigator.clipboard.writeText(joinUrl).then(() => {
        showToast('Player Join Link copied to clipboard!', 'success');
      });
    });
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
    renderAdminState(state);
  });

  socket.on('timer-tick', ({ remaining }) => {
    if (statTimer) statTimer.textContent = formatTime(remaining);
  });

  socket.on('participant-joined', ({ participant, totalCount }) => {
    showToast(`${participant.avatar || '👤'} ${participant.name} joined the arena!`, 'info');
  });

  socket.on('submission-received', ({ participantName, totalSubmissions, totalParticipants }) => {
    showToast(`✍️ ${participantName} submitted a prompt! (${totalSubmissions}/${totalParticipants})`, 'info');
  });

  socket.on('vote-cast', ({ totalVotes }) => {
    if (statVotes && currentState) {
      statVotes.textContent = `${totalVotes} / ${currentState.participantCount || 0}`;
    }
  });

  // Init
  loadChallenges();

  // Reconnect if admin room exists or room param is in URL
  socket.on('connect', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = (urlParams.get('room') || '').toUpperCase().trim();
    const savedRoom = urlRoom || (localStorage.getItem('prompt_admin_room') || '').toUpperCase().trim();

    if (savedRoom) {
      socket.emit('admin:join-room', { roomCode: savedRoom }, (res) => {
        if (res && res.success) {
          currentRoom = savedRoom;
          localStorage.setItem('prompt_admin_room', savedRoom);
          showDashboard(res.state);
        } else if (urlRoom) {
          showToast(res ? res.error : 'Competition room not found', 'error');
        }
      });
    }
  });

})();
