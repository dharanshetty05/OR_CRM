/**
 * ScaleWithLakshya Outreach CRM - API Repository Service
 * Talks to the Express backend over same-origin /api routes.
 */

class APIService {
  constructor() {
    this.baseUrl = String(window.CONFIG?.API_BASE_URL || '/api').replace(/\/$/, '');
  }

  async _fetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 503) {
          throw new Error(err.error || 'Google Sheets is unavailable');
        }
        throw new Error(err.error || `Could not complete the request (${response.status})`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('Could not connect to MyCRM');
      }
      throw error;
    }
  }

  async getHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error('Could not connect to MyCRM');
      }
      return await response.json();
    } catch (error) {
      if (error.message === 'Could not connect to MyCRM') throw error;
      throw new Error('Could not connect to MyCRM');
    }
  }

  async waitUntilReady(onStatus) {
    let lastError = null;
    let delayMs = 0;

    for (let attempt = 0; attempt < 15; attempt++) {
      if (delayMs) {
        await new Promise(r => setTimeout(r, delayMs));
      }
      try {
        const health = await this.getHealth();
        if (typeof onStatus === 'function') onStatus(health);
        if (health.status === 'ready' && health.ready) {
          return health;
        }
        if (health.status === 'error') {
          throw new Error('Google Sheets is unavailable');
        }
        lastError = new Error('Google Sheets is connecting...');
      } catch (e) {
        lastError = e;
        if (e.message === 'Google Sheets is unavailable') throw e;
      }
      delayMs = delayMs === 0 ? 400 : Math.min(3000, Math.round(delayMs * 1.5));
    }

    throw lastError || new Error('Could not connect to MyCRM');
  }

  async refreshFromSheets() {
    const payload = await this._fetch('/refresh', { method: 'POST' });
    return {
      leads: (payload.leads || []).map(this._mapBackendLeadToFrontend),
      activities: (payload.activities || []).map(this._mapBackendActivityToFrontend)
    };
  }

  async init() {
    return this.waitUntilReady();
  }

  /* -------------------------------------------------------------------------- */
  /*                            LEADS OPERATIONS                                */
  /* -------------------------------------------------------------------------- */

  async getAllLeads() {
    const leads = await this._fetch('/leads');
    // Map backend to frontend schema (most fields align because backend was updated)
    return leads.map(this._mapBackendLeadToFrontend);
  }

  async getLeadById(leadId) {
    const lead = await this._fetch(`/leads/${leadId}`);
    return this._mapBackendLeadToFrontend(lead);
  }

  async createLead(leadData, existingLeads = []) {
    // Perform duplicate check on frontend side before submitting
    const dupCheck = this.findDuplicate(leadData, existingLeads);
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    const payload = this._mapFrontendLeadToBackend(leadData);
    const created = await this._fetch('/leads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return this._mapBackendLeadToFrontend(created);
  }

  async updateLead(leadId, updatedFields, existingLeads = []) {
    // We need the existing lead for duplicate checks
    let existing = existingLeads.find(l => l.lead_id === leadId);
    if (!existing) {
      existing = await this.getLeadById(leadId);
    }
    if (!existing) {
      throw new Error(`Lead with ID "${leadId}" was not found.`);
    }

    const merged = { ...existing, ...updatedFields };

    const dupCheck = this.findDuplicate(merged, existingLeads, leadId);
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    merged.updated_at = new Date().toISOString();

    const payload = this._mapFrontendLeadToBackend(merged);
    const updated = await this._fetch(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    return this._mapBackendLeadToFrontend(updated);
  }

  async archiveLead(leadId) {
    return this.updateLead(leadId, { archived_at: new Date().toISOString() });
  }

  async deleteLeadPermanently(leadId) {
    await this._fetch(`/leads/${leadId}`, { method: 'DELETE' });
    return { success: true };
  }

  /* -------------------------------------------------------------------------- */
  /*                          ACTIVITY OPERATIONS                               */
  /* -------------------------------------------------------------------------- */

  async getAllActivities() {
    const activities = await this._fetch('/activities');
    return activities.map(this._mapBackendActivityToFrontend);
  }

  async addActivity(activityData, currentLead = null) {
    const payload = this._mapFrontendActivityToBackend(activityData);
    
    const activityRecord = await this._fetch('/activities', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const frontendActivity = this._mapBackendActivityToFrontend(activityRecord);

    let updatedLead = null;
    const isContactTouchpoint = window.CONFIG?.CONTACT_ACTIVITY_TYPES?.includes(activityData.activity_type);

    if (isContactTouchpoint && currentLead) {
      try {
        const now = activityData.activity_at || new Date().toISOString();
        updatedLead = await this.updateLead(currentLead.lead_id, {
          last_contacted_at: now,
          status: (currentLead.status === 'NOT CONTACTED' || currentLead.status === 'New' || currentLead.status === 'Researching')
            ? 'DM SENT'
            : currentLead.status
        });
      } catch (err) {
        return {
          success: true,
          partialSuccess: true,
          activity: frontendActivity,
          warning: "Activity was saved, but Last Contacted could not be updated."
        };
      }
    }

    return { success: true, activity: frontendActivity, updatedLead };
  }

  /* -------------------------------------------------------------------------- */
  /*                         BULK DATA & CLEAR OPERATIONS                       */
  /* -------------------------------------------------------------------------- */

  async bulkSave(leadsArray = [], activitiesArray = []) {
    throw new Error('Bulk import is not supported in the remote API mode.');
  }

  async clearAllData() {
    throw new Error('Clear all data is disabled for the remote database to prevent accidental data loss.');
  }

  /* -------------------------------------------------------------------------- */
  /*                            UTILITY FUNCTIONS                               */
  /* -------------------------------------------------------------------------- */

  findDuplicate(newLeadData, existingLeads, excludeLeadId = null) {
    const normDomain = this.normalizeDomain(newLeadData.website);
    const normPhone = this.normalizePhone(newLeadData.phone);
    const placeId = (newLeadData.google_place_id || '').trim();
    const bizLoc = (newLeadData.business_name || '').trim().toLowerCase() + '::' + (newLeadData.location || '').trim().toLowerCase();

    for (const lead of existingLeads) {
      if (excludeLeadId && lead.lead_id === excludeLeadId) continue;
      if (lead.archived_at) continue;

      if (placeId && lead.google_place_id && lead.google_place_id.trim() === placeId) {
        return { duplicate: true, reason: `Duplicate Place ID with existing lead: "${lead.business_name}"` };
      }
      if (normDomain && lead.normalized_domain && lead.normalized_domain === normDomain) {
        return { duplicate: true, reason: `Duplicate website domain (${normDomain}) with existing lead: "${lead.business_name}"` };
      }
      if (normPhone && lead.normalized_phone && lead.normalized_phone === normPhone) {
        return { duplicate: true, reason: `Duplicate phone number (${normPhone}) with existing lead: "${lead.business_name}"` };
      }
      if (newLeadData.business_name && newLeadData.location) {
        const existingBizLoc = (lead.business_name || '').trim().toLowerCase() + '::' + (lead.location || '').trim().toLowerCase();
        if (bizLoc === existingBizLoc) {
          return { duplicate: true, reason: `Duplicate Business Name & Location with existing lead: "${lead.business_name}"` };
        }
      }
    }
    return { duplicate: false };
  }

  normalizeDomain(website) {
    if (!website || typeof website !== 'string') return '';
    let domain = website.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//i, '');
    domain = domain.replace(/^www\./i, '');
    domain = domain.split(/[/?#:]/)[0];
    domain = domain.replace(/[\/.]+$/, '');
    return domain;
  }

  normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    return phone.trim().replace(/[^\d+]/g, '');
  }
  
  _mapBackendLeadToFrontend = (b) => {
    const mapped = { ...b };
    
    if (b.id) { mapped.lead_id = b.id; delete mapped.id; }
    if (b.created_at) { mapped.date_added = b.created_at; delete mapped.created_at; }
    if (b.last_contacted) { mapped.last_contacted_at = b.last_contacted; delete mapped.last_contacted; }
    if (b.next_followup) { mapped.next_follow_up_at = b.next_followup; delete mapped.next_followup; }
    
    // Auto-generate normalized fields for frontend
    if (!mapped.normalized_domain) { mapped.normalized_domain = this.normalizeDomain(mapped.website) || ''; }
    if (!mapped.normalized_phone) { mapped.normalized_phone = this.normalizePhone(mapped.phone) || ''; }
    
    return mapped;
  }

  _mapFrontendLeadToBackend = (f) => {
    const mapped = { ...f };
    
    if (f.lead_id) { mapped.id = f.lead_id; delete mapped.lead_id; }
    if (f.date_added) { mapped.created_at = f.date_added; delete mapped.date_added; }
    if (f.last_contacted_at) { mapped.last_contacted = f.last_contacted_at; delete mapped.last_contacted_at; }
    if (f.next_follow_up_at) { mapped.next_followup = f.next_follow_up_at; delete mapped.next_follow_up_at; }
    
    // Remove normalized fields before sending to backend
    delete mapped.normalized_domain;
    delete mapped.normalized_phone;
    
    return mapped;
  }

  _mapBackendActivityToFrontend = (b) => {
    let extra = {};
    try {
      if (b.note && b.note.startsWith('{')) {
        extra = JSON.parse(b.note);
      } else {
        extra.notes = b.note;
      }
    } catch (e) {
      extra.notes = b.note;
    }

    return {
      activity_id: b.id,
      lead_id: b.lead_id,
      activity_at: b.date,
      activity_type: b.type,
      channel: extra.channel || 'Instagram',
      summary: extra.summary || '',
      outcome: extra.outcome || '',
      notes: extra.notes || ''
    };
  }

  _mapFrontendActivityToBackend = (f) => {
    const extra = {
      channel: f.channel,
      summary: f.summary,
      outcome: f.outcome,
      notes: f.notes
    };

    return {
      lead_id: f.lead_id,
      date: f.activity_at || new Date().toISOString(),
      type: f.activity_type,
      note: JSON.stringify(extra)
    };
  }
}

// Export singleton instance for browser scope to replace dbService seamlessly
if (typeof window !== 'undefined') {
  window.dbService = new APIService();
}
