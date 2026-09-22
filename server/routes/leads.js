const express = require('express');
const router = express.Router();
const { getRows, appendRow, updateRow, deleteRow, getSheetIdByTitle } = require('../googleSheets');
// crypto is built into Node.js, we can use it to generate a simple unique ID 
// to avoid adding another dependency like uuid
const crypto = require('crypto');

const SHEET_NAME = 'LEADS';

// Helper to map row array to object
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

// Map lead object back to row array
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

// GET all leads
router.get('/', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:U`);
        const leads = rows.map(mapRowToLead).filter(lead => lead.id);
        res.json(leads);
    } catch (error) {
        console.error('Error fetching leads:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

// GET one lead
router.get('/:id', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:U`);
        const leads = rows.map(mapRowToLead);
        const lead = leads.find(l => l.id === req.params.id);
        
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        res.json(lead);
    } catch (error) {
        console.error('Error fetching lead:', error.message || error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

// POST create a lead
router.post('/', async (req, res) => {
    try {
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
            id: req.body.id || crypto.randomUUID(), // use provided id if available
            created_at: new Date().toISOString()
        };
        const rowData = mapLeadToRow(newLead);
        
        await appendRow(`${SHEET_NAME}!A:U`, rowData);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('Error creating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// PATCH update a lead
router.patch('/:id', async (req, res) => {
    try {
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

        const rows = await getRows(`${SHEET_NAME}!A2:U`);
        const leads = rows.map(mapRowToLead);
        const rowIndex = leads.findIndex(l => l.id === req.params.id);
        
        if (rowIndex === -1) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const existingLead = leads[rowIndex];
        const updatedLead = { ...existingLead, ...req.body, id: existingLead.id }; // preserve ID
        const rowData = mapLeadToRow(updatedLead);
        
        // rowIndex + 2 because A1 is header, A2 is index 0
        const rowNumber = rowIndex + 2; 
        await updateRow(`${SHEET_NAME}!A${rowNumber}:U${rowNumber}`, rowData);
        
        res.json(updatedLead);
    } catch (error) {
        console.error('Error updating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// DELETE a lead
router.delete('/:id', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:U`);
        const leads = rows.map(mapRowToLead);
        const rowIndex = leads.findIndex(l => l.id === req.params.id);
        
        if (rowIndex === -1) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const sheetId = await getSheetIdByTitle(SHEET_NAME);
        // deleteRow expects 0-indexed values for rows
        // Header is row 0. Row 1 in sheet is index 0 in data.
        // So row index 0 (which is sheet row 2) is actually startIndex: 1, endIndex: 2
        const startIndex = rowIndex + 1;
        const endIndex = startIndex + 1;
        
        await deleteRow(sheetId, startIndex, endIndex);
        
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Error deleting lead:', error.message || error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

module.exports = router;
