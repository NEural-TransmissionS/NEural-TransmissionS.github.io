/**
 * Backend for apps/connect (Florida Tech AI engagement form).
 *
 * Runs as a Google Apps Script web app bound to a Google Sheet; each submission
 * becomes one row in the "Responses" tab. Setup steps are in ../README.md.
 *
 * Interface:
 *   POST <web app URL ending in /exec>
 *   Content-Type: application/x-www-form-urlencoded
 *   Fields: name*, email*, organization, role, phone, interests (repeatable),
 *           challenge, notes, source, website (honeypot, must be empty)
 *   Reply:  {"ok": true} or {"ok": false, "error": "<message for the visitor>"}
 *   GET returns {"ok": true, "service": "connect"} as a health check.
 *
 * @OnlyCurrentDoc  Limits the Sheets permission to the Sheet this script is
 *                  attached to, instead of every spreadsheet in your Drive.
 */

const SHEET_NAME = 'Responses';

// Set to an address (e.g. 'rwhite@fit.edu') to get an email for every submission.
// Empty string disables notifications. Free accounts can send 100 emails/day.
const NOTIFY_EMAIL = 'rwhite@fit.edu';

const HEADERS = [
  'Timestamp', 'Name', 'Organization', 'Role', 'Email', 'Phone',
  'Interests', 'AI challenge', 'Notes', 'Source',
];
const MAX_LEN = 2000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function doGet() {
  return json_({ ok: true, service: 'connect' });
}

function doPost(e) {
  try {
    const p = e.parameter || {};

    // Bots fill every field, including the hidden one. Report success so they move on.
    if (p.website) return json_({ ok: true });

    const name = clean_(p.name);
    const email = clean_(p.email);
    if (!name || !EMAIL_RE.test(email)) {
      return json_({ ok: false, error: 'Name and a valid email are required.' });
    }

    // e.parameters (plural) holds every value of a repeated field, one per checked box.
    const interests = ((e.parameters && e.parameters.interests) || [])
      .map(clean_).filter(String).join('; ');

    const fields = [
      name, clean_(p.organization), clean_(p.role), email, clean_(p.phone),
      interests, clean_(p.challenge), clean_(p.notes), clean_(p.source) || 'direct',
    ];
    const row = [new Date()].concat(fields.map(noFormula_));

    // Serialize writes so near-simultaneous submissions (a room scanning at once) can't collide.
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      sheet_().appendRow(row);
    } finally {
      lock.releaseLock();
    }

    // The row is already saved, so a failed email must not turn into an error for the
    // visitor. Failures show up under Executions in the Apps Script editor.
    if (NOTIFY_EMAIL) {
      try {
        notify_(row, email);
      } catch (mailErr) {
        console.error('Notification email failed:', mailErr);
      }
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error.' });
  }
}

// Returns the Responses tab, creating it with a frozen header row on first use.
function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function notify_(row, replyTo) {
  const org = row[2] ? ` (${row[2]})` : '';
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: replyTo,
    subject: `AI connect: ${row[1]}${org}`,
    body: HEADERS.map((h, i) => `${h}: ${row[i]}`).join('\n'),
  });
}

function clean_(value) {
  return String(value == null ? '' : value).trim().slice(0, MAX_LEN);
}

// Sheets would evaluate text starting with = + - @ as a formula ("formula injection"),
// so prefix those with an apostrophe to force them to be stored as plain text.
function noFormula_(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
