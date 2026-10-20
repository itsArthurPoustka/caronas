# Church Event Ride Sharing (Caronas da Igreja)

A simple, practical ride-sharing and carpool coordination web application for church events. Designed to be mobile-first, easy to use on smartphones, and free of unnecessary bloat.

The application serves purely as a **contact and coordination tool**—it connects drivers with empty seats to attendees needing a ride without intrusive tracking, payment gateways, map routing, or automated ride assignments.

---

## Features

### 1. Find a Ride
- **Mobile-First Scan**: Clear, readable list of active ride offers optimized for scanning on phone screens.
- **Offer Details**: Displays the driver's verified name, departure time, available seats badge, and a **direct tap-to-call button** (`tel:` link) plus quick SMS button.
- **Real-Time Filtering**: Search filter by driver name or departure time.
- **Direct Contact Note**: Reminds riders to call or text drivers directly to coordinate pickup spots.
- **Friendly Empty State**: Warm encouraging message and direct button to offer the first ride when no offers exist yet.

### 2. Offer a Ride
- **Attendee Verification**: Drivers enter their registered event email, which is matched server-side against the official church attendee list.
- **Zero Manual Phone Input**: The driver's name and contact phone number are pulled directly from the organizer's CSV roster. Drivers cannot change or mistype their phone numbers.
- **Unregistered Attendee Protection**: If an email is not found on the roster, the user cannot publish an offer and is shown a clear message to contact the church event organizers.
- **Duplicate Prevention**: If an attendee already has an active ride listing, entering their email allows them to **update their departure time and seats**, **mark the ride as full**, or **cancel/remove their listing**.
- **Streamlined Form**: Includes quick-pick departure time chips (e.g., `Sunday 8:30 AM`, `Sunday 9:00 AM`, `Sunday 5:30 PM`) and an intuitive seat counter stepper.
- **Privacy By Design**: No car make, model, license plate, home address, or unnecessary personal data is ever collected.

### 3. Organizer Setup & CSV Import
- **Passcode-Protected Portal**: Discreet "Organizer" access point protected by a passcode (default: `church2026`, configurable via `.env`).
- **CSV Roster Importer**: Drag-and-drop or file selector to upload attendee rosters.
- **Smart Column Detection**: Accepts header variations such as `name`, `full name`, `nome`, `email`, `e-mail`, `phone`, `phone number`, `telefone`, `whatsapp`.
- **Row-by-Row Error Reporting**: Highlights missing fields, invalid email formats, or duplicate emails with exact row numbers.
- **Roster Privacy**: The raw attendee roster is strictly stored server-side to verify drivers and is never exposed to the public.
- **Sample Template Download**: Built-in button to download a ready-to-use CSV template (`attendees_sample.csv`).
- **Live Event Stats**: Shows real-time counts for verified attendees, active ride offers, and full rides.

---

## Tradeoff & Architecture Summary

| Concern | Chosen Approach | Tradeoff Rationale |
|---|---|---|
| **Attendee Access** | **Open Event Link** | Eliminates registration friction on Sunday mornings. Church members open the link from WhatsApp or the church bulletin and view rides immediately. |
| **Driver Identity** | **Email Lookup & Server Verification** | Drivers confirm their email against the organizer CSV. The driver's phone is displayed *only* alongside their active ride listing so riders can reach them. Raw rosters remain confidential. |
| **Duplicate Prevention** | **Single Active Ride Per Attendee** | Prevents clutter. Looking up the driver's email automatically opens update/remove controls. |
| **Organizer Access** | **Passcode-Protected Portal** | Fast access for event staff without requiring complex user database tables or third-party OAuth setup. |

---

## Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher (tested on Node v22)
- npm v9 or higher

### Installation & Running

1. **Clone or navigate to the repository**:
   ```bash
   cd Caronas
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```
   Or run in development mode with automatic restart:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) on your desktop or mobile browser.

---

## Organizer Setup Instructions

1. Click the **"⚙️ Organizer"** button in the top-right corner of the app.
2. Enter the organizer passcode: `church2026` (or the custom passcode defined in `.env`).
3. Under **Import Attendee Roster**, drag and drop your attendee CSV file (or click to browse).
4. Review the parsed row count and any errors.
5. Click **"Save & Update Attendee Roster"**.

### Attendee CSV Format
The CSV must include headers for name, email, and phone number:

```csv
name,email,phone
Sarah Jenkins,sarah.j@example.com,(555) 234-5678
David Miller,david.m@example.com,(555) 345-6789
Rebecca Santos,rebecca.santos@example.com,(555) 456-7890
Marcus Thorne,marcus.t@example.com,(555) 567-8901
```

You can also download a sample CSV directly from the Organizer setup modal.

---

## Configuration (`.env`)

You can customize the port and organizer passcode by creating a `.env` file (or copying `.env.example`):

```bash
PORT=3000
ORGANIZER_PASSCODE=church2026
```

---

## File Structure

```
Caronas/
├── server.js              # Express API server, CSV parsing, data persistence
├── package.json           # Project metadata and start scripts
├── .env.example           # Environment variables template
├── README.md              # Documentation and guide
├── data/                  # Persistent data store (auto-created)
│   ├── attendees.json     # Verified attendee roster (secure server store)
│   ├── rides.json         # Active ride listings
│   └── sample_attendees.csv
└── public/
    ├── index.html         # Mobile-first single page interface
    ├── css/
    │   └── style.css      # Modern design system, responsive styles
    └── js/
        └── app.js         # Frontend interactions, verification & API calls
```
