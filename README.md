# ScaleWithLakshya Outreach CRM

A personal single-user **Outreach CRM** for **ScaleWithLakshya**.

Google Sheets is the source of truth. A small Express backend caches lead and activity data in memory and serves the MyCRM frontend from the same origin.

```text
Google Sheets  →  Express backend (memory cache)  →  MyCRM frontend
```

Start the app with `start-crm.bat`. You do not need VS Code, Live Server, or a separate frontend server.

---

## Key Highlights

- **One launcher**: Double-click `start-crm.bat` to start Express and open the browser.
- **Same-origin app**: The UI is served at `http://localhost:3000` and calls `/api` on the same host.
- **Google Sheets source of truth**: The backend reads LEADS and ACTIVITY from Sheets into an in-memory cache.
- **Explicit refresh**: Dashboard **Refresh** reloads both sheets from Google and replaces the cache.
- **Instagram DM Workflow**: Open prospect Instagram profiles, log DM touchpoints, and track outreach status.
- **Follow-up Desk**: Triage Overdue, Due Today, and Upcoming outreach with rescheduling.
- **CSV import/export**: Backup and import tools remain available in Settings.

---

## My Actual Workflow

1. **Add prospect**: Quickly enter Business Name, Niche, Location, and Instagram Handle (`@handle`).
2. **Review prospect**: Open lead profile drawer to read notes and history.
3. **Open Instagram**: Click **Open Instagram** to launch `https://instagram.com/handle` in a new tab.
4. **Send Instagram DM**: Send your outreach message on Instagram.
5. **Record outreach**: Click **Log DM / Touchpoint** to log interaction & auto-update last contacted timestamp.
6. **Set follow-up**: Set next follow-up date (+1 Day, +3 Days, +1 Week presets).
7. **Track status**: Transition status from `NOT CONTACTED` &rarr; `DM SENT` &rarr; `REPLIED` &rarr; `CALL BOOKED` &rarr; `WON` / `LOST`.

---

## Workflow Statuses

- `NOT CONTACTED`: New prospect awaiting initial outreach.
- `DM SENT`: Initial Instagram DM or outreach message sent.
- `REPLIED`: Prospect replied to your DM or email.
- `CALL BOOKED`: Discovery / sales call scheduled.
- `WON`: Closed client for ScaleWithLakshya.
- `LOST`: Unresponsive or passed on offer.

---

## Data Model

Lead and activity records live in Google Sheets tabs named **LEADS** and **ACTIVITY**. The Node backend maps those rows into the CRM UI. The browser does not store a separate database.

---

## Running Locally

1. Install [Node.js](https://nodejs.org) (includes npm).
2. Configure `server/.env` with the Google service account and spreadsheet ID. See `server/README.md`.
3. Double-click `start-crm.bat`.

The launcher starts Express, waits until `http://localhost:3000` responds, and opens the browser.

You can also start the backend manually:

```bash
cd server
npm install
npm start
```

Then open `http://localhost:3000`.

Do **not** open `index.html` as a file, and do **not** use Live Server or a Python HTTP server. Those split the frontend from the API.
