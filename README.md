# EXORDIUM — Indonesian Pokémon Card Checklist

GitHub-ready frontend + Google Apps Script backend for a multi-user Indonesian Pokémon TCG collection checklist.

## Visual direction

The UI is intentionally styled around the supplied EXORDIUM reference:
- near-black / deep green background
- emerald green accent
- left navigation sidebar
- top global search
- collection intelligence cards
- featured latest-series area
- dense premium card grid
- dark glass/metal panel treatment
- responsive mobile layout

## Google Sheet structure

Create one Google Sheet.

### `Users`
`Username | Name | Email | Phone | Password Hash | Role | Created At`

### `Owned`
`Username | Set Name | Card ID | Owned | Updated At`

### Each series gets its own tab

Oldest series must be the first tab.
Newest/latest series must be the last tab.

Headers:
`ID | Card Name | Set Code | Total Set Number | Rarity | Image URL`

The web app uses the **actual number of card rows entered in the series tab** for completion percentage. `Total Set Number` is display/reference data only.

Owned status is stored in the `Owned` tab because ownership is user-specific.

## Authentication

Login accepts:
- username
- email
- phone number

Pressing Enter in the password field submits the login form.

Password hashing:
`HMAC-SHA256(password, "EXOEXO")`

Requested default admin:
- username: `admin`
- password: `12345678`

Admin can list users, reset passwords, and delete users.

Change the default admin password before a public launch.

## Deploy

1. Create Google Sheet.
2. Extensions → Apps Script.
3. Paste `Code.gs`.
4. Deploy → New deployment → Web app.
5. Execute as the spreadsheet owner.
6. Copy the Web App URL.
7. Open `app.js` and replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`.
8. Commit the project to GitHub.
9. Enable GitHub Pages.

## GitHub

The repository can be hosted as a static GitHub Pages site. Google Apps Script acts as the API/database bridge.

For production, consider replacing the requested demo secret `EXOEXO` with a stronger secret and changing the default admin password.
