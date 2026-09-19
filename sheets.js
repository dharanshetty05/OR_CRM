/**
 * ScaleWithLakshya Outreach CRM - Google Sheets API & Authorization Layer
 * Communicates directly with Google Sheets REST API v4.
 * Token is stored IN-MEMORY ONLY.
 */

class SheetsService {
  constructor() {
    this.tokenClient = null;
    this.clientId = null;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.pendingTokenRequest = null;
    this.silentRefreshTimer = null;
    this.lastTokenResponse = null;
    this.lastAuthError = null;
  }

  /* -------------------------------------------------------------------------- */
  /*                            AUTHENTICATION (GIS)                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Initializes the Google Identity Services OAuth 2.0 Token Client.
   *
   * Access tokens are intentionally memory-only. The browser never persists
   * OAuth tokens or refresh tokens. Silent authorization is used for returning
   * users; interactive authorization is reserved for explicit user actions.
   */
  initAuth(clientId, onTokenReceived, onError) {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      throw new Error('Google Identity Services script not loaded. Please check your internet connection.');
    }

    if (!clientId) {
      throw new Error('Google Client ID is missing.');
    }

    if (this.tokenClient && this.clientId === clientId) {
      return this.tokenClient;
    }

    this.clientId = clientId;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CONFIG.OAUTH_SCOPES,
      callback: (tokenResponse) => {
        this._handleTokenResponse(tokenResponse, onTokenReceived, onError);
      },
      error_callback: (err) => {
        this._handleAuthError(err, onError);
      }
    });

    return this.tokenClient;
  }

  _handleTokenResponse(tokenResponse, onTokenReceived, onError) {
    const pending = this.pendingTokenRequest;
    this.pendingTokenRequest = null;

    if (!tokenResponse || tokenResponse.error || !tokenResponse.access_token) {
      const error = new Error(
        tokenResponse?.error_description ||
        tokenResponse?.error ||
        'Google authorization failed.'
      );
      error.code = tokenResponse?.error || 'AUTH_FAILED';

      if (pending) pending.reject(error);
      if (onError) onError(error);
      return;
    }

    const requiredScopes = String(CONFIG.OAUTH_SCOPES || '')
      .split(/\s+/)
      .map(scope => scope.trim())
      .filter(Boolean);

    if (
      requiredScopes.length > 0 &&
      typeof google.accounts.oauth2.hasGrantedAllScopes === 'function' &&
      !google.accounts.oauth2.hasGrantedAllScopes(
        tokenResponse,
        requiredScopes[0],
        ...requiredScopes.slice(1)
      )
    ) {
      const error = new Error('Google did not grant the required Sheets permission.');
      error.code = 'SCOPE_NOT_GRANTED';

      if (pending) pending.reject(error);
      if (onError) onError(error);
      return;
    }

    this.accessToken = tokenResponse.access_token;

    const expiresInSeconds = Number.parseInt(tokenResponse.expires_in, 10) || 3600;
    const expiresInMs = Math.max(0, expiresInSeconds * 1000);
    this.tokenExpiresAt = Date.now() + Math.max(0, expiresInMs - 60000);

    this.lastTokenResponse = tokenResponse;
    this.lastAuthError = null;

    this._scheduleSilentRefresh();

    if (pending) pending.resolve(this.accessToken);
    if (onTokenReceived) onTokenReceived(this.accessToken);
  }

  _handleAuthError(err, onError) {
    const pending = this.pendingTokenRequest;
    this.pendingTokenRequest = null;

    const error = err instanceof Error
      ? err
      : new Error(err?.message || 'Google authorization failed.');

    error.code = error.code || 'AUTH_FAILED';

    if (pending) pending.reject(error);
    if (onError) onError(error);
  }

  /**
   * Returns true if there is an active, unexpired OAuth token in memory.
   */
  isAuthenticated() {
    return Boolean(this.accessToken) && Date.now() < this.tokenExpiresAt;
  }

  /**
   * Requests an access token.
   *
   * prompt='none' is used by the app for silent restoration/refresh.
   * prompt='' is used for an explicit user-driven authorization.
   * prompt='consent' is reserved for explicit re-consent.
   */
  async requestAccessToken(prompt = '') {
    if (!this.tokenClient) {
      const clientId = getGoogleClientId();
      if (!clientId) {
        throw new Error('Google Client ID is required to authorize this app.');
      }
      this.initAuth(clientId);
    }

    if (this.pendingTokenRequest) {
      const pending = this.pendingTokenRequest;

      // If a silent startup/refresh request is already running and the user
      // explicitly clicks reconnect, let the silent attempt finish first.
      // If it fails, immediately fall back to the user-driven request.
      if (prompt !== 'none' && pending.prompt === 'none') {
        try {
          return await pending.promise;
        } catch (silentError) {
          return this.requestAccessToken(prompt);
        }
      }

      return pending.promise;
    }

    let resolveRequest;
    let rejectRequest;

    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });

    this.pendingTokenRequest = {
      promise,
      prompt,
      resolve: resolveRequest,
      reject: rejectRequest
    };

    try {
      this.tokenClient.requestAccessToken({
        prompt: prompt || ''
      });
    } catch (err) {
      this.pendingTokenRequest = null;
      rejectRequest(err);
    }

    return promise;
  }

  /**
   * Ensures a usable access token exists.
   *
   * interactive=false never opens a consent/account UI. The caller can then
   * decide whether an explicit "Reconnect Google" action is needed.
   */
  async ensureAccessToken({ interactive = false, forceConsent = false } = {}) {
    if (this.isAuthenticated()) {
      return this.accessToken;
    }

    const prompt = interactive
      ? (forceConsent ? 'consent' : '')
      : 'none';

    return this.requestAccessToken(prompt);
  }

  _scheduleSilentRefresh() {
    if (this.silentRefreshTimer) {
      clearTimeout(this.silentRefreshTimer);
      this.silentRefreshTimer = null;
    }

    if (!this.tokenExpiresAt) return;

    const refreshAt = Math.max(
      30000,
      this.tokenExpiresAt - Date.now() - 120000
    );

    this.silentRefreshTimer = setTimeout(async () => {
      this.silentRefreshTimer = null;

      if (!this.isAuthenticated()) return;

      try {
        await this.requestAccessToken('none');
      } catch (error) {
        // Do not interrupt the user before the current token expires.
        // The next API request will attempt one silent reauthorization.
        this.lastAuthError = error;
      }
    }, refreshAt);
  }

  /**
   * Clears only the in-memory OAuth session.
   * Does not remove the saved Sheet ID or revoke Google consent.
   */
  clearAuth() {
    if (this.silentRefreshTimer) {
      clearTimeout(this.silentRefreshTimer);
      this.silentRefreshTimer = null;
    }

    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.lastTokenResponse = null;
    this.lastAuthError = null;
  }

  /**
   * Explicitly revoke this app's Google authorization.
   * This is intentionally separate from simply clearing the in-memory token.
   */
  async revokeAuthorization() {
    const token = this.accessToken;

    if (!token || !google?.accounts?.oauth2?.revoke) {
      this.clearAuth();
      return { successful: true };
    }

    return new Promise((resolve, reject) => {
      google.accounts.oauth2.revoke(token, (response) => {
        this.clearAuth();

        if (response?.successful) {
          resolve(response);
        } else {
          const error = new Error(
            response?.error_description ||
            response?.error ||
            'Could not revoke Google authorization.'
          );
          error.code = 'REVOKE_FAILED';
          reject(error);
        }
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                            LOW-LEVEL HTTP WRAPPER                          */
  /* -------------------------------------------------------------------------- */

  async fetchWithAuth(url, options = {}) {
    let attemptedReauth = false;

    while (true) {
      try {
        await this.ensureAccessToken({ interactive: false });
      } catch (authError) {
        const error = new Error('Google authorization is required. Please reconnect Google.');
        error.code = 'AUTH_REQUIRED';
        error.cause = authError;
        throw error;
      }

      const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };

      let response;
      try {
        response = await fetch(url, { ...options, headers });
      } catch (networkErr) {
        const error = new Error(`Network error communicating with Google Sheets: ${networkErr.message}`);
        error.code = 'NETWORK_ERROR';
        throw error;
      }

      if (response.ok) {
        return response.json();
      }

      let errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {
        // Non-JSON response.
      }

      if (response.status === 401 && !attemptedReauth) {
        attemptedReauth = true;
        this.clearAuth();

        try {
          await this.ensureAccessToken({ interactive: false });
          continue;
        } catch (authError) {
          const error = new Error('Google authorization expired. Please reconnect Google.');
          error.code = 'AUTH_REQUIRED';
          error.cause = authError;
          throw error;
        }
      }

      if (response.status === 401) {
        const error = new Error('Google authorization expired. Please reconnect Google.');
        error.code = 'AUTH_REQUIRED';
        throw error;
      }

      if (response.status === 403) {
        const msg = errorData?.error?.message ||
          'Access denied to this Google Sheet. Ensure your Google account has permission to edit it.';
        const error = new Error(`Google Sheets Permission Error (403): ${msg}`);
        error.code = 'SHEET_FORBIDDEN';
        throw error;
      }

      if (response.status === 404) {
        const error = new Error('This Google Sheet was not found. Please verify the URL or Spreadsheet ID.');
        error.code = 'SHEET_NOT_FOUND';
        throw error;
      }

      if (response.status === 429) {
        const error = new Error('Google is temporarily limiting requests. Please try again in a moment.');
        error.code = 'RATE_LIMITED';
        throw error;
      }

      const errMsg =
        errorData?.error?.message ||
        `Google API error (Status ${response.status}): ${response.statusText}`;

      const error = new Error(errMsg);
      error.code = `GOOGLE_API_${response.status}`;
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                        SHEETS REST API OPERATIONS                          */
  /* -------------------------------------------------------------------------- */

  /**
   * Retrieves spreadsheet metadata (sheets, title, etc.)
   */
  async getSpreadsheetMetadata(spreadsheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=properties.title,sheets.properties`;
    return this.fetchWithAuth(url);
  }

  /**
   * Reads values from a specific A1 range
   */
  async readSheetValues(spreadsheetId, range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
    const res = await this.fetchWithAuth(url);
    return res.values || [];
  }

  /**
   * Batch reads multiple ranges in one HTTP request
   */
  async batchGet(spreadsheetId, ranges) {
    const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${rangesParam}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
    const res = await this.fetchWithAuth(url);
    return res.valueRanges || [];
  }

  /**
   * Appends rows to a sheet
   */
  async appendRows(spreadsheetId, range, rows) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    return this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({ values: rows })
    });
  }

  /**
   * Updates an exact range with values
   */
  async updateRange(spreadsheetId, range, rows) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    return this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify({ values: rows })
    });
  }

  /**
   * Batch update spreadsheet structure (e.g., adding sheets, styling headers)
   */
  async batchUpdateSpreadsheet(spreadsheetId, requests) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
    return this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify({ requests })
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                     URL & NORMALIZATION UTILITIES                          */
  /* -------------------------------------------------------------------------- */

  /**
   * Extracts spreadsheet ID from Google Sheet URL or raw ID
   */
  extractSpreadsheetId(urlOrId) {
    if (!urlOrId || typeof urlOrId !== 'string') return null;
    const trimmed = urlOrId.trim();

    // Standard Google Sheet URL regex
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Direct ID check (Google Spreadsheet IDs are alphanumeric with dashes/underscores, usually ~44 chars)
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  /**
   * Normalizes website domain for duplicate detection:
   * Strips protocol, www., paths, queries, ports, and trailing slashes.
   */
  normalizeDomain(website) {
    if (!website || typeof website !== 'string') return '';
    let domain = website.trim().toLowerCase();
    // Strip scheme
    domain = domain.replace(/^https?:\/\//i, '');
    // Strip www.
    domain = domain.replace(/^www\./i, '');
    // Strip paths, queries, hashes
    domain = domain.split(/[/?#:]/)[0];
    // Strip trailing slash/dots
    domain = domain.replace(/[\/.]+$/, '');
    return domain;
  }

  /**
   * Normalizes phone number by stripping formatting characters
   */
  normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    // Strip all non-digit characters except leading plus if any
    const digits = phone.trim().replace(/[^\d+]/g, '');
    return digits;
  }

  /**
   * Generates a stable unique ID
   */
  generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /* -------------------------------------------------------------------------- */
  /*                  IDEMPOTENT DATABASE INITIALIZATION                        */
  /* -------------------------------------------------------------------------- */

  /**
   * Validates and provisions the Google Sheet database:
   * - Checks LEADS, ACTIVITY, SETTINGS
   * - Creates missing sheets
   * - Checks/creates headers
   * - Preserves all existing data
   */
  async initializeOrValidateDatabase(spreadsheetId) {
    const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
    const existingSheets = (metadata.sheets || []).map(s => s.properties.title);

    const requiredSheets = [
      CONFIG.SHEETS.LEADS,
      CONFIG.SHEETS.ACTIVITY,
      CONFIG.SHEETS.SETTINGS
    ];

    const missingSheets = requiredSheets.filter(name => !existingSheets.includes(name));

    // 1. Create any missing sheets
    if (missingSheets.length > 0) {
      const createRequests = missingSheets.map(title => ({
        addSheet: {
          properties: { title }
        }
      }));
      await this.batchUpdateSpreadsheet(spreadsheetId, createRequests);
    }

    // 2. Read headers for all 3 sheets
    const headerRanges = [
      `${CONFIG.SHEETS.LEADS}!A1:X1`,
      `${CONFIG.SHEETS.ACTIVITY}!A1:H1`,
      `${CONFIG.SHEETS.SETTINGS}!A1:F1`
    ];

    const valueRanges = await this.batchGet(spreadsheetId, headerRanges);
    const leadsHeader = valueRanges[0]?.values?.[0] || [];
    const activityHeader = valueRanges[1]?.values?.[0] || [];
    const settingsHeader = valueRanges[2]?.values?.[0] || [];

    // 3. Populate missing headers idempotently
    const updates = [];

    if (leadsHeader.length === 0) {
      await this.updateRange(spreadsheetId, `${CONFIG.SHEETS.LEADS}!A1:X1`, [CONFIG.LEADS_COLUMNS]);
    } else {
      // Validate schema compatibility
      this.validateHeaders(CONFIG.SHEETS.LEADS, leadsHeader, CONFIG.LEADS_COLUMNS);
    }

    if (activityHeader.length === 0) {
      await this.updateRange(spreadsheetId, `${CONFIG.SHEETS.ACTIVITY}!A1:H1`, [CONFIG.ACTIVITY_COLUMNS]);
    } else {
      this.validateHeaders(CONFIG.SHEETS.ACTIVITY, activityHeader, CONFIG.ACTIVITY_COLUMNS);
    }

    if (settingsHeader.length === 0) {
      // Write header and default settings
      const defaultSettings = [
        CONFIG.SETTINGS_COLUMNS,
        ['system', 'app_name', CONFIG.APP_NAME, 'TRUE', '1', 'Application display name'],
        ['system', 'schema_version', CONFIG.SCHEMA_VERSION, 'TRUE', '2', 'Database schema version'],
        ['system', 'app_version', CONFIG.APP_VERSION, 'TRUE', '3', 'Installed application version'],
        ['system', 'initialized_at', new Date().toISOString(), 'TRUE', '4', 'Database provision timestamp']
      ];
      await this.updateRange(spreadsheetId, `${CONFIG.SHEETS.SETTINGS}!A1:F5`, defaultSettings);
    } else {
      this.validateHeaders(CONFIG.SHEETS.SETTINGS, settingsHeader, CONFIG.SETTINGS_COLUMNS);
    }

    return {
      title: metadata.properties?.title || 'CRM Spreadsheet',
      spreadsheetId,
      status: 'ready'
    };
  }

  /**
   * Checks if existing sheet headers match expected order and naming
   */
  validateHeaders(sheetName, actualHeader, expectedColumns) {
    if (actualHeader.length < expectedColumns.length) {
      throw new Error(
        `Schema mismatch in sheet "${sheetName}": Expected ${expectedColumns.length} columns, but found ${actualHeader.length}. Please ensure the sheet has not been modified manually.`
      );
    }

    for (let i = 0; i < expectedColumns.length; i++) {
      const actual = (actualHeader[i] || '').toString().trim();
      const expected = expectedColumns[i];
      if (actual.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(
          `Schema mismatch in sheet "${sheetName}" at column ${i + 1}: Expected "${expected}", but found "${actual}".`
        );
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                           DATA ACCESS & MAPPING                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Fetches all leads from LEADS sheet (excluding archived leads from normal views)
   */
  async getAllLeads(spreadsheetId) {
    // Read up to 5000 rows across all 24 columns A:X
    const rows = await this.readSheetValues(spreadsheetId, `${CONFIG.SHEETS.LEADS}!A2:X5000`);
    
    return rows.map((row, index) => {
      const lead = {};
      CONFIG.LEADS_COLUMNS.forEach((colName, colIdx) => {
        lead[colName] = row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : '';
      });
      // 1-indexed row number in the Sheet (row 1 is header, data starts at row 2)
      lead._rowIndex = index + 2;
      lead.record_version = parseInt(lead.record_version, 10) || 1;
      return lead;
    });
  }

  /**
   * Fetches all activity records
   */
  async getAllActivities(spreadsheetId) {
    const rows = await this.readSheetValues(spreadsheetId, `${CONFIG.SHEETS.ACTIVITY}!A2:H5000`);
    return rows.map((row, index) => {
      const activity = {};
      CONFIG.ACTIVITY_COLUMNS.forEach((colName, colIdx) => {
        activity[colName] = row[colIdx] !== undefined && row[colIdx] !== null ? String(row[colIdx]) : '';
      });
      activity._rowIndex = index + 2;
      return activity;
    });
  }

  /**
   * Checks for deterministic duplicates against an array of existing leads:
   * 1. google_place_id (if both non-empty)
   * 2. normalized_domain (if both non-empty)
   * 3. normalized_phone (if both non-empty)
   * 4. business_name + location (case-insensitive trimmed, if both non-empty)
   */
  findDuplicate(newLeadData, existingLeads, excludeLeadId = null) {
    const normDomain = this.normalizeDomain(newLeadData.website);
    const normPhone = this.normalizePhone(newLeadData.phone);
    const placeId = (newLeadData.google_place_id || '').trim();
    const bizLoc = (newLeadData.business_name || '').trim().toLowerCase() + '::' + (newLeadData.location || '').trim().toLowerCase();

    for (const lead of existingLeads) {
      if (excludeLeadId && lead.lead_id === excludeLeadId) continue;
      // Exclude already archived leads from blocking
      if (lead.archived_at) continue;

      // 1. Google Place ID
      if (placeId && lead.google_place_id && lead.google_place_id.trim() === placeId) {
        return {
          duplicate: true,
          reason: `Duplicate Google Place ID with existing lead: "${lead.business_name}"`,
          lead
        };
      }

      // 2. Normalized Domain
      if (normDomain && lead.normalized_domain && lead.normalized_domain === normDomain) {
        return {
          duplicate: true,
          reason: `Duplicate website domain (${normDomain}) with existing lead: "${lead.business_name}"`,
          lead
        };
      }

      // 3. Normalized Phone
      if (normPhone && lead.normalized_phone && lead.normalized_phone === normPhone) {
        return {
          duplicate: true,
          reason: `Duplicate phone number (${normPhone}) with existing lead: "${lead.business_name}"`,
          lead
        };
      }

      // 4. Business Name + Location
      if (newLeadData.business_name && newLeadData.location) {
        const existingBizLoc = (lead.business_name || '').trim().toLowerCase() + '::' + (lead.location || '').trim().toLowerCase();
        if (bizLoc === existingBizLoc) {
          return {
            duplicate: true,
            reason: `Duplicate Business Name and Location with existing lead: "${lead.business_name}" (${lead.location})`,
            lead
          };
        }
      }
    }

    return { duplicate: false };
  }

  /**
   * Creates a new lead in the LEADS sheet
   */
  async createLead(spreadsheetId, leadData, existingLeads = []) {
    // 1. Duplicate check
    const dupCheck = this.findDuplicate(leadData, existingLeads);
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    const now = new Date().toISOString();
    const leadId = this.generateId('lead');
    const normDomain = this.normalizeDomain(leadData.website);
    const normPhone = this.normalizePhone(leadData.phone);

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
      lead_source: leadData.lead_source || 'Manual',
      google_place_id: (leadData.google_place_id || '').trim(),
      lead_tier: leadData.lead_tier || 'B',
      lead_score: leadData.lead_score !== undefined ? String(leadData.lead_score) : '0',
      opportunity_score: leadData.opportunity_score !== undefined ? String(leadData.opportunity_score) : '0',
      status: leadData.status || 'New',
      date_added: now,
      last_contacted_at: '',
      next_follow_up_at: leadData.next_follow_up_at || '',
      notes: leadData.notes || '',
      normalized_domain: normDomain,
      normalized_phone: normPhone,
      record_version: 1,
      updated_at: now,
      archived_at: ''
    };

    const row = CONFIG.LEADS_COLUMNS.map(col => fullLead[col]);
    await this.appendRows(spreadsheetId, `${CONFIG.SHEETS.LEADS}!A:X`, [row]);

    return fullLead;
  }

  /**
   * Updates an existing lead with OPTIMISTIC CONCURRENCY PROTECTION
   */
  async updateLead(spreadsheetId, leadId, updatedFields, expectedVersion) {
    // 1. Fetch latest leads to get exact row and current version
    const currentLeads = await this.getAllLeads(spreadsheetId);
    const existingLead = currentLeads.find(l => l.lead_id === leadId);

    if (!existingLead) {
      throw new Error(`Lead with ID "${leadId}" was not found in the database.`);
    }

    // 2. Concurrency Check
    if (existingLead.record_version !== expectedVersion) {
      const err = new Error('This lead changed since you opened it. Please reload the latest version to prevent overwriting updates.');
      err.isConcurrencyError = true;
      err.latestLead = existingLead;
      throw err;
    }

    // 3. Duplicate check for updated unique fields
    const dupCheck = this.findDuplicate(
      { ...existingLead, ...updatedFields },
      currentLeads,
      leadId
    );
    if (dupCheck.duplicate) {
      throw new Error(dupCheck.reason);
    }

    const now = new Date().toISOString();
    const newVersion = existingLead.record_version + 1;

    const mergedLead = {
      ...existingLead,
      ...updatedFields,
      normalized_domain: updatedFields.website !== undefined ? this.normalizeDomain(updatedFields.website) : existingLead.normalized_domain,
      normalized_phone: updatedFields.phone !== undefined ? this.normalizePhone(updatedFields.phone) : existingLead.normalized_phone,
      record_version: newVersion,
      updated_at: now
    };

    const row = CONFIG.LEADS_COLUMNS.map(col => mergedLead[col]);
    const range = `${CONFIG.SHEETS.LEADS}!A${existingLead._rowIndex}:X${existingLead._rowIndex}`;
    await this.updateRange(spreadsheetId, range, [row]);

    return mergedLead;
  }

  /**
   * Soft-archives a lead by setting archived_at timestamp
   */
  async archiveLead(spreadsheetId, leadId, expectedVersion) {
    return this.updateLead(
      spreadsheetId,
      leadId,
      { archived_at: new Date().toISOString() },
      expectedVersion
    );
  }

  /**
   * Records an outreach activity and conditionally updates lead's last_contacted_at
   */
  async addActivity(spreadsheetId, activityData, lead) {
    const activityId = this.generateId('act');
    const now = activityData.activity_at || new Date().toISOString();

    const activityRecord = {
      activity_id: activityId,
      lead_id: activityData.lead_id,
      activity_at: now,
      activity_type: activityData.activity_type,
      channel: activityData.channel || 'Other',
      summary: (activityData.summary || '').trim(),
      outcome: (activityData.outcome || '').trim(),
      notes: (activityData.notes || '').trim()
    };

    const row = CONFIG.ACTIVITY_COLUMNS.map(col => activityRecord[col]);
    await this.appendRows(spreadsheetId, `${CONFIG.SHEETS.ACTIVITY}!A:H`, [row]);

    // Check if this activity type should update last_contacted_at on the lead
    // Do NOT update for: Note Added, Status Changed, Won, Lost
    let updatedLead = null;
    if (CONFIG.CONTACT_ACTIVITY_TYPES.includes(activityData.activity_type) && lead) {
      try {
        updatedLead = await this.updateLead(
          spreadsheetId,
          lead.lead_id,
          { last_contacted_at: now },
          lead.record_version
        );
      } catch (e) {
        console.warn('Could not automatically update lead last_contacted_at:', e);
      }
    }

    return { activity: activityRecord, updatedLead };
  }
}

// Global SheetsService instance
const sheetsService = new SheetsService();

if (typeof window !== 'undefined') {
  window.sheetsService = sheetsService;
}
