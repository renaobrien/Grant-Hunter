const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.SHEET_ID;
const KEY_FILE = path.resolve(process.env.GOOGLE_KEY_FILE || './google-service-account.json');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function columnToLetter(columnNumber) {
  let current = columnNumber;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

async function getClient() {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
  return google.sheets({ version: 'v4', auth });
}

async function appendRow(tab, values) {
  const sheets = await getClient();
  // Read column D (ID — always bot-populated) to find the last used row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!D:D`,
  });
  const nextRow = ((res.data.values || []).length) + 1;
  const endColLetter = columnToLetter(1 + values.length); // B=2, so end = 2 + length - 1 = 1 + length
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!B${nextRow}:${endColLetter}${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

async function getRows(tab) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!B2:Z`,
  });
  return res.data.values || [];
}

async function updateRow(tab, row, values) {
  const sheets = await getClient();
  const sheetRow = row + 1; // offset for header
  const startCol = 2; // B
  const endColLetter = columnToLetter(startCol + values.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!B${sheetRow}:${endColLetter}${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

module.exports = { appendRow, getRows, updateRow };
