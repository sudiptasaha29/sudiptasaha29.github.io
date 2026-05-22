# Case Connectivity Dashboard - PowerBI Style HTML Package

Open `index.html` in a browser to run the dashboard.

## Included files

- `index.html` - PowerBI-style dashboard page.
- `styles.css` - dashboard theme and layout.
- `app.js` - filtering, editable fields, monthly upload, export, and backup logic.
- `data.js` - dummy case data only.
- `dummy-staffing-source.csv` - dummy source export in the expected column layout.
- `config.js` - local or SharePoint backend settings.
- `SHAREPOINT_SETUP.md` - optional shared-team setup notes.

## Editable fields

The dashboard keeps these fields editable:

- IT Team SPOC: free text
- Case Team Contacted: Yes / No / NA
- Network Connectivity: Yes / No / NA / In Progress
- Meeting Room Enablement: Yes / No / NA / In Progress
- Remarks: free text

Edits are saved in the browser automatically in local mode. Use `Export Backup` if you want to move the tracker state to another browser.

## Monthly source update

Use `Update Source` to upload a fresh CSV export. The parser expects the same source layout:

- Column B: Case Team SPOC
- Column G: Case Location
- Column P: Case Name
- Column S: Case Start Date
- Column T: Case End Date
- Column AI: Case Code

When a fresh CSV is uploaded, the dashboard matches existing cases by Case Code + Case Name and preserves the editable fields wherever the case still exists.

## Team sharing

By default, `config.js` uses local browser storage. For shared team editing, host the files in SharePoint and configure the optional SharePoint List backend in `config.js`. The setup outline is in `SHAREPOINT_SETUP.md`.
