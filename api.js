/**
 * ScaleWithLakshya Outreach CRM
 * API Repository Service
 *
 * Frontend <-> Express API <-> Google Sheets
 */

class APIService {

  constructor() {
    this.baseUrl = String(
      window.CONFIG?.API_BASE_URL || '/api'
    ).replace(/\/$/, '');
  }

  /* -------------------------------------------------------------------------- */
  /*                                HTTP                                        */
  /* -------------------------------------------------------------------------- */

  async _fetch(endpoint, options = {}) {
    try {
      const response = await fetch(
        `${this.baseUrl}${endpoint}`,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        }
      );

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({}));

        if (response.status === 503) {
          throw new Error(
            errorBody.error ||
            'Google Sheets is unavailable'
          );
        }

        throw new Error(
          errorBody.error ||
          `Could not complete the request (${response.status})`
        );
      }

      return await response.json();

    } catch (error) {

      if (
        error.name === 'TypeError' &&
        error.message.includes('Failed to fetch')
      ) {
        throw new Error('Could not connect to MyCRM');
      }

      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                HEALTH                                       */
  /* -------------------------------------------------------------------------- */

  async getHealth() {
    try {
      const response = await fetch(
        `${this.baseUrl}/health`
      );

      if (!response.ok) {
        throw new Error('Could not connect to MyCRM');
      }

      return await response.json();

    } catch (error) {
      throw new Error('Could not connect to MyCRM');
    }
  }

  async waitUntilReady(onStatus) {

    let lastError = null;
    let delayMs = 0;
    let networkFailures = 0;

    const startedAt = Date.now();

    const MAX_WAIT_MS = 10 * 1000;

    while (
      Date.now() - startedAt < MAX_WAIT_MS
    ) {

      if (delayMs) {
        await new Promise(resolve =>
          setTimeout(resolve, delayMs)
        );
      }

      try {

        const health = await this.getHealth();

        networkFailures = 0;

        if (typeof onStatus === 'function') {
          onStatus(health);
        }

        if (
          health.status === 'ready' &&
          health.ready
        ) {
          return health;
        }

        if (health.status === 'error') {
          throw new Error(
            'Google Sheets is unavailable'
          );
        }

        lastError = new Error(
          'Google Sheets is connecting...'
        );

      } catch (error) {

        lastError = error;

        if (
          error.message ===
          'Google Sheets is unavailable'
        ) {
          throw error;
        }

        if (
          error.message ===
          'Could not connect to MyCRM'
        ) {
          networkFailures++;

          if (networkFailures >= 40) {
            throw error;
          }
        }
      }

      delayMs =
        delayMs === 0
          ? 400
          : Math.min(
            3000,
            Math.round(delayMs * 1.5)
          );
    }

    throw (
      lastError ||
      new Error('Could not connect to MyCRM')
    );
  }

  async init() {
    return this.waitUntilReady();
  }

  /* -------------------------------------------------------------------------- */
  /*                                  REFRESH                                    */
  /* -------------------------------------------------------------------------- */

  async refreshFromSheets() {

    const payload = await this._fetch(
      '/refresh',
      {
        method: 'POST'
      }
    );

    return {
      leads: (payload.leads || [])
        .map(this._mapBackendLeadToFrontend),

      activities: (payload.activities || [])
        .map(this._mapBackendActivityToFrontend)
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  LEADS                                      */
  /* -------------------------------------------------------------------------- */

  async getAllLeads() {

    const leads = await this._fetch('/leads');

    return leads.map(
      this._mapBackendLeadToFrontend
    );
  }

  async updateLead(
    leadId,
    updatedFields,
    existingLeads = []
  ) {

    let existing =
      existingLeads.find(
        lead => lead.lead_id === leadId
      );

    if (!existing) {
      throw new Error(
        `Lead with ID "${leadId}" was not found.`
      );
    }

    const merged = {
      ...existing,
      ...updatedFields
    };

    merged.lead_id = leadId;

    /*
     * Send only fields belonging to the
     * current LEADS schema.
     */
    const payload =
      this._mapFrontendLeadToBackend(
        merged
      );

    const updated =
      await this._fetch(
        `/leads/${encodeURIComponent(leadId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }
      );

    return this._mapBackendLeadToFrontend(
      updated
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                ACTIVITIES                                   */
  /* -------------------------------------------------------------------------- */

  async getAllActivities() {

    const activities =
      await this._fetch('/activities');

    return activities.map(
      this._mapBackendActivityToFrontend
    );
  }

  async addActivity(
    activityData,
    currentLead = null
  ) {

    const payload =
      this._mapFrontendActivityToBackend(
        activityData
      );

    const activityRecord =
      await this._fetch(
        '/activities',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

    const frontendActivity =
      this._mapBackendActivityToFrontend(
        activityRecord
      );

    let updatedLead = null;

    /*
     * Contact activities update the lead's
     * Last Activity and status.
     */
    const contactTypes =
      window.CONFIG?.CONTACT_ACTIVITY_TYPES || [];

    const isContactTouchpoint =
      contactTypes.includes(
        activityData.activity_type
      );

    if (
      isContactTouchpoint &&
      currentLead
    ) {

      try {

        const now =
          activityData.activity_at ||
          new Date().toISOString();

        const currentStatus =
          currentLead.status;

        const newStatus =
          (
            currentStatus === 'NEW_LEAD'
          )
            ? 'DM_SENT'
            : currentStatus;

        updatedLead =
          await this.updateLead(
            currentLead.lead_id,
            {
              dm_sent_date_time: now,
              status: newStatus
            }
          );

      } catch (error) {

        console.error(
          'Activity saved but lead update failed:',
          error
        );
      }
    }

    return {
      success: true,
      activity: frontendActivity,
      updatedLead
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                            LEAD MAPPING                                     */
  /* -------------------------------------------------------------------------- */

  _mapBackendLeadToFrontend = (backendLead) => {

    return {
      lead_id:
        backendLead.id || '',

      business_name:
        backendLead.business_name || '',

      location:
        backendLead.location || '',

      niche:
        backendLead.niche || '',

      instagram_url:
        backendLead.instagram_url || '',

      website:
        backendLead.website || '',

      opportunity_score:
        backendLead.opportunity_score || '',

      status:
        backendLead.status || '',

      next_follow_up_at:
        backendLead.next_followup || '',

      follow_up_count:
        backendLead.follow_up_count || '',

      dm_sent_date_time:
        backendLead.dm_sent_date_time || '',

      reply_date:
        backendLead.reply_date || '',

      call_booked_date:
        backendLead.call_booked_date || '',

      outcome:
        backendLead.outcome || '',

      notes:
        backendLead.notes || '',

      updated_at:
        backendLead.updated_at || ''
    };
  };

  _mapFrontendLeadToBackend = (frontendLead) => {

    return {
      business_name:
        frontendLead.business_name || '',

      location:
        frontendLead.location || '',

      niche:
        frontendLead.niche || '',

      instagram_url:
        frontendLead.instagram_url || '',

      website:
        frontendLead.website || '',

      opportunity_score:
        frontendLead.opportunity_score || '',

      status:
        frontendLead.status || '',

      next_followup:
        frontendLead.next_follow_up_at || '',

      follow_up_count:
        frontendLead.follow_up_count || '',

      dm_sent_date_time:
        frontendLead.dm_sent_date_time || '',

      reply_date:
        frontendLead.reply_date || '',

      call_booked_date:
        frontendLead.call_booked_date || '',

      outcome:
        frontendLead.outcome || '',

      notes:
        frontendLead.notes || '',

      updated_at:
        frontendLead.updated_at || ''
    };
  };

  /* -------------------------------------------------------------------------- */
  /*                          ACTIVITY MAPPING                                   */
  /* -------------------------------------------------------------------------- */

  _mapBackendActivityToFrontend =
    (backendActivity) => {

      return {

        activity_id:
          backendActivity.id || '',

        lead_id:
          backendActivity.lead_id || '',

        activity_type:
          backendActivity.type || '',

        activity_at:
          backendActivity.date || '',

        follow_up_number:
          backendActivity.follow_up_number || '',

        message:
          backendActivity.message || '',

        outcome:
          backendActivity.outcome || '',

        notes:
          backendActivity.notes || '',

        created_at:
          backendActivity.created_at || ''
      };
    };

  _mapFrontendActivityToBackend =
    (frontendActivity) => {

      return {

        lead_id:
          frontendActivity.lead_id || '',

        type:
          frontendActivity.activity_type || '',

        date:
          frontendActivity.activity_at ||
          new Date().toISOString(),

        follow_up_number:
          frontendActivity.follow_up_number || '',

        message:
          frontendActivity.message || '',

        outcome:
          frontendActivity.outcome || '',

        notes:
          frontendActivity.notes || ''
      };
    };
}

/* -------------------------------------------------------------------------- */
/*                              EXPORT                                         */
/* -------------------------------------------------------------------------- */

if (typeof window !== 'undefined') {
  window.dbService = new APIService();
}