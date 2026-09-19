/**
 * ScaleWithLakshya Outreach CRM - Configuration & Schema Constants
 */

const CONFIG = {
  APP_NAME: 'ScaleWithLakshya Outreach CRM',
  APP_VERSION: '1.0.0',
  SCHEMA_VERSION: '1.0',

  // Google OAuth Client ID - can be set here or entered via UI
  // Note: Web client ID is public in frontend code; never include client secret.
  GOOGLE_CLIENT_ID: '893886180549-s85s8ojfvj0kmq47k1quolgig31l5ttg.apps.googleusercontent.com',

  // OAuth Scopes: minimum practical scope for reading and writing CRM sheet
  OAUTH_SCOPES: 'https://www.googleapis.com/auth/spreadsheets',

  // Local Storage Keys (Never store tokens or secrets)
  STORAGE_KEYS: {
    SPREADSHEET_ID: 'swl_crm_spreadsheet_id',
    ACTIVE_VIEW: 'swl_crm_active_view'
  },

  // Sheet Names
  SHEETS: {
    LEADS: 'LEADS',
    ACTIVITY: 'ACTIVITY',
    SETTINGS: 'SETTINGS'
  },

  // Exact 24 columns for LEADS sheet
  LEADS_COLUMNS: [
    'lead_id',
    'business_name',
    'contact_name',
    'niche',
    'location',
    'website',
    'instagram',
    'email',
    'phone',
    'lead_source',
    'google_place_id',
    'lead_tier',
    'lead_score',
    'opportunity_score',
    'status',
    'date_added',
    'last_contacted_at',
    'next_follow_up_at',
    'notes',
    'normalized_domain',
    'normalized_phone',
    'record_version',
    'updated_at',
    'archived_at'
  ],

  // Exact 8 columns for ACTIVITY sheet
  ACTIVITY_COLUMNS: [
    'activity_id',
    'lead_id',
    'activity_at',
    'activity_type',
    'channel',
    'summary',
    'outcome',
    'notes'
  ],

  // Exact 6 columns for SETTINGS sheet
  SETTINGS_COLUMNS: [
    'setting_group',
    'setting_key',
    'setting_value',
    'active',
    'sort_order',
    'description'
  ],

  // Permitted Enum Values
  STATUSES: [
    'New',
    'Researching',
    'Ready to Contact',
    'Contacted',
    'Follow-up',
    'Replied',
    'Call Booked',
    'Call Completed',
    'Proposal Sent',
    'Won',
    'Lost'
  ],

  TIERS: ['A', 'B', 'C'],

  ACTIVITY_TYPES: [
    'Initial DM',
    'Follow-up #1',
    'Follow-up #2',
    'Follow-up #3',
    'Email Sent',
    'Reply Received',
    'Call Booked',
    'Call Completed',
    'Proposal Sent',
    'Won',
    'Lost',
    'Note Added',
    'Status Changed'
  ],

  // Contact activity types that trigger updating last_contacted_at
  // Do NOT update for: Note Added, Status Changed, Won, Lost
  CONTACT_ACTIVITY_TYPES: [
    'Initial DM',
    'Follow-up #1',
    'Follow-up #2',
    'Follow-up #3',
    'Email Sent',
    'Reply Received',
    'Call Booked',
    'Call Completed',
    'Proposal Sent'
  ],

  CHANNELS: [
    'Instagram',
    'Email',
    'Phone',
    'Website',
    'Other'
  ],

  LEAD_SOURCES: [
    'Manual',
    'Apify',
    'n8n',
    'Referral',
    'Instagram',
    'Google Maps',
    'Other'
  ]
};

// OAuth client IDs are public browser configuration, not secrets.
// Keep the configured client ID fixed in this file so it cannot be replaced
// through browser storage or an editable settings field.
function getGoogleClientId() {
  return CONFIG.GOOGLE_CLIENT_ID || '';
}

// Export for browser scope.
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.getGoogleClientId = getGoogleClientId;
}
