function getRepository_() {
  var spreadsheet = getConfiguredDatabaseSpreadsheet_();
  validateRepositorySchema_(spreadsheet);

  return {
    spreadsheet: spreadsheet,
    leadsSheet: getRequiredSheet_(spreadsheet, CRM_SHEETS.LEADS.name),
    activitySheet: getRequiredSheet_(spreadsheet, CRM_SHEETS.ACTIVITY.name),
    leadHeaderMap: getHeaderMap_(CRM_SHEETS.LEADS.headers),
    activityHeaderMap: getHeaderMap_(CRM_SHEETS.ACTIVITY.headers)
  };
}

function getConfiguredDatabaseSpreadsheet_() {
  var spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty(CRM_DATABASE_PROPERTY_KEY);

  if (!spreadsheetId) {
    throw appError_(
      'DATABASE_NOT_CONFIGURED',
      'The CRM database has not been initialized.'
    );
  }

  return openDatabaseSpreadsheet_(spreadsheetId);
}

function validateRepositorySchema_(spreadsheet) {
  var validation = validateDatabaseSchema_(spreadsheet);
  if (!validation.schemaValid) {
    throw appError_('SCHEMA_MISMATCH', validation.issues.join(' | '));
  }
}

function getRequiredSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw appError_('SCHEMA_MISMATCH', 'Missing required sheet: ' + sheetName);
  }

  return sheet;
}

function getHeaderMap_(headers) {
  var map = {};
  headers.forEach(function (header, index) {
    map[header] = index + 1;
  });
  return map;
}

function readLeadRows_(repository) {
  return readDataRows_(repository.leadsSheet, CRM_SHEETS.LEADS.headers.length);
}

function readActivityRows_(repository) {
  return readDataRows_(repository.activitySheet, CRM_SHEETS.ACTIVITY.headers.length);
}

function readDataRows_(sheet, columnCount) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, columnCount).getValues();
}

function findLeadRecordById_(repository, leadId) {
  var rows = readLeadRows_(repository);

  for (var index = 0; index < rows.length; index++) {
    if (String(rows[index][repository.leadHeaderMap.lead_id - 1]) === leadId) {
      return {
        rowNumber: index + 2,
        row: rows[index],
        lead: mapLeadRowToObject_(rows[index])
      };
    }
  }

  return null;
}

function appendLead_(repository, lead) {
  repository.leadsSheet
    .getRange(repository.leadsSheet.getLastRow() + 1, 1, 1, CRM_SHEETS.LEADS.headers.length)
    .setValues([mapLeadObjectToRow_(lead)]);
}

function updateLeadRow_(repository, rowNumber, lead) {
  repository.leadsSheet
    .getRange(rowNumber, 1, 1, CRM_SHEETS.LEADS.headers.length)
    .setValues([mapLeadObjectToRow_(lead)]);
}

function appendActivity_(repository, activity) {
  repository.activitySheet
    .getRange(repository.activitySheet.getLastRow() + 1, 1, 1, CRM_SHEETS.ACTIVITY.headers.length)
    .setValues([mapActivityObjectToRow_(activity)]);
}

function findDuplicateLead_(repository, candidate, ignoredLeadId) {
  var rows = readLeadRows_(repository);
  var candidateBusinessLocation = normalizeComparableText_(candidate.business_name) +
    '::' +
    normalizeComparableText_(candidate.location);

  for (var index = 0; index < rows.length; index++) {
    var lead = mapLeadRowToObject_(rows[index]);

    if (ignoredLeadId && lead.lead_id === ignoredLeadId) {
      continue;
    }

    if (isArchivedLead_(lead)) {
      continue;
    }

    if (candidate.google_place_id && lead.google_place_id === candidate.google_place_id) {
      return lead;
    }

    if (candidate.normalized_domain && lead.normalized_domain === candidate.normalized_domain) {
      return lead;
    }

    if (candidate.normalized_phone && lead.normalized_phone === candidate.normalized_phone) {
      return lead;
    }

    if (
      candidate.business_name &&
      candidate.location &&
      candidateBusinessLocation === (
        normalizeComparableText_(lead.business_name) +
        '::' +
        normalizeComparableText_(lead.location)
      )
    ) {
      return lead;
    }
  }

  return null;
}

function mapLeadRowToObject_(row) {
  var lead = {};
  CRM_SHEETS.LEADS.headers.forEach(function (header, index) {
    lead[header] = serializeSheetValue_(row[index]);
  });

  lead.record_version = toIntegerOrEmpty_(lead.record_version);
  lead.lead_score = toNumberOrEmpty_(lead.lead_score);
  lead.opportunity_score = toNumberOrEmpty_(lead.opportunity_score);
  return lead;
}

function mapLeadObjectToRow_(lead) {
  return CRM_SHEETS.LEADS.headers.map(function (header) {
    if (CRM_SHEETS.LEADS.dateColumns.indexOf(header) !== -1) {
      return toSheetDateValue_(lead[header]);
    }

    return lead[header] === null || typeof lead[header] === 'undefined' ? '' : lead[header];
  });
}

function mapActivityRowToObject_(row) {
  var activity = {};
  CRM_SHEETS.ACTIVITY.headers.forEach(function (header, index) {
    activity[header] = serializeSheetValue_(row[index]);
  });

  return activity;
}

function mapActivityObjectToRow_(activity) {
  return CRM_SHEETS.ACTIVITY.headers.map(function (header) {
    if (CRM_SHEETS.ACTIVITY.dateColumns.indexOf(header) !== -1) {
      return toSheetDateValue_(activity[header]);
    }

    return activity[header] === null || typeof activity[header] === 'undefined'
      ? ''
      : activity[header];
  });
}

function serializeSheetValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return value;
}

function toSheetDateValue_(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }

  return new Date(value);
}

function toIntegerOrEmpty_(value) {
  if (value === '') {
    return '';
  }

  return parseInt(value, 10);
}

function toNumberOrEmpty_(value) {
  if (value === '') {
    return '';
  }

  return Number(value);
}

function isArchivedLead_(lead) {
  return !!lead.archived_at;
}

function flushSpreadsheet_() {
  SpreadsheetApp.flush();
}
