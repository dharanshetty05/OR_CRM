# ScaleWithLakshya Outreach CRM

A private, browser-only Outreach CRM engineered specifically for **ScaleWithLakshya**. The application runs 100% client-side in the browser, authenticates via Google Identity Services (GIS), and uses your private Google Sheet directly as its persistence engine through the Google Sheets REST API v4.

---

## Key Highlights

- **Zero Server / Backend**: No Node.js runtime, no backend server, no Apps Script, no database setup required.
- **Private Google Sheet**: The Sheet remains 100% private. Never published to the web or made publicly editable.
- **Direct REST API**: Browser communicates directly with `https://sheets.googleapis.com/v4/spreadsheets/...` using the user's OAuth access token.
- **Optimistic Concurrency**: Prevents accidental data overwrites using `record_version` validation.
- **Deterministic Duplicate Prevention**: Automatically blocks duplicate leads based on Google Place ID, normalized website domain, normalized phone, or matching Business Name + Location.
- **Follow-up Desk**: Real-time triage of Overdue, Due Today, and Upcoming outreach touches.
- **Modern Aesthetic**: Clean, responsive, keyboard-accessible interface inspired by Linear, Notion, and Attio.

---

## One-Time Google Cloud Setup

Following the official [Google Sheets API JavaScript Quickstart](https://developers.google.com/workspace/sheets/api/quickstart/js):

### 1. Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `SWL-CRM`) or select an existing one.

### 2. Enable Google Sheets API
1. In Google Cloud Console, navigate to **APIs & Services > Library**.
2. Search for **Google Sheets API**.
3. Click **Enable**.

### 3. Configure OAuth Consent Screen
1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace).
3. Set App Name to `ScaleWithLakshya Outreach CRM` and enter your user support email.
4. Under **Scopes**, add `https://www.googleapis.com/auth/spreadsheets` (or simply proceed; the app requests this scope on sign-in).
5. If using External User Type in Testing mode, under **Test Users**, add the Google email address that owns your CRM Sheet.
6. Save and finish.

### 4. Create OAuth 2.0 Web Client ID
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Set Application Type to **Web application**.
4. Name: `ScaleWithLakshya CRM Web Client`.
5. Under **Authorized JavaScript origins**, add the origin where you run the CRM:
   - For local development: `http://localhost:8000` (or `http://127.0.0.1:8000`)
   - For hosted domain (e.g. GitHub Pages or custom domain): `https://your-domain.com`
6. Click **Create**.
7. Copy your **Client ID** (looks like: `1234567890-abcdef.apps.googleusercontent.com`).
   *(Note: You do **not** need a client secret. The browser never receives or stores a client secret).*

---

## Running the Application

1. Open `config.js` and paste your Client ID:
   ```javascript
   GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com'
   ```
   *(Alternatively, you can leave it blank in code and enter it directly into the CRM setup screen; it will be saved in your browser's local storage).*

2. Serve the directory with any local static HTTP server (to ensure Google OAuth origins match):
   ```bash
   # Python
   python -m http.server 8000

   # Or npx
   npx serve .
   ```

3. Open `http://localhost:8000` in your browser.

4. Follow the 3-step setup:
   - Click **Sign in with Google** to authorize your account.
   - Paste your private Google Sheet URL (e.g. `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`).
   - Click **Connect Sheet**.
   - The CRM validates your Sheet, automatically provisions any missing tabs (`LEADS`, `ACTIVITY`, `SETTINGS`) and column headers, and opens your CRM Dashboard.

---

## Database Schema Reference

The CRM provisions and manages exactly 3 sheets in your Google Sheet:

### 1. `LEADS` (24 Columns)
`lead_id`, `business_name`, `contact_name`, `niche`, `location`, `website`, `instagram`, `email`, `phone`, `lead_source`, `google_place_id`, `lead_tier`, `lead_score`, `opportunity_score`, `status`, `date_added`, `last_contacted_at`, `next_follow_up_at`, `notes`, `normalized_domain`, `normalized_phone`, `record_version`, `updated_at`, `archived_at`

### 2. `ACTIVITY` (8 Columns)
`activity_id`, `lead_id`, `activity_at`, `activity_type`, `channel`, `summary`, `outcome`, `notes`

### 3. `SETTINGS` (6 Columns)
`setting_group`, `setting_key`, `setting_value`, `active`, `sort_order`, `description`

---

## Security & Privacy

- **OAuth client ID is public by design**: The browser must contain the OAuth web client ID. It is an identifier, not a secret. No OAuth client secret is used in this browser application.
- **Access tokens are memory-only**: OAuth access tokens are never written to `localStorage`, `sessionStorage`, IndexedDB, URLs, or source files.
- **No refresh tokens**: The browser does not persist reusable Google credentials.
- **Low-friction returning sessions**: On startup, the app first attempts silent authorization. If Google can restore the previously granted authorization, no account chooser or consent screen is shown.
- **Controlled reauthorization**: If silent authorization is unavailable or an access token is rejected, the app asks you to reconnect Google instead of repeatedly opening authorization UI.
- **Private Sheet**: The Google Sheet remains private and is accessed using the signed-in Google account's permissions.
- **No client-side secret enforcement**: Because this is a browser-only application, the OAuth client ID can be inspected by anyone who can inspect the application source. Security of the CRM data comes from Google's authorization and the Sheet's private permissions, not from hiding the client ID.
- **Safe data rendering**: CRM data is escaped before being inserted into HTML and external links are restricted to expected protocols.
- **Deterministic deduplication**: Checks `google_place_id`, domain, phone, and business name + location without third-party network calls.
