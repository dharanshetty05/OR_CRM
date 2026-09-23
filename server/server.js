require('dotenv').config();
const express = require('express');
const path = require('path');
const { checkSheetsExist } = require('./googleSheets');
const leadsRouter = require('./routes/leads');
const activitiesRouter = require('./routes/activities');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ROOT = path.resolve(path.join(__dirname, '..'));
const FRONTEND_FILES = new Set([
    'index.html',
    'styles.css',
    'app.js',
    'api.js',
    'config.js',
    'backup.js'
]);

let healthStatus = 'starting';
let loadInFlight = null;

function getHealthPayload() {
    return {
        status: healthStatus,
        ready: healthStatus === 'ready'
    };
}

function hasWarmCache() {
    return leadsRouter.getCache() !== null && activitiesRouter.getCache() !== null;
}

async function loadCachesFromSheets() {
    await checkSheetsExist();
    await Promise.all([
        leadsRouter.reloadFromSheets(),
        activitiesRouter.reloadFromSheets()
    ]);
}

async function runCacheLoad() {
    if (loadInFlight) {
        await loadInFlight;
        if (healthStatus !== 'ready') {
            throw new Error('Google Sheets is unavailable');
        }
        return;
    }

    loadInFlight = (async () => {
        await loadCachesFromSheets();
        healthStatus = 'ready';
    })();

    try {
        await loadInFlight;
    } catch (error) {
        if (!hasWarmCache()) {
            healthStatus = 'error';
        }
        throw error;
    } finally {
        loadInFlight = null;
    }
}

function startBackgroundInit() {
    runCacheLoad().catch((error) => {
        console.error('⚠️ Google Sheets Configuration Error:');
        console.error(error.message);
        console.error('The server is running, but Google Sheets data is unavailable until this is resolved.');
    });
}

function sendIndex(res) {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
}

function sendFrontendFile(res, fileName) {
    const safeName = path.basename(String(fileName || ''));
    if (!FRONTEND_FILES.has(safeName)) {
        res.status(404).end();
        return;
    }
    res.sendFile(path.join(FRONTEND_ROOT, safeName));
}

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json(getHealthPayload());
});

app.post('/api/refresh', async (req, res) => {
    try {
        await runCacheLoad();
        res.json({
            status: 'ready',
            ready: true,
            leads: leadsRouter.getCache(),
            activities: activitiesRouter.getCache()
        });
    } catch (error) {
        console.error('Failed to refresh Google Sheets cache:', error.message || error);
        res.status(503).json({
            status: 'error',
            ready: false,
            error: 'Google Sheets is unavailable'
        });
    }
});

app.use('/api/leads', leadsRouter);
app.use('/api/activities', activitiesRouter);

app.use('/server', (req, res) => {
    res.status(404).end();
});

app.get('/', (req, res) => sendIndex(res));
app.get(['/index.html', '/Index.html'], (req, res) => sendIndex(res));

app.get('/:file', (req, res, next) => {
    sendFrontendFile(res, req.params.file);
});

app.use((req, res) => {
    res.status(404).end();
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message || err);
    res.status(500).json({ error: 'An unexpected server error occurred' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Frontend available at http://localhost:' + PORT);
    console.log('Initializing Google Sheets cache in the background...');
    startBackgroundInit();
});
