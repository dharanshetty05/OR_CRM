const express = require('express');
const router = express.Router();

const {
    getRows,
    appendRow
} = require('../googleSheets');

const crypto = require('crypto');

const SHEET_NAME = 'ACTIVITY';

let activitiesCache = null;

/**
 * ACTIVITY columns:
 *
 * A  Activity ID
 * B  Lead ID
 * C  Type
 * D  Date
 * E  Follow-Up Number
 * F  Message
 * G  Outcome
 * H  Notes
 * I  Created At
 */

/**
 * Convert Google Sheets row -> backend activity.
 */
function mapRowToActivity(row) {
    return {
        id: row[0] || '',
        lead_id: row[1] || '',
        type: row[2] || '',
        date: row[3] || '',
        follow_up_number: row[4] || '',
        message: row[5] || '',
        outcome: row[6] || '',
        notes: row[7] || '',
        created_at: row[8] || ''
    };
}

/**
 * Convert backend activity -> Google Sheets row.
 */
function mapActivityToRow(activity) {
    return [
        activity.id || '',
        activity.lead_id || '',
        activity.type || '',
        activity.date || '',
        activity.follow_up_number || '',
        activity.message || '',
        activity.outcome || '',
        activity.notes || '',
        activity.created_at || ''
    ];
}

/**
 * Load activities from Google Sheets.
 */
async function reloadFromSheets() {
    console.log('Loading Activities cache from Google Sheets...');

    const rows = await getRows(`${SHEET_NAME}!A2:I`);

    activitiesCache = rows
        .map(mapRowToActivity)
        .filter(activity => activity.id);

    console.log(
        `Loaded ${activitiesCache.length} activities into cache.`
    );

    return activitiesCache;
}

function getCache() {
    return activitiesCache;
}

function cacheUnavailable(res) {
    return res.status(503).json({
        error: 'Google Sheets is unavailable'
    });
}

/**
 * GET /api/activities
 *
 * Returns all activities.
 */
router.get('/', (req, res) => {
    if (activitiesCache === null) {
        return cacheUnavailable(res);
    }

    res.json(activitiesCache);
});

/**
 * POST /api/activities
 *
 * Creates a new activity.
 */
router.post('/', async (req, res) => {
    try {
        if (activitiesCache === null) {
            return cacheUnavailable(res);
        }

        if (
            !req.body.lead_id ||
            typeof req.body.lead_id !== 'string'
        ) {
            return res.status(400).json({
                error: 'lead_id is required and must be a string'
            });
        }

        const now = new Date().toISOString();

        const newActivity = {
            id: crypto.randomUUID(),

            lead_id: req.body.lead_id,

            type: req.body.type || '',

            date: req.body.date || now,

            follow_up_number:
                req.body.follow_up_number || '',

            message:
                req.body.message || '',

            outcome:
                req.body.outcome || '',

            notes:
                req.body.notes || '',

            created_at: now
        };

        /*
         * Write the complete A:I row.
         */
        const rowData = mapActivityToRow(newActivity);

        await appendRow(
            `${SHEET_NAME}!A:I`,
            rowData
        );

        /*
         * Only update cache after Sheets succeeds.
         */
        activitiesCache.push(newActivity);

        res.status(201).json(newActivity);

    } catch (error) {
        console.error(
            'Error creating activity:',
            error.message || error
        );

        res.status(500).json({
            error: 'Failed to create activity'
        });
    }
});

router.reloadFromSheets = reloadFromSheets;
router.getCache = getCache;

module.exports = router;