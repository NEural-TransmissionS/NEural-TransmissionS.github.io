# Connect form (`apps/connect`)

A one-page "work with us on AI" form for industry partners. Built for the COES
Advisory Board talk (Oct 21, 2026) and reusable for any later event.

- **Live URL:** https://neural-transmissions.github.io/apps/connect/
- **Slide QR code:** `qr-coes-2026-10.png` points at `…/apps/connect/?src=coes-2026-10`

## How it works

```
Browser (index.html + src/main.js)
   │  POST, application/x-www-form-urlencoded
   ▼
Google Apps Script web app (apps-script/Code.gs)
   │  appendRow
   ▼
Google Sheet, tab "Responses" (one row per submission)
```

GitHub Pages only serves static files, so submissions go to an Apps Script web
app bound to a Sheet. That script is the only backend.

## Files

| File | Purpose |
|---|---|
| `index.html` | Form markup. Edit the interest checkboxes here; their `value` lands in the Sheet as written. |
| `styles.css` | Mobile-first styles (light/dark), Florida Tech crimson. |
| `src/config.js` | `ENDPOINT` (Apps Script `/exec` URL) and fallback email. **Set `ENDPOINT` once after deploying.** |
| `src/main.js` | Validation, `?src=` handling, submission, success/error UI. |
| `apps-script/Code.gs` | Backend, pasted into the Apps Script editor. Not run by GitHub Pages. |

## Submission interface

`POST <ENDPOINT>` with an urlencoded body:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `email` | yes | Checked against a basic `x@y.z` pattern |
| `organization`, `role`, `phone` | no | |
| `interests` | no | Repeated once per checked box; joined with `; ` in the Sheet |
| `challenge`, `notes` | no | Free text |
| `source` | no | Slug from `?src=` (`[A-Za-z0-9_-]{1,64}`), default `direct` |
| `website` | must be empty | Hidden honeypot; if filled, the row is dropped but `{ok:true}` is returned |

Every field is trimmed and capped at 2,000 characters. Values starting with
`= + - @` are stored with a leading apostrophe, so Sheets can't run them as formulas.

Reply: `{"ok": true}` or `{"ok": false, "error": "…"}`. `GET <ENDPOINT>` returns
`{"ok": true, "service": "connect"}` as a health check.

The form uses a urlencoded body because that is a CORS "simple request", which
needs no preflight. Apps Script can't answer a preflight, so JSON bodies would fail.

## One-time setup (about 5 minutes)

1. Create a Google Sheet, e.g. "Florida Tech AI – Connect Responses".
2. In the Sheet: **Extensions → Apps Script**. Replace the default code with
   `apps-script/Code.gs`. Optionally set `NOTIFY_EMAIL` to get an email per submission. Save.
3. **Deploy → New deployment →** type **Web app**. Set *Execute as*: **Me**, and
   *Who has access*: **Anyone**. Deploy and approve the permission prompts
   (Google warns that the app is unverified; continue, since it's your own script).
4. Copy the **Web app URL** (ends in `/exec`) into `ENDPOINT` in `src/config.js`. Commit and push.
5. Test: open the live page, submit once, and check that a row appears. Delete the test row.

**Editing the script later:** use **Deploy → Manage deployments → Edit → Version: New version**.
That keeps the same URL. Creating a *new deployment* gives a new URL, and you
would have to update `config.js` again.

**Account note:** use an account where "Anyone" access is allowed. Some
university Google Workspace domains block anonymous web-app access; a personal
Gmail account always allows it.

## Cost and limits

Free. Apps Script and Sheets cost nothing at this scale. The limits that matter on
a free account are 30 simultaneous executions (submissions are serialized with
a lock, so a whole room scanning at once is fine), 100 notification emails per
day, and 10M cells per Sheet. None of these is close for an event form.

## New event / new QR code

Add a `?src=<slug>` to the URL, e.g. `…/apps/connect/?src=careerfair-2027`, and
generate a QR code for it. The slug appears in the Sheet's **Source** column.
