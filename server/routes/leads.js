const express = require('express');
const router = express.Router();
const { getRows, updateRow } = require('../googleSheets');
const crypto = require('crypto');

const SHEET_NAME = 'LEADS';

let leadsCache = null;
let leadRowMap = new Map();
let maxRow = 1;

async function reloadFromSheets() {
    console.log('Loading Leads cache from Google Sheets...');
    const rows = await getRows(`${SHEET_NAME}!A2:Q`);
    
    leadsCache = [];
    leadRowMap.clear();
    maxRow = 1;
    
    rows.forEach((row, index) => {
        const rowNum = index + 2;
        if (rowNum > maxRow) maxRow = rowNum;
        
        const lead = mapRowToLead(row);
        if (lead.id) {
            leadsCache.push(lead);
            leadRowMap.set(lead.id, rowNum);
        }
    });
    
    console.log(`Loaded ${leadsCache.length} leads into cache.`);
    return leadsCache;
}

function getCache() {
    return leadsCache;
}

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
        last_activity: row[10] || '',
        reply_date: row[11] || '',
        call_booked_date: row[12] || '',
        outcome: row[13] || '',
        notes: row[14] || '',
        created_at: row[15] || '',
        updated_at: row[16] || ''
    };
}

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
        lead.last_activity || '',
        lead.reply_date || '',
        lead.call_booked_date || '',
        lead.outcome || '',
        lead.notes || '',
        lead.created_at || '',
        lead.updated_at || ''
    ];
}

function cacheUnavailable(res) {
    return res.status(503).json({ error: 'Google Sheets is unavailable' });
}

router.get('/', (req, res) => {
    if (leadsCache === null) return cacheUnavailable(res);
    res.json(leadsCache);
});

router.get('/:id', (req, res) => {
    if (leadsCache === null) return cacheUnavailable(res);
    const lead = leadsCache.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
});

router.patch('/:id', async (req, res) => {
    try {
        if (leadsCache === null) return cacheUnavailable(res);
        const validStatuses = ['NOT CONTACTED', 'DM SENT', 'REPLIED', 'CALL BOOKED', 'WON', 'LOST'];
        if (req.body.business_name && typeof req.body.business_name !== 'string') {
            return res.status(400).json({ error: 'business_name must be a string' });
        }
        if (req.body.status && !validStatuses.includes(req.body.status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        if (req.body.website && typeof req.body.website !== 'string') {
            return res.status(400).json({ error: 'website must be a string' });
        }

        const rowIndex = leadsCache.findIndex(l => l.id === req.params.id);
        if (rowIndex === -1) return res.status(404).json({ error: 'Lead not found in cache' });

        const rowNumber = leadRowMap.get(req.params.id);
        if (!rowNumber) return res.status(404).json({ error: 'Lead not found in sheets mapping' });

        const existingLead = leadsCache[rowIndex];
        const updatedLead = { ...existingLead, ...req.body, id: existingLead.id };
        const rowData = mapLeadToRow(updatedLead);
        
        await updateRow(`${SHEET_NAME}!A${rowNumber}:Q${rowNumber}`, rowData);
        
        leadsCache[rowIndex] = updatedLead;
        res.json(updatedLead);
    } catch (error) {
        console.error('Error updating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

router.reloadFromSheets = reloadFromSheets;
router.getCache = getCache;
module.exports = router;