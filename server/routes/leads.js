const express = require('express');
const router = express.Router();

const { getRows, updateRow } = require('../googleSheets');

const SHEET_NAME = 'LEADS';

let leadsCache = null;
let leadRowMap = new Map();

const VALID_STATUSES = [
    'NEW_LEAD',
    'DM_SENT',
    'SEEN',
    'REPLIED',
    'CONVO',
    'CALL_BOOKED',
    'NOT_INTERESTED',
    'WON',
    'LOST'
];

/**
 * Convert a Google Sheets row into the backend lead object.
 *
 * LEADS columns:
 * A  Lead ID
 * B  Business Name
 * C  Location
 * D  Niche
 * E  Instagram URL
 * F  Website URL
 * G  Opportunity Score
 * H  Status
 * I  Next Follow-Up
 * J  Follow-Up Count
 * K  DM Sent Date & Time
 * L  Reply Date
 * M  Call Booked Date
 * N  Outcome
 * O  Notes
 * P  Created At
 * Q  Updated At
 */
function mapRowToLead(row) {
    return {
        id: row[0] || '',
        business_name: row[1] || '',
        location: row[2] || '',
        niche: row[3] || '',
        instagram_url: row[4] || '',
        website: row[5] || '',
        opportunity_score: row[6] || '',
        status: row[7] || '',
        next_followup: row[8] || '',
        follow_up_count: row[9] || '',
        dm_sent_date_time: row[10] || '',
        reply_date: row[11] || '',
        call_booked_date: row[12] || '',
        outcome: row[13] || '',
        notes: row[14] || '',
        created_at: row[15] || '',
        updated_at: row[16] || ''
    };
}

/**
 * Convert a backend lead object into a Google Sheets row.
 */
function mapLeadToRow(lead) {
    return [
        lead.id || '',
        lead.business_name || '',
        lead.location || '',
        lead.niche || '',
        lead.instagram_url || '',
        lead.website || '',
        lead.opportunity_score || '',
        lead.status || '',
        lead.next_followup || '',
        lead.follow_up_count || '',
        lead.dm_sent_date_time || '',
        lead.reply_date || '',
        lead.call_booked_date || '',
        lead.outcome || '',
        lead.notes || '',
        lead.created_at || '',
        lead.updated_at || ''
    ];
}

/**
 * Load all leads from Google Sheets into memory.
 */
async function reloadFromSheets() {
    console.log('Loading Leads cache from Google Sheets...');

    const rows = await getRows(`${SHEET_NAME}!A2:Q`);

    leadsCache = [];
    leadRowMap.clear();

    rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const lead = mapRowToLead(row);

        if (!lead.id) {
            return;
        }

        leadsCache.push(lead);
        leadRowMap.set(lead.id, rowNumber);
    });

    console.log(`Loaded ${leadsCache.length} leads into cache.`);

    return leadsCache;
}

function getCache() {
    return leadsCache;
}

function cacheUnavailable(res) {
    return res.status(503).json({
        error: 'Google Sheets is unavailable'
    });
}

/**
 * GET /api/leads
 */
router.get('/', (req, res) => {
    if (leadsCache === null) {
        return cacheUnavailable(res);
    }

    res.json(leadsCache);
});

/**
 * PATCH /api/leads/:id
 *
 * Updates an existing lead both:
 * 1. In Google Sheets
 * 2. In the in-memory cache
 */
router.patch('/:id', async (req, res) => {
    try {
        if (leadsCache === null) {
            return cacheUnavailable(res);
        }

        const leadId = req.params.id;

        const rowIndex = leadsCache.findIndex(
            lead => lead.id === leadId
        );

        if (rowIndex === -1) {
            return res.status(404).json({
                error: 'Lead not found'
            });
        }

        const rowNumber = leadRowMap.get(leadId);

        if (!rowNumber) {
            return res.status(404).json({
                error: 'Lead row mapping not found'
            });
        }

        const existingLead = leadsCache[rowIndex];

        /*
         * Only allow fields that actually belong to the
         * current LEADS schema.
         */
        const allowedFields = [
            'business_name',
            'location',
            'niche',
            'instagram_url',
            'website',
            'opportunity_score',
            'status',
            'next_followup',
            'follow_up_count',
            'dm_sent_date_time',
            'reply_date',
            'call_booked_date',
            'outcome',
            'notes'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        /*
         * Validate important fields.
         */

        if (
            Object.prototype.hasOwnProperty.call(updates, 'status') &&
            !VALID_STATUSES.includes(updates.status)
        ) {
            return res.status(400).json({
                error: 'Invalid status'
            });
        }

        /*
         * Always update Updated At when a lead changes.
         */
        updates.updated_at = new Date().toISOString();

        const updatedLead = {
            ...existingLead,
            ...updates,
            id: existingLead.id
        };

        const rowData = mapLeadToRow(updatedLead);

        /*
         * Write the complete A:Q row.
         */
        await updateRow(
            `${SHEET_NAME}!A${rowNumber}:Q${rowNumber}`,
            rowData
        );

        /*
         * Update cache only after Sheets succeeds.
         */
        leadsCache[rowIndex] = updatedLead;

        res.json(updatedLead);

    } catch (error) {
        console.error(
            'Error updating lead:',
            error.message || error
        );

        res.status(500).json({
            error: 'Failed to update lead'
        });
    }
});

router.reloadFromSheets = reloadFromSheets;
router.getCache = getCache;

module.exports = router;