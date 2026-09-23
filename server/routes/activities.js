const express = require('express');
const router = express.Router();
const { getRows, appendRow } = require('../googleSheets');
const crypto = require('crypto');

const SHEET_NAME = 'ACTIVITY';

let activitiesCache = null;

async function reloadFromSheets() {
    console.log('Loading Activities cache from Google Sheets...');
    const rows = await getRows(`${SHEET_NAME}!A2:E`);
    activitiesCache = rows.map(mapRowToActivity).filter(a => a.id);
    console.log(`Loaded ${activitiesCache.length} activities into cache.`);
    return activitiesCache;
}

function getCache() {
    return activitiesCache;
}

function mapRowToActivity(row) {
    return {
        id: row[0] || '',
        lead_id: row[1] || '',
        date: row[2] || '',
        type: row[3] || '',
        note: row[4] || ''
    };
}

function mapActivityToRow(activity) {
    return [
        activity.id || '',
        activity.lead_id || '',
        activity.date || '',
        activity.type || '',
        activity.note || ''
    ];
}

function cacheUnavailable(res) {
    return res.status(503).json({ error: 'Google Sheets is unavailable' });
}

router.get('/', (req, res) => {
    if (activitiesCache === null) return cacheUnavailable(res);
    res.json(activitiesCache);
});

router.get('/:leadId', (req, res) => {
    if (activitiesCache === null) return cacheUnavailable(res);
    const activities = activitiesCache.filter(a => a.lead_id === req.params.leadId);
    res.json(activities);
});

router.post('/', async (req, res) => {
    try {
        if (activitiesCache === null) return cacheUnavailable(res);
        if (!req.body.lead_id || typeof req.body.lead_id !== 'string') {
            return res.status(400).json({ error: 'lead_id is required and must be a string' });
        }

        const newActivity = {
            ...req.body,
            id: crypto.randomUUID(),
            date: req.body.date || new Date().toISOString()
        };
        const rowData = mapActivityToRow(newActivity);
        
        await appendRow(`${SHEET_NAME}!A:E`, rowData);
        activitiesCache.push(newActivity);
        res.status(201).json(newActivity);
    } catch (error) {
        console.error('Error creating activity:', error.message || error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

router.reloadFromSheets = reloadFromSheets;
router.getCache = getCache;
module.exports = router;
