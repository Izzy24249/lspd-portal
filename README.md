# LSPD Forms Portal

Forms portal for the LSPD on our FiveM server. Officers fill out a form on the website, and it posts an official record to Discord.

| Folder | What it is | Where it runs |
|---|---|---|
| `site/` | The website (`index.html`) | InfinityFree, auto-deployed by GitHub Actions on every push to `main` |
| `apps-script/` | Backend (`WebApp.gs`) that logs to Google Sheets and posts to Discord | Google Apps Script (copy-paste, see below) |

## Forms
- **Academy Evaluation** – FTO checklist, posts to the academy forum and updates the monthly leaderboard.
- **CID Report Builder** – detective case file, posts to the CID forum and logs to the `CID Archive` tab.

## Updating the website
Edit `site/index.html`, commit, push to `main`. The **Deploy to InfinityFree** action uploads it to `htdocs` within a minute or two. Check progress in the repo's **Actions** tab.

Needs three repository secrets (Settings → Secrets and variables → Actions): `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, all from InfinityFree's control panel → **FTP Details**.

## Updating the backend
GitHub does not deploy Apps Script. After changing `apps-script/WebApp.gs`:
1. Open the Google Sheet → **Extensions → Apps Script**, paste the file contents over `WebApp.gs`, save.
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.** The URL stays the same.

Discord webhook URLs are **not** in this repo. They live in Apps Script → **Project Settings → Script Properties**:

| Property | Value |
|---|---|
| `FORUM_WEBHOOK_URL` | Academy forum webhook |
| `LEADERBOARD_WEBHOOK_URL` | Leaderboard channel webhook |
| `CID_WEBHOOK_URL` | CID forum webhook |

Never commit a webhook URL. Anyone who has one can post as the webhook.
