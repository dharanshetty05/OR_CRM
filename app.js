/**
 * ScaleWithLakshya Outreach CRM
 * Main Application Logic
 *
 * Backend source of truth:
 *   LEADS    -> routes/leads.js
 *   ACTIVITY -> routes/activities.js
 *
 * The frontend normalizes backend field names so UI logic stays consistent.
 */

class App {
  constructor() {
    this.leads = [];
    this.activities = [];
    this.activeLead = null;

    this.isInitialDataLoading = true;
    this.currentView = 'dashboard';

    this.sheetsHealth = {
      status: 'starting',
      ready: false
    };

    this.searchQuery = '';

    this.filters = {
      status: '',
      niche: '',
      followup: ''
    };

    this.init = this.init.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /* ========================================================================== */
  /* INITIALIZATION                                                             */
  /* ========================================================================== */

  async init() {
    console.log(
      `${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} initializing...`
    );

    window.addEventListener('keydown', this.handleKeyDown);

    this.updateSheetsStatus({
      status: 'starting',
      ready: false
    });

    // Dashboard appears immediately.
    this.switchView('dashboard');
    this.hideLoadingOverlay();

    // Load data in background.
    try {
      await this.connectAndLoad();
    } catch (error) {
      console.error('Failed to load CRM:', error);

      this.updateSheetsStatus({
        status: 'error',
        ready: false
      });

      this.showToast(
        this.friendlyConnectionError(error),
        'error'
      );
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

    const [rawLeads, rawActivities] = await Promise.all([
      dbService.getAllLeads(),
      dbService.getAllActivities()
    ]);

    this.setDataset(rawLeads, rawActivities);
  }

  friendlyConnectionError(error) {
    const message = error?.message || '';

    if (message.includes('unavailable')) {
      return 'Google Sheets is unavailable';
    }

    if (message.includes('connecting')) {
      return 'Google Sheets is connecting...';
    }

    return 'Could not connect to MyCRM';
  }

  /* ========================================================================== */
  /* LOADING                                                                    */
  /* ========================================================================== */

  showLoadingOverlay(
    text = 'Google Sheets is connecting...',
    { showRetry = false } = {}
  ) {
    const overlay = document.getElementById('app-loading-overlay');
    const label = document.getElementById('app-loading-text');
    const spinner = document.getElementById('app-loading-spinner');
    const retry = document.getElementById('app-loading-retry');

    if (label) {
      const span = label.querySelector('span') || label;
      span.textContent = text;
    }

    if (spinner) {
      spinner.classList.toggle('hidden', showRetry);
    }

    if (retry) {
      retry.classList.toggle('hidden', !showRetry);
    }

    if (overlay) {
      overlay.classList.remove('hidden');
    }
  }

  hideLoadingOverlay() {
    const overlay = document.getElementById('app-loading-overlay');

    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  handleKeyDown(event) {
    if (event.key !== 'Escape') return;

    const drawer = document.getElementById('lead-drawer');

    if (drawer && !drawer.classList.contains('hidden')) {
      this.closeLeadDrawer();
    }
  }

  /* ========================================================================== */
  /* DATA NORMALIZATION                                                         */
  /* ========================================================================== */

  normalizeLead(raw) {
    if (!raw) return null;

    return {
      id: raw.lead_id || '',
      business_name: raw.business_name || '',
      location: raw.location || '',
      niche: raw.niche || '',
      instagram_url: raw.instagram_url || '',
      website: raw.website || '',
      opportunity_score: raw.opportunity_score ?? '',
      status: raw.status || 'NEW_LEAD',
      next_follow_up_at: raw.next_follow_up_at || '',
      follow_up_count: Number(raw.follow_up_count || 0),
      dm_sent_date_time: raw.dm_sent_date_time || '',
      reply_date: raw.reply_date || '',
      call_booked_date: raw.call_booked_date || '',
      outcome: raw.outcome || '',
      notes: raw.notes || '',
      updated_at: raw.updated_at || ''
    };
  }

  normalizeActivity(raw) {
    if (!raw) return null;

    return {
      id:
        raw.id ||
        raw.activity_id ||
        '',

      lead_id:
        raw.lead_id ||
        '',

      type:
        raw.type ||
        raw.activity_type ||
        '',

      date:
        raw.date ||
        raw.activity_at ||
        '',

      follow_up_number:
        raw.follow_up_number || '',

      message:
        raw.message ||
        raw.summary ||
        '',

      outcome:
        raw.outcome || '',

      notes:
        raw.notes || '',

      created_at:
        raw.created_at || ''
    };
  }

  setDataset(rawLeads, rawActivities) {
    this.leads = (rawLeads || [])
      .map(lead => this.normalizeLead(lead))
      .filter(lead => lead && lead.id);

    this.activities = (rawActivities || [])
      .map(activity => this.normalizeActivity(activity))
      .filter(activity => activity && activity.id);

    this.isInitialDataLoading = false;

    this.updateLeadCount();
    this.updateNicheFilterOptions();
    this.rerenderCurrentView();

    this.refreshActiveLead();
  }

  applyLocalLead(rawLead) {
    const lead = this.normalizeLead(rawLead);

    if (!lead || !lead.id) return;

    const index =
      this.leads.findIndex(item => item.id === lead.id);

    if (index === -1) {
      this.leads.push(lead);
    } else {
      this.leads[index] = lead;
    }

    this.updateLeadCount();
    this.updateNicheFilterOptions();
    this.rerenderCurrentView();
    this.refreshActiveLead();
  }

  applyLocalActivity(rawActivity) {
    const activity =
      this.normalizeActivity(rawActivity);

    if (!activity || !activity.id) return;

    const index =
      this.activities.findIndex(
        item => item.id === activity.id
      );

    if (index === -1) {
      this.activities.push(activity);
    } else {
      this.activities[index] = activity;
    }

    this.rerenderCurrentView();
    this.refreshActiveLead();
  }

  refreshActiveLead() {
    if (!this.activeLead) return;

    const freshLead =
      this.leads.find(
        lead => lead.id === this.activeLead.id
      );

    if (!freshLead) return;

    this.activeLead = freshLead;
    this.renderLeadDrawerContent();
  }

  updateLeadCount() {
    const countEl =
      document.getElementById('nav-leads-count');

    if (countEl) {
      countEl.textContent = this.leads.length;
    }
  }

  /* ========================================================================== */
  /* VIEW NAVIGATION                                                             */
  /* ========================================================================== */

  switchView(viewName) {
    this.currentView = viewName;

    localStorage.setItem(
      CONFIG.STORAGE_KEYS.ACTIVE_VIEW,
      viewName
    );

    ['dashboard', 'leads', 'followups'].forEach(view => {
      const element =
        document.getElementById(`view-${view}`);

      if (element) {
        element.classList.add('hidden');
      }
    });

    const target =
      document.getElementById(`view-${viewName}`);

    if (target) {
      target.classList.remove('hidden');
    }

    ['dashboard', 'leads', 'followups'].forEach(navKey => {
      const button =
        document.getElementById(`nav-${navKey}`);

      if (!button) return;

      const icon = button.querySelector('svg');

      if (navKey === viewName) {
        button.classList.add(
          'bg-brand-50',
          'text-brand-700',
          'font-semibold'
        );

        button.classList.remove(
          'text-neutral-700',
          'hover:bg-neutral-100'
        );

        if (icon) {
          icon.classList.replace(
            'text-neutral-500',
            'text-brand-600'
          );
        }
      } else {
        button.classList.remove(
          'bg-brand-50',
          'text-brand-700',
          'font-semibold'
        );

        button.classList.add(
          'text-neutral-700',
          'hover:bg-neutral-100'
        );

        if (icon) {
          icon.classList.replace(
            'text-brand-600',
            'text-neutral-500'
          );
        }
      }
    });

    this.rerenderCurrentView();
  }

  rerenderCurrentView() {
    if (this.currentView === 'dashboard') {
      this.renderDashboard();
    }

    if (this.currentView === 'leads') {
      this.renderLeadsTable();
    }

    if (this.currentView === 'followups') {
      this.renderFollowups();
    }
  }

  /* ========================================================================== */
  /* GOOGLE SHEETS REFRESH                                                      */
  /* ========================================================================== */

  async refreshFromSheets() {
    try {
      this.showToast(
        'Refreshing from Google Sheets...',
        'info'
      );

      const result =
        await dbService.refreshFromSheets();

      this.setDataset(
        result.leads || [],
        result.activities || []
      );

      this.updateSheetsStatus({
        status: 'ready',
        ready: true
      });

      this.showToast(
        'CRM refreshed successfully',
        'success'
      );
    } catch (error) {
      console.error(
        'Error refreshing Google Sheets:',
        error
      );

      this.updateSheetsStatus({
        status: 'error',
        ready: false
      });

      this.showToast(
        error.message ||
        'Google Sheets is unavailable',
        'error'
      );
    }
  }

  updateSheetsStatus(health) {
    this.sheetsHealth =
      health || {
        status: 'starting',
        ready: false
      };

    const label =
      document.getElementById(
        'sheets-status-label'
      );

    const dot =
      document.getElementById(
        'sheets-status-dot'
      );

    let labelText = 'Connecting...';
    let dotClass = 'bg-amber-400';

    if (this.sheetsHealth.status === 'ready') {
      labelText = 'Connected';
      dotClass = 'bg-emerald-500';
    }

    if (this.sheetsHealth.status === 'error') {
      labelText = 'Connection Error';
      dotClass = 'bg-red-500';
    }

    if (label) {
      label.textContent = labelText;
    }

    if (dot) {
      dot.className =
        `w-2 h-2 rounded-full ${dotClass}`;
    }
  }

  /* ========================================================================== */
  /* DATE HELPERS                                                               */
  /* ========================================================================== */

  getTodayRange() {
    const now = new Date();

    const start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime();

    const end =
      start +
      24 * 60 * 60 * 1000 -
      1;

    return {
      start,
      end
    };
  }

  /* ========================================================================== */
  /* DASHBOARD                                                                  */
  /* ========================================================================== */

  renderDashboard() {
    if (this.isInitialDataLoading) {
      const metricIds = [
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

      metricIds.forEach(id => {
        this.setElemText(id, '—');
      });

      return;
    }

    const {
      start: todayStart,
      end: todayEnd
    } = this.getTodayRange();

    let notContacted = 0;
    let dmSent = 0;
    let replied = 0;
    let callsBooked = 0;
    let won = 0;

    const overdue = [];
    const dueToday = [];

    this.leads.forEach(lead => {
      const status =
        (lead.status || '').toUpperCase();

      if (status === 'NEW_LEAD') {
        notContacted++;
      }

      if (status === 'DM_SENT') {
        dmSent++;
      }

      if (status === 'REPLIED') {
        replied++;
      }

      if (status === 'CALL_BOOKED') {
        callsBooked++;
      }

      if (status === 'WON') {
        won++;
      }

      if (lead.next_follow_up_at) {
        const time =
          new Date(
            lead.next_follow_up_at
          ).getTime();

        if (isNaN(time)) return;

        if (time < todayStart) {
          overdue.push(lead);
        } else if (
          time >= todayStart &&
          time <= todayEnd
        ) {
          dueToday.push(lead);
        }
      }
    });

    const reachedToday =
      this.activities.filter(activity => {
        if (!activity.date) return false;

        const time =
          new Date(activity.date).getTime();

        return (
          !isNaN(time) &&
          time >= todayStart &&
          time <= todayEnd
        );
      });

    const reachedTodayLeadIds =
      new Set(
        reachedToday.map(
          activity => activity.lead_id
        )
      );

    const reachedTodayCount =
      reachedTodayLeadIds.size;

    this.setElemText(
      'metric-total-leads',
      this.leads.length
    );

    this.setElemText(
      'metric-reached-today',
      reachedTodayCount
    );

    this.setElemText(
      'metric-total-touchpoints',
      this.activities.length
    );

    this.setElemText(
      'metric-not-contacted',
      notContacted
    );

    this.setElemText(
      'metric-dm-sent',
      dmSent
    );

    this.setElemText(
      'metric-replied',
      replied
    );

    this.setElemText(
      'metric-overdue',
      overdue.length
    );

    this.setElemText(
      'metric-due-today',
      dueToday.length
    );

    this.setElemText(
      'metric-calls-booked',
      callsBooked
    );

    this.setElemText(
      'metric-won',
      won
    );

    this.renderDailyProgress(
      reachedTodayCount
    );

    this.renderActivityTrend();

    this.renderDashboardQueue(
      overdue,
      dueToday
    );

    this.renderRecentActivity();

    this.renderReplyRate();

    const overdueBadge =
      document.getElementById(
        'nav-overdue-count'
      );

    if (overdueBadge) {
      if (overdue.length) {
        overdueBadge.textContent =
          overdue.length;

        overdueBadge.classList.remove(
          'hidden'
        );
      } else {
        overdueBadge.classList.add(
          'hidden'
        );
      }
    }
  }

  renderDailyProgress(count) {
    const target =
      CONFIG.DAILY_OUTREACH_TARGET || 20;

    const percentage =
      Math.min(
        100,
        Math.round(
          (count / target) * 100
        )
      );

    const bar =
      document.getElementById(
        'daily-progress-bar-fill'
      );

    const label =
      document.getElementById(
        'daily-progress-label'
      );

    if (bar) {
      bar.style.width =
        `${percentage}%`;

      bar.classList.toggle(
        'bg-emerald-500',
        count >= target
      );

      bar.classList.toggle(
        'bg-brand-600',
        count < target
      );
    }

    if (label) {
      label.textContent =
        `${count} / ${target} reached today`;
    }
  }

  renderReplyRate() {
    const element =
      document.getElementById(
        'metric-reply-rate'
      );

    if (!element) return;

    const contacted =
      this.leads.filter(lead => {
        const status =
          (lead.status || '').toUpperCase();

        return ![
          'NEW_LEAD',
          'NEW',
          'RESEARCHING',
          'READY TO CONTACT'
        ].includes(status);
      }).length;

    const replied =
      this.leads.filter(
        lead =>
          (lead.status || '').toUpperCase() ===
          'REPLIED'
      ).length;

    const rate =
      contacted > 0
        ? Math.round(
            (replied / contacted) * 100
          )
        : 0;

    element.textContent =
      `${rate}%`;
  }

  renderDashboardQueue(overdue, dueToday) {
    const container =
      document.getElementById(
        'dashboard-urgent-followups'
      );

    if (!container) return;

    const untouched =
      this.leads.filter(lead => {
        const status =
          (lead.status || '').toUpperCase();

        return [
          'NEW_LEAD',
          'NEW',
          'RESEARCHING',
          'READY TO CONTACT'
        ].includes(status);
      });

    const queue = [
      ...overdue.map(lead => ({
        lead,
        reason: 'overdue'
      })),

      ...dueToday.map(lead => ({
        lead,
        reason: 'today'
      })),

      ...untouched.slice(
        0,
        10
      ).map(lead => ({
        lead,
        reason: 'new'
      }))
    ].slice(0, 10);

    if (!queue.length) {
      container.innerHTML = `
        <div class="py-8 text-center">
          <p class="text-sm font-medium text-neutral-700">
            Nothing needs action right now.
          </p>
        </div>
      `;

      return;
    }

    container.innerHTML =
      queue.map(item => {
        const lead = item.lead;

        let badge = '';

        if (item.reason === 'overdue') {
          badge = `
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              Overdue
            </span>
          `;
        }

        if (item.reason === 'today') {
          badge = `
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Due today
            </span>
          `;
        }

        if (item.reason === 'new') {
          badge = `
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
              Not contacted
            </span>
          `;
        }

        return `
          <div
            onclick="app.openLeadDrawer('${this.escapeJsString(lead.id)}')"
            class="py-3 px-2 flex items-center justify-between hover:bg-neutral-50 rounded-lg cursor-pointer"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-neutral-900">
                  ${this.escapeHtml(lead.business_name)}
                </span>

                <span class="badge-status status-${this.slugify(lead.status)} text-[10px]">
                  ${this.escapeHtml(lead.status)}
                </span>
              </div>

              <div class="text-xs text-neutral-500 mt-1">
                ${this.escapeHtml(lead.location || '-')}
              </div>
            </div>

            ${badge}
          </div>
        `;
      }).join('');
  }

  renderRecentActivity() {
    const container =
      document.getElementById(
        'dashboard-recent-activity'
      );

    if (!container) return;

    const activities =
      [...this.activities]
        .sort(
          (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
        )
        .slice(0, 8);

    if (!activities.length) {
      container.innerHTML = `
        <div class="py-8 text-center text-xs text-neutral-400">
          No outreach activity recorded yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      activities.map(activity => {
        const lead =
          this.leads.find(
            item =>
              item.id ===
              activity.lead_id
          );

        return `
          <div
            ${lead
              ? `onclick="app.openLeadDrawer('${this.escapeJsString(lead.id)}')"`
              : ''}
            class="py-2.5 px-2 hover:bg-neutral-50 rounded-lg cursor-pointer"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold text-neutral-900">
                ${this.escapeHtml(
                  lead?.business_name || 'Lead'
                )}
              </span>

              <span class="text-[11px] text-neutral-400">
                ${this.formatDateTime(activity.date)}
              </span>
            </div>

            <p class="text-xs font-medium text-neutral-700">
              ${this.escapeHtml(activity.type)}
            </p>

            <p class="text-xs text-neutral-500 truncate mt-0.5">
              ${this.escapeHtml(activity.message)}
            </p>
          </div>
        `;
      }).join('');
  }

  renderActivityTrend() {
    const container =
      document.getElementById(
        'dashboard-activity-trend'
      );

    if (!container) return;

    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();

      date.setDate(
        date.getDate() - i
      );

      const start =
        new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).getTime();

      const end =
        start +
        24 * 60 * 60 * 1000 -
        1;

      days.push({
        start,
        end,
        label:
          date.toLocaleDateString(
            undefined,
            { weekday: 'short' }
          ),
        count: 0
      });
    }

    this.activities.forEach(activity => {
      const time =
        new Date(
          activity.date
        ).getTime();

      if (isNaN(time)) return;

      const day =
        days.find(
          item =>
            time >= item.start &&
            time <= item.end
        );

      if (day) {
        day.count++;
      }
    });

    const max =
      Math.max(
        1,
        ...days.map(day => day.count)
      );

    container.innerHTML = `
      <div class="flex items-end justify-between gap-2 h-24 px-1">
        ${days.map((day, index) => {
          const height =
            Math.max(
              6,
              Math.round(
                (day.count / max) * 100
              )
            );

          const today =
            index === days.length - 1;

          return `
            <div
              class="flex-1 flex flex-col items-center justify-end h-full gap-1.5"
              title="${day.count} touchpoints"
            >
              <span class="text-[10px] font-semibold text-neutral-500">
                ${day.count}
              </span>

              <div
                class="w-full rounded-t-md ${
                  today
                    ? 'bg-brand-600'
                    : 'bg-brand-200'
                }"
                style="height:${height}%"
              ></div>

              <span class="text-[10px] font-medium ${
                today
                  ? 'text-brand-700'
                  : 'text-neutral-400'
              }">
                ${day.label}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ========================================================================== */
  /* LEADS                                                                      */
  /* ========================================================================== */

  handleSearchChange(query) {
    this.searchQuery =
      (query || '')
        .trim()
        .toLowerCase();

    this.renderLeadsTable();
  }

  handleFilterChange() {
    this.filters.status =
      document.getElementById(
        'filter-status'
      )?.value || '';

    this.filters.niche =
      document.getElementById(
        'filter-niche'
      )?.value || '';

    this.filters.followup =
      document.getElementById(
        'filter-followup'
      )?.value || '';

    this.renderLeadsTable();
  }

  clearFilters() {
    this.searchQuery = '';

    const search =
      document.getElementById(
        'leads-search'
      );

    if (search) {
      search.value = '';
    }

    [
      'filter-status',
      'filter-niche',
      'filter-followup'
    ].forEach(id => {
      const element =
        document.getElementById(id);

      if (element) {
        element.value = '';
      }
    });

    this.filters = {
      status: '',
      niche: '',
      followup: ''
    };

    this.renderLeadsTable();
  }

  updateNicheFilterOptions() {
    const select =
      document.getElementById(
        'filter-niche'
      );

    if (!select) return;

    const current =
      select.value;

    const niches =
      [...new Set(
        this.leads
          .map(
            lead =>
              (lead.niche || '').trim()
          )
          .filter(Boolean)
      )].sort();

    select.innerHTML =
      '<option value="">All Niches</option>';

    niches.forEach(niche => {
      const option =
        document.createElement('option');

      option.value = niche;
      option.textContent = niche;

      if (niche === current) {
        option.selected = true;
      }

      select.appendChild(option);
    });
  }

  getFilteredLeads() {
    const {
      start: todayStart,
      end: todayEnd
    } = this.getTodayRange();

    return this.leads.filter(lead => {
      if (this.searchQuery) {
        const haystack = [
          lead.business_name,
          lead.niche,
          lead.location,
          lead.instagram_url,
          lead.website
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (
          !haystack.includes(
            this.searchQuery
          )
        ) {
          return false;
        }
      }

      if (
        this.filters.status &&
        lead.status !==
          this.filters.status
      ) {
        return false;
      }

      if (
        this.filters.niche &&
        lead.niche !==
          this.filters.niche
      ) {
        return false;
      }

      if (this.filters.followup) {
        const followup =
          lead.next_follow_up_at
            ? new Date(
                lead.next_follow_up_at
              ).getTime()
            : null;

        if (
          this.filters.followup ===
            'none' &&
          followup
        ) {
          return false;
        }

        if (
          this.filters.followup !==
            'none' &&
          !followup
        ) {
          return false;
        }

        if (
          this.filters.followup ===
            'overdue' &&
          followup >= todayStart
        ) {
          return false;
        }

        if (
          this.filters.followup ===
            'today' &&
          (
            followup < todayStart ||
            followup > todayEnd
          )
        ) {
          return false;
        }

        if (
          this.filters.followup ===
            'upcoming' &&
          followup <= todayEnd
        ) {
          return false;
        }
      }

      return true;
    });
  }

  renderLeadsTable() {
    const body =
      document.getElementById(
        'leads-table-body'
      );

    const summary =
      document.getElementById(
        'leads-table-summary'
      );

    if (!body) return;

    const leads =
      this.getFilteredLeads();

    if (summary) {
      summary.textContent =
        `Showing ${leads.length} of ${this.leads.length} leads`;
    }

    if (!leads.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-16">
            <h4 class="text-base font-bold text-neutral-900">
              ${
                this.leads.length
                  ? 'No leads match your filters'
                  : 'Your lead list is empty'
              }
            </h4>

            <p class="text-xs text-neutral-500 mt-1">
              ${
                this.leads.length
                  ? 'Try clearing your filters.'
                  : 'Add leads directly to Google Sheets, then refresh the CRM.'
              }
            </p>

            ${
              this.leads.length
                ? `
                  <button
                    onclick="app.clearFilters()"
                    class="mt-3 px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium"
                  >
                    Reset filters
                  </button>
                `
                : ''
            }
          </td>
        </tr>
      `;

      return;
    }

    const {
      start: todayStart,
      end: todayEnd
    } = this.getTodayRange();

    body.innerHTML =
      leads.map(lead => {
        let followupBadge =
          '<span class="text-neutral-400 text-xs">-</span>';

        if (lead.next_follow_up_at) {
          const time =
            new Date(
              lead.next_follow_up_at
            ).getTime();

          const formatted =
            this.formatDateTime(
              lead.next_follow_up_at
            );

          if (time < todayStart) {
            followupBadge = `
              <span class="badge-status followup-overdue">
                Overdue: ${formatted}
              </span>
            `;
          } else if (
            time >= todayStart &&
            time <= todayEnd
          ) {
            followupBadge = `
              <span class="badge-status followup-today">
                Today: ${formatted}
              </span>
            `;
          } else {
            followupBadge = `
              <span class="badge-status followup-upcoming">
                ${formatted}
              </span>
            `;
          }
        }

        const igUrl =
          this.getInstagramUrl(
            lead.instagram_url
          );

        const actions = `
          <div class="flex items-center gap-2">
            ${
              igUrl
                ? `
                  <a
                    href="${this.sanitizeExternalUrl(igUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick="event.stopPropagation()"
                    class="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[11px] font-bold"
                  >
                    Open IG
                  </a>
                `
                : ''
            }

            <button
              onclick="event.stopPropagation(); app.openLeadDrawer('${this.escapeJsString(lead.id)}')"
              class="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded text-[11px] font-bold"
            >
              Open Lead
            </button>
          </div>
        `;

        return `
          <tr
            onclick="app.openLeadDrawer('${this.escapeJsString(lead.id)}')"
            class="table-row-hover"
          >
            <td class="px-5 py-3.5">
              <div class="font-semibold text-neutral-900">
                ${this.escapeHtml(lead.business_name)}
              </div>
            </td>

            <td class="px-4 py-3.5 text-xs text-neutral-700">
              ${this.escapeHtml(lead.location || '-')}
            </td>

            <td class="px-4 py-3.5 text-xs">
              <span class="inline-block px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                ${this.escapeHtml(lead.niche || '-')}
              </span>
            </td>

            <td class="px-4 py-3.5">
              ${actions}
            </td>

            <td class="px-4 py-3.5">
              <span class="badge-status status-${this.slugify(lead.status)}">
                ${this.escapeHtml(lead.status)}
              </span>
            </td>

            <td class="px-4 py-3.5">
              ${followupBadge}
            </td>

            <td class="px-4 py-3.5 text-xs">
              ${
                lead.dm_sent_date_time
                  ? this.formatDate(
                      lead.dm_sent_date_time
                    )
                  : 'Never'
              }
            </td>
          </tr>
        `;
      }).join('');
  }

  /* ========================================================================== */
  /* LEAD DRAWER                                                                */
  /* ========================================================================== */

  openLeadDrawer(leadId) {
    const lead =
      this.leads.find(
        item => item.id === leadId
      );

    if (!lead) return;

    this.activeLead = lead;

    this.renderLeadDrawerContent();

    const drawer =
      document.getElementById(
        'lead-drawer'
      );

    const backdrop =
      document.getElementById(
        'drawer-backdrop'
      );

    const panel =
      document.getElementById(
        'drawer-panel'
      );

    if (
      drawer &&
      backdrop &&
      panel
    ) {
      drawer.classList.remove(
        'hidden'
      );

      requestAnimationFrame(() => {
        backdrop.classList.remove(
          'opacity-0'
        );

        panel.classList.remove(
          'translate-x-full'
        );
      });
    }
  }

  closeLeadDrawer() {
    const drawer =
      document.getElementById(
        'lead-drawer'
      );

    const backdrop =
      document.getElementById(
        'drawer-backdrop'
      );

    const panel =
      document.getElementById(
        'drawer-panel'
      );

    if (
      drawer &&
      backdrop &&
      panel
    ) {
      backdrop.classList.add(
        'opacity-0'
      );

      panel.classList.add(
        'translate-x-full'
      );

      setTimeout(() => {
        drawer.classList.add(
          'hidden'
        );

        this.activeLead = null;
      }, 200);
    }
  }

  renderLeadDrawerContent() {
    const lead =
      this.activeLead;

    if (!lead) return;

    this.setElemText(
      'drawer-business-name',
      lead.business_name
    );

    this.setElemText(
      'drawer-lead-id',
      lead.id
    );

    this.setElemText(
      'drawer-location',
      lead.location || '-'
    );

    this.setElemText(
      'drawer-niche',
      lead.niche || '-'
    );

    this.setElemText(
      'drawer-lead-source',
      'Google Sheets'
    );

    this.setElemText(
      'drawer-notes',
      lead.notes || 'No notes recorded.'
    );

    this.setElemText(
      'drawer-instagram-handle',
      lead.instagram_url || 'Not set'
    );

    const statusBadge =
      document.getElementById(
        'drawer-status-badge'
      );

    if (statusBadge) {
      statusBadge.className =
        `badge-status status-${this.slugify(lead.status)}`;

      statusBadge.textContent =
        lead.status;
    }

    const nextFollowup =
      document.getElementById(
        'drawer-next-followup'
      );

    if (nextFollowup) {
      nextFollowup.textContent =
        lead.next_follow_up_at
          ? this.formatDateTime(
              lead.next_follow_up_at
            )
          : 'None scheduled';
    }

    const lastContacted =
      document.getElementById(
        'drawer-last-contacted'
      );

    if (lastContacted) {
      lastContacted.textContent =
        lead.dm_sent_date_time
          ? this.formatDateTime(
              lead.dm_sent_date_time
            )
          : 'Never contacted';
    }

    this.renderQuickActions();
    this.renderLeadLinks();
    this.renderLeadActivities();
  }

  renderQuickActions() {
    const container =
      document.getElementById(
        'drawer-quick-actions'
      );

    if (!container || !this.activeLead) {
      return;
    }

    const lead =
      this.activeLead;

    const status =
      (lead.status || '').toUpperCase();

    let optionsHtml = '';
    window.CONFIG.STATUSES.forEach(s => {
      const selected = s === status ? 'selected' : '';
      optionsHtml += `<option value="${s}" ${selected}>${s}</option>`;
    });

    container.innerHTML = `
      <div class="flex items-center gap-2">
        <label class="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Change Status:</label>
        <select 
          onchange="app.changeLeadStatus('${this.escapeJsString(lead.id)}', this.value)"
          class="text-xs bg-white border border-neutral-300 rounded-md px-2.5 py-1.5 text-neutral-700 focus:outline-none focus:ring-1 focus:ring-brand-500 font-semibold"
        >
          ${optionsHtml}
        </select>
      </div>
    `;
  }

  async changeLeadStatus(leadId, newStatus) {
    const lead = this.leads.find(item => item.id === leadId);
    if (!lead) return;

    try {
      const updatedLead = await dbService.updateLead(
        lead.id,
        {
          status: newStatus,
          dm_sent_date_time: newStatus === 'DM_SENT' ? this.getNowLocalIso() : lead.dm_sent_date_time
        },
        this.leads
      );

      this.applyLocalLead(updatedLead);
      this.showToast(`Status updated to ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      this.showToast(error.message || 'Could not update status', 'error');
    }
  }

  renderLeadLinks() {
    const lead =
      this.activeLead;

    if (!lead) return;

    const igUrl =
      this.getInstagramUrl(
        lead.instagram_url
      );

    const igButton =
      document.getElementById(
        'btn-drawer-open-ig'
      );

    if (igButton) {
      if (igUrl) {
        igButton.href =
          this.sanitizeExternalUrl(
            igUrl
          );

        igButton.classList.remove(
          'pointer-events-none',
          'opacity-50'
        );
      } else {
        igButton.removeAttribute(
          'href'
        );

        igButton.classList.add(
          'pointer-events-none',
          'opacity-50'
        );
      }
    }

    this.setupDrawerLink(
      'drawer-website-link',
      this.sanitizeExternalUrl(
        lead.website
      ),
      lead.website
    );

    this.setupDrawerLink(
      'drawer-instagram-link',
      igUrl
        ? this.sanitizeExternalUrl(
            igUrl
          )
        : null,
      lead.instagram_url
    );
  }

  renderLeadActivities() {
    const lead =
      this.activeLead;

    const container =
      document.getElementById(
        'drawer-activities-list'
      );

    if (!lead || !container) {
      return;
    }

    const activities =
      this.activities
        .filter(
          activity =>
            activity.lead_id ===
            lead.id
        )
        .sort(
          (a, b) =>
            new Date(b.date || 0) -
            new Date(a.date || 0)
        );

    if (!activities.length) {
      container.innerHTML = `
        <div class="p-4 bg-neutral-50 rounded-lg text-center text-xs text-neutral-400">
          No outreach touchpoints logged yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      activities.map(activity => `
        <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-bold text-neutral-900">
              ${this.escapeHtml(activity.type)}
            </span>

            <span class="text-[11px] text-neutral-400">
              ${this.formatDateTime(activity.date)}
            </span>
          </div>

          ${
            activity.outcome
              ? `
                <div class="text-[11px] text-neutral-500">
                  Outcome:
                  <span class="font-medium">
                    ${this.escapeHtml(activity.outcome)}
                  </span>
                </div>
              `
              : ''
          }

          <p class="text-neutral-800 font-medium">
            ${this.escapeHtml(activity.message)}
          </p>

          ${
            activity.notes
              ? `
                <p class="text-neutral-600 bg-white p-2 rounded border border-neutral-100 whitespace-pre-wrap">
                  ${this.escapeHtml(activity.notes)}
                </p>
              `
              : ''
          }
        </div>
      `).join('');
  }

  setupDrawerLink(
    elementId,
    url,
    label
  ) {
    const element =
      document.getElementById(
        elementId
      );

    if (!element) return;

    if (url && label) {
      element.href = url;
      element.textContent = label;

      element.classList.remove(
        'pointer-events-none',
        'text-neutral-400'
      );

      element.classList.add(
        'text-brand-600',
        'hover:underline'
      );

      return;
    }

    element.removeAttribute(
      'href'
    );

    element.textContent = '-';

    element.classList.add(
      'pointer-events-none',
      'text-neutral-400'
    );

    element.classList.remove(
      'text-brand-600',
      'hover:underline'
    );
  }

  /* ========================================================================== */
  /* FOLLOW-UPS                                                                 */
  /* ========================================================================== */

  renderFollowups() {
    const {
      start: todayStart,
      end: todayEnd
    } = this.getTodayRange();

    const overdue = [];
    const today = [];
    const upcoming = [];
    const none = [];

    this.leads.forEach(lead => {
      if (!lead.next_follow_up_at) {
        none.push(lead);
        return;
      }

      const time =
        new Date(
          lead.next_follow_up_at
        ).getTime();

      if (isNaN(time)) {
        none.push(lead);
        return;
      }

      if (time < todayStart) {
        overdue.push(lead);
      } else if (
        time >= todayStart &&
        time <= todayEnd
      ) {
        today.push(lead);
      } else {
        upcoming.push(lead);
      }
    });

    const sortByFollowup =
      (a, b) =>
        new Date(
          a.next_follow_up_at
        ) -
        new Date(
          b.next_follow_up_at
        );

    overdue.sort(sortByFollowup);
    today.sort(sortByFollowup);
    upcoming.sort(sortByFollowup);

    this.setElemText(
      'badge-overdue-count',
      overdue.length
    );

    this.setElemText(
      'badge-today-count',
      today.length
    );

    this.setElemText(
      'badge-upcoming-count',
      upcoming.length
    );

    this.setElemText(
      'badge-none-count',
      none.length
    );

    this.renderFollowupGroup(
      'followups-list-overdue',
      overdue,
      'No overdue follow-ups.'
    );

    this.renderFollowupGroup(
      'followups-list-today',
      today,
      'No follow-ups scheduled for today.'
    );

    this.renderFollowupGroup(
      'followups-list-upcoming',
      upcoming,
      'No upcoming follow-ups scheduled.'
    );

    this.renderFollowupGroup(
      'followups-list-none',
      none,
      'All leads have follow-ups scheduled!'
    );
  }

  renderFollowupGroup(
    containerId,
    leads,
    emptyMessage
  ) {
    const container =
      document.getElementById(
        containerId
      );

    if (!container) return;

    if (!leads.length) {
      container.innerHTML = `
        <div class="p-4 text-center text-xs text-neutral-400">
          ${emptyMessage}
        </div>
      `;

      return;
    }

    container.innerHTML =
      leads.map(lead => {
        const igUrl =
          this.getInstagramUrl(
            lead.instagram_url
          );

        const status =
          (lead.status || '')
            .toUpperCase();

        const closed = [
          'REPLIED',
          'CALL_BOOKED',
          'CALL COMPLETED',
          'PROPOSAL SENT',
          'WON',
          'LOST'
        ];

        return `
          <div class="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 rounded-lg">

            <div
              class="cursor-pointer flex-1"
              onclick="app.openLeadDrawer('${this.escapeJsString(lead.id)}')"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-neutral-900">
                  ${this.escapeHtml(lead.business_name)}
                </span>

                <span class="badge-status status-${this.slugify(lead.status)} text-[10px]">
                  ${this.escapeHtml(lead.status)}
                </span>
              </div>

              <div class="text-xs text-neutral-500 mt-1">
                Next:
                ${this.formatDateTime(lead.next_follow_up_at)}
              </div>
            </div>

            <div class="flex items-center gap-2">

              ${
                igUrl
                  ? `
                    <a
                      href="${this.sanitizeExternalUrl(igUrl)}"
                      target="_blank"
                      rel="noopener noreferrer"
                      onclick="event.stopPropagation()"
                      class="px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md text-xs font-semibold"
                    >
                      Open IG
                    </a>
                  `
                  : ''
              }

              ${
                !closed.includes(status)
                  ? `
                    <button
                      onclick="event.stopPropagation(); app.markFollowedUp('${this.escapeJsString(lead.id)}')"
                      class="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-semibold"
                    >
                      Mark Followed Up
                    </button>
                  `
                  : ''
              }

              <button
                onclick="app.quickSetFollowup('${this.escapeJsString(lead.id)}', event)"
                class="px-2.5 py-1.5 border border-neutral-300 hover:bg-white text-neutral-700 text-xs font-medium rounded-md"
              >
                Reschedule
              </button>

            </div>
          </div>
        `;
      }).join('');
  }

  quickSetFollowup(
    leadId,
    event
  ) {
    if (event) {
      event.stopPropagation();
    }

    const lead =
      this.leads.find(
        item => item.id === leadId
      );

    if (!lead) return;

    this.activeLead = lead;
    this.openSetFollowupModal();
  }

  /* ========================================================================== */
  /* ACTIVITY MODAL                                                             */
  /* ========================================================================== */

  openAddActivityModal(
    defaultType = 'Initial DM'
  ) {
    if (!this.activeLead) return;

    const modal =
      document.getElementById(
        'modal-add-activity'
      );

    if (!modal) return;

    const summary =
      document.getElementById(
        'act-summary'
      );

    const outcome =
      document.getElementById(
        'act-outcome'
      );

    const notes =
      document.getElementById(
        'act-notes'
      );

    const datetime =
      document.getElementById(
        'act-datetime'
      );

    const type =
      document.getElementById(
        'act-type'
      );
    if (summary) {
      summary.value =
        defaultType === 'Initial DM'
          ? 'Sent initial Instagram DM'
          : '';
    }

    if (outcome) {
      outcome.value =
        defaultType === 'Initial DM'
          ? 'DM_SENT'
          : '';
    }

    if (notes) {
      notes.value = '';
    }

    if (datetime) {
      datetime.value =
        this.getNowLocalIso();
    }

    if (type) {
      type.value = defaultType;
    }
    modal.showModal();
  }

  async submitAddActivity(event) {
    event.preventDefault();

    if (!this.activeLead) return;

    const modal =
      document.getElementById(
        'modal-add-activity'
      );

    const button =
      document.getElementById(
        'btn-submit-add-activity'
      );

    const activity = {
      lead_id:
        this.activeLead.id,

      type:
        document.getElementById(
          'act-type'
        )?.value || 'Initial DM',

      date:
        document.getElementById(
          'act-datetime'
        )?.value ||
        this.getNowLocalIso(),

      message:
        document.getElementById(
          'act-summary'
        )?.value || '',

      outcome:
        document.getElementById(
          'act-outcome'
        )?.value || '',

      notes:
        document.getElementById(
          'act-notes'
        )?.value || ''
    };

    try {
      if (button) {
        button.disabled = true;
        button.textContent =
          'Logging...';
      }

      const result =
        await dbService.addActivity(
          activity,
          this.activeLead
        );

      if (result?.activity) {
        this.applyLocalActivity(
          result.activity
        );
      }

      if (result?.updatedLead) {
        this.applyLocalLead(
          result.updatedLead
        );
      }

      if (modal) {
        modal.close();
      }

      this.showToast(
        'Outreach activity logged',
        'success'
      );
    } catch (error) {
      console.error(
        'Error logging activity:',
        error
      );

      this.showToast(
        error.message ||
        'Could not log activity',
        'error'
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          'Log Activity';
      }
    }
  }

  /* ========================================================================== */
  /* MARK DM SENT                                                               */
  /* ========================================================================== */

  async markDmSent(leadId) {
    const lead =
      this.leads.find(
        item => item.id === leadId
      );

    if (!lead) return;

    try {
      const activity = {
        lead_id: lead.id,
        type: 'Initial DM',
        date: this.getNowLocalIso(),
        message:
          'Sent initial Instagram DM',
        outcome: 'DM_SENT',
        notes: ''
      };

      const result =
        await dbService.addActivity(
          activity,
          lead
        );

      if (result?.activity) {
        this.applyLocalActivity(
          result.activity
        );
      }

      let updatedLead =
        result?.updatedLead ||
        lead;

      if (
        ![
          'DM_SENT',
          'REPLIED',
          'CALL_BOOKED',
          'WON'
        ].includes(
          (updatedLead.status || '')
            .toUpperCase()
        )
      ) {
        updatedLead =
          await dbService.updateLead(
            lead.id,
            {
              status: 'DM_SENT',
              dm_sent_date_time:
                this.getNowLocalIso()
            },
            this.leads
          );

        this.applyLocalLead(
          updatedLead
        );
      }

      this.showToast(
        'Initial DM marked as sent',
        'success'
      );
    } catch (error) {
      console.error(
        'Error marking DM sent:',
        error
      );

      this.showToast(
        error.message ||
        'Could not mark DM sent',
        'error'
      );
    }
  }

  /* ========================================================================== */
  /* MARK FOLLOW-UP SENT                                                        */
  /* ========================================================================== */

  async markFollowedUp(leadId) {
    const lead =
      this.leads.find(
        item => item.id === leadId
      );

    if (!lead) return;

    try {
      const previousFollowups =
        this.activities.filter(
          activity =>
            activity.lead_id === leadId &&
            String(
              activity.type || ''
            )
              .toLowerCase()
              .startsWith(
                'follow-up'
              )
        );

      const number =
        Math.min(
          previousFollowups.length + 1,
          3
        );

      const activity = {
        lead_id: lead.id,

        type:
          `Follow-up #${number}`,

        date:
          this.getNowLocalIso(),

        message:
          'Sent Instagram follow-up',

        outcome:
          'Follow-up Sent',

        notes: ''
      };

      const result =
        await dbService.addActivity(
          activity,
          lead
        );

      if (result?.activity) {
        this.applyLocalActivity(
          result.activity
        );
      }

      const nextFollowup =
        this.getFutureLocalIso(3);

      const updatedLead =
        await dbService.updateLead(
          lead.id,
          {
            status: 'DM_SENT',
            next_followup:
              nextFollowup,
            follow_up_count:
              previousFollowups.length + 1,
            dm_sent_date_time:
              this.getNowLocalIso()
          },
          this.leads
        );

      this.applyLocalLead(
        updatedLead
      );

      this.showToast(
        'Follow-up logged. Next follow-up in 3 days.',
        'success'
      );
    } catch (error) {
      console.error(
        'Error marking follow-up:',
        error
      );

      this.showToast(
        error.message ||
        'Could not mark follow-up',
        'error'
      );
    }
  }

  /* ========================================================================== */
  /* FOLLOW-UP MODAL                                                            */
  /* ========================================================================== */

  openSetFollowupModal() {
    if (!this.activeLead) return;

    const modal =
      document.getElementById(
        'modal-set-followup'
      );

    if (!modal) return;

    const idInput =
      document.getElementById(
        'set-followup-lead-id'
      );

    const dateInput =
      document.getElementById(
        'set-followup-datetime'
      );

    if (idInput) {
      idInput.value =
        this.activeLead.id;
    }

    if (dateInput) {
      dateInput.value =
        this.activeLead
          .next_follow_up_at ||
        this.getFutureLocalIso(1);
    }

    modal.showModal();
  }

  setFollowupPreset(daysAhead) {
    const input =
      document.getElementById(
        'set-followup-datetime'
      );

    if (input) {
      input.value =
        this.getFutureLocalIso(
          daysAhead
        );
    }
  }

  async submitSetFollowup(event) {
    event.preventDefault();

    if (!this.activeLead) return;

    const modal =
      document.getElementById(
        'modal-set-followup'
      );

    const value =
      document.getElementById(
        'set-followup-datetime'
      )?.value;

    if (!value) {
      this.showToast(
        'Select a follow-up date',
        'error'
      );

      return;
    }

    try {
      const updatedLead =
        await dbService.updateLead(
          this.activeLead.id,
          {
            next_followup: value
          },
          this.leads
        );

      this.applyLocalLead(
        updatedLead
      );

      if (modal) {
        modal.close();
      }

      this.showToast(
        'Follow-up scheduled',
        'success'
      );
    } catch (error) {
      console.error(
        'Error scheduling follow-up:',
        error
      );

      this.showToast(
        error.message ||
        'Could not schedule follow-up',
        'error'
      );
    }
  }

  async clearFollowup() {
    if (!this.activeLead) return;

    const modal =
      document.getElementById(
        'modal-set-followup'
      );

    try {
      const updatedLead =
        await dbService.updateLead(
          this.activeLead.id,
          {
            next_followup: ''
          },
          this.leads
        );

      this.applyLocalLead(
        updatedLead
      );

      if (modal) {
        modal.close();
      }

      this.showToast(
        'Follow-up cleared',
        'success'
      );
    } catch (error) {
      console.error(
        'Error clearing follow-up:',
        error
      );

      this.showToast(
        error.message ||
        'Could not clear follow-up',
        'error'
      );
    }
  }

  /* ========================================================================== */
  /* UTILITIES                                                                  */
  /* ========================================================================== */

  getInstagramUrl(value) {
    if (!value) return null;

    const raw =
      String(value).trim();

    if (!raw) return null;

    if (
      /^https?:\/\//i.test(raw)
    ) {
      return raw;
    }

    return `https://instagram.com/${raw.replace(/^@/, '')}`;
  }

  sanitizeExternalUrl(value) {
    if (
      !value ||
      typeof value !== 'string'
    ) {
      return null;
    }

    const raw =
      value.trim();

    if (!raw) return null;

    const candidate =
      /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;

    try {
      const url =
        new URL(candidate);

      if (
        url.protocol !== 'https:' &&
        url.protocol !== 'http:'
      ) {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  getNowLocalIso() {
    const date =
      new Date();

    date.setMinutes(
      date.getMinutes() -
      date.getTimezoneOffset()
    );

    return date
      .toISOString()
      .slice(0, 16);
  }

  getFutureLocalIso(
    daysAhead = 1
  ) {
    const date =
      new Date();

    date.setDate(
      date.getDate() +
      daysAhead
    );

    date.setHours(
      10,
      0,
      0,
      0
    );

    date.setMinutes(
      date.getMinutes() -
      date.getTimezoneOffset()
    );

    return date
      .toISOString()
      .slice(0, 16);
  }

  formatDateTime(value) {
    if (!value) return '-';

    const date =
      new Date(value);

    if (isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }
    );
  }

  formatDate(value) {
    if (!value) return '-';

    const date =
      new Date(value);

    if (isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    );
  }

  slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(
        /[^a-z0-9-_]/g,
        ''
      );
  }

  escapeJsString(value) {
    return String(value ?? '')
      .replace(
        /\\/g,
        '\\\\'
      )
      .replace(
        /'/g,
        "\\'"
      )
      .replace(
        /\r/g,
        '\\r'
      )
      .replace(
        /\n/g,
        '\\n'
      );
  }

  escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value)
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /'/g,
        '&#039;'
      );
  }

  setElemText(
    elementId,
    value
  ) {
    const element =
      document.getElementById(
        elementId
      );

    if (!element) return;

    element.textContent =
      value !== undefined &&
      value !== null
        ? value
        : '-';
  }

  showToast(
    message,
    type = 'info'
  ) {
    const container =
      document.getElementById(
        'toast-container'
      );

    if (!container) return;

    const toast =
      document.createElement(
        'div'
      );

    toast.className =
      `toast-item ${type}`;

    toast.innerHTML = `
      <span class="flex-1">
        ${this.escapeHtml(message)}
      </span>
    `;

    container.appendChild(
      toast
    );

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform =
        'translateY(8px)';
      toast.style.transition =
        'all 0.2s ease-out';

      setTimeout(
        () => toast.remove(),
        200
      );
    }, 4000);
  }
}

/* ============================================================================ */
/* GLOBAL INSTANCE                                                              */
/* ============================================================================ */

window.app = new App();

document.addEventListener(
  'DOMContentLoaded',
  () => {
    window.app.init();
  }
);
