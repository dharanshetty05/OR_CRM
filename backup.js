/**
 * ScaleWithLakshya Outreach CRM - Data Backup & Import/Export Module
 * Exports and restores complete CRM dataset via JSON and CSV files.
 */

class BackupService {
  /**
   * Export full database (leads & activities) to a JSON file.
   */
  async exportToJson() {
    const leads = await dbService.getAllLeads();
    const activities = await dbService.getAllActivities();

    const backupData = {
      app: 'ScaleWithLakshya CRM',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      leads_count: leads.length,
      activities_count: activities.length,
      leads,
      activities
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `swl_crm_backup_${dateStr}.json`;

    this.downloadFile(filename, jsonStr, 'application/json');
    return backupData;
  }

  /**
   * Import data from a JSON file.
   */
  async importFromJsonFile(file) {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON file format.');
    }

    const leads = Array.isArray(data.leads) ? data.leads : (Array.isArray(data) ? data : []);
    const activities = Array.isArray(data.activities) ? data.activities : [];

    if (leads.length === 0 && activities.length === 0) {
      throw new Error('No leads or activities found in the JSON file.');
    }

    const result = await dbService.bulkSave(leads, activities);
    return {
      leadsImported: result.leadsCount,
      activitiesImported: result.activitiesCount
    };
  }

  /**
   * Export active leads to CSV file for easy viewing in Excel/Google Sheets.
   */
  async exportToCsv() {
    const leads = await dbService.getAllLeads();
    const activeLeads = leads.filter(l => !l.archived_at);

    const headers = [
      'lead_id',
      'business_name',
      'contact_name',
      'niche',
      'location',
      'website',
      'instagram',
      'email',
      'phone',
      'status',
      'lead_tier',
      'lead_source',
      'notes',
      'next_follow_up_at',
      'last_contacted_at',
      'date_added'
    ];

    const rows = [headers.join(',')];

    activeLeads.forEach(lead => {
      const row = headers.map(col => {
        const val = lead[col] !== undefined && lead[col] !== null ? String(lead[col]) : '';
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const escaped = val.replace(/"/g, '""');
        if (/[",\n\r]/.test(escaped)) {
          return `"${escaped}"`;
        }
        return escaped;
      });
      rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `swl_crm_leads_${dateStr}.csv`;

    this.downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
    return { count: activeLeads.length };
  }

  /**
   * Import leads from a CSV file.
   */
  async importFromCsvFile(file) {
    const text = await file.text();
    const lines = this.parseCsvText(text);

    if (lines.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    const headers = lines[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const rows = lines.slice(1);

    const existingLeads = await dbService.getAllLeads();
    const importedLeads = [];
    let skippedCount = 0;

    rows.forEach(row => {
      if (row.length === 0 || (row.length === 1 && !row[0].trim())) return;

      const leadObj = {};
      headers.forEach((h, idx) => {
        leadObj[h] = row[idx] ? row[idx].trim() : '';
      });

      // Flexible column fallback mapping for legacy Google Sheets export or standard CSVs
      const businessName = leadObj.business_name || leadObj.business || leadObj.company || leadObj.name || '';
      if (!businessName) {
        skippedCount++;
        return;
      }

      const leadRecord = {
        business_name: businessName,
        contact_name: leadObj.contact_name || leadObj.contact || leadObj.person || '',
        niche: leadObj.niche || leadObj.category || leadObj.industry || 'General',
        location: leadObj.location || leadObj.city || leadObj.address || '',
        website: leadObj.website || leadObj.url || leadObj.domain || '',
        instagram: leadObj.instagram || leadObj.ig || leadObj.handle || '',
        email: leadObj.email || leadObj.mail || '',
        phone: leadObj.phone || leadObj.mobile || leadObj.tel || '',
        status: this.normalizeStatus(leadObj.status),
        lead_tier: leadObj.lead_tier || leadObj.tier || 'B',
        lead_source: leadObj.lead_source || leadObj.source || 'CSV Import',
        google_place_id: leadObj.google_place_id || leadObj.place_id || '',
        lead_score: leadObj.lead_score || '50',
        opportunity_score: leadObj.opportunity_score || '50',
        notes: leadObj.notes || leadObj.comment || '',
        next_follow_up_at: leadObj.next_follow_up_at || leadObj.followup || '',
        last_contacted_at: leadObj.last_contacted_at || leadObj.last_contacted || '',
        date_added: leadObj.date_added || leadObj.created_at || new Date().toISOString()
      };

      importedLeads.push(leadRecord);
    });

    if (importedLeads.length === 0) {
      throw new Error('No valid leads could be parsed from the CSV file.');
    }

    let savedCount = 0;
    for (const lead of importedLeads) {
      try {
        await dbService.createLead(lead, existingLeads);
        savedCount++;
      } catch (e) {
        // Skip duplicate or error row silently during bulk import
        skippedCount++;
      }
    }

    return { importedCount: savedCount, skippedCount };
  }

  /**
   * Status Normalizer for importing legacy statuses
   */
  normalizeStatus(rawStatus) {
    if (!rawStatus) return 'NOT CONTACTED';
    const clean = rawStatus.trim();
    if (['New', 'Researching', 'Ready to Contact', 'NOT CONTACTED'].includes(clean)) return 'NOT CONTACTED';
    if (['Contacted', 'Follow-up', 'DM SENT'].includes(clean)) return 'DM SENT';
    if (['Replied', 'REPLIED'].includes(clean)) return 'REPLIED';
    if (['Call Booked', 'Call Completed', 'Proposal Sent', 'CALL BOOKED'].includes(clean)) return 'CALL BOOKED';
    if (['Won', 'WON'].includes(clean)) return 'WON';
    if (['Lost', 'LOST'].includes(clean)) return 'LOST';
    return clean;
  }

  /**
   * Helper to parse CSV text into array of arrays, correctly handling quoted fields.
   */
  parseCsvText(text) {
    const lines = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell);
        currentCell = '';
        if (currentRow.length > 0 && !(currentRow.length === 1 && !currentRow[0])) {
          lines.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += char;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell);
      if (currentRow.length > 0 && !(currentRow.length === 1 && !currentRow[0])) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  /**
   * Trigger browser file download.
   */
  downloadFile(filename, content, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

if (typeof window !== 'undefined') {
  window.backupService = new BackupService();
}
