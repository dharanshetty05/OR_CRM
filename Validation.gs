var LEAD_EDITABLE_FIELDS = [
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
  'next_follow_up_at',
  'notes'
];

var CONTACT_ACTIVITY_TYPES = [
  'Initial DM',
  'Follow-up #1',
  'Follow-up #2',
  'Follow-up #3',
  'Email Sent',
  'Reply Received',
  'Call Booked',
  'Call Completed',
  'Proposal Sent'
];

function validateCreateLeadInput_(input) {
  assertPlainObject_(input, 'Lead input is required.');
  Object.keys(input).forEach(function (field) {
    if (LEAD_EDITABLE_FIELDS.indexOf(field) === -1) {
      throw appError_('INVALID_INPUT', field + ' cannot be supplied by the client.');
    }
  });

  requireString_(input.business_name, 'business_name');
  requireString_(input.niche, 'niche');
  requireString_(input.location, 'location');
  requireString_(input.status, 'status');
  validateLeadEditableFields_(input, true);
}

function validateUpdateLeadInput_(input) {
  assertPlainObject_(input, 'Lead update input is required.');
  validateId_(input.lead_id, 'lead_id');

  if (hasValue_(input.expected_version)) {
    validateExpectedVersion_(input.expected_version);
  }

  Object.keys(input).forEach(function (field) {
    if (
      field !== 'lead_id' &&
      field !== 'expected_version' &&
      LEAD_EDITABLE_FIELDS.indexOf(field) === -1
    ) {
      throw appError_('INVALID_INPUT', field + ' cannot be updated by the client.');
    }
  });

  validateLeadEditableFields_(input, false);
}

function validateFollowUpInput_(input) {
  assertPlainObject_(input, 'Follow-up input is required.');
  validateId_(input.lead_id, 'lead_id');
  validateExpectedVersion_(input.expected_version);

  if (hasValue_(input.next_follow_up_at)) {
    parseDateInput_(input.next_follow_up_at, 'next_follow_up_at');
  }
}

function validateAddActivityInput_(input) {
  assertPlainObject_(input, 'Activity input is required.');
  validateId_(input.lead_id, 'lead_id');
  requireString_(input.activity_type, 'activity_type');
  requireString_(input.summary, 'summary');
  validateEnum_(input.activity_type, CRM_CONTROLLED_VALUES.ACTIVITY_TYPE, 'activity_type');
  validateOptionalEnum_(input.channel, CRM_CONTROLLED_VALUES.CHANNEL, 'channel');

  if (hasValue_(input.activity_at)) {
    parseDateInput_(input.activity_at, 'activity_at');
  }

  validateOptionalString_(input.outcome, 'outcome');
  validateOptionalString_(input.notes, 'notes');
}

function validateLeadEditableFields_(input, requireStatus) {
  validateOptionalString_(input.contact_name, 'contact_name');
  validateOptionalString_(input.website, 'website');
  validateOptionalString_(input.instagram, 'instagram');
  validateOptionalString_(input.email, 'email');
  validateOptionalString_(input.phone, 'phone');
  validateOptionalString_(input.google_place_id, 'google_place_id');
  validateOptionalString_(input.notes, 'notes');

  if (hasOwn_(input, 'business_name')) {
    requireString_(input.business_name, 'business_name');
  }

  if (hasOwn_(input, 'niche')) {
    requireString_(input.niche, 'niche');
  }

  if (hasOwn_(input, 'location')) {
    requireString_(input.location, 'location');
  }

  if (hasOwn_(input, 'status')) {
    requireString_(input.status, 'status');
    validateStatus_(input.status);
  }

  validateOptionalEnum_(input.lead_tier, CRM_CONTROLLED_VALUES.LEAD_TIER, 'lead_tier');
  validateOptionalEnum_(input.lead_source, CRM_CONTROLLED_VALUES.LEAD_SOURCE, 'lead_source');
  validateOptionalScore_(input.lead_score, 'lead_score');
  validateOptionalScore_(input.opportunity_score, 'opportunity_score');

  if (hasValue_(input.next_follow_up_at)) {
    parseDateInput_(input.next_follow_up_at, 'next_follow_up_at');
  }
}

function validateStatus_(status) {
  if (CRM_CONTROLLED_VALUES.LEAD_STATUS.indexOf(status) === -1) {
    throw appError_('INVALID_STATUS', 'Invalid lead status: ' + status);
  }
}

function validateOptionalEnum_(value, allowedValues, fieldName) {
  if (!hasValue_(value)) {
    return;
  }

  validateEnum_(value, allowedValues, fieldName);
}

function validateEnum_(value, allowedValues, fieldName) {
  if (typeof value !== 'string' || allowedValues.indexOf(value) === -1) {
    throw appError_('INVALID_ENUM', 'Invalid ' + fieldName + ': ' + value);
  }
}

function validateOptionalScore_(value, fieldName) {
  if (!hasValue_(value)) {
    return;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return;
  }

  var score = Number(value);
  if (isNaN(score) || score < 0 || score > 100) {
    throw appError_('INVALID_SCORE', fieldName + ' must be a number from 0 through 100.');
  }
}

function validateExpectedVersion_(value) {
  var version = Number(value);
  if (!hasValue_(value) || isNaN(version) || version < 1 || Math.floor(version) !== version) {
    throw appError_('INVALID_INPUT', 'expected_version must be a positive integer.');
  }
}

function validateId_(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError_('INVALID_INPUT', fieldName + ' is required.');
  }

  if (!/^[A-Z]+-[A-Za-z0-9-]+$/.test(value)) {
    throw appError_('INVALID_INPUT', fieldName + ' is invalid.');
  }
}

function requireString_(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError_('INVALID_INPUT', fieldName + ' is required.');
  }
}

function validateOptionalString_(value, fieldName) {
  if (!hasValue_(value)) {
    return;
  }

  if (typeof value !== 'string') {
    throw appError_('INVALID_INPUT', fieldName + ' must be a string.');
  }
}

function parseDateInput_(value, fieldName) {
  var date;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    throw appError_('INVALID_INPUT', fieldName + ' must be a valid date value.');
  }

  if (isNaN(date.getTime())) {
    throw appError_('INVALID_INPUT', fieldName + ' must be a valid date value.');
  }

  return date;
}

function assertPlainObject_(value, message) {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') {
    throw appError_('INVALID_INPUT', message);
  }
}

function hasValue_(value) {
  return value !== null && typeof value !== 'undefined' && value !== '';
}

function hasOwn_(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeDomain_(website) {
  if (!hasValue_(website)) {
    return '';
  }

  var value = String(website).trim().toLowerCase();
  if (!value) {
    return '';
  }

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/^www\./, '');
  value = value.split('/')[0].split('?')[0].split('#')[0];
  value = value.replace(/:\d+$/, '');
  return value;
}

function normalizePhone_(phone) {
  if (!hasValue_(phone)) {
    return '';
  }

  return String(phone).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function normalizeComparableText_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function appError_(code, message) {
  return {
    code: code,
    message: message
  };
}
