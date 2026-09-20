/**
 * ScaleWithLakshya Outreach CRM - Local IndexedDB Repository Service
 * Fast, zero-auth, offline-first local database.
 */

class DBService {
  constructor() {
    this.dbName = 'SWL_CRM_DB';
    this.version = 1;
    this.db = null;
  }

  /**
   * Initializes the IndexedDB database and creates object stores.
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create 'leads' store
        if (!db.objectStoreNames.contains('leads')) {
          const leadsStore = db.createObjectStore('leads', { keyPath: 'lead_id' });
          leadsStore.createIndex('status', 'status', { unique: false });
          leadsStore.createIndex('niche', 'niche', { unique: false });
          leadsStore.createIndex('lead_tier', 'lead_tier', { unique: false });
          leadsStore.createIndex('lead_source', 'lead_source', { unique: false });
          leadsStore.createIndex('next_follow_up_at', 'next_follow_up_at', { unique: false });
          leadsStore.createIndex('date_added', 'date_added', { unique: false });
        }

        // Create 'activities' store
        if (!db.objectStoreNames.contains('activities')) {
          const actStore = db.createObjectStore('activities', { keyPath: 'activity_id' });
          actStore.createIndex('lead_id', 'lead_id', { unique: false });
          actStore.createIndex('activity_at', 'activity_at', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(new Error('Failed to open local database: ' + event.target.error?.message));
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                            LEADS OPERATIONS                                */
  /* -------------------------------------------------------------------------- */

  async getAllLeads() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('leads', 'readonly');
      const store = tx.objectStore('leads');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getLeadById(leadId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('leads', 'readonly');
      const store = tx.objectStore('leads');
      const request = store.get(leadId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Duplicate detection utility against existing leads.
   */
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

  async createLead(leadData, existingLeads = []) {
    await this.init();

    const dupCheck = this.findDuplicate(leadData, existingLeads);
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    const now = new Date().toISOString();
    const leadId = leadData.lead_id || this.generateId('lead');

    const fullLead = {
      lead_id: leadId,
      business_name: (leadData.business_name || '').trim(),
      contact_name: (leadData.contact_name || '').trim(),
      niche: (leadData.niche || '').trim(),
      location: (leadData.location || '').trim(),
      website: (leadData.website || '').trim(),
      instagram: (leadData.instagram || '').trim(),
      email: (leadData.email || '').trim(),
      phone: (leadData.phone || '').trim(),
      status: leadData.status || 'NOT CONTACTED',
      lead_tier: leadData.lead_tier || 'B',
      lead_source: leadData.lead_source || 'Manual',
      google_place_id: (leadData.google_place_id || '').trim(),
      lead_score: leadData.lead_score !== undefined ? String(leadData.lead_score) : '50',
      opportunity_score: leadData.opportunity_score !== undefined ? String(leadData.opportunity_score) : '50',
      notes: leadData.notes || '',
      date_added: leadData.date_added || now,
      last_contacted_at: leadData.last_contacted_at || '',
      next_follow_up_at: leadData.next_follow_up_at || '',
      normalized_domain: this.normalizeDomain(leadData.website),
      normalized_phone: this.normalizePhone(leadData.phone),
      updated_at: now,
      archived_at: leadData.archived_at || ''
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      const req = store.put(fullLead);

      req.onsuccess = () => resolve(fullLead);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateLead(leadId, updatedFields, existingLeads = []) {
    await this.init();
    const existing = await this.getLeadById(leadId);
    if (!existing) {
      throw new Error(`Lead with ID "${leadId}" was not found.`);
    }

    const merged = { ...existing, ...updatedFields };

    const dupCheck = this.findDuplicate(merged, existingLeads, leadId);
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    merged.normalized_domain = this.normalizeDomain(merged.website);
    merged.normalized_phone = this.normalizePhone(merged.phone);
    merged.updated_at = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('leads', 'readwrite');
      const store = tx.objectStore('leads');
      const req = store.put(merged);

      req.onsuccess = () => resolve(merged);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async archiveLead(leadId) {
    return this.updateLead(leadId, { archived_at: new Date().toISOString() });
  }

  async deleteLeadPermanently(leadId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['leads', 'activities'], 'readwrite');
      const leadsStore = tx.objectStore('leads');
      const actStore = tx.objectStore('activities');

      leadsStore.delete(leadId);

      // Delete associated activities
      const actIndex = actStore.index('lead_id');
      const req = actIndex.getAllKeys(leadId);
      req.onsuccess = () => {
        (req.result || []).forEach(actId => actStore.delete(actId));
      };

      tx.oncomplete = () => resolve({ success: true });
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                          ACTIVITY OPERATIONS                               */
  /* -------------------------------------------------------------------------- */

  async getAllActivities() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('activities', 'readonly');
      const store = tx.objectStore('activities');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async addActivity(activityData, currentLead = null) {
    await this.init();
    const now = activityData.activity_at || new Date().toISOString();
    const actId = activityData.activity_id || this.generateId('act');

    const activityRecord = {
      activity_id: actId,
      lead_id: activityData.lead_id,
      activity_at: now,
      activity_type: activityData.activity_type || 'Initial DM',
      channel: activityData.channel || 'Instagram',
      summary: (activityData.summary || '').trim(),
      outcome: (activityData.outcome || '').trim(),
      notes: (activityData.notes || '').trim()
    };

    let updatedLead = null;
    const isContactTouchpoint = CONFIG.CONTACT_ACTIVITY_TYPES.includes(activityData.activity_type);

    if (isContactTouchpoint && currentLead) {
      updatedLead = await this.updateLead(currentLead.lead_id, {
        last_contacted_at: now,
        // Automatically set status to DM SENT if currently NOT CONTACTED or New
        status: (currentLead.status === 'NOT CONTACTED' || currentLead.status === 'New' || currentLead.status === 'Researching')
          ? 'DM SENT'
          : currentLead.status
      });
    }

    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('activities', 'readwrite');
      const store = tx.objectStore('activities');
      const req = store.put(activityRecord);

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });

    return { activity: activityRecord, updatedLead };
  }

  /* -------------------------------------------------------------------------- */
  /*                         BULK DATA & CLEAR OPERATIONS                       */
  /* -------------------------------------------------------------------------- */

  async bulkSave(leadsArray = [], activitiesArray = []) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['leads', 'activities'], 'readwrite');
      const leadsStore = tx.objectStore('leads');
      const actStore = tx.objectStore('activities');

      leadsArray.forEach(lead => {
        lead.normalized_domain = this.normalizeDomain(lead.website);
        lead.normalized_phone = this.normalizePhone(lead.phone);
        leadsStore.put(lead);
      });

      activitiesArray.forEach(act => {
        actStore.put(act);
      });

      tx.oncomplete = () => resolve({ leadsCount: leadsArray.length, activitiesCount: activitiesArray.length });
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAllData() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['leads', 'activities'], 'readwrite');
      tx.objectStore('leads').clear();
      tx.objectStore('activities').clear();

      tx.oncomplete = () => resolve({ success: true });
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                            UTILITY FUNCTIONS                               */
  /* -------------------------------------------------------------------------- */

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

  generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }
}

// Export singleton instance for browser scope
if (typeof window !== 'undefined') {
  window.dbService = new DBService();
}
