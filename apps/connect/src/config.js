// Google Apps Script web app URL that receives submissions (ends in /exec).
// Get it from Deploy > Manage deployments in the Apps Script editor; see ../README.md.
// Empty string = backend not configured yet; the form will say so instead of submitting.
export const ENDPOINT = "https://script.google.com/macros/s/AKfycbzesV43hUuFl0_SvIoFo-sPr5iHJKq2wWZ3AKoSxrPFWDl9ueqgw4cAbaE6FyMOX6kX/exec";

// Shown to visitors when a submission fails, so they still have a way to reach us.
export const FALLBACK_EMAIL = "rwhite@fit.edu";
