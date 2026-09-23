const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateRow, deleteRow, getSheetIdByTitle } = require('../googleSheets');
const crypto = require('crypto');

const SHEET_NAME = 'LEADS';

let leadsCache = null;

async function reloadFromSheets() {
    console.log('Loading Leads cache from Google Sheets...');
    const rows = await getRows(`${SHEET_NAME}!A2:U`);
    leadsCache = rows.map(mapRowToLead).filter(lead => lead.id);
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
        contact_name: row[2] || '',
        niche: row[3] || '',
        location: row[4] || '',
        website: row[5] || '',
        instagram: row[6] || '',
        email: row[7] || '',
        phone: row[8] || '',
        status: row[9] || '',
        lead_tier: row[10] || '',
        lead_source: row[11] || '',
        google_place_id: row[12] || '',
        lead_score: row[13] || '',
        opportunity_score: row[14] || '',
        notes: row[15] || '',
        created_at: row[16] || '',
        last_contacted: row[17] || '',
        next_followup: row[18] || '',
        updated_at: row[19] || '',
        archived_at: row[20] || ''
    };
}

function mapLeadToRow(lead) {
    return [
        lead.id || '',
        lead.business_name || '',
        lead.contact_name || '',
        lead.niche || '',
        lead.location || '',
        lead.website || '',
        lead.instagram || '',
        lead.email || '',
        lead.phone || '',
        lead.status || '',
        lead.lead_tier || '',
        lead.lead_source || '',
        lead.google_place_id || '',
        lead.lead_score || '',
        lead.opportunity_score || '',
        lead.notes || '',
        lead.created_at || '',
        lead.last_contacted || '',
        lead.next_followup || '',
        lead.updated_at || '',
        lead.archived_at || ''
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

router.post('/', async (req, res) => {
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

        const newLead = {
            ...req.body,
            id: req.body.id || crypto.randomUUID(),
            created_at: new Date().toISOString()
        };
        const rowData = mapLeadToRow(newLead);
        
        await appendRow(`${SHEET_NAME}!A:U`, rowData);
        leadsCache.push(newLead);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('Error creating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
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

        const idRows = await getRows(`${SHEET_NAME}!A2:A`);
        const sheetRowIndex = idRows.findIndex(row => row[0] === req.params.id);
        if (sheetRowIndex === -1) return res.status(404).json({ error: 'Lead not found in sheets' });

        const existingLead = leadsCache[rowIndex];
        const updatedLead = { ...existingLead, ...req.body, id: existingLead.id };
        const rowData = mapLeadToRow(updatedLead);
        
        const rowNumber = sheetRowIndex + 2; 
        await updateRow(`${SHEET_NAME}!A${rowNumber}:U${rowNumber}`, rowData);
        
        leadsCache[rowIndex] = updatedLead;
        res.json(updatedLead);
    } catch (error) {
        console.error('Error updating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        if (leadsCache === null) return cacheUnavailable(res);
        const rowIndex = leadsCache.findIndex(l => l.id === req.params.id);
        if (rowIndex === -1) return res.status(404).json({ error: 'Lead not found in cache' });

        const idRows = await getRows(`${SHEET_NAME}!A2:A`);
        const sheetRowIndex = idRows.findIndex(row => row[0] === req.params.id);
        if (sheetRowIndex === -1) return res.status(404).json({ error: 'Lead not found in sheets' });

        const sheetId = await getSheetIdByTitle(SHEET_NAME);
        const startIndex = sheetRowIndex + 1;
        const endIndex = startIndex + 1;
        
        await deleteRow(sheetId, startIndex, endIndex);
        
        leadsCache.splice(rowIndex, 1);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error.message || error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

router.reloadFromSheets = reloadFromSheets;
router.getCache = getCache;
module.exports = router;
