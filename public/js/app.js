/**
 * Caronas do Evento da Igreja - Lógica do Aplicativo Mobile
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Elementos do DOM ---
  const tabBtnFind = document.getElementById('tabBtnFind');
  const tabBtnOffer = document.getElementById('tabBtnOffer');
  const paneFind = document.getElementById('paneFind');
  const paneOffer = document.getElementById('paneOffer');
  const ridesCountBadge = document.getElementById('ridesCountBadge');

  // Elementos da Aba Encontrar Carona
  const ridesListContainer = document.getElementById('ridesListContainer');
  const ridesEmptyState = document.getElementById('ridesEmptyState');
  const rideSearchInput = document.getElementById('rideSearchInput');
  const btnRefreshRides = document.getElementById('btnRefreshRides');
  const btnGoToOffer = document.getElementById('btnGoToOffer');

  // Elementos da Aba Oferecer Carona
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

  // Elementos do Modal do Organizador
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

  // --- Estado da Aplicação ---
  let allRides = [];
  let verifiedAttendee = null; // { name, email, phone }
  let activeRideForDriver = null; // carona ativa se houver
  let pendingCSVContent = null;
  let organizerPasscode = sessionStorage.getItem('organizer_passcode') || '';

  // --- Auxiliar: Notificação Toast ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- Auxiliar: Sanitizar texto para HTML ---
  function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str || '';
    return p.innerHTML;
  }

  // --- Auxiliar: Iniciais para o avatar ---
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // --- Auxiliar: Formatar telefone para link tel: ---
  function formatTelLink(phone) {
    return String(phone || '').replace(/[^0-9+]/g, '');
  }

  // --- Navegação por Abas ---
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

  // --- Carregar e Renderizar Caronas Ativas ---
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
        showToast('Não foi possível carregar as caronas. Tente novamente.', 'error');
      }
    } catch (err) {
      console.error('Erro ao buscar caronas:', err);
      showToast('Erro de conexão ao carregar as caronas.', 'error');
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
        ? '⚠️ Carona Lotada' 
        : `💺 ${ride.seats} ${ride.seats === 1 ? 'vaga livre' : 'vagas livres'}`;
      const seatsBadgeClass = ride.isFull ? 'full' : 'available';

      card.innerHTML = `
        <div class="ride-card-header">
          <div class="driver-info">
            <div class="driver-avatar" aria-hidden="true">${initials}</div>
            <div class="driver-meta">
              <h3>${escapeHTML(ride.driverName)}</h3>
              <span class="driver-verified-tag">✓ Participante Confirmado</span>
            </div>
          </div>
          <span class="ride-pill-seats ${seatsBadgeClass}">${seatsText}</span>
        </div>

        <div class="ride-details-row">
          <span class="ride-time-icon" aria-hidden="true">⏰</span>
          <div>
            <span class="ride-time-label">Saída:</span>
            <span>${escapeHTML(ride.departureTime)}</span>
          </div>
        </div>

        <div class="call-action-wrapper">
          <a href="tel:${telLink}" class="btn-call" aria-label="Ligar para o motorista ${escapeHTML(ride.driverName)} no número ${escapeHTML(ride.phone)}">
            <span aria-hidden="true">📞</span> Ligar (${escapeHTML(ride.phone)})
          </a>
          <a href="sms:${telLink}" class="btn-sms" title="Enviar SMS" aria-label="Enviar SMS para ${escapeHTML(ride.driverName)}">
            <span aria-hidden="true">💬</span> SMS
          </a>
        </div>
      `;

      ridesListContainer.appendChild(card);
    });
  }

  // --- Filtro de Busca em Tempo Real ---
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

  // --- Oferecer Carona: Etapa 1 Verificação de E-mail ---
  verifyEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = driverEmailInput.value.trim();
    if (!email) return;

    btnVerifyEmail.disabled = true;
    btnVerifyEmail.innerHTML = 'Verificando...';
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
        verifyErrorMessage.textContent = data.message || 'E-mail não encontrado na lista de participantes. Por favor, entre em contato com a organização do evento.';
        verifyErrorBox.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro de verificação:', err);
      verifyErrorMessage.textContent = 'Erro de conexão. Verifique sua conexão com a internet.';
      verifyErrorBox.style.display = 'block';
    } finally {
      btnVerifyEmail.disabled = false;
      btnVerifyEmail.innerHTML = '<span>Verificar e Continuar</span> →';
    }
  });

  // --- Oferecer Carona: Etapa 2 Formulário de Detalhes ---
  function setupOfferDetailsStep() {
    verifiedDriverName.textContent = verifiedAttendee.name;
    verifiedDriverPhone.textContent = `Telefone cadastrado: ${verifiedAttendee.phone}`;

    if (activeRideForDriver) {
      // Motorista já possui uma carona ativa: modo de atualização
      existingOfferAlert.style.display = 'block';
      existingOfferSummary.textContent = `Oferta atual: Saída às ${activeRideForDriver.departureTime}, ${activeRideForDriver.seats} ${activeRideForDriver.seats === 1 ? 'vaga disponível' : 'vagas disponíveis'}.`;
      
      departureTimeInput.value = activeRideForDriver.departureTime;
      updateSeatsValue(activeRideForDriver.seats);
      
      fullToggleGroup.style.display = 'block';
      markFullCheckbox.checked = Boolean(activeRideForDriver.isFull);

      btnPublishOffer.textContent = 'Atualizar Oferta de Carona';
      btnRemoveOffer.style.display = 'block';
    } else {
      // Nova oferta de carona
      existingOfferAlert.style.display = 'none';
      fullToggleGroup.style.display = 'none';
      markFullCheckbox.checked = false;
      departureTimeInput.value = '';
      updateSeatsValue(3);

      btnPublishOffer.textContent = 'Publicar Oferta de Carona';
      btnRemoveOffer.style.display = 'none';
    }

    offerVerifyStep.style.display = 'none';
    offerDetailsStep.style.display = 'block';
    offerSuccessStep.style.display = 'none';
  }

  // Botão Alterar E-mail
  btnChangeEmail.addEventListener('click', () => {
    verifiedAttendee = null;
    activeRideForDriver = null;
    offerVerifyStep.style.display = 'block';
    offerDetailsStep.style.display = 'none';
    offerSuccessStep.style.display = 'none';
  });

  // Chips de Sugestão de Horário
  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      departureTimeInput.value = chip.dataset.time;
      departureTimeInput.focus();
    });
  });

  // Contador de Vagas
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

  // Publicar / Atualizar Oferta de Carona
  publishRideForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!verifiedAttendee) return;

    const departureTime = departureTimeInput.value.trim();
    const seats = parseInt(seatsHiddenInput.value, 10);
    const isFull = markFullCheckbox.checked;

    if (!departureTime) {
      showToast('Por favor, informe o seu horário de saída.', 'error');
      departureTimeInput.focus();
      return;
    }

    btnPublishOffer.disabled = true;
    btnPublishOffer.textContent = 'Salvando...';

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
        // Se a opção de marcar como lotada foi alterada
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

        // Exibir tela de sucesso
        document.getElementById('successHeading').textContent = activeRideForDriver ? 'Oferta de Carona Atualizada!' : 'Oferta de Carona Publicada!';
        document.getElementById('successMessage').textContent = `Sua carona para ${departureTime} (${seats} ${seats === 1 ? 'vaga' : 'vagas'}) já está ativa. Os participantes podem ligar diretamente para você combinar os detalhes.`;
        
        offerDetailsStep.style.display = 'none';
        offerSuccessStep.style.display = 'block';
        showToast('Sua oferta de carona já está disponível!', 'success');
        fetchRides();
      } else {
        showToast(data.message || 'Falha ao salvar carona.', 'error');
      }
    } catch (err) {
      console.error('Erro ao publicar:', err);
      showToast('Erro de conexão ao salvar carona.', 'error');
    } finally {
      btnPublishOffer.disabled = false;
      btnPublishOffer.textContent = activeRideForDriver ? 'Atualizar Oferta de Carona' : 'Publicar Oferta de Carona';
    }
  });

  // Cancelar e Remover Oferta de Carona
  btnRemoveOffer.addEventListener('click', async () => {
    if (!activeRideForDriver || !verifiedAttendee) return;

    const confirmed = confirm('Tem certeza de que deseja cancelar e remover sua oferta de carona?');
    if (!confirmed) return;

    btnRemoveOffer.disabled = true;
    btnRemoveOffer.textContent = 'Removendo...';

    try {
      const res = await fetch(`/api/rides/${activeRideForDriver.id}?email=${encodeURIComponent(verifiedAttendee.email)}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('Sua oferta de carona foi removida.', 'info');
        verifiedAttendee = null;
        activeRideForDriver = null;
        offerDetailsStep.style.display = 'none';
        offerVerifyStep.style.display = 'block';
        driverEmailInput.value = '';
        fetchRides();
      } else {
        showToast(data.message || 'Não foi possível remover a carona.', 'error');
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showToast('Erro de conexão ao remover a carona.', 'error');
    } finally {
      btnRemoveOffer.disabled = false;
      btnRemoveOffer.textContent = 'Cancelar e Remover Minha Carona';
    }
  });

  // --- Lógica do Modal do Organizador ---
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

  // Login do Organizador
  organizerLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passcode = organizerPasscodeInput.value.trim();
    if (!passcode) return;

    btnLoginOrganizer.disabled = true;
    btnLoginOrganizer.textContent = 'Autenticando...';
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
        organizerLoginError.textContent = data.message || 'Senha incorreta.';
        organizerLoginError.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro no login do organizador:', err);
      organizerLoginError.textContent = 'Erro de conexão ao autenticar.';
      organizerLoginError.style.display = 'block';
    } finally {
      btnLoginOrganizer.disabled = false;
      btnLoginOrganizer.textContent = 'Acessar Painel';
    }
  });

  // Bloquear Painel do Organizador
  btnLogoutOrganizer.addEventListener('click', () => {
    organizerPasscode = '';
    sessionStorage.removeItem('organizer_passcode');
    organizerAuthSection.style.display = 'block';
    organizerDashboardSection.style.display = 'none';
    showToast('Painel do organizador bloqueado.');
  });

  // Carregar Dados do Painel
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
        // Sessão inválida
        sessionStorage.removeItem('organizer_passcode');
        organizerPasscode = '';
        organizerAuthSection.style.display = 'block';
        organizerDashboardSection.style.display = 'none';
      }
    } catch (err) {
      console.error('Erro ao carregar estatísticas do organizador:', err);
    }
  }

  function renderOrganizerRides(rides) {
    organizerRidesList.innerHTML = '';
    if (!rides || rides.length === 0) {
      organizerRidesList.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhuma carona ativa no momento.</p>';
      return;
    }

    rides.forEach(ride => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 12px; font-size: 0.85rem;';
      item.innerHTML = `
        <div>
          <strong>${escapeHTML(ride.driverName)}</strong> (${escapeHTML(ride.departureTime)}) - ${ride.seats} vagas
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(ride.phone)}</div>
        </div>
        <button class="btn-neutral" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger);" data-ride-id="${ride.id}">
          Remover
        </button>
      `;

      item.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`Remover a carona de ${ride.driverName}?`)) return;
        try {
          const res = await fetch(`/api/organizer/rides/${ride.id}`, {
            method: 'DELETE',
            headers: { 'x-organizer-passcode': organizerPasscode }
          });
          if (res.ok) {
            showToast('Carona removida pelo organizador.');
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

  // --- Manipulação de Arquivo CSV (Drag & Drop e Input) ---
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
      showToast('Por favor, selecione um arquivo .csv válido.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingCSVContent = e.target.result;
      processPendingCSV(file.name);
    };
    reader.onerror = () => {
      showToast('Erro ao ler o arquivo selecionado.', 'error');
    };
    reader.readAsText(file);
  }

  // Pré-visualização do CSV antes da confirmação
  async function processPendingCSV(filename) {
    csvErrorBox.style.display = 'none';
    csvPreviewBox.style.display = 'none';

    if (!pendingCSVContent || !pendingCSVContent.trim()) {
      showToast('O arquivo CSV selecionado está vazio.', 'error');
      return;
    }

    const lines = pendingCSVContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    const rowCount = Math.max(0, lines.length - 1);

    previewSummaryText.textContent = `Arquivo "${filename}" com ${rowCount} participantes detectados. Pronto para validar e importar.`;
    csvPreviewBox.style.display = 'block';
  }

  // Confirmar Importação
  btnConfirmImport.addEventListener('click', async () => {
    if (!pendingCSVContent) return;

    btnConfirmImport.disabled = true;
    btnConfirmImport.textContent = 'Validando e Importando...';
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
        // Exibir erros de validação
        csvErrorList.innerHTML = '';
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach(err => {
            const li = document.createElement('li');
            li.textContent = err;
            csvErrorList.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.textContent = data.message || 'Falha ao importar arquivo CSV.';
          csvErrorList.appendChild(li);
        }
        csvErrorBox.style.display = 'block';
        showToast('Por favor, corrija os erros do CSV exibidos acima.', 'error');
      }
    } catch (err) {
      console.error('Erro na importação:', err);
      showToast('Erro de conexão durante a importação do CSV.', 'error');
    } finally {
      btnConfirmImport.disabled = false;
      btnConfirmImport.textContent = 'Salvar e Atualizar Lista de Participantes';
    }
  });

  // --- Carregamento Inicial ---
  fetchRides();
});
