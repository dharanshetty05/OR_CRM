function getLeads() {
  return runApi_(function () {
    var repository = getRepository_();
    var rows = readLeadRows_(repository);
    var leads = rows
      .map(mapLeadRowToObject_)
      .filter(function (lead) {
        return !isArchivedLead_(lead);
      });

    return leads;
  });
}

function getLead(leadId) {
  return runApi_(function () {
    validateId_(leadId, 'lead_id');

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, leadId);
    if (!record) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + leadId);
    }

    return record.lead;
  });
}

function createLead(input) {
  return runLockedApi_(function () {
    validateCreateLeadInput_(input);

    var repository = getRepository_();
    var now = new Date();
    var lead = buildNewLead_(input, now);
    var duplicate = findDuplicateLead_(repository, lead, null);

    if (duplicate) {
      throw appError_(
        'DUPLICATE_LEAD',
        'A matching lead already exists: ' + duplicate.lead_id
      );
    }

    appendLead_(repository, lead);
    flushSpreadsheet_();
    return mapLeadRowToObject_(mapLeadObjectToRow_(lead));
  });
}

function updateLead(input) {
  return runLockedApi_(function () {
    validateUpdateLeadInput_(input);

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, input.lead_id);
    if (!record || isArchivedLead_(record.lead)) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + input.lead_id);
    }

    assertExpectedVersion_(record.lead, input.expected_version);

    var updated = applyLeadUpdates_(record.lead, input, new Date());
    var duplicate = findDuplicateLead_(repository, updated, updated.lead_id);
    if (duplicate) {
      throw appError_(
        'DUPLICATE_LEAD',
        'A matching lead already exists: ' + duplicate.lead_id
      );
    }

    updateLeadRow_(repository, record.rowNumber, updated);
    flushSpreadsheet_();
    return mapLeadRowToObject_(mapLeadObjectToRow_(updated));
  });
}

function archiveLead(leadId) {
  return runLockedApi_(function () {
    validateId_(leadId, 'lead_id');

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, leadId);
    if (!record) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + leadId);
    }

    var now = new Date();
    record.lead.archived_at = now;
    record.lead.updated_at = now;
    record.lead.record_version = Number(record.lead.record_version) + 1;

    updateLeadRow_(repository, record.rowNumber, record.lead);
    flushSpreadsheet_();
    return mapLeadRowToObject_(mapLeadObjectToRow_(record.lead));
  });
}

function addActivity(input) {
  return runLockedApi_(function () {
    validateAddActivityInput_(input);

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, input.lead_id);
    if (!record || isArchivedLead_(record.lead)) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + input.lead_id);
    }

    var activityAt = hasValue_(input.activity_at)
      ? parseDateInput_(input.activity_at, 'activity_at')
      : new Date();
    var activity = buildActivity_(input, activityAt);

    appendActivity_(repository, activity);

    if (isContactActivity_(activity.activity_type)) {
      record.lead.last_contacted_at = activityAt;
      record.lead.updated_at = new Date();
      record.lead.record_version = Number(record.lead.record_version) + 1;
      updateLeadRow_(repository, record.rowNumber, record.lead);
    }

    flushSpreadsheet_();
    return mapActivityRowToObject_(mapActivityObjectToRow_(activity));
  });
}

function getActivities(leadId) {
  return runApi_(function () {
    validateId_(leadId, 'lead_id');

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, leadId);
    if (!record || isArchivedLead_(record.lead)) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + leadId);
    }

    return readActivityRows_(repository)
      .map(mapActivityRowToObject_)
      .filter(function (activity) {
        return activity.lead_id === leadId;
      })
      .sort(function (left, right) {
        return new Date(left.activity_at).getTime() - new Date(right.activity_at).getTime();
      });
  });
}

function updateFollowUp(input) {
  return runLockedApi_(function () {
    validateFollowUpInput_(input);

    var repository = getRepository_();
    var record = findLeadRecordById_(repository, input.lead_id);
    if (!record || isArchivedLead_(record.lead)) {
      throw appError_('LEAD_NOT_FOUND', 'Lead not found: ' + input.lead_id);
    }

    assertExpectedVersion_(record.lead, input.expected_version);

    var now = new Date();
    record.lead.next_follow_up_at = hasValue_(input.next_follow_up_at)
      ? parseDateInput_(input.next_follow_up_at, 'next_follow_up_at')
      : '';
    record.lead.updated_at = now;
    record.lead.record_version = Number(record.lead.record_version) + 1;

    updateLeadRow_(repository, record.rowNumber, record.lead);
    flushSpreadsheet_();
    return mapLeadRowToObject_(mapLeadObjectToRow_(record.lead));
  });
}

function runApi_(handler) {
  try {
    return successResponse_(handler());
  } catch (error) {
    return handleApiError_(error);
  }
}

function runLockedApi_(handler) {
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    try {
      lock.waitLock(30000);
      lockAcquired = true;
    } catch (lockError) {
      throw appError_('LOCK_TIMEOUT', 'Could not acquire the CRM write lock.');
    }

    return successResponse_(handler());
  } catch (error) {
    return handleApiError_(error);
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // Ignore release failures when lock acquisition failed.
      }
    }
  }
}

function handleApiError_(error) {
  var code = error && error.code ? error.code : 'OPERATION_FAILED';
  var message = error && error.message ? error.message : 'The requested operation failed.';

  if (typeof console !== 'undefined' && console.error) {
    console.error(code + ': ' + message);
  }

  return errorResponse_(code, message);
}

function buildNewLead_(input, now) {
  var lead = emptyLead_();
  LEAD_EDITABLE_FIELDS.forEach(function (field) {
    if (hasOwn_(input, field)) {
      lead[field] = normalizeInputValue_(input[field], field);
    }
  });

  lead.lead_id = generateStableId_('LEAD');
  lead.date_added = now;
  lead.record_version = 1;
  lead.updated_at = now;
  lead.archived_at = '';
  lead.normalized_domain = normalizeDomain_(lead.website);
  lead.normalized_phone = normalizePhone_(lead.phone);
  return lead;
}

function applyLeadUpdates_(lead, input, now) {
  var updated = copyObject_(lead);

  LEAD_EDITABLE_FIELDS.forEach(function (field) {
    if (hasOwn_(input, field)) {
      updated[field] = normalizeInputValue_(input[field], field);
    }
  });

  if (hasOwn_(input, 'website')) {
    updated.normalized_domain = normalizeDomain_(updated.website);
  }

  if (hasOwn_(input, 'phone')) {
    updated.normalized_phone = normalizePhone_(updated.phone);
  }

  updated.updated_at = now;
  updated.record_version = Number(updated.record_version) + 1;
  return updated;
}

function buildActivity_(input, activityAt) {
  return {
    activity_id: generateStableId_('ACT'),
    lead_id: input.lead_id,
    activity_at: activityAt,
    activity_type: input.activity_type,
    channel: hasValue_(input.channel) ? input.channel : '',
    summary: input.summary.trim(),
    outcome: hasValue_(input.outcome) ? input.outcome.trim() : '',
    notes: hasValue_(input.notes) ? input.notes.trim() : ''
  };
}

function emptyLead_() {
  var lead = {};
  CRM_SHEETS.LEADS.headers.forEach(function (header) {
    lead[header] = '';
  });
  return lead;
}

function normalizeInputValue_(value, field) {
  if (!hasValue_(value)) {
    return '';
  }

  if (field === 'lead_score' || field === 'opportunity_score') {
    return Number(value);
  }

  if (field === 'next_follow_up_at') {
    return parseDateInput_(value, field);
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function assertExpectedVersion_(lead, expectedVersion) {
  if (!hasValue_(expectedVersion)) {
    return;
  }

  if (Number(lead.record_version) !== Number(expectedVersion)) {
    throw appError_(
      'CONFLICT',
      'The lead was changed by another operation. Refresh before saving.'
    );
  }
}

function isContactActivity_(activityType) {
  return CONTACT_ACTIVITY_TYPES.indexOf(activityType) !== -1;
}

function generateStableId_(prefix) {
  var uuid = Utilities.getUuid ? Utilities.getUuid() : String(new Date().getTime());
  return prefix + '-' + uuid;
}

function copyObject_(object) {
  var copy = {};
  Object.keys(object).forEach(function (key) {
    copy[key] = object[key];
  });
  return copy;
}
