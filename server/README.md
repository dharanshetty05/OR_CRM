# CRM Node.js Backend

This is a tiny Node.js backend for the CRM, designed to intermediate between the frontend and Google Sheets. It securely authenticates using a Google Cloud Service Account, keeping all credentials strictly server-side.

## Setup Instructions

### 1. Install Node.js
Ensure you have Node.js and npm installed on your system.

### 2. Install Dependencies
Run the following command in the `server` directory:
```bash
npm install
```

### 3. Google Cloud Configuration (Manual Setup Required)
To connect this backend to Google Sheets, you need to perform the following steps in Google Cloud:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or use an existing one).
3. Enable the **Google Sheets API** for the project.
4. Go to **IAM & Admin > Service Accounts** and create a new Service Account.
5. Create and download a **JSON key** for this service account.
6. Open the JSON file to find the `client_email` and `private_key`.

### 4. Google Sheets Configuration
1. Create a new Google Sheet (or open your existing one).
2. Ensure it has two tabs named exactly:
   - `LEADS`
   - `ACTIVITY`
3. Click **Share** in the top right corner of your Google Sheet.
4. Share the sheet with the Service Account email (`client_email`) and give it **Editor** access.
5. Copy the Spreadsheet ID from the URL. (It's the long string between `/d/` and `/edit`).

### 5. Environment Variables
1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
2. Fill in the values in `.env`:
   - `GOOGLE_SHEET_ID`: The ID copied from the Google Sheet URL.
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The `client_email` from the JSON key.
   - `GOOGLE_PRIVATE_KEY`: The `private_key` from the JSON key. Keep the quotes around it, e.g. `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`.

### 6. Run the Server
```bash
npm run dev
```

The server will start on port 3000 (or the port specified in `.env`) and verify the Google Sheets connection on startup.

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get a specific lead
- `POST /api/leads` - Create a new lead
- `PATCH /api/leads/:id` - Update a lead
- `DELETE /api/leads/:id` - Delete a lead
- `GET /api/activities` - Get all activities
- `GET /api/activities/:leadId` - Get activities for a lead
- `POST /api/activities` - Create an activity

**Note:** Frontend integration has NOT been performed yet. The current frontend still operates independently of this backend.
