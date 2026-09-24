/**
 * ScaleWithLakshya Outreach CRM - Configuration Constants
 * Cleaned & simplified for local single-user architecture.
 */

const CONFIG = {
  APP_NAME: 'ScaleWithLakshya Outreach CRM',
  APP_VERSION: '2.0.0 (Local Edition)',

  // Local Storage Keys
  STORAGE_KEYS: {
    ACTIVE_VIEW: 'swl_crm_active_view'
  },

  // Same-origin API prefix served by Express
  API_BASE_URL: '/api',

  // Simple, editable daily outreach goal used by the "Today's Progress"
  // indicator on the dashboard. Not a settings system - just a constant.
  DAILY_OUTREACH_TARGET: 20,

  // Primary Outreach Statuses
  STATUSES: [
    'NOT CONTACTED',
    'DM SENT',
    'REPLIED',
    'CALL BOOKED',
    'WON',
    'LOST'
  ],

  ACTIVITY_TYPES: [
    'Initial DM',
    'Follow-up #1',
    'Follow-up #2',
    'Follow-up #3',
    'Reply Received',
    'Call Booked',
    'Call Completed',
    'Proposal Sent',
    'Won',
    'Lost',
    'Note Added',
    'Status Changed'
  ],

  // Activity types that automatically update `last_contacted_at`
  CONTACT_ACTIVITY_TYPES: [
    'Initial DM',
    'Follow-up #1',
    'Follow-up #2',
    'Follow-up #3',
    'Reply Received',
    'Call Booked',
    'Call Completed',
    'Proposal Sent'
  ],

  CHANNELS: [
    'Instagram',
    'Website',
    'Other'
  ],

  LEAD_SOURCES: [
    'Manual',
    'Instagram',
    'Apify',
    'n8n',
    'Google Maps',
    'Referral',
    'Other'
  ]
};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}