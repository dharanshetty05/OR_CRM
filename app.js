/**
 * ScaleWithLakshya Outreach CRM - Main Application Logic
 * Express-served frontend with Google Sheets as the source of truth.
 */

class App {
  constructor() {
    this.leads = [];
    this.allLeadsRaw = [];
    this.activities = [];
    this.activeLead = null;
    this.isInitialDataLoading = true;
    this.currentView = 'leads';
    this.sheetsHealth = { status: 'starting', ready: false };
    this.searchQuery = '';
    this.filters = {
      status: '',
      niche: '',
      tier: '',
      source: '',
      followup: '',
      today: false
    };

    // Bind methods
    this.init = this.init.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /* -------------------------------------------------------------------------- */
  /*                               INITIALIZATION                               */
  /* -------------------------------------------------------------------------- */

  async init() {
    console.log(`${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} initializing...`);

    window.addEventListener('keydown', this.handleKeyDown);
    this.populateDropdowns();
    this.updateSheetsStatus({ status: 'starting', ready: false });

    // Show the dashboard immediately.
    // Google Sheets will load in the background.
    this.switchView('dashboard');
    this.hideLoadingOverlay();

    // Load backend / Google Sheets data without blocking the UI.
    try {
      await this.connectAndLoad();
    } catch (e) {
      console.error('Failed to load MyCRM data:', e);

      const message = this.friendlyConnectionError(e);

      this.updateSheetsStatus({
        status: 'error',
        ready: false
      });

      this.showToast(message, 'error');
    }
  }


  async connectAndLoad() {
    await dbService.waitUntilReady((health) => {
      this.updateSheetsStatus(health);
    });

    this.updateSheetsStatus({
      status: 'ready',
      ready: true
    });

    // The backend already keeps Google Sheets loaded in its in-memory cache.
    // Always read from that cache on load (fast, no Sheets round-trip).
    // A fresh Sheets read only happens when the user explicitly clicks Refresh.
    const [leads, activities] = await Promise.all([
      dbService.getAllLeads(),
      dbService.getAllActivities()
    ]);

    this.setDataset(leads, activities);
  }

  friendlyConnectionError(error) {
    const message = (error && error.message) || '';
    if (message.includes('unavailable')) return 'Google Sheets is unavailable';
    if (message.includes('connecting')) return 'Google Sheets is connecting...';
    if (message.includes('Could not connect')) return 'Could not connect to MyCRM';
    return 'Could not connect to MyCRM';
  }

  showLoadingOverlay(text = 'Google Sheets is connecting...', { showRetry = false } = {}) {
    const overlay = document.getElementById('app-loading-overlay');
    const label = document.getElementById('app-loading-text');
    const spinner = document.getElementById('app-loading-spinner');
    const retry = document.getElementById('app-loading-retry');
    if (label) {
      const textSpan = label.querySelector('span') || label;
      textSpan.textContent = text;
    }
    if (spinner) spinner.classList.toggle('hidden', showRetry);
    if (retry) retry.classList.toggle('hidden', !showRetry);
    if (overlay) overlay.classList.remove('hidden');
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('app-loading-overlay');
    if (overlay) overlay.classList.add('hidden');
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
    const statusSelects = ['filter-status', 'edit-status'];
    statusSelects.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
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
    const sourceSelects = ['filter-source', 'edit-lead-source'];
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
        if (ch === 'Instagram') opt.selected = true;
        actChannelSelect.appendChild(opt);
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               VIEW NAVIGATION                              */
  /* -------------------------------------------------------------------------- */

  switchView(viewName) {
    this.currentView = viewName;
    localStorage.setItem(CONFIG.STORAGE_KEYS.ACTIVE_VIEW, viewName);

    // Hide all views
    ['dashboard', 'leads', 'followups'].forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add('hidden');
    });

    // Show selected view
    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.remove('hidden');

    // Update Sidebar Navigation state
    ['dashboard', 'leads', 'followups'].forEach(navKey => {
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

    // Render View Content
    if (viewName === 'dashboard') this.renderDashboard();
    else if (viewName === 'leads') this.renderLeadsTable();
    else if (viewName === 'followups') this.renderFollowups();
  }

  /* -------------------------------------------------------------------------- */
  /*                            DATA SYNCHRONIZATION                            */
  /* -------------------------------------------------------------------------- */

  async refreshFromSheets() {
    try {
      this.showToast('Refreshing from Google Sheets...', 'info');
      const { leads, activities } = await dbService.refreshFromSheets();
      this.setDataset(leads, activities);
      this.updateSheetsStatus({ status: 'ready', ready: true });
      this.showToast('Leads refreshed from Google Sheets', 'success');
    } catch (err) {
      console.error('Error refreshing from Google Sheets:', err);
      if (this.sheetsHealth.status !== 'ready') {
        this.updateSheetsStatus({ status: 'error', ready: false });
      }
      this.showToast(err.message || 'Google Sheets is unavailable', 'error');
    }
  }

  setDataset(allLeads, allActivities) {
    this.allLeadsRaw = allLeads || [];
    this.activities = allActivities || [];
    this.isInitialDataLoading = false;
    this.rebuildVisibleState();
  }

  applyLocalLead(lead) {
    if (!lead || !lead.lead_id) return;
    const idx = this.allLeadsRaw.findIndex(l => l.lead_id === lead.lead_id);
    if (idx === -1) this.allLeadsRaw.push(lead);
    else this.allLeadsRaw[idx] = lead;
    this.rebuildVisibleState();
  }

  applyLocalActivity(activity) {
    if (!activity) return;
    const existing = this.activities.findIndex(a => a.activity_id === activity.activity_id);
    if (existing === -1) this.activities.push(activity);
    else this.activities[existing] = activity;
    this.rebuildVisibleState();
  }

  rebuildVisibleState() {
    this.leads = this.allLeadsRaw.filter(l => !l.archived_at && l.lead_id);

    const countEl = document.getElementById('nav-leads-count');
    if (countEl) countEl.textContent = this.leads.length;

    this.updateNicheFilterOptions();
    this.rerenderCurrentView();

    if (this.activeLead) {
      const fresh = this.allLeadsRaw.find(l => l.lead_id === this.activeLead.lead_id);
      if (fresh && !fresh.archived_at) {
        this.activeLead = fresh;
        this.renderLeadDrawerContent();
      }
    }
  }

  rerenderCurrentView() {
    if (this.currentView === 'dashboard') this.renderDashboard();
    else if (this.currentView === 'leads') this.renderLeadsTable();
    else if (this.currentView === 'followups') this.renderFollowups();
  }

  updateSheetsStatus(health) {
    this.sheetsHealth = health || { status: 'starting', ready: false };
    const status = this.sheetsHealth.status;
    const labelEl = document.getElementById('sheets-status-label');
    const dotEl = document.getElementById('sheets-status-dot');

    let label = 'Connecting...';
    let dotClass = 'bg-amber-400';

    if (status === 'ready') {
      label = 'Connected';
      dotClass = 'bg-emerald-500';
    } else if (status === 'error') {
      label = 'Connection Error';
      dotClass = 'bg-red-500';
    }

    if (labelEl) labelEl.textContent = label;
    if (dotEl) {
      dotEl.className = `w-2 h-2 rounded-full ${dotClass}`;
    }
  }

  getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + (24 * 60 * 60 * 1000) - 1;
    return { start, end };
  }

  // Leads that had an actual outreach touchpoint (any activity) logged today,
  // in the user's local timezone. Used by the "Today" filter and dashboard
  // metrics. Deliberately based on activities, not lead creation date.
  getLeadIdsReachedToday() {
    const { start, end } = this.getTodayRange();
    const ids = new Set();
    this.activities.forEach(act => {
      const t = act.activity_at ? new Date(act.activity_at).getTime() : NaN;
      if (!isNaN(t) && t >= start && t <= end) ids.add(act.lead_id);
    });
    return ids;
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
    // Keep the instant dashboard from showing misleading zero values
    // while Google Sheets is still loading the first dataset.
    if (this.isInitialDataLoading) {
      const loadingMetrics = [
        'metric-total-leads',
        'metric-reached-today',
        'metric-total-touchpoints',
        'metric-not-contacted',
        'metric-dm-sent',
        'metric-replied',
        'metric-overdue',
        'metric-due-today',
        'metric-calls-booked',
        'metric-won'
      ];

      loadingMetrics.forEach(id => {
        this.setElemText(id, '—');
      });

      const urgentContainer = document.getElementById('dashboard-urgent-followups');
      if (urgentContainer) {
        urgentContainer.innerHTML = `
          <div class="py-8 text-center">
            <div class="w-8 h-8 mx-auto mb-3 border-2 border-neutral-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p class="text-sm font-medium text-neutral-600">Loading your outreach data...</p>
            <p class="text-xs text-neutral-400 mt-1">Connecting to Google Sheets.</p>
          </div>
        `;
      }

      const activityContainer = document.getElementById('dashboard-recent-activity');
      if (activityContainer) {
        activityContainer.innerHTML = `
          <div class="py-8 text-center">
            <div class="w-8 h-8 mx-auto mb-3 border-2 border-neutral-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p class="text-sm font-medium text-neutral-600">Loading recent activity...</p>
          </div>
        `;
      }

      const trendContainer = document.getElementById('dashboard-activity-trend');
      if (trendContainer) trendContainer.innerHTML = '';

      return;
    }

    const { start: todayStart, end: todayEnd } = this.getTodayRange();

    let countTotal = this.leads.length;
    let countNotContacted = 0;
    let countDmSent = 0;
    let countReplied = 0;
    let countCallsBooked = 0;
    let countWon = 0;

    let overdueFollowups = [];
    let dueTodayFollowups = [];

    this.leads.forEach(lead => {
      const st = (lead.status || '').toUpperCase();

      if (st === 'NOT CONTACTED' || st === 'NEW' || st === 'RESEARCHING' || st === 'READY TO CONTACT') {
        countNotContacted++;
      } else if (st === 'DM SENT' || st === 'CONTACTED' || st === 'FOLLOW-UP') {
        countDmSent++;
      } else if (st === 'REPLIED') {
        countReplied++;
      } else if (st === 'CALL BOOKED' || st === 'CALL COMPLETED' || st === 'PROPOSAL SENT') {
        countCallsBooked++;
      } else if (st === 'WON') {
        countWon++;
      }

      // Follow-up check
      if (lead.next_follow_up_at) {
        const fTime = new Date(lead.next_follow_up_at).getTime();
        if (!isNaN(fTime)) {
          if (fTime < todayStart) overdueFollowups.push(lead);
          else if (fTime >= todayStart && fTime <= todayEnd) dueTodayFollowups.push(lead);
        }
      }
    });

    // Reached today: leads with an actual outreach activity logged today
    // (not leads created today).
    const reachedTodayIds = this.getLeadIdsReachedToday();
    const reachedTodayCount = this.leads.filter(l => reachedTodayIds.has(l.lead_id)).length;

    // Update DOM Metrics
    this.setElemText('metric-total-leads', countTotal);
    this.setElemText('metric-reached-today', reachedTodayCount);
    this.setElemText('metric-total-touchpoints', this.activities.length);
    this.setElemText('metric-not-contacted', countNotContacted);
    this.setElemText('metric-dm-sent', countDmSent);
    this.setElemText('metric-replied', countReplied);
    this.setElemText('metric-overdue', overdueFollowups.length);
    this.setElemText('metric-due-today', dueTodayFollowups.length);
    this.setElemText('metric-calls-booked', countCallsBooked);
    this.setElemText('metric-won', countWon);

    this.renderActivityTrend();

    // Sidebar overdue badge
    const navOverdue = document.getElementById('nav-overdue-count');
    if (navOverdue) {
      if (overdueFollowups.length > 0) {
        navOverdue.textContent = overdueFollowups.length;
        navOverdue.classList.remove('hidden');
      } else {
        navOverdue.classList.add('hidden');
      }
    }

    // Urgent follow-ups list
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
                  <span>${this.escapeHtml(lead.instagram || lead.contact_name || 'Prospect')}</span>
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

    // Recent activity list
    const activityContainer = document.getElementById('dashboard-recent-activity');
    if (activityContainer) {
      if (this.activities.length === 0) {
        activityContainer.innerHTML = `
          <div class="py-8 text-center text-xs text-neutral-400">
            No outreach activities recorded yet. Open any lead to log DMs.
          </div>
        `;
      } else {
        const sortedActivities = [...this.activities].sort((a, b) => new Date(b.activity_at || 0) - new Date(a.activity_at || 0)).slice(0, 8);
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

  // Simple 7-day outreach volume trend (today + previous 6 days), built from
  // the activities already in memory - no extra requests.
  renderActivityTrend() {
    const container = document.getElementById('dashboard-activity-trend');
    if (!container) return;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + (24 * 60 * 60 * 1000) - 1;
      days.push({ dayStart, dayEnd, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 });
    }

    this.activities.forEach(act => {
      const t = act.activity_at ? new Date(act.activity_at).getTime() : NaN;
      if (isNaN(t)) return;
      const day = days.find(d => t >= d.dayStart && t <= d.dayEnd);
      if (day) day.count++;
    });

    const maxCount = Math.max(1, ...days.map(d => d.count));

    container.innerHTML = `
      <div class="flex items-end justify-between gap-2 h-24 px-1">
        ${days.map((d, idx) => {
          const heightPct = Math.max(6, Math.round((d.count / maxCount) * 100));
          const isToday = idx === days.length - 1;
          return `
            <div class="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title="${d.count} touchpoint${d.count === 1 ? '' : 's'}">
              <span class="text-[10px] font-semibold text-neutral-500">${d.count}</span>
              <div class="w-full rounded-t-md ${isToday ? 'bg-brand-600' : 'bg-brand-200'} transition-all" style="height: ${heightPct}%"></div>
              <span class="text-[10px] font-medium ${isToday ? 'text-brand-700' : 'text-neutral-400'}">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
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

  // Toggle the "Today" quick filter (leads reached via an outreach
  // activity today). Can be called from the leads view chip or from
  // the dashboard "Reached Today" metric.
  toggleTodayFilter(forceOn) {
    this.filters.today = typeof forceOn === 'boolean' ? forceOn : !this.filters.today;
    const chip = document.getElementById('filter-today-chip');
    if (chip) {
      chip.classList.toggle('bg-brand-600', this.filters.today);
      chip.classList.toggle('text-white', this.filters.today);
      chip.classList.toggle('border-brand-600', this.filters.today);
      chip.classList.toggle('bg-white', !this.filters.today);
      chip.classList.toggle('text-neutral-700', !this.filters.today);
      chip.classList.toggle('border-neutral-300', !this.filters.today);
    }
    this.renderLeadsTable();
  }

  goToReachedToday() {
    this.switchView('leads');
    this.toggleTodayFilter(true);
  }

  clearFilters() {
    this.searchQuery = '';
    const searchInput = document.getElementById('leads-search');
    if (searchInput) searchInput.value = '';

    ['filter-status', 'filter-niche', 'filter-tier', 'filter-source', 'filter-followup'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.filters = { status: '', niche: '', tier: '', source: '', followup: '', today: false };
    const chip = document.getElementById('filter-today-chip');
    if (chip) {
      chip.classList.remove('bg-brand-600', 'text-white', 'border-brand-600');
      chip.classList.add('bg-white', 'text-neutral-700', 'border-neutral-300');
    }
    this.renderLeadsTable();
  }

  getFilteredLeads() {
    const { start: todayStart, end: todayEnd } = this.getTodayRange();
    const reachedTodayIds = this.filters.today ? this.getLeadIdsReachedToday() : null;

    return this.leads.filter(lead => {
      if (reachedTodayIds && !reachedTodayIds.has(lead.lead_id)) return false;

      if (this.searchQuery) {
        const haystack = [
          lead.business_name,
          lead.contact_name,
          lead.niche,
          lead.location,
          lead.instagram,
          lead.website,
          lead.email,
          lead.phone
        ].filter(Boolean).join(' ').toLowerCase();

        if (!haystack.includes(this.searchQuery)) return false;
      }

      if (this.filters.status && lead.status !== this.filters.status) return false;
      if (this.filters.niche && lead.niche !== this.filters.niche) return false;
      if (this.filters.tier && lead.lead_tier !== this.filters.tier) return false;
      if (this.filters.source && lead.lead_source !== this.filters.source) return false;

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
      summaryEl.textContent = this.filters.today
        ? `${filtered.length} lead${filtered.length === 1 ? '' : 's'} reached today (of ${this.leads.length} total)`
        : `Showing ${filtered.length} of ${this.leads.length} leads`;
    }

    if (filtered.length === 0) {
      if (this.leads.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-16">
              <div class="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              </div>
              <h4 class="text-base font-bold text-neutral-900">Your lead list is currently empty</h4>
              <p class="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Add leads directly to Google Sheets, then refresh the CRM.
              </p>
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

      const igUrl = lead.instagram
        ? (lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`)
        : null;

      const actionsHtml = `<div class="flex items-center gap-2">
        ${igUrl ? `<a href="${this.sanitizeExternalUrl(igUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[11px] font-bold shadow-sm transition-colors">Open IG</a>` : '<span class="text-neutral-400 text-[11px]">-</span>'}
        <button onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}'); event.stopPropagation();" class="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded text-[11px] font-bold shadow-sm transition-colors">Open Lead</button>
      </div>`;

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
            ${actionsHtml}
          </td>
          <td class="px-4 py-3.5 whitespace-nowrap">
            <span class="badge-status status-${this.slugify(lead.status)}">${this.escapeHtml(lead.status)}</span>
          </td>
          <td class="px-3 py-3.5 whitespace-nowrap text-center">
            <span class="tier-badge tier-${lead.lead_tier || 'B'}">${this.escapeHtml(lead.lead_tier || 'B')}</span>
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
    this.setElemText('drawer-notes', lead.notes || 'No notes recorded.');
    this.setElemText('drawer-instagram-handle', lead.instagram || 'Not set');

    // Instagram Button setup
    const igBtn = document.getElementById('btn-drawer-open-ig');
    if (igBtn) {
      if (lead.instagram) {
        const url = lead.instagram.startsWith('http')
          ? lead.instagram
          : `https://instagram.com/${lead.instagram.replace('@', '')}`;
        igBtn.href = this.sanitizeExternalUrl(url);
        igBtn.classList.remove('pointer-events-none', 'opacity-50');
      } else {
        igBtn.removeAttribute('href');
        igBtn.classList.add('pointer-events-none', 'opacity-50');
      }
    }

    // Status Badges
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
      followupEl.textContent = lead.next_follow_up_at ? this.formatDateTime(lead.next_follow_up_at) : 'None scheduled';
    }

    const contactedEl = document.getElementById('drawer-last-contacted');
    if (contactedEl) {
      contactedEl.textContent = lead.last_contacted_at ? this.formatDateTime(lead.last_contacted_at) : 'Never contacted';
    }

    // Populate Fast Actions
    const quickActionsEl = document.getElementById('drawer-quick-actions');
    if (quickActionsEl) {
      let actionBtn = '';
      const statusUpper = (lead.status || '').toUpperCase();
      const closedStatuses = ['REPLIED', 'CALL BOOKED', 'CALL COMPLETED', 'PROPOSAL SENT', 'WON', 'LOST'];
      
      if (statusUpper === 'NOT CONTACTED' || statusUpper === 'NEW' || statusUpper === 'RESEARCHING' || statusUpper === 'READY TO CONTACT') {
        actionBtn = `<button onclick="app.markDmSent('${this.escapeJsString(lead.lead_id)}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span>Mark DM Sent</span>
        </button>`;
      } else if (!closedStatuses.includes(statusUpper)) {
        actionBtn = `<button onclick="app.markFollowedUp('${this.escapeJsString(lead.lead_id)}')" class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          <span>Mark Followed Up</span>
        </button>`;
      }
      
      quickActionsEl.innerHTML = actionBtn;
    }

    // Contact Links
    this.setupDrawerLink('drawer-email-link', lead.email ? `mailto:${lead.email.trim()}` : null, lead.email);
    this.setupDrawerLink('drawer-phone-link', lead.phone ? `tel:${lead.phone.trim()}` : null, lead.phone);
    this.setupDrawerLink('drawer-website-link', this.sanitizeExternalUrl(lead.website), lead.website);
    this.setupDrawerLink(
      'drawer-instagram-link',
      lead.instagram ? this.sanitizeExternalUrl(lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`) : null,
      lead.instagram
    );

    // Activity Timeline
    const leadActivities = this.activities
      .filter(a => a.lead_id === lead.lead_id)
      .sort((a, b) => new Date(b.activity_at || 0) - new Date(a.activity_at || 0));

    const actListContainer = document.getElementById('drawer-activities-list');
    if (actListContainer) {
      if (leadActivities.length === 0) {
        actListContainer.innerHTML = `
          <div class="p-4 bg-neutral-50 rounded-lg text-center text-xs text-neutral-400">
            No outreach touchpoints logged for this lead yet.
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

      if (fTime < todayStart) overdue.push(lead);
      else if (fTime >= todayStart && fTime <= todayEnd) today.push(lead);
      else upcoming.push(lead);
    });

    overdue.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
    today.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
    upcoming.sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));

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

    container.innerHTML = list.map(lead => {
      const igUrl = lead.instagram
        ? (lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`)
        : null;
        
      const statusUpper = (lead.status || '').toUpperCase();
      const closedStatuses = ['REPLIED', 'CALL BOOKED', 'CALL COMPLETED', 'PROPOSAL SENT', 'WON', 'LOST'];
      const showFollowUpBtn = !closedStatuses.includes(statusUpper);
      
      return `
      <div class="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 rounded-lg transition-colors">
        <div class="cursor-pointer flex-1" onclick="app.openLeadDrawer('${this.escapeHtml(this.escapeJsString(lead.lead_id))}')">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-neutral-900 hover:text-brand-600">${this.escapeHtml(lead.business_name)}</span>
            <span class="badge-status status-${this.slugify(lead.status)} text-[10px]">${this.escapeHtml(lead.status)}</span>
            <span class="tier-badge tier-${lead.lead_tier || 'B'} text-[10px] w-4 h-4">${this.escapeHtml(lead.lead_tier || 'B')}</span>
          </div>
          <div class="text-xs text-neutral-500 mt-1 flex items-center gap-3">
            <span>${this.escapeHtml(lead.instagram || lead.contact_name || 'No contact')}</span>
            <span>&bull;</span>
            <span>Last touch: ${lead.last_contacted_at ? this.formatDateTime(lead.last_contacted_at) : 'Never'}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${igUrl ? `<a href="${this.sanitizeExternalUrl(igUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md text-xs font-semibold shadow-sm transition-colors">Open IG</a>` : ''}
          ${showFollowUpBtn ? `<button onclick="event.stopPropagation(); app.markFollowedUp('${this.escapeJsString(lead.lead_id)}')" class="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-semibold shadow-sm transition-colors">Mark Followed Up</button>` : ''}
          <button onclick="app.quickSetFollowup('${lead.lead_id}', event)" class="px-2.5 py-1.5 border border-neutral-300 hover:bg-white text-neutral-700 text-xs font-medium rounded-md shadow-sm transition-colors">
            Reschedule
          </button>
        </div>
      </div>
    `}).join('');
  }

  quickSetFollowup(leadId, event) {
    if (event) event.stopPropagation();
    const lead = this.leads.find(l => l.lead_id === leadId);
    if (!lead) return;

    this.activeLead = lead;
    this.openSetFollowupModal();
  }
  /* -------------------------------------------------------------------------- */
  /*                              MODAL OPERATIONS                              */
  /* -------------------------------------------------------------------------- */

  openEditLeadModal() {
    const lead = this.activeLead;
    if (!lead) return;

    const modal = document.getElementById('modal-edit-lead');
    if (!modal) return;

    document.getElementById('edit-lead-id').value = lead.lead_id;
    document.getElementById('edit-business-name').value = lead.business_name || '';
    document.getElementById('edit-contact-name').value = lead.contact_name || '';
    document.getElementById('edit-niche').value = lead.niche || '';
    document.getElementById('edit-location').value = lead.location || '';
    document.getElementById('edit-website').value = lead.website || '';
    document.getElementById('edit-instagram').value = lead.instagram || '';
    document.getElementById('edit-phone').value = lead.phone || '';
    document.getElementById('edit-status').value = lead.status || 'NOT CONTACTED';
    document.getElementById('edit-lead-tier').value = lead.lead_tier || 'B';
    document.getElementById('edit-lead-source').value = lead.lead_source || 'Instagram';
    document.getElementById('edit-next-followup').value = lead.next_follow_up_at || '';
    document.getElementById('edit-notes').value = lead.notes || '';

    modal.showModal();
  }

  async submitEditLead(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-edit-lead');
    const modal = document.getElementById('modal-edit-lead');
    const leadId = document.getElementById('edit-lead-id').value;

    const updatedFields = {
      business_name: document.getElementById('edit-business-name').value,
      contact_name: document.getElementById('edit-contact-name').value,
      niche: document.getElementById('edit-niche').value,
      location: document.getElementById('edit-location').value,
      website: document.getElementById('edit-website').value,
      instagram: document.getElementById('edit-instagram').value,
      phone: document.getElementById('edit-phone').value,
      status: document.getElementById('edit-status').value,
      lead_tier: document.getElementById('edit-lead-tier').value,
      lead_source: document.getElementById('edit-lead-source').value,
      next_follow_up_at: document.getElementById('edit-next-followup').value,
      notes: document.getElementById('edit-notes').value
    };

    try {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Saving Changes...';

      const updatedLead = await dbService.updateLead(leadId, updatedFields, this.allLeadsRaw);
      this.applyLocalLead(updatedLead);
      this.activeLead = updatedLead;
      this.renderLeadDrawerContent();

      this.showToast('Lead updated successfully!', 'success');
      modal.close();
    } catch (err) {
      console.error('Update error:', err);
      this.showToast(err.message || 'Could not update lead.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Save Changes';
    }
  }

  openAddActivityModal(defaultType = 'Initial DM') {
    const lead = this.activeLead;
    if (!lead) return;

    const modal = document.getElementById('modal-add-activity');
    if (!modal) return;

    document.getElementById('act-summary').value = defaultType === 'Initial DM' ? 'Sent initial Instagram DM' : '';
    document.getElementById('act-outcome').value = defaultType === 'Initial DM' ? 'DM Sent' : '';
    document.getElementById('act-notes').value = '';
    document.getElementById('act-datetime').value = this.getNowLocalIso();
    document.getElementById('act-type').value = defaultType;
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

      const res = await dbService.addActivity(actData, lead);
      if (res && res.activity) this.applyLocalActivity(res.activity);
      if (res && res.updatedLead) this.applyLocalLead(res.updatedLead);

      if (res && res.partialSuccess) {
        this.showToast(res.warning, 'warning');
      } else {
        this.showToast('Outreach touchpoint logged successfully!', 'success');
      }
      modal.close();
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
      const updatedLead = await dbService.updateLead(lead.lead_id, { next_follow_up_at: nextFollowup }, this.allLeadsRaw);
      this.applyLocalLead(updatedLead);

      this.showToast('Follow-up schedule updated', 'success');
      modal.close();
    } catch (err) {
      console.error('Error setting follow-up:', err);
      this.showToast(err.message || 'Could not update follow-up.', 'error');
    }
  }

  async clearFollowup() {
    const modal = document.getElementById('modal-set-followup');
    const lead = this.activeLead;
    if (!lead) return;

    try {
      const updatedLead = await dbService.updateLead(lead.lead_id, { next_follow_up_at: '' }, this.allLeadsRaw);
      this.applyLocalLead(updatedLead);
      this.showToast('Follow-up cleared', 'success');
      modal.close();
    } catch (err) {
      console.error('Error clearing follow-up:', err);
      this.showToast('Could not clear follow-up.', 'error');
    }
  }

  async markDmSent(leadId) {
    const lead = this.leads.find(l => l.lead_id === leadId);
    if (!lead) return;

    try {
      const actData = {
        lead_id: lead.lead_id,
        activity_type: 'Initial DM',
        channel: 'Instagram',
        activity_at: this.getNowLocalIso(),
        summary: 'Sent initial Instagram DM',
        outcome: 'DM Sent',
        notes: ''
      };
      
      const res = await dbService.addActivity(actData, lead);
      if (res && res.activity) this.applyLocalActivity(res.activity);
      if (res && res.updatedLead) this.applyLocalLead(res.updatedLead);

      const current = res && res.updatedLead ? res.updatedLead : lead;
      const statusUpper = (current.status || '').toUpperCase();
      if (statusUpper !== 'DM SENT' && ['NOT CONTACTED', 'NEW', 'RESEARCHING', 'READY TO CONTACT'].includes((lead.status || '').toUpperCase())) {
        const updatedLead = await dbService.updateLead(lead.lead_id, { status: 'DM SENT' }, this.allLeadsRaw);
        this.applyLocalLead(updatedLead);
      }
      
      this.showToast('Initial DM marked as sent', 'success');
    } catch (err) {
      console.error('Error marking DM sent:', err);
      this.showToast('Could not mark DM sent', 'error');
    }
  }

  async markFollowedUp(leadId) {
    const lead = this.leads.find(l => l.lead_id === leadId);
    if (!lead) return;

    try {
      const leadActivities = this.activities.filter(a => a.lead_id === leadId);
      const followUpCount = leadActivities.filter(a => a.activity_type.startsWith('Follow-up')).length + 1;
      const activityType = `Follow-up #${followUpCount > 3 ? '3' : followUpCount}`;
      
      const actData = {
        lead_id: lead.lead_id,
        activity_type: activityType,
        channel: 'Instagram',
        activity_at: this.getNowLocalIso(),
        summary: 'Sent Instagram follow-up',
        outcome: 'Follow-up Sent',
        notes: ''
      };
      
      const res = await dbService.addActivity(actData, lead);
      if (res && res.activity) this.applyLocalActivity(res.activity);
      if (res && res.updatedLead) this.applyLocalLead(res.updatedLead);
      
      const nextFollowup = this.getFutureLocalIso(3);
      const updatedLead = await dbService.updateLead(lead.lead_id, { next_follow_up_at: nextFollowup }, this.allLeadsRaw);
      this.applyLocalLead(updatedLead);
      
      this.showToast('Follow-up logged. Next follow-up in 3 days.', 'success');
    } catch (err) {
      console.error('Error marking followed up:', err);
      this.showToast('Could not mark follow-up', 'error');
    }
  }

  async handleArchiveLead() {
    const lead = this.activeLead;
    if (!lead) return;

    if (confirm(`Archive "${lead.business_name}"? It will be removed from your active leads views.`)) {
      try {
        await dbService.archiveLead(lead.lead_id);
        this.applyLocalLead({ ...lead, archived_at: new Date().toISOString() });

        this.closeLeadDrawer();
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
    } else if (type === 'warning') {
      iconSvg = '<svg class="w-4 h-4 text-amber-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>';
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
    d.setHours(10, 0, 0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  sanitizeExternalUrl(value) {
    if (!value || typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;

    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
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
    return (text || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
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
window.app = new App();
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});