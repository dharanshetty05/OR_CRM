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

  // API Backend URL
  API_BASE_URL: 'http://localhost:3000',

  // Primary Outreach Statuses
  STATUSES: [
    'NOT CONTACTED',
    'DM SENT',
    'REPLIED',
    'CALL BOOKED',
    'WON',
    'LOST'
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

  // Activity types that automatically update `last_contacted_at`
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
