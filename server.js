const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ORGANIZER_PASSCODE = process.env.ORGANIZER_PASSCODE || 'church2026';

const DATA_DIR = path.join(__dirname, 'data');
const ATTENDEES_FILE = path.join(DATA_DIR, 'attendees.json');
const RIDES_FILE = path.join(DATA_DIR, 'rides.json');
const SAMPLE_CSV_FILE = path.join(DATA_DIR, 'sample_attendees.csv');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    return { success: false, errors: ['The uploaded CSV file is empty.'] };
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
  if (nameIdx === -1) missingColumns.push('"name" (or "Nome")');
  if (emailIdx === -1) missingColumns.push('"email" (or "E-mail")');
  if (phoneIdx === -1) missingColumns.push('"phone" (or "Telefone")');

  if (missingColumns.length > 0) {
    return {
      success: false,
      errors: [`Missing required columns in CSV header: ${missingColumns.join(', ')}. Please ensure the header row includes: name, email, phone.`]
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
      rowErrors.push('Missing attendee name');
    }
    if (!rawEmail) {
      rowErrors.push('Missing email address');
    } else if (!emailRegex.test(rawEmail)) {
      rowErrors.push(`Invalid email format ("${rawEmail}")`);
    }
    if (!rawPhone) {
      rowErrors.push('Missing phone number');
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
    } else {
      const normalized = normalizeEmail(rawEmail);
      if (emailSet.has(normalized)) {
        errors.push(`Row ${rowNum}: Duplicate email "${rawEmail}" found in CSV.`);
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
      errors: ['No valid attendee records found after header row.']
    };
  }

  return {
    success: true,
    attendees,
    count: attendees.length
  };
}

// Sample attendee CSV generation
const sampleCsvContent = `name,email,phone
Sarah Jenkins,sarah.j@example.com,(555) 234-5678
David Miller,david.m@example.com,(555) 345-6789
Rebecca Santos,rebecca.santos@example.com,(555) 456-7890
Marcus Thorne,marcus.t@example.com,(555) 567-8901
Elena Rostova,elena.r@example.com,(555) 678-9012
Pastor Johnathan Vance,pastor.john@example.com,(555) 789-0123
Grace O'Connor,grace.oc@example.com,(555) 890-1234
Mateo Silva,mateo.silva@example.com,(555) 901-2345
Hannah Abbott,hannah.a@example.com,(555) 123-4567
Daniel Washington,daniel.w@example.com,(555) 234-9876`;

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
        departureTime: 'Sunday 8:30 AM',
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
        departureTime: 'Sunday 9:00 AM',
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
    return res.status(400).json({ success: false, message: 'Please enter your event email address.' });
  }

  const normalized = normalizeEmail(email);
  const attendees = readJSON(ATTENDEES_FILE, []);
  const attendee = attendees.find(a => a.email === normalized);

  if (!attendee) {
    return res.status(404).json({
      success: false,
      found: false,
      message: 'Email not found on the registered attendee list. Please contact the church event organizers so they can add you to the attendee roster.'
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
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const normalized = normalizeEmail(email);
  const attendees = readJSON(ATTENDEES_FILE, []);
  const attendee = attendees.find(a => a.email === normalized);

  if (!attendee) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Email is not on the church attendee list. Contact the event organizers to register.'
    });
  }

  const cleanedDepartureTime = String(departureTime || '').trim();
  if (!cleanedDepartureTime) {
    return res.status(400).json({ success: false, message: 'Please provide your planned departure time.' });
  }

  const seatsNum = parseInt(seats, 10);
  if (isNaN(seatsNum) || seatsNum < 1 || seatsNum > 20) {
    return res.status(400).json({ success: false, message: 'Available seats must be between 1 and 20.' });
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
    message: existingIndex >= 0 ? 'Your ride offer was updated successfully.' : 'Your ride offer is now published!',
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
    return res.status(400).json({ success: false, message: 'Driver email is required to verify ownership.' });
  }

  const normalized = normalizeEmail(email);
  const rides = readJSON(RIDES_FILE, []);
  const rideIndex = rides.findIndex(r => r.id === id);

  if (rideIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ride offer not found.' });
  }

  if (rides[rideIndex].email !== normalized) {
    return res.status(403).json({ success: false, message: 'Unauthorized: Email does not match this ride listing.' });
  }

  if (departureTime !== undefined) {
    const cleaned = String(departureTime).trim();
    if (!cleaned) return res.status(400).json({ success: false, message: 'Departure time cannot be empty.' });
    rides[rideIndex].departureTime = cleaned;
  }

  if (seats !== undefined) {
    const seatsNum = parseInt(seats, 10);
    if (isNaN(seatsNum) || seatsNum < 0 || seatsNum > 20) {
      return res.status(400).json({ success: false, message: 'Seats must be between 0 and 20.' });
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
    message: 'Ride updated successfully.',
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
    return res.status(400).json({ success: false, message: 'Driver email is required to remove this listing.' });
  }

  const normalized = normalizeEmail(email);
  const rides = readJSON(RIDES_FILE, []);
  const rideIndex = rides.findIndex(r => r.id === id);

  if (rideIndex === -1) {
    return res.status(404).json({ success: false, message: 'Ride offer not found.' });
  }

  if (rides[rideIndex].email !== normalized) {
    return res.status(403).json({ success: false, message: 'Unauthorized: Email does not match this ride listing.' });
  }

  rides.splice(rideIndex, 1);
  writeJSON(RIDES_FILE, rides);

  return res.json({ success: true, message: 'Your ride offer has been removed.' });
});

// --- ORGANIZER ENDPOINTS ---

function checkOrganizerPasscode(req, res, next) {
  const passcode = req.headers['x-organizer-passcode'] || req.body?.passcode || req.query?.passcode;
  if (!passcode || String(passcode).trim() !== ORGANIZER_PASSCODE) {
    return res.status(401).json({
      success: false,
      message: 'Invalid organizer passcode. Please check the code with event management.'
    });
  }
  next();
}

// Organizer Login verification
app.post('/api/organizer/login', (req, res) => {
  const { passcode } = req.body;
  if (!passcode || String(passcode).trim() !== ORGANIZER_PASSCODE) {
    return res.status(401).json({ success: false, message: 'Invalid organizer passcode.' });
  }
  return res.json({ success: true, message: 'Passcode verified.' });
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
    return res.status(400).json({ success: false, errors: ['No CSV content provided.'] });
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
    message: `Successfully imported and verified ${result.count} church event attendees.`
  });
});

// Organizer Ride Deletion (moderation)
app.delete('/api/organizer/rides/:id', checkOrganizerPasscode, (req, res) => {
  const { id } = req.params;
  const rides = readJSON(RIDES_FILE, []);
  const index = rides.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Ride not found.' });
  }

  rides.splice(index, 1);
  writeJSON(RIDES_FILE, rides);

  return res.json({ success: true, message: 'Ride listing removed by organizer.' });
});

// Download sample CSV template
app.get('/api/organizer/sample-csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendees_sample.csv"');
  res.send(sampleCsvContent);
});

// Catch-all for SPA client
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Church Ride Sharing server running on http://localhost:${PORT}`);
});
