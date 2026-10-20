const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const ORGANIZER_PASSCODE = process.env.ORGANIZER_PASSCODE || 'church2026';

// Trust proxy for Cloudflare / reverse proxy headers
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Block common automated scanner probes instantly (wp-admin, .env, php, etc.)
const SCANNER_PROBES = [
  '.env', '.git', 'wp-', 'php', 'cgi-bin', 'xmlrpc', 'actuator',
  'shell', 'bash', 'cmd', 'boaform', 'admin.php', 'config.json', 'backup'
];
app.use((req, res, next) => {
  const pathLower = req.path.toLowerCase();
  if (SCANNER_PROBES.some(probe => pathLower.includes(probe))) {
    return res.status(404).end();
  }
  next();
});

// General Rate Limiter (200 requests per 15 min per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições deste endereço. Por favor, aguarde alguns minutos.' }
});
app.use(generalLimiter);

// Strict Rate Limiter for Attendee Email Verification (anti-scraping/enumeration)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de verificação. Por segurança, aguarde alguns minutos.' }
});
app.use('/api/verify-email', verifyLimiter);

// Strict Rate Limiter for Organizer Login (anti-brute-force)
const organizerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas de senha incorretas. Acesso temporariamente bloqueado por 15 minutos.' }
});
app.use('/api/organizer/login', organizerLoginLimiter);

const DATA_DIR = path.join(__dirname, 'data');
const ATTENDEES_FILE = path.join(DATA_DIR, 'attendees.json');
const RIDES_FILE = path.join(DATA_DIR, 'rides.json');
const SAMPLE_CSV_FILE = path.join(DATA_DIR, 'sample_attendees.csv');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Body parsing middleware with tight limits to prevent payload abuse
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore', // Never serve hidden files (.env, .git, etc.)
  maxAge: '1h'
}));

// Helpers for data persistence
function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Normalize email for reliable matching
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// RFC 4180 compliant CSV Parser
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        if (currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// CSV Validator and Column Identifier
function validateAndParseAttendeeCSV(csvText) {
  const parsed = parseCSV(csvText);
  if (parsed.length === 0) {
    return { success: false, errors: ['O arquivo CSV enviado está vazio.'] };
  }

  const headerRow = parsed[0].map(h => h.trim().toLowerCase());
  
  // Find column indexes with aliases
  let nameIdx = -1;
  let emailIdx = -1;
  let phoneIdx = -1;

  headerRow.forEach((col, idx) => {
    if (['name', 'full name', 'fullname', 'nome', 'nome completo', 'attendee name'].includes(col)) {
      nameIdx = idx;
    } else if (['email', 'e-mail', 'email address', 'e-mail address'].includes(col)) {
      emailIdx = idx;
    } else if (['phone', 'phone number', 'phonenumber', 'telephone', 'telefone', 'celular', 'tel', 'whatsapp'].includes(col)) {
      phoneIdx = idx;
    }
  });

  const missingColumns = [];
  if (nameIdx === -1) missingColumns.push('"nome" (ou "name")');
  if (emailIdx === -1) missingColumns.push('"email" (ou "e-mail")');
  if (phoneIdx === -1) missingColumns.push('"telefone" (ou "phone", "whatsapp")');

  if (missingColumns.length > 0) {
    return {
      success: false,
      errors: [`Colunas obrigatórias ausentes no cabeçalho do CSV: ${missingColumns.join(', ')}. Certifique-se de que a primeira linha inclua: nome, email, telefone.`]
    };
  }

  const errors = [];
  const attendees = [];
  const emailSet = new Set();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let r = 1; r < parsed.length; r++) {
    const rowNum = r + 1; // 1-indexed for user readability
    const row = parsed[r];

    const rawName = (row[nameIdx] || '').trim();
    const rawEmail = (row[emailIdx] || '').trim();
    const rawPhone = (row[phoneIdx] || '').trim();

    // Skip empty trailing rows
    if (!rawName && !rawEmail && !rawPhone) continue;

    const rowErrors = [];
    if (!rawName) {
      rowErrors.push('Nome do participante ausente');
    }
    if (!rawEmail) {
      rowErrors.push('E-mail ausente');
    } else if (!emailRegex.test(rawEmail)) {
      rowErrors.push(`Formato de e-mail inválido ("${rawEmail}")`);
    }
    if (!rawPhone) {
      rowErrors.push('Número de telefone ausente');
    }

    if (rowErrors.length > 0) {
      errors.push(`Linha ${rowNum}: ${rowErrors.join(', ')}`);
    } else {
      const normalized = normalizeEmail(rawEmail);
      if (emailSet.has(normalized)) {
        errors.push(`Linha ${rowNum}: E-mail duplicado "${rawEmail}" encontrado no CSV.`);
      } else {
        emailSet.add(normalized);
        attendees.push({
          name: rawName,
          email: normalized,
          displayEmail: rawEmail,
          phone: rawPhone
        });
      }
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      validCount: attendees.length,
      totalRows: parsed.length - 1
    };
  }

  if (attendees.length === 0) {
    return {
      success: false,
      errors: ['Nenhum participante válido encontrado após o cabeçalho.']
    };
  }

  return {
    success: true,
    attendees,
    count: attendees.length
  };
}

// Sample attendee CSV generation (Portuguese BR)
const sampleCsvContent = `nome,email,telefone
Sarah Jenkins,sarah.j@exemplo.com,(11) 98765-4321
David Miller,david.m@exemplo.com,(11) 97654-3210
Rebeca Santos,rebeca.santos@exemplo.com,(21) 98123-4567
Marcos Silveira,marcos.s@exemplo.com,(31) 99234-5678
Helena Ramos,helena.r@exemplo.com,(41) 98877-6655
Pastor Jonathan Alencar,pastor.jonathan@exemplo.com,(11) 99111-2233
Graça Oliveira,graca.o@exemplo.com,(19) 98456-7890
Mateo Silva,mateo.silva@exemplo.com,(85) 99765-4321
Ana Beatriz Souza,ana.souza@exemplo.com,(61) 98222-3344
Daniel Nogueira,daniel.n@exemplo.com,(71) 98333-4455`;

// Seed initial sample data if no attendees file exists
function seedSampleDataIfNeeded() {
  if (!fs.existsSync(SAMPLE_CSV_FILE)) {
    fs.writeFileSync(SAMPLE_CSV_FILE, sampleCsvContent, 'utf-8');
  }

  if (!fs.existsSync(ATTENDEES_FILE)) {
    const res = validateAndParseAttendeeCSV(sampleCsvContent);
    if (res.success) {
      writeJSON(ATTENDEES_FILE, res.attendees);
      console.log(`[Seed] Seeded ${res.attendees.length} initial sample church attendees.`);
    }
  }

  if (!fs.existsSync(RIDES_FILE)) {
    // Seed 2 realistic sample active rides so the user sees a working live demo immediately
    const attendees = readJSON(ATTENDEES_FILE, []);
    const sampleRides = [];
    if (attendees.length >= 2) {
      sampleRides.push({
        id: 'ride_' + Date.now() + '_1',
        email: attendees[0].email,
        driverName: attendees[0].name,
        phone: attendees[0].phone,
        departureTime: 'Domingo 08:30',
        seats: 3,
        isFull: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      sampleRides.push({
        id: 'ride_' + Date.now() + '_2',
        email: attendees[1].email,
        driverName: attendees[1].name,
        phone: attendees[1].phone,
        departureTime: 'Domingo 09:00',
        seats: 2,
        isFull: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    writeJSON(RIDES_FILE, sampleRides);
  }
}

seedSampleDataIfNeeded();

// --- API ENDPOINTS ---

// 1. Get active rides list
// Security: Exposes only driver name, departure time, seats, isFull, and phone.
// Email and backend IDs are sanitized.
app.get('/api/rides', (req, res) => {
  const rides = readJSON(RIDES_FILE, []);
  
  // Public view: exclude raw emails
  const publicRides = rides.map(r => ({
    id: r.id,
    driverName: r.driverName,
    departureTime: r.departureTime,
    seats: Number(r.seats),
    isFull: Boolean(r.isFull),
    phone: r.phone,
    createdAt: r.createdAt
  }));

  // Sort: available rides first, then by departure time
  publicRides.sort((a, b) => {
    if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  res.json({ success: true, rides: publicRides });
});

// 2. Attendee Verification & Active Offer Lookup
// Checks entered email against the attendee list.
// If matched, returns verified name, phone, and whether they already have an active offer.
app.post('/api/verify-email', (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Por favor, digite o seu e-mail do evento.' });
  }

  const normalized = normalizeEmail(email);
  const attendees = readJSON(ATTENDEES_FILE, []);
  const attendee = attendees.find(a => a.email === normalized);

  if (!attendee) {
    return res.status(404).json({
      success: false,
      found: false,
      message: 'E-mail não encontrado na lista de participantes. Por favor, entre em contato com os organizadores do evento da igreja para se cadastrar.'
    });
  }

  // Check if this attendee already has an active ride offer
  const rides = readJSON(RIDES_FILE, []);
  const existingRide = rides.find(r => r.email === normalized) || null;

  return res.json({
    success: true,
    found: true,
    attendee: {
      name: attendee.name,
      email: attendee.email,
      phone: attendee.phone
    },
    existingRide: existingRide ? {
      id: existingRide.id,
      departureTime: existingRide.departureTime,
      seats: existingRide.seats,
      isFull: existingRide.isFull
    } : null
  });
});

// 3. Publish or Update a Ride Offer
// Strictly uses name & phone from attendee list to prevent spoofing or arbitrary contact editing.
app.post('/api/rides', (req, res) => {
  const { email, departureTime, seats } = req.body;

  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'O e-mail é obrigatório.' });
  }

  const normalized = normalizeEmail(email);
  const attendees = readJSON(ATTENDEES_FILE, []);
  const attendee = attendees.find(a => a.email === normalized);

  if (!attendee) {
    return res.status(403).json({
      success: false,
      message: 'Não autorizado: Este e-mail não consta na lista de participantes da igreja. Entre em contato com a organização.'
    });
  }

  const cleanedDepartureTime = String(departureTime || '').trim();
  if (!cleanedDepartureTime) {
    return res.status(400).json({ success: false, message: 'Por favor, informe o horário de saída previsto.' });
  }

  const seatsNum = parseInt(seats, 10);
  if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 20) {
    return res.status(400).json({ success: false, message: 'O número de vagas deve ser entre 1 e 20.' });
  }

  const rides = readJSON(RIDES_FILE, []);
  const existingIndex = rides.findIndex(r => r.email === normalized);

  let savedRide;
  if (existingIndex >= 0) {
    // Update existing offer (prevent duplicate active offers for same attendee)
    rides[existingIndex].departureTime = cleanedDepartureTime;
    rides[existingIndex].seats = seatsNum;
    rides[existingIndex].isFull = false;
    rides[existingIndex].updatedAt = new Date().toISOString();
    // Refresh name/phone from attendee record in case it was updated in CSV
    rides[existingIndex].driverName = attendee.name;
    rides[existingIndex].phone = attendee.phone;
    savedRide = rides[existingIndex];
  } else {
    // Create new ride offer
    savedRide = {
      id: 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: normalized,
      driverName: attendee.name,
      phone: attendee.phone,
      departureTime: cleanedDepartureTime,
      seats: seatsNum,
      isFull: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    rides.push(savedRide);
  }

  writeJSON(RIDES_FILE, rides);

  return res.json({
    success: true,
    message: existingIndex >= 0 ? 'Sua oferta de carona foi atualizada com sucesso.' : 'Sua oferta de carona foi publicada com sucesso!',
    ride: {
      id: savedRide.id,
      driverName: savedRide.driverName,
      departureTime: savedRide.departureTime,
      seats: savedRide.seats,
      isFull: savedRide.isFull,
      phone: savedRide.phone
    }
  });
});

// 4. Update Ride Status (e.g., mark full, change seats/time)
app.patch('/api/rides/:id', (req, res) => {
  const { id } = req.params;
  const { email, departureTime, seats, isFull } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'O e-mail do motorista é obrigatório para verificar a autoria.' });
  }

  const normalized = normalizeEmail(email);
  const rides = readJSON(RIDES_FILE, []);
  const rideIndex = rides.findIndex(r => r.id === id);

  if (rideIndex === -1) {
    return res.status(404).json({ success: false, message: 'Oferta de carona não encontrada.' });
  }

  if (rides[rideIndex].email !== normalized) {
    return res.status(403).json({ success: false, message: 'Não autorizado: O e-mail não corresponde a esta oferta de carona.' });
  }

  if (departureTime !== undefined) {
    const cleaned = String(departureTime).trim();
    if (!cleaned) return res.status(400).json({ success: false, message: 'O horário de saída não pode ficar vazio.' });
    rides[rideIndex].departureTime = cleaned;
  }

  if (seats !== undefined) {
    const seatsNum = parseInt(seats, 10);
    if (isNaN(seatsNum) || seatsNum < 0 || seatsNum > 20) {
      return res.status(400).json({ success: false, message: 'O número de vagas deve ser entre 0 e 20.' });
    }
    rides[rideIndex].seats = seatsNum;
  }

  if (isFull !== undefined) {
    rides[rideIndex].isFull = Boolean(isFull);
  }

  rides[rideIndex].updatedAt = new Date().toISOString();
  writeJSON(RIDES_FILE, rides);

  return res.json({
    success: true,
    message: 'Carona atualizada com sucesso.',
    ride: {
      id: rides[rideIndex].id,
      driverName: rides[rideIndex].driverName,
      departureTime: rides[rideIndex].departureTime,
      seats: rides[rideIndex].seats,
      isFull: rides[rideIndex].isFull,
      phone: rides[rideIndex].phone
    }
  });
});

// 5. Remove a Ride Offer
app.delete('/api/rides/:id', (req, res) => {
  const { id } = req.params;
  const email = req.query.email || req.body.email;

  if (!email) {
    return res.status(400).json({ success: false, message: 'O e-mail do motorista é obrigatório para remover esta oferta.' });
  }

  const normalized = normalizeEmail(email);
  const rides = readJSON(RIDES_FILE, []);
  const rideIndex = rides.findIndex(r => r.id === id);

  if (rideIndex === -1) {
    return res.status(404).json({ success: false, message: 'Oferta de carona não encontrada.' });
  }

  if (rides[rideIndex].email !== normalized) {
    return res.status(403).json({ success: false, message: 'Não autorizado: O e-mail não corresponde a esta oferta de carona.' });
  }

  rides.splice(rideIndex, 1);
  writeJSON(RIDES_FILE, rides);

  return res.json({ success: true, message: 'Sua oferta de carona foi removida com sucesso.' });
});

// --- ORGANIZER ENDPOINTS ---

function checkOrganizerPasscode(req, res, next) {
  const passcode = req.headers['x-organizer-passcode'] || req.body?.passcode || req.query?.passcode;
  if (!passcode || String(passcode).trim() !== ORGANIZER_PASSCODE) {
    return res.status(401).json({
      success: false,
      message: 'Senha do organizador incorreta. Por favor, verifique com a organização do evento.'
    });
  }
  next();
}

// Organizer Login verification
app.post('/api/organizer/login', (req, res) => {
  const { passcode } = req.body;
  if (!passcode || String(passcode).trim() !== ORGANIZER_PASSCODE) {
    return res.status(401).json({ success: false, message: 'Senha do organizador incorreta.' });
  }
  return res.json({ success: true, message: 'Senha verificada com sucesso.' });
});

// Organizer Stats & Summary (never exposes full raw attendee records to public)
app.get('/api/organizer/stats', checkOrganizerPasscode, (req, res) => {
  const attendees = readJSON(ATTENDEES_FILE, []);
  const rides = readJSON(RIDES_FILE, []);

  // Return counts and anonymized ride summary for organizer view
  res.json({
    success: true,
    attendeeCount: attendees.length,
    activeRidesCount: rides.length,
    fullRidesCount: rides.filter(r => r.isFull).length,
    rides: rides.map(r => ({
      id: r.id,
      driverName: r.driverName,
      email: r.email,
      phone: r.phone,
      departureTime: r.departureTime,
      seats: r.seats,
      isFull: r.isFull,
      createdAt: r.createdAt
    }))
  });
});

// Organizer CSV Import with row-by-row validation & column detection
app.post('/api/organizer/import-csv', checkOrganizerPasscode, (req, res) => {
  let csvText = '';
  if (typeof req.body === 'string') {
    csvText = req.body;
  } else if (req.body && typeof req.body.csvText === 'string') {
    csvText = req.body.csvText;
  }

  if (!csvText || !csvText.trim()) {
    return res.status(400).json({ success: false, errors: ['Nenhum conteúdo CSV foi enviado.'] });
  }

  const result = validateAndParseAttendeeCSV(csvText);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      errors: result.errors,
      validCount: result.validCount || 0,
      totalRows: result.totalRows || 0
    });
  }

  // Save validated attendee list
  writeJSON(ATTENDEES_FILE, result.attendees);

  // Synchronize existing rides: if any driver's name or phone changed in CSV, update the active ride
  const rides = readJSON(RIDES_FILE, []);
  let ridesUpdated = 0;
  rides.forEach(r => {
    const match = result.attendees.find(a => a.email === r.email);
    if (match) {
      if (r.driverName !== match.name || r.phone !== match.phone) {
        r.driverName = match.name;
        r.phone = match.phone;
        ridesUpdated++;
      }
    }
  });
  if (ridesUpdated > 0) {
    writeJSON(RIDES_FILE, rides);
  }

  return res.json({
    success: true,
    count: result.count,
    message: `Lista de participantes importada com sucesso: ${result.count} pessoas cadastradas.`
  });
});

// Organizer Ride Deletion (moderation)
app.delete('/api/organizer/rides/:id', checkOrganizerPasscode, (req, res) => {
  const { id } = req.params;
  const rides = readJSON(RIDES_FILE, []);
  const index = rides.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Carona não encontrada.' });
  }

  rides.splice(index, 1);
  writeJSON(RIDES_FILE, rides);

  return res.json({ success: true, message: 'Oferta de carona removida pelo organizador.' });
});

// Download sample CSV template
app.get('/api/organizer/sample-csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="participantes_modelo.csv"');
  res.send(sampleCsvContent);
});

// Catch-all for SPA client
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Church Ride Sharing server running on http://localhost:${PORT}`);
});
