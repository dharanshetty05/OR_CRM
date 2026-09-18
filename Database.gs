var CRM_DATABASE_PROPERTY_KEY = 'CRM_DATABASE_SPREADSHEET_ID';
var CRM_SCHEMA_VERSION = '1';

var CRM_SHEETS = {
  LEADS: {
    name: 'LEADS',
    headers: [
      'lead_id',
      'business_name',
      'contact_name',
      'niche',
      'location',
      'website',
      'instagram',
      'email',
      'phone',
      'lead_source',
      'google_place_id',
      'lead_tier',
      'lead_score',
      'opportunity_score',
      'status',
      'date_added',
      'last_contacted_at',
      'next_follow_up_at',
      'notes',
      'normalized_domain',
      'normalized_phone',
      'record_version',
      'updated_at',
      'archived_at'
    ],
    dateColumns: [
      'date_added',
      'last_contacted_at',
      'next_follow_up_at',
      'updated_at',
      'archived_at'
    ],
    numericColumns: [
      'lead_score',
      'opportunity_score',
      'record_version'
    ],
    wrapColumns: [
      'business_name',
      'contact_name',
      'website',
      'instagram',
      'email',
      'notes'
    ]
  },
  ACTIVITY: {
    name: 'ACTIVITY',
    headers: [
      'activity_id',
      'lead_id',
      'activity_at',
      'activity_type',
      'channel',
      'summary',
      'outcome',
      'notes'
    ],
    dateColumns: ['activity_at'],
    numericColumns: [],
    wrapColumns: ['summary', 'outcome', 'notes']
  },
  SETTINGS: {
    name: 'SETTINGS',
    headers: [
      'setting_group',
      'setting_key',
      'setting_value',
      'active',
      'sort_order',
      'description'
    ],
    dateColumns: [],
    numericColumns: ['sort_order'],
    wrapColumns: ['setting_value', 'description']
  }
};

var CRM_CONTROLLED_VALUES = {
  LEAD_STATUS: [
    'New',
    'Researching',
    'Ready to Contact',
    'Contacted',
    'Follow-up',
    'Replied',
    'Call Booked',
    'Call Completed',
    'Proposal Sent',
    'Won',
    'Lost'
  ],
  LEAD_TIER: ['A', 'B', 'C'],
  ACTIVITY_TYPE: [
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
  CHANNEL: [
    'Instagram',
    'Email',
    'Phone',
    'Website',
    'Other'
  ],
  LEAD_SOURCE: [
    'Manual',
    'Apify',
    'n8n',
    'Referral',
    'Instagram',
    'Google Maps',
    'Other'
  ]
};

function initializeDatabase() {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    var properties = PropertiesService.getScriptProperties();
    var spreadsheetId = properties.getProperty(CRM_DATABASE_PROPERTY_KEY);
    var spreadsheet;
    var created = false;

    if (spreadsheetId) {
      spreadsheet = openDatabaseSpreadsheet_(spreadsheetId);
    } else {
      spreadsheet = SpreadsheetApp.create(APP_NAME);
      spreadsheetId = spreadsheet.getId();
      created = true;
    }

    var setupResult = ensureDatabaseStructure_(spreadsheet);

    if (created) {
      properties.setProperty(CRM_DATABASE_PROPERTY_KEY, spreadsheetId);
    }

    return successResponse_({
      databaseConfigured: true,
      spreadsheetId: spreadsheetId,
      spreadsheetName: spreadsheet.getName(),
      created: created,
      sheets: setupResult.sheets,
      schemaVersion: CRM_SCHEMA_VERSION
    });
  } catch (error) {
    return errorResponse_(
      error.code || 'INITIALIZATION_FAILED',
      error.message || 'Database initialization failed.'
    );
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      // No action needed if the lock was never acquired.
    }
  }
}

function getDatabaseHealth() {
  try {
    var properties = PropertiesService.getScriptProperties();
    var spreadsheetId = properties.getProperty(CRM_DATABASE_PROPERTY_KEY);

    if (!spreadsheetId) {
      return successResponse_({
        databaseConfigured: false,
        spreadsheetIdPresent: false,
        requiredSheetsPresent: false,
        schemaValid: false,
        schemaVersion: null
      });
    }

    var spreadsheet = openDatabaseSpreadsheet_(spreadsheetId);
    var validation = validateDatabaseSchema_(spreadsheet);
    var schemaVersion = getSettingValue_(spreadsheet, 'METADATA', 'SCHEMA_VERSION');

    return successResponse_({
      databaseConfigured: true,
      spreadsheetIdPresent: true,
      requiredSheetsPresent: validation.requiredSheetsPresent,
      schemaValid: validation.schemaValid,
      schemaVersion: schemaVersion,
      spreadsheetId: spreadsheetId,
      spreadsheetName: spreadsheet.getName(),
      issues: validation.issues
    });
  } catch (error) {
    return errorResponse_(
      error.code || 'DATABASE_HEALTH_FAILED',
      error.message || 'Database health check failed.'
    );
  }
}

function getDatabaseSchema() {
  try {
    return successResponse_({
      schemaVersion: CRM_SCHEMA_VERSION,
      sheets: getSchemaDefinition_(),
      controlledValues: CRM_CONTROLLED_VALUES,
      metadata: {
        APP_NAME: APP_NAME,
        APP_VERSION: APP_VERSION,
        SCHEMA_VERSION: CRM_SCHEMA_VERSION
      }
    });
  } catch (error) {
    return errorResponse_(
      error.code || 'SCHEMA_RETRIEVAL_FAILED',
      error.message || 'Database schema retrieval failed.'
    );
  }
}

function ensureDatabaseStructure_(spreadsheet) {
  var createdSheets = [];
  var defaultSheet = getDefaultSheet_(spreadsheet);

  Object.keys(CRM_SHEETS).forEach(function (sheetKey) {
    var definition = CRM_SHEETS[sheetKey];
    var sheet = spreadsheet.getSheetByName(definition.name);

    if (!sheet) {
      sheet = createOrReuseDefaultSheet_(spreadsheet, defaultSheet, definition.name);
      if (defaultSheet && defaultSheet.getName() === definition.name) {
        defaultSheet = null;
      }
      createdSheets.push(definition.name);
    }

    ensureSheetHeaders_(sheet, definition);
    formatSheet_(sheet, definition);
  });

  ensureInitialSettings_(spreadsheet.getSheetByName(CRM_SHEETS.SETTINGS.name));

  var validation = validateDatabaseSchema_(spreadsheet);
  if (!validation.schemaValid) {
    throw schemaError_('SCHEMA_MISMATCH', validation.issues.join(' | '));
  }

  deleteUnusedDefaultSheet_(spreadsheet);

  return {
    sheets: Object.keys(CRM_SHEETS).map(function (sheetKey) {
      return CRM_SHEETS[sheetKey].name;
    }),
    createdSheets: createdSheets
  };
}

function createOrReuseDefaultSheet_(spreadsheet, defaultSheet, sheetName) {
  if (defaultSheet && defaultSheet.getLastRow() === 0 && defaultSheet.getLastColumn() === 0) {
    defaultSheet.setName(sheetName);
    return defaultSheet;
  }

  return spreadsheet.insertSheet(sheetName);
}

function getDefaultSheet_(spreadsheet) {
  var sheets = spreadsheet.getSheets();
  if (sheets.length !== 1) {
    return null;
  }

  var sheet = sheets[0];
  return sheet.getName() === 'Sheet1' ? sheet : null;
}

function deleteUnusedDefaultSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName('Sheet1');
  if (!sheet || spreadsheet.getSheets().length <= 1) {
    return;
  }

  if (sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
    spreadsheet.deleteSheet(sheet);
  }
}

function ensureSheetHeaders_(sheet, definition) {
  var expectedHeaders = definition.headers;
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();

  if (lastRow === 0 && lastColumn === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }

  var actualHeaders = getHeaderValues_(sheet);

  if (!headersMatch_(actualHeaders, expectedHeaders)) {
    throw schemaError_(
      'SCHEMA_MISMATCH',
      definition.name + ' headers do not match the expected CRM schema.'
    );
  }
}

function ensureInitialSettings_(settingsSheet) {
  var existingKeys = getExistingSettingKeys_(settingsSheet);
  var rowsToAppend = getInitialSettingsRows_().filter(function (row) {
    return !existingKeys[row[0] + '::' + row[1]];
  });

  if (rowsToAppend.length === 0) {
    return;
  }

  settingsSheet
    .getRange(settingsSheet.getLastRow() + 1, 1, rowsToAppend.length, CRM_SHEETS.SETTINGS.headers.length)
    .setValues(rowsToAppend);
}

function getExistingSettingKeys_(settingsSheet) {
  var keys = {};
  var lastRow = settingsSheet.getLastRow();

  if (lastRow < 2) {
    return keys;
  }

  var values = settingsSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  values.forEach(function (row) {
    if (row[0] && row[1]) {
      keys[row[0] + '::' + row[1]] = true;
    }
  });

  return keys;
}

function getInitialSettingsRows_() {
  var rows = [
    ['METADATA', 'APP_NAME', APP_NAME, true, 1, 'Application name.'],
    ['METADATA', 'APP_VERSION', APP_VERSION, true, 2, 'Application version.'],
    ['METADATA', 'SCHEMA_VERSION', CRM_SCHEMA_VERSION, true, 3, 'Database schema version.']
  ];

  addControlledValueRows_(rows, 'LEAD_STATUS', CRM_CONTROLLED_VALUES.LEAD_STATUS, 100);
  addControlledValueRows_(rows, 'LEAD_TIER', CRM_CONTROLLED_VALUES.LEAD_TIER, 200);
  addControlledValueRows_(rows, 'ACTIVITY_TYPE', CRM_CONTROLLED_VALUES.ACTIVITY_TYPE, 300);
  addControlledValueRows_(rows, 'CHANNEL', CRM_CONTROLLED_VALUES.CHANNEL, 400);
  addControlledValueRows_(rows, 'LEAD_SOURCE', CRM_CONTROLLED_VALUES.LEAD_SOURCE, 500);

  return rows;
}

function addControlledValueRows_(rows, settingGroup, values, sortOffset) {
  values.forEach(function (value, index) {
    rows.push([
      settingGroup,
      normalizeSettingKey_(value),
      value,
      true,
      sortOffset + index + 1,
      settingGroup + ' controlled value.'
    ]);
  });
}

function normalizeSettingKey_(value) {
  return String(value)
    .toUpperCase()
    .replace(/#/g, 'NUMBER')
    .replace(/&/g, 'AND')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function validateDatabaseSchema_(spreadsheet) {
  var issues = [];

  Object.keys(CRM_SHEETS).forEach(function (sheetKey) {
    var definition = CRM_SHEETS[sheetKey];
    var sheet = spreadsheet.getSheetByName(definition.name);

    if (!sheet) {
      issues.push('Missing required sheet: ' + definition.name);
      return;
    }

    var actualHeaders = getHeaderValues_(sheet);

    if (!headersMatch_(actualHeaders, definition.headers)) {
      issues.push('Header mismatch on sheet: ' + definition.name);
    }
  });

  var schemaVersion = getSettingValue_(spreadsheet, 'METADATA', 'SCHEMA_VERSION');
  if (schemaVersion !== CRM_SCHEMA_VERSION) {
    issues.push('Missing or incompatible SCHEMA_VERSION setting.');
  }

  return {
    requiredSheetsPresent: requiredSheetsPresent_(spreadsheet),
    schemaValid: issues.length === 0,
    issues: issues
  };
}

function requiredSheetsPresent_(spreadsheet) {
  return Object.keys(CRM_SHEETS).every(function (sheetKey) {
    return !!spreadsheet.getSheetByName(CRM_SHEETS[sheetKey].name);
  });
}

function getSettingValue_(spreadsheet, settingGroup, settingKey) {
  var settingsSheet = spreadsheet.getSheetByName(CRM_SHEETS.SETTINGS.name);
  if (!settingsSheet || settingsSheet.getLastRow() < 2) {
    return null;
  }

  var values = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 3).getValues();
  for (var index = 0; index < values.length; index++) {
    if (values[index][0] === settingGroup && values[index][1] === settingKey) {
      return String(values[index][2]);
    }
  }

  return null;
}

function headersMatch_(actualHeaders, expectedHeaders) {
  if (actualHeaders.length !== expectedHeaders.length) {
    return false;
  }

  for (var index = 0; index < expectedHeaders.length; index++) {
    if (actualHeaders[index] !== expectedHeaders[index]) {
      return false;
    }
  }

  return true;
}

function getHeaderValues_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return [];
  }

  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function formatSheet_(sheet, definition) {
  var headers = definition.headers;
  var headerRange = sheet.getRange(1, 1, 1, headers.length);

  sheet.setFrozenRows(1);
  headerRange
    .setFontWeight('bold')
    .setBackground('#162033')
    .setFontColor('#ffffff')
    .setWrap(true);

  sheet.autoResizeColumns(1, headers.length);

  headers.forEach(function (header, index) {
    var column = index + 1;
    sheet.setColumnWidth(column, getColumnWidth_(header));

    if (definition.wrapColumns.indexOf(header) !== -1) {
      sheet.getRange(1, column, sheet.getMaxRows(), 1).setWrap(true);
    }

    if (definition.dateColumns.indexOf(header) !== -1) {
      sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1)
        .setNumberFormat('yyyy-mm-dd hh:mm');
    }

    if (definition.numericColumns.indexOf(header) !== -1) {
      sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1)
        .setNumberFormat('0');
    }
  });
}

function getColumnWidth_(header) {
  if (header.indexOf('notes') !== -1 || header === 'summary' || header === 'description') {
    return 240;
  }

  if (header.indexOf('_at') !== -1 || header.indexOf('date') !== -1) {
    return 150;
  }

  if (header.indexOf('id') !== -1 || header === 'website' || header === 'instagram') {
    return 180;
  }

  return 130;
}

function openDatabaseSpreadsheet_(spreadsheetId) {
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw schemaError_(
      'DATABASE_NOT_FOUND',
      'The configured CRM database spreadsheet could not be opened.'
    );
  }
}

function getSchemaDefinition_() {
  return Object.keys(CRM_SHEETS).map(function (sheetKey) {
    var definition = CRM_SHEETS[sheetKey];
    return {
      name: definition.name,
      columns: definition.headers.slice()
    };
  });
}

function schemaError_(code, message) {
  return {
    code: code,
    message: message
  };
}

function successResponse_(data) {
  return {
    success: true,
    data: data,
    error: null
  };
}

function errorResponse_(code, message) {
  return {
    success: false,
    data: null,
    error: {
      code: code,
      message: message
    }
  };
}
