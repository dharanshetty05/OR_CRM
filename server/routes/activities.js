const express = require('express');
const router = express.Router();
const { getRows, appendRow } = require('../googleSheets');
const crypto = require('crypto');

const SHEET_NAME = 'ACTIVITY';

// Helper to map row array to object
function mapRowToActivity(row) {
    return {
        id: row[0] || '',
        lead_id: row[1] || '',
        date: row[2] || '',
        type: row[3] || '',
        note: row[4] || ''
    };
}

// Map activity object back to row array
function mapActivityToRow(activity) {
    return [
        activity.id || '',
        activity.lead_id || '',
        activity.date || '',
        activity.type || '',
        activity.note || ''
    ];
}

// GET all activities
router.get('/', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:E`);
        const activities = rows.map(mapRowToActivity).filter(a => a.id);
        res.json(activities);
    } catch (error) {
        console.error('Error fetching activities:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// GET activities for a specific lead
router.get('/:leadId', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:E`);
        const activities = rows.map(mapRowToActivity).filter(a => a.id && a.lead_id === req.params.leadId);
        res.json(activities);
    } catch (error) {
        console.error('Error fetching activities for lead:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// POST create an activity
router.post('/', async (req, res) => {
    try {
        // Validate required fields
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
        res.status(201).json(newActivity);
    } catch (error) {
        console.error('Error creating activity:', error.message || error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

module.exports = router;
