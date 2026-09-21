require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkSheetsExist } = require('./googleSheets');
const leadsRouter = require('./routes/leads');
const activitiesRouter = require('./routes/activities');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS minimally - allow only specified origin or local dev
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:8000';
app.use(cors({
    origin: allowedOrigin
}));

app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API Routes
app.use('/api/leads', leadsRouter);
app.use('/api/activities', activitiesRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message || err);
    res.status(500).json({ error: 'An unexpected server error occurred' });
});

// Start server and validate Google Sheets configuration
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS configured to allow origin: ${allowedOrigin}`);
    
    console.log('Verifying Google Sheets configuration...');
    try {
        await checkSheetsExist();
        console.log('✅ Google Sheets configuration is valid and required sheets exist.');
    } catch (error) {
        console.error('⚠️ Google Sheets Configuration Error:');
        console.error(error.message);
        console.error('The server is running, but Google Sheets API calls will fail until this is resolved.');
    }
});
