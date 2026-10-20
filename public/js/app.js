/**
 * Church Event Ride Sharing - Mobile-first Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const tabBtnFind = document.getElementById('tabBtnFind');
  const tabBtnOffer = document.getElementById('tabBtnOffer');
  const paneFind = document.getElementById('paneFind');
  const paneOffer = document.getElementById('paneOffer');
  const ridesCountBadge = document.getElementById('ridesCountBadge');

  // Find Pane Elements
  const ridesListContainer = document.getElementById('ridesListContainer');
  const ridesEmptyState = document.getElementById('ridesEmptyState');
  const rideSearchInput = document.getElementById('rideSearchInput');
  const btnRefreshRides = document.getElementById('btnRefreshRides');
  const btnGoToOffer = document.getElementById('btnGoToOffer');

  // Offer Pane Elements
  const offerVerifyStep = document.getElementById('offerVerifyStep');
  const offerDetailsStep = document.getElementById('offerDetailsStep');
  const offerSuccessStep = document.getElementById('offerSuccessStep');
  
  const verifyEmailForm = document.getElementById('verifyEmailForm');
  const driverEmailInput = document.getElementById('driverEmailInput');
  const btnVerifyEmail = document.getElementById('btnVerifyEmail');
  const verifyErrorBox = document.getElementById('verifyErrorBox');
  const verifyErrorMessage = document.getElementById('verifyErrorMessage');

  const verifiedDriverName = document.getElementById('verifiedDriverName');
  const verifiedDriverPhone = document.getElementById('verifiedDriverPhone');
  const btnChangeEmail = document.getElementById('btnChangeEmail');
  
  const existingOfferAlert = document.getElementById('existingOfferAlert');
  const existingOfferSummary = document.getElementById('existingOfferSummary');
  const publishRideForm = document.getElementById('publishRideForm');
  const departureTimeInput = document.getElementById('departureTimeInput');
  const seatsDisplay = document.getElementById('seatsDisplay');
  const seatsHiddenInput = document.getElementById('seatsHiddenInput');
  const btnSeatMinus = document.getElementById('btnSeatMinus');
  const btnSeatPlus = document.getElementById('btnSeatPlus');
  const fullToggleGroup = document.getElementById('fullToggleGroup');
  const markFullCheckbox = document.getElementById('markFullCheckbox');
  const btnPublishOffer = document.getElementById('btnPublishOffer');
  const btnRemoveOffer = document.getElementById('btnRemoveOffer');
  const btnViewInList = document.getElementById('btnViewInList');

  // Organizer Modal Elements
  const btnOpenOrganizer = document.getElementById('btnOpenOrganizer');
  const organizerModal = document.getElementById('organizerModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const organizerAuthSection = document.getElementById('organizerAuthSection');
  const organizerDashboardSection = document.getElementById('organizerDashboardSection');
  const organizerLoginForm = document.getElementById('organizerLoginForm');
  const organizerPasscodeInput = document.getElementById('organizerPasscodeInput');
  const organizerLoginError = document.getElementById('organizerLoginError');
  const btnLoginOrganizer = document.getElementById('btnLoginOrganizer');
  const btnLogoutOrganizer = document.getElementById('btnLogoutOrganizer');
  
  const statAttendeeCount = document.getElementById('statAttendeeCount');
  const statActiveRides = document.getElementById('statActiveRides');
  const statFullRides = document.getElementById('statFullRides');
  
  const csvDropzone = document.getElementById('csvDropzone');
  const csvFileInput = document.getElementById('csvFileInput');
  const csvErrorBox = document.getElementById('csvErrorBox');
  const csvErrorList = document.getElementById('csvErrorList');
  const csvPreviewBox = document.getElementById('csvPreviewBox');
  const previewSummaryText = document.getElementById('previewSummaryText');
  const btnConfirmImport = document.getElementById('btnConfirmImport');
  const organizerRidesList = document.getElementById('organizerRidesList');

  const toastContainer = document.getElementById('toastContainer');

  // --- App State ---
  let allRides = [];
  let verifiedAttendee = null; // { name, email, phone }
  let activeRideForDriver = null; // existing ride if any
  let pendingCSVContent = null;
  let organizerPasscode = sessionStorage.getItem('organizer_passcode') || '';

  // --- Helper: Toast Notification ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Trigger reflow & show
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- Helper: Sanitize Text for HTML ---
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  // --- Helper: Format Initials for Avatar ---
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // --- Helper: Format Clean Phone for tel: link ---
  function formatTelLink(phone) {
    return String(phone || '').replace(/[^0-9+]/g, '');
  }

  // --- Tab Navigation ---
  function switchTab(tabId) {
    if (tabId === 'find') {
      tabBtnFind.classList.add('active');
      tabBtnOffer.classList.remove('active');
      paneFind.classList.add('active');
      paneOffer.classList.remove('active');
      fetchRides();
    } else {
      tabBtnOffer.classList.add('active');
      tabBtnFind.classList.remove('active');
      paneOffer.classList.add('active');
      paneFind.classList.remove('active');
    }
  }

  tabBtnFind.addEventListener('click', () => switchTab('find'));
  tabBtnOffer.addEventListener('click', () => switchTab('offer'));
  btnGoToOffer?.addEventListener('click', () => switchTab('offer'));
  btnViewInList?.addEventListener('click', () => switchTab('find'));

  // --- Fetch & Render Active Rides ---
  async function fetchRides() {
    btnRefreshRides.classList.add('spinning');
    try {
      const res = await fetch('/api/rides');
      const data = await res.json();
      if (data.success) {
        allRides = data.rides;
        renderRides(allRides);
        updateRidesCount(allRides.length);
      } else {
        showToast('Unable to load rides. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error fetching rides:', err);
      showToast('Network error loading rides.', 'error');
    } finally {
      setTimeout(() => btnRefreshRides.classList.remove('spinning'), 500);
    }
  }

  function updateRidesCount(count) {
    ridesCountBadge.textContent = count;
  }

  function renderRides(ridesToRender) {
    ridesListContainer.innerHTML = '';
    
    if (!ridesToRender || ridesToRender.length === 0) {
      ridesEmptyState.style.display = 'block';
      ridesListContainer.style.display = 'none';
      return;
    }

    ridesEmptyState.style.display = 'none';
    ridesListContainer.style.display = 'flex';

    ridesToRender.forEach(ride => {
      const card = document.createElement('div');
      card.className = `ride-card ${ride.isFull ? 'full' : ''}`;
      
      const initials = getInitials(ride.driverName);
      const telLink = formatTelLink(ride.phone);
      const seatsText = ride.isFull 
        ? '⚠️ Ride Full' 
        : `💺 ${ride.seats} ${ride.seats === 1 ? 'seat' : 'seats'} left`;
      const seatsBadgeClass = ride.isFull ? 'full' : 'available';

      card.innerHTML = `
        <div class="ride-card-header">
          <div class="driver-info">
            <div class="driver-avatar" aria-hidden="true">${initials}</div>
            <div class="driver-meta">
              <h3>${escapeHTML(ride.driverName)}</h3>
              <span class="driver-verified-tag">✓ Verified Attendee</span>
            </div>
          </div>
          <span class="ride-pill-seats ${seatsBadgeClass}">${seatsText}</span>
        </div>

        <div class="ride-details-row">
          <span class="ride-time-icon" aria-hidden="true">⏰</span>
          <div>
            <span class="ride-time-label">Departure:</span>
            <span>${escapeHTML(ride.departureTime)}</span>
          </div>
        </div>

        <div class="call-action-wrapper">
          <a href="tel:${telLink}" class="btn-call" aria-label="Call driver ${escapeHTML(ride.driverName)} at ${escapeHTML(ride.phone)}">
            <span aria-hidden="true">📞</span> Call ${escapeHTML(ride.phone)}
          </a>
          <a href="sms:${telLink}" class="btn-sms" title="Send SMS" aria-label="Send SMS to ${escapeHTML(ride.driverName)}">
            <span aria-hidden="true">💬</span> SMS
          </a>
        </div>
      `;

      ridesListContainer.appendChild(card);
    });
  }

  // --- Real-time Search Filter ---
  rideSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!term) {
      renderRides(allRides);
      return;
    }

    const filtered = allRides.filter(r => 
      r.driverName.toLowerCase().includes(term) ||
      r.departureTime.toLowerCase().includes(term)
    );
    renderRides(filtered);
  });

  btnRefreshRides.addEventListener('click', fetchRides);

  // --- Offer a Ride: Step 1 Email Verification ---
  verifyEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = driverEmailInput.value.trim();
    if (!email) return;

    btnVerifyEmail.disabled = true;
    btnVerifyEmail.innerHTML = 'Verifying...';
    verifyErrorBox.style.display = 'none';

    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        verifiedAttendee = data.attendee;
        activeRideForDriver = data.existingRide;
        setupOfferDetailsStep();
      } else {
        verifyErrorMessage.textContent = data.message || 'Email not found on the registered church attendee list. Please contact the organizers.';
        verifyErrorBox.style.display = 'block';
      }
    } catch (err) {
      console.error('Verification error:', err);
      verifyErrorMessage.textContent = 'Connection error. Please check your internet connection.';
      verifyErrorBox.style.display = 'block';
    } finally {
      btnVerifyEmail.disabled = false;
      btnVerifyEmail.innerHTML = '<span>Verify & Continue</span> →';
    }
  });

  // --- Offer a Ride: Step 2 Setup ---
  function setupOfferDetailsStep() {
    verifiedDriverName.textContent = verifiedAttendee.name;
    verifiedDriverPhone.textContent = `Registered Phone: ${verifiedAttendee.phone}`;

    if (activeRideForDriver) {
      // Driver ALREADY has an active ride: enable update / manage mode
      existingOfferAlert.style.display = 'block';
      existingOfferSummary.textContent = `Current offer: Departure at ${activeRideForDriver.departureTime}, ${activeRideForDriver.seats} seats available.`;
      
      departureTimeInput.value = activeRideForDriver.departureTime;
      updateSeatsValue(activeRideForDriver.seats);
      
      fullToggleGroup.style.display = 'block';
      markFullCheckbox.checked = Boolean(activeRideForDriver.isFull);

      btnPublishOffer.textContent = 'Update Ride Offer';
      btnRemoveOffer.style.display = 'block';
    } else {
      // New ride offer
      existingOfferAlert.style.display = 'none';
      fullToggleGroup.style.display = 'none';
      markFullCheckbox.checked = false;
      departureTimeInput.value = '';
      updateSeatsValue(3);

      btnPublishOffer.textContent = 'Publish Ride Offer';
      btnRemoveOffer.style.display = 'none';
    }

    offerVerifyStep.style.display = 'none';
    offerDetailsStep.style.display = 'block';
    offerSuccessStep.style.display = 'none';
  }

  // Change Email Button
  btnChangeEmail.addEventListener('click', () => {
    verifiedAttendee = null;
    activeRideForDriver = null;
    offerVerifyStep.style.display = 'block';
    offerDetailsStep.style.display = 'none';
    offerSuccessStep.style.display = 'none';
  });

  // Departure Time Preset Chips
  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      departureTimeInput.value = chip.dataset.time;
      departureTimeInput.focus();
    });
  });

  // Seats Stepper
  function updateSeatsValue(val) {
    const num = Math.max(1, Math.min(10, parseInt(val, 10) || 1));
    seatsHiddenInput.value = num;
    seatsDisplay.textContent = num;
  }

  btnSeatMinus.addEventListener('click', () => {
    const current = parseInt(seatsHiddenInput.value, 10) || 1;
    updateSeatsValue(current - 1);
  });

  btnSeatPlus.addEventListener('click', () => {
    const current = parseInt(seatsHiddenInput.value, 10) || 1;
    updateSeatsValue(current + 1);
  });

  // Publish / Update Ride Offer
  publishRideForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!verifiedAttendee) return;

    const departureTime = departureTimeInput.value.trim();
    const seats = parseInt(seatsHiddenInput.value, 10);
    const isFull = markFullCheckbox.checked;

    if (!departureTime) {
      showToast('Please enter your departure time.', 'error');
      departureTimeInput.focus();
      return;
    }

    btnPublishOffer.disabled = true;
    btnPublishOffer.textContent = 'Saving...';

    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifiedAttendee.email,
          departureTime,
          seats
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // If full toggle was marked, apply update
        if (activeRideForDriver && isFull !== activeRideForDriver.isFull) {
          await fetch(`/api/rides/${activeRideForDriver.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: verifiedAttendee.email,
              isFull
            })
          });
        }

        // Show success
        document.getElementById('successHeading').textContent = activeRideForDriver ? 'Ride Offer Updated!' : 'Ride Offer Published!';
        document.getElementById('successMessage').textContent = `Your ride listing for ${departureTime} (${seats} ${seats === 1 ? 'seat' : 'seats'}) is active. Attendees can call you directly to coordinate.`;
        
        offerDetailsStep.style.display = 'none';
        offerSuccessStep.style.display = 'block';
        showToast('Your ride listing is live!', 'success');
        fetchRides();
      } else {
        showToast(data.message || 'Failed to publish ride.', 'error');
      }
    } catch (err) {
      console.error('Publish error:', err);
      showToast('Network error saving ride.', 'error');
    } finally {
      btnPublishOffer.disabled = false;
      btnPublishOffer.textContent = activeRideForDriver ? 'Update Ride Offer' : 'Publish Ride Offer';
    }
  });

  // Remove / Cancel Offer
  btnRemoveOffer.addEventListener('click', async () => {
    if (!activeRideForDriver || !verifiedAttendee) return;

    const confirmed = confirm('Are you sure you want to cancel and remove your active ride offer?');
    if (!confirmed) return;

    btnRemoveOffer.disabled = true;
    btnRemoveOffer.textContent = 'Removing...';

    try {
      const res = await fetch(`/api/rides/${activeRideForDriver.id}?email=${encodeURIComponent(verifiedAttendee.email)}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Your ride offer was removed.', 'info');
        verifiedAttendee = null;
        activeRideForDriver = null;
        offerDetailsStep.style.display = 'none';
        offerVerifyStep.style.display = 'block';
        driverEmailInput.value = '';
        fetchRides();
      } else {
        showToast(data.message || 'Could not remove ride.', 'error');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Network error removing ride.', 'error');
    } finally {
      btnRemoveOffer.disabled = false;
      btnRemoveOffer.textContent = 'Cancel & Remove My Ride Offer';
    }
  });

  // --- Organizer Modal Logic ---
  btnOpenOrganizer.addEventListener('click', () => {
    organizerModal.classList.add('active');
    if (organizerPasscode) {
      checkAndLoadOrganizerDashboard();
    } else {
      organizerAuthSection.style.display = 'block';
      organizerDashboardSection.style.display = 'none';
    }
  });

  btnCloseModal.addEventListener('click', () => {
    organizerModal.classList.remove('active');
    csvErrorBox.style.display = 'none';
    csvPreviewBox.style.display = 'none';
  });

  organizerModal.addEventListener('click', (e) => {
    if (e.target === organizerModal) {
      organizerModal.classList.remove('active');
    }
  });

  // Organizer Login
  organizerLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passcode = organizerPasscodeInput.value.trim();
    if (!passcode) return;

    btnLoginOrganizer.disabled = true;
    btnLoginOrganizer.textContent = 'Authenticating...';
    organizerLoginError.style.display = 'none';

    try {
      const res = await fetch('/api/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        organizerPasscode = passcode;
        sessionStorage.setItem('organizer_passcode', passcode);
        organizerPasscodeInput.value = '';
        checkAndLoadOrganizerDashboard();
      } else {
        organizerLoginError.textContent = data.message || 'Invalid passcode.';
        organizerLoginError.style.display = 'block';
      }
    } catch (err) {
      console.error('Organizer login error:', err);
      organizerLoginError.textContent = 'Network error authenticating.';
      organizerLoginError.style.display = 'block';
    } finally {
      btnLoginOrganizer.disabled = false;
      btnLoginOrganizer.textContent = 'Access Dashboard';
    }
  });

  // Logout / Lock Organizer
  btnLogoutOrganizer.addEventListener('click', () => {
    organizerPasscode = '';
    sessionStorage.removeItem('organizer_passcode');
    organizerAuthSection.style.display = 'block';
    organizerDashboardSection.style.display = 'none';
    showToast('Organizer panel locked.');
  });

  // Load Dashboard Data
  async function checkAndLoadOrganizerDashboard() {
    try {
      const res = await fetch('/api/organizer/stats', {
        headers: { 'x-organizer-passcode': organizerPasscode }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        organizerAuthSection.style.display = 'none';
        organizerDashboardSection.style.display = 'block';
        
        statAttendeeCount.textContent = data.attendeeCount;
        statActiveRides.textContent = data.activeRidesCount;
        statFullRides.textContent = data.fullRidesCount;

        renderOrganizerRides(data.rides);
      } else {
        // Invalid session
        sessionStorage.removeItem('organizer_passcode');
        organizerPasscode = '';
        organizerAuthSection.style.display = 'block';
        organizerDashboardSection.style.display = 'none';
      }
    } catch (err) {
      console.error('Error fetching organizer stats:', err);
    }
  }

  function renderOrganizerRides(rides) {
    organizerRidesList.innerHTML = '';
    if (!rides || rides.length === 0) {
      organizerRidesList.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">No active ride listings currently.</p>';
      return;
    }

    rides.forEach(ride => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; font-size: 0.85rem;';
      item.innerHTML = `
        <div>
          <strong>${escapeHTML(ride.driverName)}</strong> (${escapeHTML(ride.departureTime)}) - ${ride.seats} seats
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(ride.phone)}</div>
        </div>
        <button class="btn-neutral" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger);" data-ride-id="${ride.id}">
          Remove
        </button>
      `;

      item.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`Remove ride by ${ride.driverName}?`)) return;
        try {
          const res = await fetch(`/api/organizer/rides/${ride.id}`, {
            method: 'DELETE',
            headers: { 'x-organizer-passcode': organizerPasscode }
          });
          if (res.ok) {
            showToast('Ride removed by organizer.');
            checkAndLoadOrganizerDashboard();
            fetchRides();
          }
        } catch (err) {
          console.error(err);
        }
      });

      organizerRidesList.appendChild(item);
    });
  }

  // --- CSV Drag & Drop / File Input Handling ---
  csvDropzone.addEventListener('click', () => csvFileInput.click());

  csvDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropzone.classList.add('dragover');
  });

  csvDropzone.addEventListener('dragleave', () => {
    csvDropzone.classList.remove('dragover');
  });

  csvDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedCSV(e.dataTransfer.files[0]);
    }
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedCSV(e.target.files[0]);
    }
  });

  function handleSelectedCSV(file) {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      showToast('Please select a valid .csv file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingCSVContent = e.target.result;
      processPendingCSV(file.name);
    };
    reader.onerror = () => {
      showToast('Error reading the selected file.', 'error');
    };
    reader.readAsText(file);
  }

  // Preview and validate pending CSV on client, then send to server
  async function processPendingCSV(filename) {
    csvErrorBox.style.display = 'none';
    csvPreviewBox.style.display = 'none';

    if (!pendingCSVContent || !pendingCSVContent.trim()) {
      showToast('The selected CSV file is empty.', 'error');
      return;
    }

    const lines = pendingCSVContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    const rowCount = Math.max(0, lines.length - 1);

    previewSummaryText.textContent = `File "${filename}" with ${rowCount} attendee rows detected. Ready to validate and import.`;
    csvPreviewBox.style.display = 'block';
  }

  // Confirm Import
  btnConfirmImport.addEventListener('click', async () => {
    if (!pendingCSVContent) return;

    btnConfirmImport.disabled = true;
    btnConfirmImport.textContent = 'Validating & Importing...';
    csvErrorBox.style.display = 'none';

    try {
      const res = await fetch('/api/organizer/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          'x-organizer-passcode': organizerPasscode
        },
        body: pendingCSVContent
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        csvPreviewBox.style.display = 'none';
        pendingCSVContent = null;
        csvFileInput.value = '';
        checkAndLoadOrganizerDashboard();
        fetchRides();
      } else {
        // Display validation errors
        csvErrorList.innerHTML = '';
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach(err => {
            const li = document.createElement('li');
            li.textContent = err;
            csvErrorList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = data.message || 'Failed to import CSV file.';
          csvErrorList.appendChild(li);
        }
        csvErrorBox.style.display = 'block';
        showToast('Please fix the CSV errors shown above.', 'error');
      }
    } catch (err) {
      console.error('Import error:', err);
      showToast('Network error during CSV import.', 'error');
    } finally {
      btnConfirmImport.disabled = false;
      btnConfirmImport.textContent = 'Save & Update Attendee Roster';
    }
  });

  // --- Initial Load ---
  fetchRides();
});
