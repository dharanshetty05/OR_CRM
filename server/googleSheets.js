const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Helper to format private key from environment variable
function getPrivateKey() {
    let key = process.env.GOOGLE_PRIVATE_KEY;
    if (!key) return null;
    // Handle escaped newlines from .env string
    return key.replace(/\\n/g, '\n');
}

let cachedAuthClient = null;
let cachedSheetsInstance = null;

async function getAuthClient() {
    if (cachedAuthClient) return cachedAuthClient;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = getPrivateKey();

    if (!email || !key) {
        throw new Error('Google credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env');
    }

    cachedAuthClient = new google.auth.JWT(
        email,
        null,
        key,
        SCOPES
    );
    return cachedAuthClient;
}

async function getSheetsInstance() {
    if (cachedSheetsInstance) return cachedSheetsInstance;

    const auth = await getAuthClient();
    cachedSheetsInstance = google.sheets({ version: 'v4', auth });
    return cachedSheetsInstance;
}

function getSpreadsheetId() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
        throw new Error('Spreadsheet ID missing. Set GOOGLE_SHEET_ID in .env');
    }
    return spreadsheetId;
}

async function checkSheetsExist() {
    const spreadsheetId = getSpreadsheetId();
    try {
        const sheets = await getSheetsInstance();
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
        });

        const sheetTitles = response.data.sheets.map(s => s.properties.title);
        if (!sheetTitles.includes('LEADS') || !sheetTitles.includes('ACTIVITY')) {
            throw new Error('Required sheets "LEADS" and "ACTIVITY" do not exist in the spreadsheet. Please create them manually.');
        }
        return true;
    } catch (error) {
        if (error.code === 403 || error.code === 404) {
            throw new Error('Sheet not found or permission denied. Check GOOGLE_SHEET_ID and ensure the spreadsheet is shared with the service account email.');
        }
        throw error;
    }
}

async function getRows(range) {
    const sheets = await getSheetsInstance();
    const spreadsheetId = getSpreadsheetId();
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data.values || [];
    } catch (error) {
        throw error;
    }
}

async function appendRow(range, values) {
    const sheets = await getSheetsInstance();
    const spreadsheetId = getSpreadsheetId();
    
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values]
            }
        });
    } catch (error) {
        throw error;
    }
}

async function updateRow(range, values) {
    const sheets = await getSheetsInstance();
    const spreadsheetId = getSpreadsheetId();
    
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values]
            }
        });
    } catch (error) {
        throw error;
    }
}

async function deleteRow(sheetId, startIndex, endIndex) {
    const sheets = await getSheetsInstance();
    const spreadsheetId = getSpreadsheetId();
    
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: startIndex,
                                endIndex: endIndex
                            }
                        }
                    }
                ]
            }
        });
    } catch (error) {
        throw error;
    }
}

module.exports = {
    checkSheetsExist,
    getRows,
    appendRow,
    updateRow,
    deleteRow,
};