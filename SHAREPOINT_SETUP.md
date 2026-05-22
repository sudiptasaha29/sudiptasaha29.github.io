# Team Sharing Setup

The current dashboard can run in two modes:

- `local`: single-user mode. Editable fields are saved in that person's browser.
- `sharepoint`: team mode. Editable fields are read from and saved to one shared SharePoint List.

For team access, use `sharepoint` mode.

## 1. Create The SharePoint List

Create a SharePoint List named:

`Case Connectivity Tracker`

Keep the default `Title` column. Add the columns below with the exact names shown. Use names without spaces so SharePoint keeps the same internal names that the dashboard expects.

| Column name | Type | Notes |
|---|---|---|
| `CaseKey` | Single line of text | Unique case key used by the dashboard |
| `CaseName` | Multiple lines of text | Source column P |
| `CaseLocation` | Multiple lines of text | Source column G |
| `CaseTeamSpoc` | Multiple lines of text | Source column B |
| `CaseStartDateText` | Single line of text | Source column S |
| `CaseEndDateText` | Single line of text | Source column T |
| `CaseStartValue` | Number | Used for ongoing-case calculations |
| `CaseEndValue` | Number | Used for ongoing-case calculations |
| `CaseCode` | Single line of text | Source column AI |
| `SourceRows` | Number | Number of staffing rows grouped into the case |
| `SourceStatus` | Choice | `Latest file`, `Carried over` |
| `ITTeamSpoc` | Single line of text | Editable field |
| `CaseTeamContacted` | Choice | `Yes`, `No`, `NA` |
| `NetworkConnectivity` | Choice | `Yes`, `No`, `NA`, `In Progress` |
| `MeetingRoomEnablement` | Choice | `Yes`, `No`, `NA`, `In Progress` |
| `Remarks` | Multiple lines of text | Editable field |

Give team members read access to the dashboard files and edit access to this list.

## 2. Upload Dashboard Files

Upload these files to a document library on the same SharePoint site, ideally:

`Site Assets/Case Connectivity Dashboard/`

Files to upload:

- `index.html`
- `styles.css`
- `app.js`
- `data.js`
- `config.js`

## 3. Switch On Shared Mode

Edit `config.js` after uploading:

```js
window.STAFFING_DASHBOARD_CONFIG = {
  backend: "sharepoint",
  siteUrl: "https://YOUR-TENANT.sharepoint.com/sites/YOUR-SITE",
  listTitle: "Case Connectivity Tracker",
};
```

Then open:

`https://YOUR-TENANT.sharepoint.com/sites/YOUR-SITE/SiteAssets/Case%20Connectivity%20Dashboard/index.html`

On first load, if the list is empty, the dashboard seeds the list with the current 412 cases. After that, everyone sees and edits the same shared tracker.

## Monthly Refresh

Use **Update source file** and upload the latest monthly CSV export.

The dashboard will:

- Load the new source file.
- Match cases by `CaseCode + CaseName`.
- Preserve the editable fields for matched cases.
- Add new cases.
- Mark cases missing from the latest source as `Carried over`.
- Sync the updated tracker back to the SharePoint List.

## If SharePoint Blocks HTML

Some corporate SharePoint tenants block JavaScript in uploaded HTML files. If the page downloads instead of opening, use one of these routes:

- Ask the SharePoint admin to allow this site/library to serve the dashboard.
- Host these files in an approved internal web hosting location and keep the SharePoint List as the backend.
- Convert the same data model into Power BI with a SharePoint List/Excel source, using Power Apps only if team members need in-report editing.
