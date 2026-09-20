# ScaleWithLakshya Outreach CRM

A streamlined, personal single-user **Outreach CRM** built specifically for **ScaleWithLakshya**.

The application runs 100% locally in your browser with **zero authentication**, **zero setup**, and **zero external network dependencies**, storing your lead database directly inside browser-native **IndexedDB**.

---

## Key Highlights

- **Zero Auth / Zero Login**: Opens directly into your CRM every time you launch or refresh the application.
- **Local-First Persistence**: Data is stored safely in browser IndexedDB (`SWL_CRM_DB`) across refreshes and restarts.
- **Instagram DM Workflow**: Fast, 1-click access to open prospect Instagram profiles (`https://instagram.com/handle`), log DM touchpoints, and track outreach status.
- **Data Backup & Transfer**: Built-in 1-click **Export Full Backup (JSON)**, **Export Leads (CSV)**, and **Import Data (JSON/CSV)** capabilities in Settings.
- **Follow-up Desk**: Triage Overdue, Due Today, and Upcoming outreach touches with 1-click rescheduling.
- **Linear/Attio Aesthetic**: Clean, responsive, keyboard-accessible UI with dark-mode toast notifications and smooth slide-over lead detail drawers.

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

## Data Model & Backup

### IndexedDB Object Stores

- **`leads`**: `lead_id`, `business_name`, `contact_name`, `niche`, `location`, `website`, `instagram`, `email`, `phone`, `status`, `lead_tier`, `lead_source`, `notes`, `last_contacted_at`, `next_follow_up_at`, `date_added`, `updated_at`, `archived_at`.
- **`activities`**: `activity_id`, `lead_id`, `activity_at`, `activity_type`, `channel`, `summary`, `outcome`, `notes`.

### Export / Import

In **Settings**:
- **Export Full Backup (JSON)**: Creates a complete JSON snapshot file containing all leads and activities.
- **Export Leads (CSV)**: Generates a CSV file of active leads for viewing in Excel or Google Sheets.
- **Import JSON / CSV**: Restores a JSON backup file or imports leads directly from a CSV file.

---

## Running Locally

Serve the directory using any static HTTP server (or open `index.html` directly):

```bash
# Python
python -m http.server 8000

# Or npx
npx serve .
```

Open `http://localhost:8000` in your browser.
