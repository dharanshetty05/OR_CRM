require('dotenv').config();
const express = require('express');
const path = require('path');
const { checkSheetsExist } = require('./googleSheets');
const leadsRouter = require('./routes/leads');
const activitiesRouter = require('./routes/activities');

const app = express();
const PORT = process.env.PORT || 3000;

let isReady = false;

// Serve static frontend files from the project root (one directory above /server)
app.use(express.static(path.join(__dirname, '..')));

app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    if (isReady) {
        res.json({ status: 'ok', ready: true });
    } else {
        res.json({ status: 'initializing', ready: false });
    }
});

// API Routes
app.use('/api/leads', leadsRouter);
app.use('/api/activities', activitiesRouter);

// Browser route to serve index.html explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message || err);
    res.status(500).json({ error: 'An unexpected server error occurred' });
});

// Start server and validate Google Sheets configuration
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    
    console.log('Verifying Google Sheets configuration and initializing cache...');
    try {
        await checkSheetsExist();
        console.log('✅ Google Sheets configuration is valid and required sheets exist.');
        
        await leadsRouter.initLeads();
        await activitiesRouter.initActivities();
        
        isReady = true;
        console.log('✅ CRM Backend is ready.');
    } catch (error) {
        console.error('⚠️ Google Sheets Configuration Error:');
        console.error(error.message);
        console.error('The server is running, but Google Sheets API calls will fail until this is resolved.');
    }
});
