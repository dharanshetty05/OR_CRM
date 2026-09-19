/**
 * ScaleWithLakshya Outreach CRM - Main Application Logic
 * Orchestrates UI state, Google Identity Services, Sheets API data flow, and workflows.
 */

class App {
  constructor() {
    this.leads = [];
    this.allLeadsRaw = [];
    this.activities = [];
    this.activeLead = null;
    this.currentView = 'dashboard';
    this.spreadsheetId = localStorage.getItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID) || null;
    this.spreadsheetTitle = 'CRM Sheet';
    this.searchQuery = '';
    this.filters = {
      status: '',
      niche: '',
      tier: '',
      source: '',
      followup: ''
    };
    this.isSyncing = false;

    // Bind methods
    this.init = this.init.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /* -------------------------------------------------------------------------- */
  /*                               INITIALIZATION                               */
  /* -------------------------------------------------------------------------- */

  async init() {
    console.log(`${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} initializing...`);

    // Setup keyboard listeners
    window.addEventListener('keydown', this.handleKeyDown);

    // Populate static dropdowns
    this.populateDropdowns();

    // Reflect the current in-memory authentication state immediately.
    this.updateAuthBadges(sheetsService.isAuthenticated());

    // Determine initial view
    if (!this.spreadsheetId) {
      this.switchView('setup');
    } else {
      // Check stored preference or default to dashboard
      const savedView = localStorage.getItem(CONFIG.STORAGE_KEYS.ACTIVE_VIEW) || 'dashboard';
      this.switchView(savedView);
      // Attempt silent auth or prompt
      this.refreshData();
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('lead-drawer');
      if (drawer && !drawer.classList.contains('hidden')) {
        this.closeLeadDrawer();
      }
    }
  }

  populateDropdowns() {
    // 1. Statuses
    const statusSelects = ['filter-status', 'add-status', 'edit-status'];
    statusSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // Preserve first option if it's "All Statuses"
      const isFilter = id.startsWith('filter');
      el.innerHTML = isFilter ? '<option value="">All Statuses</option>' : '';
      CONFIG.STATUSES.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        el.appendChild(opt);
      });
    });

    // 2. Sources
    const sourceSelects = ['filter-source', 'add-lead-source', 'edit-lead-source'];
    sourceSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const isFilter = id.startsWith('filter');
      el.innerHTML = isFilter ? '<option value="">All Sources</option>' : '';
      CONFIG.LEAD_SOURCES.forEach(src => {
        const opt = document.createElement('option');
        opt.value = src;
        opt.textContent = src;
        el.appendChild(opt);
      });
    });

    // 3. Activity Types
    const actTypeSelect = document.getElementById('act-type');
    if (actTypeSelect) {
      actTypeSelect.innerHTML = '';
      CONFIG.ACTIVITY_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        actTypeSelect.appendChild(opt);
      });
    }

    // 4. Channels
    const actChannelSelect = document.getElementById('act-channel');
    if (actChannelSelect) {
      actChannelSelect.innerHTML = '';
      CONFIG.CHANNELS.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch;
        opt.textContent = ch;
        actChannelSelect.appendChild(opt);
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               VIEW NAVIGATION                              */
  /* -------------------------------------------------------------------------- */

  switchView(viewName) {
    // If not connected and trying to view CRM, redirect to setup
    if (!this.spreadsheetId && viewName !== 'setup') {
      viewName = 'setup';
    }

    this.currentView = viewName;
    if (viewName !== 'setup') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.ACTIVE_VIEW, viewName);
    }

    // Hide all views
    ['setup', 'dashboard', 'leads', 'followups', 'settings'].forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add('hidden');
    });

    // Show selected view
    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.remove('hidden');

    // Update Sidebar Navigation state
    ['dashboard', 'leads', 'followups', 'settings'].forEach(navKey => {
      const navBtn = document.getElementById(`nav-${navKey}`);
      if (!navBtn) return;
      if (navKey === viewName) {
        navBtn.classList.add('bg-brand-50', 'text-brand-700', 'font-semibold');
        navBtn.classList.remove('text-neutral-700', 'hover:bg-neutral-100');
        const icon = navBtn.querySelector('svg');
        if (icon) icon.classList.replace('text-neutral-500', 'text-brand-600');
      } else {
        navBtn.classList.remove('bg-brand-50', 'text-brand-700', 'font-semibold');
        navBtn.classList.add('text-neutral-700', 'hover:bg-neutral-100');
        const icon = navBtn.querySelector('svg');
        if (icon) icon.classList.replace('text-brand-600', 'text-neutral-500');
      }
    });

    // View specific actions
    if (viewName === 'dashboard') {
      this.renderDashboard();
    } else if (viewName === 'leads') {
      this.renderLeadsTable();
    } else if (viewName === 'followups') {
      this.renderFollowups();
    } else if (viewName === 'settings') {
      this.renderSettings();
    } else if (viewName === 'setup') {
      this.updateSetupUI();
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         AUTHENTICATION & CONNECTION                        */
  /* -------------------------------------------------------------------------- */

  async handleGoogleSignIn(forcePrompt = false) {
    const clientId = getGoogleClientId();

    if (!clientId) {
      this.showToast('Google authorization is not configured for this CRM.', 'error');
      return;
    }

    try {
      this.showToast(forcePrompt ? 'Reconnecting Google...' : 'Connecting to Google...', 'info');
      sheetsService.initAuth(clientId);
      await sheetsService.ensureAccessToken({
        interactive: true,
        forceConsent: forcePrompt
      });

      this.updateAuthBadges(true);
      this.updateSetupUI();

      if (this.spreadsheetId) {
        await this.refreshData();
      } else {
        this.showToast('Google connected. You can now connect your CRM Sheet.', 'success');
      }
    } catch (err) {
      console.warn('Google authorization failed:', err.code || 'AUTH_FAILED');

      const message = err.code === 'SCOPE_NOT_GRANTED'
        ? 'Google Sheets permission was not granted. Please reconnect and allow access.'
        : (err.message || 'Google authorization failed.');

      this.showToast(message, 'error');
      this.updateAuthBadges(false);
    }
  }

  updateAuthBadges(isAuthed) {
    const setupAuthBadge = document.getElementById('setup-auth-badge');
    const settingsAuthBadge = document.getElementById('settings-auth-badge');
    const sidebarAuth = document.getElementById('sidebar-auth-status');

    if (isAuthed) {
      if (setupAuthBadge) {
        setupAuthBadge.textContent = 'Authorized';
        setupAuthBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium';
      }
      if (settingsAuthBadge) {
        settingsAuthBadge.textContent = 'Authorized';
        settingsAuthBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium';
      }
      if (sidebarAuth) sidebarAuth.textContent = 'Connected & Authorized';
    } else {
      if (setupAuthBadge) {
        setupAuthBadge.textContent = 'Not signed in';
        setupAuthBadge.className = 'text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium';
      }
      if (settingsAuthBadge) {
        settingsAuthBadge.textContent = 'Not authorized';
        settingsAuthBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 font-medium';
      }
      if (sidebarAuth) sidebarAuth.textContent = 'Sign-in required';
    }
  }

  updateSetupUI() {
    const isAuthed = sheetsService.isAuthenticated();
    const btnConnect = document.getElementById('btn-setup-connect');
    const sheetInput = document.getElementById('setup-sheet-url');

    if (btnConnect) {
      btnConnect.disabled = !isAuthed;
    }

    if (this.spreadsheetId && sheetInput && !sheetInput.value) {
      sheetInput.value = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
    }
  }

  async handleConnectSheet() {
    const sheetUrlInput = document.getElementById('setup-sheet-url');
    const statusMsg = document.getElementById('setup-status-message');
    const btnConnect = document.getElementById('btn-setup-connect');
    const btnText = document.getElementById('setup-connect-text');

    const rawUrl = (sheetUrlInput?.value || '').trim();
    if (!rawUrl) {
      this.showToast('Please enter a Google Sheet URL', 'error');
      return;
    }

    const extractedId = sheetsService.extractSpreadsheetId(rawUrl);
    if (!extractedId) {
      this.showToast('Invalid Google Sheet URL or ID format.', 'error');
      return;
    }

    if (!sheetsService.isAuthenticated()) {
      this.showToast('Please sign in with Google first.', 'error');
      await this.handleGoogleSignIn();
      if (!sheetsService.isAuthenticated()) return;
    }

    try {
      btnConnect.disabled = true;
      btnText.textContent = 'Validating & Initializing...';
      if (statusMsg) {
        statusMsg.className = 'mt-4 p-3 rounded-lg text-xs leading-relaxed bg-brand-50 text-brand-800 border border-brand-200 block';
        statusMsg.textContent = 'Connecting to Google Sheets API and verifying database schema...';
      }

      // Initialize database (idempotent: checks/creates LEADS, ACTIVITY, SETTINGS)
      const res = await sheetsService.initializeOrValidateDatabase(extractedId);

      this.spreadsheetId = extractedId;
      this.spreadsheetTitle = res.title || 'CRM Sheet';
      localStorage.setItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID, extractedId);

      if (statusMsg) {
        statusMsg.className = 'mt-4 p-3 rounded-lg text-xs leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-200 block';
        statusMsg.textContent = 'Connected successfully! Initializing CRM workspace...';
      }

      this.showToast('Google Sheet connected successfully!', 'success');
      
      // Load data and enter CRM
      await this.refreshData();
      this.switchView('dashboard');

    } catch (err) {
      console.error('Connection error:', err);
      if (statusMsg) {
        statusMsg.className = 'mt-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-800 border border-red-200 block';
        statusMsg.textContent = err.message || 'Could not connect to this Google Sheet.';
      }
      this.showToast(err.message || 'Could not connect to Sheet.', 'error');
    } finally {
      btnConnect.disabled = false;
      btnText.textContent = 'Connect Sheet';
    }
  }

  disconnectSpreadsheet() {
    if (confirm('Disconnect this spreadsheet from the CRM? Your data will remain intact in Google Sheets.')) {
      this.spreadsheetId = null;
      this.leads = [];
      this.allLeadsRaw = [];
      this.activities = [];
      this.activeLead = null;
      localStorage.removeItem(CONFIG.STORAGE_KEYS.SPREADSHEET_ID);
      this.switchView('setup');
      this.showToast('Spreadsheet disconnected.', 'info');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            DATA SYNCHRONIZATION                            */
  /* -------------------------------------------------------------------------- */

  async refreshData() {
    if (!this.spreadsheetId) return;

    if (!sheetsService.isAuthenticated()) {
      try {
        // Returning users get a silent authorization attempt. No account
        // chooser or consent screen is opened from this background path.
        await sheetsService.ensureAccessToken({ interactive: false });
        this.updateAuthBadges(true);
      } catch (e) {
        this.updateAuthBadges(false);
        if (e?.code === 'AUTH_REQUIRED') {
          this.showToast('Google authorization is required. Use Reconnect Google in Settings.', 'info');
        } else {
          this.showToast('Google authorization could not be restored.', 'info');
        }
        return;
      }
    }

    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      this.showToast('Syncing with Google Sheets...', 'info');

      // 1. Fetch metadata to get title
      try {
        const meta = await sheetsService.getSpreadsheetMetadata(this.spreadsheetId);
        this.spreadsheetTitle = meta.properties?.title || 'CRM Sheet';
        const sidebarTitle = document.getElementById('sidebar-sheet-title');
        if (sidebarTitle) sidebarTitle.textContent = this.spreadsheetTitle;
      } catch (e) {
        console.warn('Metadata fetch failed:', e);
      }

      // 2. Fetch Leads and Activities in parallel
      const [allLeads, allActivities] = await Promise.all([
        sheetsService.getAllLeads(this.spreadsheetId),
        sheetsService.getAllActivities(this.spreadsheetId)
      ]);

      this.allLeadsRaw = allLeads;
      // Filter out archived leads for regular views
      this.leads = allLeads.filter(l => !l.archived_at && l.lead_id);
      this.activities = allActivities;

      // Update sidebar counts
      const countEl = document.getElementById('nav-leads-count');
      if (countEl) countEl.textContent = this.leads.length;

      // Dynamically populate Niche filter from actual leads
      this.updateNicheFilterOptions();

      // Render current view
      if (this.currentView === 'dashboard') this.renderDashboard();
      else if (this.currentView === 'leads') this.renderLeadsTable();
      else if (this.currentView === 'followups') this.renderFollowups();
      else if (this.currentView === 'settings') this.renderSettings();

      // If drawer is open with an active lead, update its state
      if (this.activeLead) {
        const fresh = this.leads.find(l => l.lead_id === this.activeLead.lead_id);
        if (fresh) {
          this.activeLead = fresh;
          this.renderLeadDrawerContent();
        }
      }

      this.showToast('CRM data up to date', 'success');
    } catch (err) {
      console.error('Error refreshing CRM data:', err);
      this.showToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      this.isSyncing = false;
    }
  }

  updateNicheFilterOptions() {
    const nicheSelect = document.getElementById('filter-niche');
    if (!nicheSelect) return;
    const currentVal = nicheSelect.value;
    const niches = Array.from(new Set(this.leads.map(l => (l.niche || '').trim()).filter(Boolean))).sort();

    nicheSelect.innerHTML = '<option value="">All Niches</option>';
    niches.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      if (n === currentVal) opt.selected = true;
      nicheSelect.appendChild(opt);
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                               DASHBOARD VIEW                               */
  /* -------------------------------------------------------------------------- */

  renderDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;

    // Metrics calculations
    let countTotal = this.leads.length;
    let countNew = 0;
    let countReady = 0;
    let countContacted = 0;
    let countReplies = 0;
    let countCallsBooked = 0;
    let countProposals = 0;
    let countWon = 0;
    let countLost = 0;

    let overdueFollowups = [];
    let dueTodayFollowups = [];

    this.leads.forEach(lead => {
      // Status breakdown
      switch (lead.status) {
        case 'New': countNew++; break;
        case 'Ready to Contact': countReady++; break;
        case 'Contacted': countContacted++; break;
        case 'Replied': countReplies++; break;
        case 'Call Booked': countCallsBooked++; break;
        case 'Proposal Sent': countProposals++; break;
        case 'Won': countWon++; break;
        case 'Lost': countLost++; break;
      }

      // Follow-up calculations
      if (lead.next_follow_up_at) {
        const fTime = new Date(lead.next_follow_up_at).getTime();
        if (!isNaN(fTime)) {
          if (fTime < todayStart) {
            overdueFollowups.push(lead);
          } else if (fTime >= todayStart && fTime <= todayEnd) {
            dueTodayFollowups.push(lead);
          }
        }
      }
    });

    // Update DOM metrics
    this.setElemText('metric-total-leads', countTotal);
    this.setElemText('metric-new', countNew);
    this.setElemText('metric-ready', countReady);
    this.setElemText('metric-contacted', countContacted);
    this.setElemText('metric-overdue', overdueFollowups.length);
    this.setElemText('metric-due-today', dueTodayFollowups.length);

    this.setElemText('metric-replies', countReplies);
    this.setElemText('metric-calls-booked', countCallsBooked);
    this.setElemText('metric-proposals', countProposals);
    this.setElemText('metric-won', countWon);
    this.setElemText('metric-lost', countLost);

    // Update Overdue badge in sidebar
    const navOverdue = document.getElementById('nav-overdue-count');
    if (navOverdue) {
      if (overdueFollowups.length > 0) {
        navOverdue.textContent = overdueFollowups.length;
        navOverdue.classList.remove('hidden');
      } else {
        navOverdue.classList.add('hidden');
      }
    }

    // Render Action Center (Overdue & Due Today)
    const urgentContainer = document.getElementById('dashboard-urgent-followups');
    if (urgentContainer) {
      const urgentList = [...overdueFollowups, ...dueTodayFollowups];
      if (urgentList.length === 0) {
        urgentContainer.innerHTML = `
          <div class="py-8 text-center">
            <div class="w-10 h-10 mx-auto mb-2 text-neutral-300">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </div>
            <p class="text-sm font-medium text-neutral-700">No overdue follow-ups or tasks due today.</p>
            <p class="text-xs text-neutral-400 mt-0.5">Your outreach queue is clear.</p>
          </div>
        `;
      } else {
        urgentContainer.innerHTML = urgentList.slice(0, 10).map(lead => {
          const isOverdue = overdueFollowups.some(l => l.lead_id === lead.lead_id);
          const timeStr = this.formatDateTime(lead.next_follow_up_at);
          return `
            <div onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}')" class="py-3 px-2 flex items-center justify-between hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-neutral-900">${this.escapeHtml(lead.business_name)}</span>
                  <span class="badge-status status-${this.slugify(lead.status)} text-[10px]">${this.escapeHtml(lead.status)}</span>
                </div>
                <div class="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                  <span>${this.escapeHtml(lead.contact_name || lead.location || 'Prospect')}</span>
                  <span>&bull;</span>
                  <span>Last touch: ${lead.last_contacted_at ? this.formatDate(lead.last_contacted_at) : 'Never'}</span>
                </div>
              </div>
              <div class="text-right">
                <span class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}">
                  ${isOverdue ? 'Overdue: ' : 'Due: '}${timeStr}
                </span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Recent Activity list
    const activityContainer = document.getElementById('dashboard-recent-activity');
    if (activityContainer) {
      if (this.activities.length === 0) {
        activityContainer.innerHTML = `
          <div class="py-8 text-center text-xs text-neutral-400">
            No activity recorded yet. Add touches from any lead profile.
          </div>
        `;
      } else {
        // Sort newest first
        const sortedActivities = [...this.activities].sort((a, b) => {
          return new Date(b.activity_at || 0) - new Date(a.activity_at || 0);
        }).slice(0, 8);

        activityContainer.innerHTML = sortedActivities.map(act => {
          const relatedLead = this.leads.find(l => l.lead_id === act.lead_id);
          const bizName = relatedLead ? relatedLead.business_name : 'Lead';
          return `
            <div ${relatedLead ? `onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(relatedLead.lead_id))}')"` : ''} class="py-2.5 px-2 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-semibold text-neutral-900">${this.escapeHtml(bizName)}</span>
                <span class="text-[11px] text-neutral-400">${this.formatDateTime(act.activity_at)}</span>
              </div>
              <p class="text-xs text-neutral-700 font-medium">${this.escapeHtml(act.activity_type)} (${this.escapeHtml(act.channel)})</p>
              <p class="text-xs text-neutral-500 truncate mt-0.5">${this.escapeHtml(act.summary)}</p>
            </div>
          `;
        }).join('');
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                LEADS VIEW                                  */
  /* -------------------------------------------------------------------------- */

  handleSearchChange(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.renderLeadsTable();
  }

  handleFilterChange() {
    this.filters.status = document.getElementById('filter-status')?.value || '';
    this.filters.niche = document.getElementById('filter-niche')?.value || '';
    this.filters.tier = document.getElementById('filter-tier')?.value || '';
    this.filters.source = document.getElementById('filter-source')?.value || '';
    this.filters.followup = document.getElementById('filter-followup')?.value || '';
    this.renderLeadsTable();
  }

  clearFilters() {
    this.searchQuery = '';
    const searchInput = document.getElementById('leads-search');
    if (searchInput) searchInput.value = '';

    ['filter-status', 'filter-niche', 'filter-tier', 'filter-source', 'filter-followup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.filters = { status: '', niche: '', tier: '', source: '', followup: '' };
    this.renderLeadsTable();
  }

  getFilteredLeads() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;

    return this.leads.filter(lead => {
      // 1. Search Query across 7 fields
      if (this.searchQuery) {
        const haystack = [
          lead.business_name,
          lead.contact_name,
          lead.niche,
          lead.location,
          lead.website,
          lead.email,
          lead.phone
        ].filter(Boolean).join(' ').toLowerCase();

        if (!haystack.includes(this.searchQuery)) {
          return false;
        }
      }

      // 2. Status Filter
      if (this.filters.status && lead.status !== this.filters.status) {
        return false;
      }

      // 3. Niche Filter
      if (this.filters.niche && lead.niche !== this.filters.niche) {
        return false;
      }

      // 4. Tier Filter
      if (this.filters.tier && lead.lead_tier !== this.filters.tier) {
        return false;
      }

      // 5. Source Filter
      if (this.filters.source && lead.lead_source !== this.filters.source) {
        return false;
      }

      // 6. Follow-up state Filter
      if (this.filters.followup) {
        const fTime = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() : null;
        if (this.filters.followup === 'none' && fTime) return false;
        if (this.filters.followup !== 'none' && !fTime) return false;

        if (this.filters.followup === 'overdue' && fTime >= todayStart) return false;
        if (this.filters.followup === 'today' && (fTime < todayStart || fTime > todayEnd)) return false;
        if (this.filters.followup === 'upcoming' && fTime <= todayEnd) return false;
      }

      return true;
    });
  }

  renderLeadsTable() {
    const tableBody = document.getElementById('leads-table-body');
    const summaryEl = document.getElementById('leads-table-summary');
    if (!tableBody) return;

    const filtered = this.getFilteredLeads();

    if (summaryEl) {
      summaryEl.textContent = `Showing ${filtered.length} of ${this.leads.length} leads`;
    }

    if (filtered.length === 0) {
      if (this.leads.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-16">
              <div class="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              </div>
              <h4 class="text-base font-bold text-neutral-900">Your outreach list is empty</h4>
              <p class="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">Add your first target prospect to start tracking outreach and building your pipeline.</p>
              <button onclick="app.openAddLeadModal()" class="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
                Add your first lead
              </button>
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-12">
              <p class="text-sm font-medium text-neutral-700">No leads match your search criteria</p>
              <p class="text-xs text-neutral-400 mt-1">Try clearing some filters or searching for another keyword.</p>
              <button onclick="app.clearFilters()" class="mt-3 px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                Reset filters
              </button>
            </td>
          </tr>
        `;
      }
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;

    tableBody.innerHTML = filtered.map(lead => {
      // Follow-up badge formatting
      let followUpBadge = '<span class="text-neutral-400 text-xs">-</span>';
      if (lead.next_follow_up_at) {
        const fTime = new Date(lead.next_follow_up_at).getTime();
        const formattedDate = this.formatDateTime(lead.next_follow_up_at);
        if (fTime < todayStart) {
          followUpBadge = `<span class="badge-status followup-overdue">Overdue: ${formattedDate}</span>`;
        } else if (fTime >= todayStart && fTime <= todayEnd) {
          followUpBadge = `<span class="badge-status followup-today">Today: ${formattedDate}</span>`;
        } else {
          followUpBadge = `<span class="badge-status followup-upcoming">${formattedDate}</span>`;
        }
      }

      const lastContactedBadge = lead.last_contacted_at 
        ? `<span class="text-xs text-neutral-700">${this.formatDate(lead.last_contacted_at)}</span>`
        : `<span class="text-xs text-neutral-400">Never</span>`;

      return `
        <tr onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}')" class="table-row-hover">
          <td class="px-5 py-3.5 whitespace-nowrap">
            <div class="font-semibold text-neutral-900">${this.escapeHtml(lead.business_name)}</div>
            <div class="text-xs text-neutral-500">${this.escapeHtml(lead.contact_name || '')}</div>
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap text-xs text-neutral-700">
            ${this.escapeHtml(lead.location || '-')}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap text-xs text-neutral-700">
            <span class="inline-block px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">${this.escapeHtml(lead.niche || '-')}</span>
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="badge-status status-${this.slugify(lead.status)}">${this.escapeHtml(lead.status)}</span>
          </td>
          <td class="px-3 py-3.5 whitespace-nowrap text-center">
            <span class="tier-badge tier-${lead.lead_tier || 'B'}">${this.escapeHtml(lead.lead_tier || 'B')}</span>
          </td>
          <td class="px-3 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-neutral-800">
            ${lead.lead_score || '0'}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            ${followUpBadge}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            ${lastContactedBadge}
          </td>
        </tr>
      `;
    }).join('');
  }

  /* -------------------------------------------------------------------------- */
  /*                            LEAD DETAIL DRAWER                              */
  /* -------------------------------------------------------------------------- */

  openLeadDrawer(leadId) {
    const lead = this.leads.find(l => l.lead_id === leadId);
    if (!lead) return;

    this.activeLead = lead;
    this.renderLeadDrawerContent();

    const drawer = document.getElementById('lead-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const panel = document.getElementById('drawer-panel');

    if (drawer && backdrop && panel) {
      drawer.classList.remove('hidden');
      requestAnimationFrame(() => {
        backdrop.classList.remove('opacity-0');
        panel.classList.remove('translate-x-full');
      });
    }
  }

  closeLeadDrawer() {
    const drawer = document.getElementById('lead-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const panel = document.getElementById('drawer-panel');

    if (drawer && backdrop && panel) {
      backdrop.classList.add('opacity-0');
      panel.classList.add('translate-x-full');
      setTimeout(() => {
        drawer.classList.add('hidden');
        this.activeLead = null;
      }, 200);
    }
  }

  renderLeadDrawerContent() {
    const lead = this.activeLead;
    if (!lead) return;

    this.setElemText('drawer-business-name', lead.business_name);
    this.setElemText('drawer-contact-name', lead.contact_name || 'No contact specified');
    this.setElemText('drawer-lead-id', lead.lead_id);
    this.setElemText('drawer-location', lead.location || '-');
    this.setElemText('drawer-niche', lead.niche || '-');
    this.setElemText('drawer-lead-source', lead.lead_source || 'Manual');
    this.setElemText('drawer-place-id', lead.google_place_id || 'None');
    this.setElemText('drawer-lead-score', lead.lead_score || '0');
    this.setElemText('drawer-opportunity-score', lead.opportunity_score || '0');
    this.setElemText('drawer-notes', lead.notes || 'No notes recorded.');
    this.setElemText('drawer-date-added', this.formatDateTime(lead.date_added));
    this.setElemText('drawer-record-version', `v${lead.record_version || 1}`);
    this.setElemText('drawer-updated-at', this.formatDateTime(lead.updated_at));

    // Badges
    const statusBadge = document.getElementById('drawer-status-badge');
    if (statusBadge) {
      statusBadge.className = `badge-status status-${this.slugify(lead.status)}`;
      statusBadge.textContent = lead.status;
    }

    const tierBadge = document.getElementById('drawer-tier-badge');
    if (tierBadge) {
      tierBadge.className = `tier-badge tier-${lead.lead_tier || 'B'}`;
      tierBadge.textContent = lead.lead_tier || 'B';
    }

    // Follow-up status
    const followupEl = document.getElementById('drawer-next-followup');
    if (followupEl) {
      if (lead.next_follow_up_at) {
        followupEl.textContent = this.formatDateTime(lead.next_follow_up_at);
      } else {
        followupEl.textContent = 'None scheduled';
      }
    }

    const contactedEl = document.getElementById('drawer-last-contacted');
    if (contactedEl) {
      contactedEl.textContent = lead.last_contacted_at ? this.formatDateTime(lead.last_contacted_at) : 'Never contacted';
    }

    // Links: only allow safe, expected protocols.
    this.setupDrawerLink(
      'drawer-email-link',
      lead.email ? `mailto:${lead.email.trim()}` : null,
      lead.email
    );
    this.setupDrawerLink(
      'drawer-phone-link',
      lead.phone ? `tel:${lead.phone.trim()}` : null,
      lead.phone
    );
    this.setupDrawerLink(
      'drawer-website-link',
      this.sanitizeExternalUrl(lead.website),
      lead.website
    );
    this.setupDrawerLink(
      'drawer-instagram-link',
      lead.instagram
        ? this.sanitizeExternalUrl(
            lead.instagram.startsWith('http')
              ? lead.instagram
              : `https://instagram.com/${lead.instagram.replace('@', '')}`
          )
        : null,
      lead.instagram
    );

    // Activity Timeline (Filtered to this lead, sorted newest first)
    const leadActivities = this.activities
      .filter(a => a.lead_id === lead.lead_id)
      .sort((a, b) => new Date(b.activity_at || 0) - new Date(a.activity_at || 0));

    const actListContainer = document.getElementById('drawer-activities-list');
    if (actListContainer) {
      if (leadActivities.length === 0) {
        actListContainer.innerHTML = `
          <div class="p-4 bg-neutral-50 rounded-lg text-center text-xs text-neutral-400">
            No outreach recorded for this lead yet.
          </div>
        `;
      } else {
        actListContainer.innerHTML = leadActivities.map(act => `
          <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-neutral-900">${this.escapeHtml(act.activity_type)}</span>
              <span class="text-[11px] text-neutral-400 font-medium">${this.formatDateTime(act.activity_at)}</span>
            </div>
            <div class="flex items-center gap-2 text-neutral-500 text-[11px]">
              <span class="font-medium text-neutral-700">Channel: ${this.escapeHtml(act.channel)}</span>
              ${act.outcome ? `<span>&bull;</span> <span>Outcome: ${this.escapeHtml(act.outcome)}</span>` : ''}
            </div>
            <p class="text-neutral-800 font-medium">${this.escapeHtml(act.summary)}</p>
            ${act.notes ? `<p class="text-neutral-600 bg-white p-2 rounded border border-neutral-100 text-[11px] whitespace-pre-wrap">${this.escapeHtml(act.notes)}</p>` : ''}
          </div>
        `).join('');
      }
    }
  }

  setupDrawerLink(elemId, url, displayLabel) {
    const el = document.getElementById(elemId);
    if (!el) return;

    if (url && displayLabel) {
      el.href = url;
      el.textContent = displayLabel;
      el.classList.remove('pointer-events-none', 'text-neutral-400');
      el.classList.add('text-brand-600', 'hover:underline');
      return;
    }

    el.removeAttribute('href');
    el.textContent = '-';
    el.classList.add('pointer-events-none', 'text-neutral-400');
    el.classList.remove('text-brand-600', 'hover:underline');
  }

  /* -------------------------------------------------------------------------- */
  /*                            FOLLOW-UPS DESK VIEW                            */
  /* -------------------------------------------------------------------------- */

  renderFollowups() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + (24 * 60 * 60 * 1000) - 1;

    const overdue = [];
    const today = [];
    const upcoming = [];
    const none = [];

    this.leads.forEach(lead => {
      if (!lead.next_follow_up_at) {
        none.push(lead);
        return;
      }
      const fTime = new Date(lead.next_follow_up_at).getTime();
      if (isNaN(fTime)) {
        none.push(lead);
        return;
      }

      if (fTime < todayStart) {
        overdue.push(lead);
      } else if (fTime >= todayStart && fTime <= todayEnd) {
        today.push(lead);
      } else {
        upcoming.push(lead);
      }
    });

    // Sort overdue & today earliest first; upcoming earliest first
    overdue.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
    today.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
    upcoming.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));

    // Update Section Badges
    this.setElemText('badge-overdue-count', overdue.length);
    this.setElemText('badge-today-count', today.length);
    this.setElemText('badge-upcoming-count', upcoming.length);
    this.setElemText('badge-none-count', none.length);

    this.renderFollowupGroup('followups-list-overdue', overdue, 'No overdue follow-ups.');
    this.renderFollowupGroup('followups-list-today', today, 'No follow-ups scheduled for today.');
    this.renderFollowupGroup('followups-list-upcoming', upcoming, 'No upcoming follow-ups scheduled.');
    this.renderFollowupGroup('followups-list-none', none, 'All leads have follow-ups scheduled!');
  }

  renderFollowupGroup(containerId, list, emptyMsg) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-neutral-400 font-medium">${emptyMsg}</div>`;
      return;
    }

    container.innerHTML = list.map(lead => `
      <div class="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 rounded-lg transition-colors">
        <div class="cursor-pointer flex-1" onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}')">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-neutral-900 hover:text-brand-600">${this.escapeHtml(lead.business_name)}</span>
            <span class="badge-status status-${this.slugify(lead.status)} text-[10px]">${this.escapeHtml(lead.status)}</span>
            <span class="tier-badge tier-${lead.lead_tier || 'B'} text-[10px] w-4 h-4">${this.escapeHtml(lead.lead_tier || 'B')}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex items-center gap-3">
            <span>${this.escapeHtml(lead.contact_name || lead.location || 'No contact')}</span>
            <span>&bull;</span>
            <span>Last touch: ${lead.last_contacted_at ? this.formatDateTime(lead.last_contacted_at) : 'Never'}</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-xs font-semibold text-neutral-800 block">
              ${lead.next_follow_up_at ? this.formatDateTime(lead.next_follow_up_at) : 'Not scheduled'}
            </span>
          </div>
          <button onclick="app.quickSetFollowup('${lead.lead_id}', event)" class="px-2.5 py-1.5 border border-neutral-300 hover:bg-white text-neutral-700 text-xs font-medium rounded-md shadow-sm transition-colors">
            Reschedule
          </button>
          <button onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}')" class="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-md shadow-sm transition-colors">
            Open
          </button>
        </div>
      </div>
    `).join('');
  }

  quickSetFollowup(leadId, event) {
    if (event) event.stopPropagation();
    const lead = this.leads.find(l => l.lead_id === leadId);
    if (!lead) return;

    this.activeLead = lead;
    this.openSetFollowupModal();
  }

  /* -------------------------------------------------------------------------- */
  /*                               SETTINGS VIEW                                */
  /* -------------------------------------------------------------------------- */

  renderSettings() {
    this.setElemText('settings-sheet-name', this.spreadsheetTitle || 'CRM Sheet');
    this.setElemText('settings-sheet-id', this.spreadsheetId || 'Not connected');

    const linkEl = document.getElementById('settings-sheet-link');
    if (linkEl && this.spreadsheetId) {
      linkEl.href = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
    }

    this.updateAuthBadges(sheetsService.isAuthenticated());
  }

  /* -------------------------------------------------------------------------- */
  /*                              MODAL OPERATIONS                              */
  /* -------------------------------------------------------------------------- */

  openAddLeadModal() {
    const modal = document.getElementById('modal-add-lead');
    if (!modal) return;

    // Reset form
    document.getElementById('add-business-name').value = '';
    document.getElementById('add-contact-name').value = '';
    document.getElementById('add-niche').value = '';
    document.getElementById('add-location').value = '';
    document.getElementById('add-website').value = '';
    document.getElementById('add-instagram').value = '';
    document.getElementById('add-email').value = '';
    document.getElementById('add-phone').value = '';
    document.getElementById('add-place-id').value = '';
    document.getElementById('add-notes').value = '';
    document.getElementById('add-next-followup').value = '';
    document.getElementById('add-lead-score').value = '50';
    document.getElementById('add-opportunity-score').value = '50';
    document.getElementById('add-status').value = 'New';
    document.getElementById('add-lead-tier').value = 'B';
    document.getElementById('add-lead-source').value = 'Manual';

    modal.showModal();
  }

  async submitAddLead(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-add-lead');
    const modal = document.getElementById('modal-add-lead');

    const leadData = {
      business_name: document.getElementById('add-business-name').value,
      contact_name: document.getElementById('add-contact-name').value,
      niche: document.getElementById('add-niche').value,
      location: document.getElementById('add-location').value,
      website: document.getElementById('add-website').value,
      instagram: document.getElementById('add-instagram').value,
      email: document.getElementById('add-email').value,
      phone: document.getElementById('add-phone').value,
      status: document.getElementById('add-status').value,
      lead_tier: document.getElementById('add-lead-tier').value,
      lead_source: document.getElementById('add-lead-source').value,
      google_place_id: document.getElementById('add-place-id').value,
      lead_score: document.getElementById('add-lead-score').value,
      opportunity_score: document.getElementById('add-opportunity-score').value,
      next_follow_up_at: document.getElementById('add-next-followup').value,
      notes: document.getElementById('add-notes').value
    };

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Saving Lead...';

      // Duplicate check & append via sheetsService
      const newLead = await sheetsService.createLead(this.spreadsheetId, leadData, this.allLeadsRaw);

      this.leads.unshift(newLead);
      this.allLeadsRaw.unshift(newLead);
      this.showToast(`Added lead: ${newLead.business_name}`, 'success');

      modal.close();
      this.renderLeadsTable();
      this.updateNicheFilterOptions();

      // Open new lead in drawer
      this.openLeadDrawer(newLead.lead_id);
    } catch (err) {
      console.error('Error adding lead:', err);
      this.showToast(err.message || 'Could not save lead.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Create Lead';
    }
  }

  openEditLeadModal() {
    const lead = this.activeLead;
    if (!lead) return;

    const modal = document.getElementById('modal-edit-lead');
    const banner = document.getElementById('edit-concurrency-banner');
    if (!modal) return;

    if (banner) banner.classList.add('hidden');

    document.getElementById('edit-lead-id').value = lead.lead_id;
    document.getElementById('edit-record-version').value = lead.record_version;
    document.getElementById('edit-business-name').value = lead.business_name || '';
    document.getElementById('edit-contact-name').value = lead.contact_name || '';
    document.getElementById('edit-niche').value = lead.niche || '';
    document.getElementById('edit-location').value = lead.location || '';
    document.getElementById('edit-website').value = lead.website || '';
    document.getElementById('edit-instagram').value = lead.instagram || '';
    document.getElementById('edit-email').value = lead.email || '';
    document.getElementById('edit-phone').value = lead.phone || '';
    document.getElementById('edit-status').value = lead.status || 'New';
    document.getElementById('edit-lead-tier').value = lead.lead_tier || 'B';
    document.getElementById('edit-lead-source').value = lead.lead_source || 'Manual';
    document.getElementById('edit-place-id').value = lead.google_place_id || '';
    document.getElementById('edit-lead-score').value = lead.lead_score || '0';
    document.getElementById('edit-opportunity-score').value = lead.opportunity_score || '0';
    document.getElementById('edit-next-followup').value = lead.next_follow_up_at || '';
    document.getElementById('edit-notes').value = lead.notes || '';

    // Read-only fields
    this.setElemText('edit-readonly-id', lead.lead_id);
    this.setElemText('edit-readonly-date', this.formatDateTime(lead.date_added));
    this.setElemText('edit-readonly-contacted', lead.last_contacted_at ? this.formatDateTime(lead.last_contacted_at) : 'Never');
    this.setElemText('edit-readonly-version', `v${lead.record_version}`);

    modal.showModal();
  }

  async submitEditLead(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-edit-lead');
    const modal = document.getElementById('modal-edit-lead');
    const banner = document.getElementById('edit-concurrency-banner');

    const leadId = document.getElementById('edit-lead-id').value;
    const expectedVersion = parseInt(document.getElementById('edit-record-version').value, 10);

    const updatedFields = {
      business_name: document.getElementById('edit-business-name').value,
      contact_name: document.getElementById('edit-contact-name').value,
      niche: document.getElementById('edit-niche').value,
      location: document.getElementById('edit-location').value,
      website: document.getElementById('edit-website').value,
      instagram: document.getElementById('edit-instagram').value,
      email: document.getElementById('edit-email').value,
      phone: document.getElementById('edit-phone').value,
      status: document.getElementById('edit-status').value,
      lead_tier: document.getElementById('edit-lead-tier').value,
      lead_source: document.getElementById('edit-lead-source').value,
      google_place_id: document.getElementById('edit-place-id').value,
      lead_score: document.getElementById('edit-lead-score').value,
      opportunity_score: document.getElementById('edit-opportunity-score').value,
      next_follow_up_at: document.getElementById('edit-next-followup').value,
      notes: document.getElementById('edit-notes').value
    };

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Saving Changes...';

      // Updates with OPTIMISTIC CONCURRENCY PROTECTION
      const updatedLead = await sheetsService.updateLead(this.spreadsheetId, leadId, updatedFields, expectedVersion);

      // Update in memory arrays
      const leadIdx = this.leads.findIndex(l => l.lead_id === leadId);
      if (leadIdx !== -1) this.leads[leadIdx] = updatedLead;

      const rawIdx = this.allLeadsRaw.findIndex(l => l.lead_id === leadId);
      if (rawIdx !== -1) this.allLeadsRaw[rawIdx] = updatedLead;

      this.activeLead = updatedLead;
      this.renderLeadDrawerContent();
      this.renderLeadsTable();

      this.showToast('Lead updated successfully!', 'success');
      modal.close();
    } catch (err) {
      console.error('Update error:', err);
      if (err.isConcurrencyError) {
        if (banner) banner.classList.remove('hidden');
        this.showToast('Concurrency conflict: lead was updated elsewhere.', 'error');
      } else {
        this.showToast(err.message || 'Could not update lead.', 'error');
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Save Changes';
    }
  }

  async reloadActiveLead() {
    if (!this.activeLead) return;
    try {
      this.showToast('Reloading fresh data from Google Sheet...', 'info');
      await this.refreshData();
      const fresh = this.leads.find(l => l.lead_id === this.activeLead.lead_id);
      if (fresh) {
        this.activeLead = fresh;
        this.openEditLeadModal();
        this.showToast('Loaded latest version.', 'success');
      }
    } catch (e) {
      this.showToast('Failed to reload latest: ' + e.message, 'error');
    }
  }

  openAddActivityModal() {
    const lead = this.activeLead;
    if (!lead) return;

    const modal = document.getElementById('modal-add-activity');
    if (!modal) return;

    document.getElementById('act-summary').value = '';
    document.getElementById('act-outcome').value = '';
    document.getElementById('act-notes').value = '';
    document.getElementById('act-datetime').value = this.getNowLocalIso();
    document.getElementById('act-type').value = 'Initial DM';
    document.getElementById('act-channel').value = 'Instagram';

    modal.showModal();
  }

  async submitAddActivity(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-add-activity');
    const btnSubmit = document.getElementById('btn-submit-add-activity');
    const lead = this.activeLead;
    if (!lead) return;

    const actData = {
      lead_id: lead.lead_id,
      activity_type: document.getElementById('act-type').value,
      channel: document.getElementById('act-channel').value,
      activity_at: document.getElementById('act-datetime').value,
      summary: document.getElementById('act-summary').value,
      outcome: document.getElementById('act-outcome').value,
      notes: document.getElementById('act-notes').value
    };

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Logging Touchpoint...';

      const { activity, updatedLead } = await sheetsService.addActivity(this.spreadsheetId, actData, lead);

      this.activities.unshift(activity);

      // If last_contacted_at was updated
      if (updatedLead) {
        const leadIdx = this.leads.findIndex(l => l.lead_id === lead.lead_id);
        if (leadIdx !== -1) this.leads[leadIdx] = updatedLead;
        this.activeLead = updatedLead;
      }

      this.showToast('Activity logged successfully!', 'success');
      modal.close();
      this.renderLeadDrawerContent();
      this.renderLeadsTable();
    } catch (err) {
      console.error('Error logging activity:', err);
      this.showToast(err.message || 'Could not log activity.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Log Activity';
    }
  }

  openSetFollowupModal() {
    const lead = this.activeLead;
    if (!lead) return;

    const modal = document.getElementById('modal-set-followup');
    if (!modal) return;

    document.getElementById('set-followup-lead-id').value = lead.lead_id;
    document.getElementById('set-followup-datetime').value = lead.next_follow_up_at || this.getFutureLocalIso(1);

    modal.showModal();
  }

  setFollowupPreset(daysAhead) {
    const input = document.getElementById('set-followup-datetime');
    if (input) {
      input.value = this.getFutureLocalIso(daysAhead);
    }
  }

  async submitSetFollowup(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-set-followup');
    const lead = this.activeLead;
    if (!lead) return;

    const nextFollowup = document.getElementById('set-followup-datetime').value;

    try {
      this.showToast('Updating follow-up...', 'info');
      const updatedLead = await sheetsService.updateLead(
        this.spreadsheetId,
        lead.lead_id,
        { next_follow_up_at: nextFollowup },
        lead.record_version
      );

      const leadIdx = this.leads.findIndex(l => l.lead_id === lead.lead_id);
      if (leadIdx !== -1) this.leads[leadIdx] = updatedLead;
      this.activeLead = updatedLead;

      this.showToast('Follow-up schedule updated', 'success');
      modal.close();
      this.renderLeadDrawerContent();
      if (this.currentView === 'followups') this.renderFollowups();
      else if (this.currentView === 'dashboard') this.renderDashboard();
      else this.renderLeadsTable();
    } catch (err) {
      console.error('Error setting follow-up:', err);
      this.showToast(err.message || 'Could not update follow-up.', 'error');
    }
  }

  async handleArchiveLead() {
    const lead = this.activeLead;
    if (!lead) return;

    if (confirm(`Archive "${lead.business_name}"? It will be removed from your active leads views.`)) {
      try {
        this.showToast('Archiving lead...', 'info');
        await sheetsService.archiveLead(this.spreadsheetId, lead.lead_id, lead.record_version);

        // Remove from active leads array
        this.leads = this.leads.filter(l => l.lead_id !== lead.lead_id);

        this.closeLeadDrawer();
        this.renderLeadsTable();
        this.renderDashboard();
        this.showToast(`Archived "${lead.business_name}"`, 'success');
      } catch (err) {
        console.error('Archive failed:', err);
        this.showToast(err.message || 'Could not archive lead.', 'error');
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            UTILITY & FORMATTERS                            */
  /* -------------------------------------------------------------------------- */

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg class="w-4 h-4 text-emerald-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg class="w-4 h-4 text-red-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    } else {
      iconSvg = '<svg class="w-4 h-4 text-neutral-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span class="flex-1">${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  }

  formatDateTime(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return isoStr;
    }
  }

  getNowLocalIso() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  getFutureLocalIso(daysAhead = 1) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    d.setHours(10, 0, 0, 0); // Default 10:00 AM
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  sanitizeExternalUrl(value) {
    if (!value || typeof value !== 'string') return null;

    const raw = value.trim();
    if (!raw) return null;

    const candidate = /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return null;
      }
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  escapeJsString(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
  }

  slugify(text) {
    return (text || '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  setElemText(elemId, text) {
    const el = document.getElementById(elemId);
    if (el) el.textContent = text !== undefined && text !== null ? text : '-';
  }
}

// Instantiate global app
const app = new App();
window.app = app;

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
