// Engagement form: validates in the browser, then POSTs to the Apps Script backend.
// Wire format (urlencoded, one "interests" entry per checked box) is documented in ../README.md.
import { ENDPOINT, FALLBACK_EMAIL } from "./config.js";

const form = document.getElementById("connectForm");
const submitBtn = document.getElementById("submitBtn");
const errorEl = document.getElementById("formError");
const thanks = document.getElementById("thanks");

// ?src=coes-2026-10 (from a QR code) is stored with the submission to tell events apart.
// Restricted to a short slug so arbitrary text can't be injected into the Sheet via the URL.
const src = new URLSearchParams(location.search).get("src");
if (src && /^[\w-]{1,64}$/.test(src)) {
  form.elements.source.value = src;
}

function showError(message) {
  errorEl.textContent = "";
  errorEl.append(message);
  errorEl.hidden = false;
}

// Error text that always ends with a working way to reach a person.
function errorWithEmail(prefix) {
  const frag = document.createDocumentFragment();
  const link = document.createElement("a");
  link.href = `mailto:${FALLBACK_EMAIL}`;
  link.textContent = FALLBACK_EMAIL;
  frag.append(`${prefix} Please email `, link, " instead.");
  return frag;
}

// Mark required fields invalid for screen readers and styling; returns the first bad field.
function validate() {
  let firstBad = null;
  for (const el of form.querySelectorAll("input[required]")) {
    const bad = !el.checkValidity();
    el.setAttribute("aria-invalid", String(bad));
    if (bad && !firstBad) firstBad = el;
  }
  return firstBad;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;

  const firstBad = validate();
  if (firstBad) {
    showError("Please enter your name and a valid email.");
    firstBad.focus();
    return;
  }

  if (!ENDPOINT) {
    showError(errorWithEmail("This form isn't connected yet."));
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";
  try {
    // URLSearchParams body => application/x-www-form-urlencoded, a CORS "simple request"
    // (no preflight, which Apps Script can't answer). Apps Script redirects to
    // script.googleusercontent.com, which allows any origin, so the JSON reply is readable.
    const response = await fetch(ENDPOINT, {
      method: "POST",
      body: new URLSearchParams(new FormData(form)),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Submission rejected");

    form.hidden = true;
    thanks.hidden = false;
    thanks.focus();
  } catch (err) {
    console.error("Submission failed:", err);
    showError(errorWithEmail("Sorry, something went wrong sending your note."));
    submitBtn.disabled = false;
    submitBtn.textContent = "Send";
  }
});
