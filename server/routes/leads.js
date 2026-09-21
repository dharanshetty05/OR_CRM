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
        niche: row[2] || '',
        location: row[3] || '',
        website: row[4] || '',
        instagram: row[5] || '',
        phone: row[6] || '',
        status: row[7] || '',
        notes: row[8] || '',
        last_contacted: row[9] || '',
        next_followup: row[10] || '',
        created_at: row[11] || ''
    };
}

// Map lead object back to row array
function mapLeadToRow(lead) {
    return [
        lead.id || '',
        lead.business_name || '',
        lead.niche || '',
        lead.location || '',
        lead.website || '',
        lead.instagram || '',
        lead.phone || '',
        lead.status || '',
        lead.notes || '',
        lead.last_contacted || '',
        lead.next_followup || '',
        lead.created_at || ''
    ];
}

// GET all leads
router.get('/', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:L`);
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
        const rows = await getRows(`${SHEET_NAME}!A2:L`);
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
        const newLead = {
            ...req.body,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
        };
        const rowData = mapLeadToRow(newLead);
        
        await appendRow(`${SHEET_NAME}!A:L`, rowData);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('Error creating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// PATCH update a lead
router.patch('/:id', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:L`);
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
        await updateRow(`${SHEET_NAME}!A${rowNumber}:L${rowNumber}`, rowData);
        
        res.json(updatedLead);
    } catch (error) {
        console.error('Error updating lead:', error.message || error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// DELETE a lead
router.delete('/:id', async (req, res) => {
    try {
        const rows = await getRows(`${SHEET_NAME}!A2:L`);
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
