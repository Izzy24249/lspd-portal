# LSPD Forms Portal

Forms portal for the LSPD on our FiveM server. Officers fill out a form on the website and it posts an official record to Discord. Admins build and change forms in a browser at `/admin.html`.

| Path | What it is | Where it runs |
|---|---|---|
| `site/index.html` | Public portal (home page + every form) | InfinityFree, auto-deployed on push to `main` |
| `site/admin.html` | Manage portal (login required) | InfinityFree |
| `site/forms.js` | Shared form renderer + the Apps Script `ENDPOINT` URL | InfinityFree |
| `site/portal.css` | Shared styles, including the CID Dossier theme | InfinityFree |
| `apps-script/WebApp.gs` | Backend: stores forms, checks admin logins, posts to Discord, logs to the Sheet | Google Apps Script (paste by hand) |

## Admin portal (`/admin.html`)
- **Forms:** create, edit, reorder, duplicate, hide or delete forms. A live preview shows exactly what officers will see. Block types: title banner, field rows, header strips, text/rule lines, checklists, repeating lists (add rows), big text boxes. Each form also has its look (Classic sheet or CID Dossier, with an optional watermark logo), webhook, forum thread name, embed title and colour, forum tag rules, and an optional monthly leaderboard.
- **Webhooks:** add, rename, replace, check, send a test message, or delete. URLs are stored in Script Properties and never sent to the website.
- **Portal settings:** name and branding, a home-page announcement, and maintenance mode (blocks all submissions).
- **Admins** (owners only): add admins, reset passwords, change roles, remove access instantly.
- **Activity log:** every login and change, also kept in the "Admin Log" tab of the Sheet.
- **My account:** change your password.

The **first owner account** is created from the Google Sheet: menu **🚔 LSPD Portal → Create / reset admin account**. The same menu resets a forgotten password.

## Updating the website
Commit to `main` and the **Deploy to InfinityFree** action uploads `site/` to `htdocs`. Needs repo secrets `FTP_SERVER`, `FTP_USERNAME` and `FTP_PASSWORD`, from InfinityFree → FTP Details.

## Updating the backend
GitHub does not deploy Apps Script. After changing `apps-script/WebApp.gs`:
1. Google Sheet → **Extensions → Apps Script**: delete the old code, paste the whole file, save.
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.** The URL stays the same.

## Where data lives (Google Sheet tabs)
| Tab | Contents |
|---|---|
| `Portal Config` (hidden) | All forms and settings. Edit them through admin.html, not by hand. |
| `Portal Admins` (hidden) | Admin usernames, roles and salted password hashes |
| `Admin Log` | Audit trail |
| `Leaderboard Log` | One row per submission that counts toward a leaderboard |
| One tab per form (e.g. `Academy Records`, `CID Records`) | Submissions. Columns follow the form's field IDs. |

Old tabs (`Archive`, `CID Archive`) are left untouched as history. The old `Archive` rows were imported into `Leaderboard Log`, so this month's FTO counts carry over.

Never commit a webhook URL.
