const STORAGE_KEY = "case-connectivity-powerbi-dummy-state-v1";
const CONFIG = window.STAFFING_DASHBOARD_CONFIG ?? {};
const TEAM_BACKEND_ENABLED =
  CONFIG.backend === "sharepoint" && Boolean(CONFIG.siteUrl) && Boolean(CONFIG.listTitle);
const SAVE_DELAY_MS = 700;
const CONTACT_OPTIONS = ["Yes", "No", "NA"];
const PROGRESS_OPTIONS = ["Yes", "No", "NA", "In Progress"];
const DEFAULT_EDITABLE = {
  itTeamSpoc: "",
  caseTeamContacted: "NA",
  networkConnectivity: "NA",
  meetingRoomEnablement: "NA",
  remarks: "",
};
const COLUMN_MAP = {
  caseTeamSpoc: 1,
  caseLocation: 6,
  caseName: 15,
  caseStartDate: 18,
  caseEndDate: 19,
  caseCode: 34,
};
const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};
const SHAREPOINT_FIELDS = [
  "Id",
  "Title",
  "CaseKey",
  "CaseName",
  "CaseLocation",
  "CaseTeamSpoc",
  "CaseStartDateText",
  "CaseEndDateText",
  "CaseStartValue",
  "CaseEndValue",
  "CaseCode",
  "SourceRows",
  "SourceStatus",
  "ITTeamSpoc",
  "CaseTeamContacted",
  "NetworkConnectivity",
  "MeetingRoomEnablement",
  "Remarks",
];

const els = {
  sourceName: document.querySelector("#sourceName"),
  sourceMeta: document.querySelector("#sourceMeta"),
  ongoingCount: document.querySelector("#ongoingCount"),
  ongoingCaption: document.querySelector("#ongoingCaption"),
  contactedCount: document.querySelector("#contactedCount"),
  networkDoneCount: document.querySelector("#networkDoneCount"),
  meetingDoneCount: document.querySelector("#meetingDoneCount"),
  contactedStrip: document.querySelector("#contactedStrip"),
  networkStrip: document.querySelector("#networkStrip"),
  meetingStrip: document.querySelector("#meetingStrip"),
  locationChart: document.querySelector("#locationChart"),
  statusMatrix: document.querySelector("#statusMatrix"),
  timelineList: document.querySelector("#timelineList"),
  searchInput: document.querySelector("#searchInput"),
  locationFilter: document.querySelector("#locationFilter"),
  contactFilter: document.querySelector("#contactFilter"),
  networkFilter: document.querySelector("#networkFilter"),
  meetingFilter: document.querySelector("#meetingFilter"),
  sourceFilter: document.querySelector("#sourceFilter"),
  ongoingOnly: document.querySelector("#ongoingOnly"),
  visibleCount: document.querySelector("#visibleCount"),
  tableBody: document.querySelector("#caseTableBody"),
  sourceUpload: document.querySelector("#sourceUpload"),
  backupUpload: document.querySelector("#backupUpload"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportStateButton: document.querySelector("#exportStateButton"),
  resetButton: document.querySelector("#resetButton"),
  toast: document.querySelector("#toast"),
};

let state = createInitialState();
let saveTimers = new Map();
let sharePointDigest = "";
let sharePointDigestExpiresAt = 0;

function clean(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseBlank(value) {
  const cleaned = clean(value);
  return cleaned && cleaned !== "-" ? cleaned : "";
}

function isRealCaseName(value) {
  const cleaned = normaliseBlank(value);
  return Boolean(cleaned) && cleaned.toUpperCase() !== "NA";
}

function stableKey(code, name) {
  const codePart = normaliseBlank(code).toLowerCase();
  const namePart = normaliseBlank(name).toLowerCase();
  return `${codePart || "no-code"}::${namePart}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      if (next === "\n") continue;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => clean(cell)));
}

function parseDateValue(raw) {
  const value = clean(raw);
  if (!value || value === "-") return null;

  const dmy = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = MONTHS[dmy[2].toLowerCase()];
    const yearRaw = Number(dmy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (month !== undefined) return Date.UTC(year, month, day);
  }

  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return Date.UTC(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]));
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function uniqueList(values) {
  return [...new Set(values.map(normaliseBlank).filter(Boolean))];
}

function locationTokens(value) {
  return String(value ?? "")
    .split(/\s*\/\s*/)
    .map(normaliseBlank)
    .filter(Boolean);
}

function getLocationOptions(cases = state.cases) {
  return [...new Set(cases.flatMap((caseItem) => locationTokens(caseItem.caseLocation)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function buildCasesFromRows(rows) {
  if (!rows.length) return [];
  const groups = new Map();

  rows.slice(1).forEach((row) => {
    const caseName = normaliseBlank(row[COLUMN_MAP.caseName]);
    const caseCode = normaliseBlank(row[COLUMN_MAP.caseCode]);
    if (!isRealCaseName(caseName)) return;

    const key = stableKey(caseCode, caseName);
    const group =
      groups.get(key) ??
      {
        key,
        caseName,
        caseCode,
        locations: [],
        spocs: [],
        starts: [],
        ends: [],
        sourceRows: 0,
      };

    group.sourceRows += 1;
    group.locations.push(row[COLUMN_MAP.caseLocation]);
    group.spocs.push(row[COLUMN_MAP.caseTeamSpoc]);

    const start = parseDateValue(row[COLUMN_MAP.caseStartDate]);
    const end = parseDateValue(row[COLUMN_MAP.caseEndDate]);
    if (start) group.starts.push(start);
    if (end) group.ends.push(end);

    groups.set(key, group);
  });

  return [...groups.values()]
    .map((group) => {
      const start = group.starts.length ? Math.min(...group.starts) : null;
      const end = group.ends.length ? Math.max(...group.ends) : null;
      return {
        key: group.key,
        caseName: group.caseName || "Unnamed case",
        caseLocation: uniqueList(group.locations).join(" / "),
        caseTeamSpoc: uniqueList(group.spocs).join(" / "),
        caseStartDate: formatDate(start),
        caseEndDate: formatDate(end),
        caseStartValue: start,
        caseEndValue: end,
        caseCode: group.caseCode || "No code",
        sourceRows: group.sourceRows,
        sourceStatus: "Latest file",
        editable: { ...DEFAULT_EDITABLE },
      };
    })
    .sort(sortCases);
}

function sortCases(a, b) {
  if ((a.caseStartValue ?? 0) !== (b.caseStartValue ?? 0)) {
    return (a.caseStartValue ?? 0) - (b.caseStartValue ?? 0);
  }
  return a.caseName.localeCompare(b.caseName);
}

function createInitialState() {
  const initial = window.STAFFING_DASHBOARD_INITIAL_DATA;
  return {
    cases: initial?.cases ?? [],
    meta: {
      sourceName: initial?.sourceName ?? "Initial source",
      sourceRows: initial?.sourceRows ?? 0,
      uploadedAt: initial?.generatedAt ?? new Date().toISOString(),
      carriedOver: 0,
      backend: TEAM_BACKEND_ENABLED ? "sharepoint" : "local",
    },
  };
}

function loadLocalState() {
  const fallback = createInitialState();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.cases?.length) return fallback;
    return {
      ...saved,
      cases: saved.cases.map((item) => ({
        ...item,
        editable: { ...DEFAULT_EDITABLE, ...(item.editable ?? {}) },
      })),
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  if (TEAM_BACKEND_ENABLED) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function sharePointBaseUrl() {
  return String(CONFIG.siteUrl ?? "").replace(/\/$/, "");
}

function sharePointListTitle() {
  return String(CONFIG.listTitle ?? "").replaceAll("'", "''");
}

function sharePointItemsUrl(query = "") {
  return `${sharePointBaseUrl()}/_api/web/lists/getbytitle('${sharePointListTitle()}')/items${query}`;
}

async function readSharePointJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json;odata=nometadata",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return {};
  return response.json();
}

async function getSharePointDigest() {
  const now = Date.now();
  if (sharePointDigest && now < sharePointDigestExpiresAt) return sharePointDigest;

  const data = await readSharePointJson(`${sharePointBaseUrl()}/_api/contextinfo`, {
    method: "POST",
  });
  sharePointDigest = data.FormDigestValue;
  sharePointDigestExpiresAt = now + Math.max(60, Number(data.FormDigestTimeoutSeconds ?? 1800) - 60) * 1000;
  return sharePointDigest;
}

function sharePointItemToCase(item) {
  return {
    key: item.CaseKey,
    caseName: item.CaseName || item.Title || "Unnamed case",
    caseLocation: item.CaseLocation || "",
    caseTeamSpoc: item.CaseTeamSpoc || "",
    caseStartDate: item.CaseStartDateText || "",
    caseEndDate: item.CaseEndDateText || "",
    caseStartValue: Number(item.CaseStartValue) || parseDateValue(item.CaseStartDateText),
    caseEndValue: Number(item.CaseEndValue) || parseDateValue(item.CaseEndDateText),
    caseCode: item.CaseCode || "No code",
    sourceRows: Number(item.SourceRows) || 0,
    sourceStatus: item.SourceStatus || "Latest file",
    sharePointId: item.Id,
    editable: {
      ...DEFAULT_EDITABLE,
      itTeamSpoc: item.ITTeamSpoc || "",
      caseTeamContacted: item.CaseTeamContacted || "NA",
      networkConnectivity: item.NetworkConnectivity || "NA",
      meetingRoomEnablement: item.MeetingRoomEnablement || "NA",
      remarks: item.Remarks || "",
    },
  };
}

function caseToSharePointPayload(caseItem) {
  return {
    Title: String(caseItem.caseName ?? "").slice(0, 255),
    CaseKey: caseItem.key,
    CaseName: caseItem.caseName,
    CaseLocation: caseItem.caseLocation,
    CaseTeamSpoc: caseItem.caseTeamSpoc,
    CaseStartDateText: caseItem.caseStartDate,
    CaseEndDateText: caseItem.caseEndDate,
    CaseStartValue: Number(caseItem.caseStartValue) || null,
    CaseEndValue: Number(caseItem.caseEndValue) || null,
    CaseCode: caseItem.caseCode,
    SourceRows: Number(caseItem.sourceRows) || 0,
    SourceStatus: caseItem.sourceStatus,
    ITTeamSpoc: caseItem.editable.itTeamSpoc,
    CaseTeamContacted: caseItem.editable.caseTeamContacted,
    NetworkConnectivity: caseItem.editable.networkConnectivity,
    MeetingRoomEnablement: caseItem.editable.meetingRoomEnablement,
    Remarks: caseItem.editable.remarks,
  };
}

async function fetchSharePointCases() {
  const select = `?$top=5000&$select=${SHAREPOINT_FIELDS.join(",")}`;
  let url = sharePointItemsUrl(select);
  const items = [];

  while (url) {
    const data = await readSharePointJson(url);
    items.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? "";
  }

  return items.map(sharePointItemToCase).sort(sortCases);
}

async function createSharePointCase(caseItem) {
  const digest = await getSharePointDigest();
  const data = await readSharePointJson(sharePointItemsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;odata=nometadata",
      "X-RequestDigest": digest,
    },
    body: JSON.stringify(caseToSharePointPayload(caseItem)),
  });
  caseItem.sharePointId = data.Id;
}

async function updateSharePointCase(caseItem) {
  if (!caseItem.sharePointId) {
    await createSharePointCase(caseItem);
    return;
  }

  const digest = await getSharePointDigest();
  await readSharePointJson(sharePointItemsUrl(`(${caseItem.sharePointId})`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json;odata=nometadata",
      "X-RequestDigest": digest,
      "X-HTTP-Method": "MERGE",
      "IF-MATCH": "*",
    },
    body: JSON.stringify(caseToSharePointPayload(caseItem)),
  });
}

async function syncSharePointCases(cases) {
  for (const caseItem of cases) {
    await updateSharePointCase(caseItem);
  }
}

function scheduleCaseSave(caseItem, immediate = false) {
  if (!TEAM_BACKEND_ENABLED) {
    saveState();
    return;
  }

  window.clearTimeout(saveTimers.get(caseItem.key));
  const run = async () => {
    saveTimers.delete(caseItem.key);
    try {
      await updateSharePointCase(caseItem);
    } catch (error) {
      showToast(`Shared save failed: ${error.message}`);
    }
  };

  if (immediate) {
    run();
  } else {
    saveTimers.set(caseItem.key, window.setTimeout(run, SAVE_DELAY_MS));
  }
}

async function mergeIncomingCases(incomingCases, sourceName, sourceRows) {
  const now = new Date().toISOString();
  const previousByKey = new Map(state.cases.map((caseItem) => [caseItem.key, caseItem]));
  const next = incomingCases.map((incoming) => {
    const previous = previousByKey.get(incoming.key);
    previousByKey.delete(incoming.key);
    return {
      ...incoming,
      editable: { ...DEFAULT_EDITABLE, ...(previous?.editable ?? {}) },
      firstSeenAt: previous?.firstSeenAt ?? now,
      lastSeenAt: now,
      sourceStatus: "Latest file",
      sharePointId: previous?.sharePointId,
    };
  });

  previousByKey.forEach((previous) => {
    next.push({
      ...previous,
      sourceStatus: "Carried over",
      editable: { ...DEFAULT_EDITABLE, ...(previous.editable ?? {}) },
    });
  });

  state = {
    cases: next.sort(sortCases),
    meta: {
      sourceName,
      sourceRows,
      uploadedAt: now,
      carriedOver: previousByKey.size,
      backend: TEAM_BACKEND_ENABLED ? "sharepoint" : "local",
    },
  };
  render();
  if (TEAM_BACKEND_ENABLED) {
    showToast("Monthly file loaded. Syncing shared tracker data to SharePoint...");
    await syncSharePointCases(state.cases);
    showToast(`${sourceName} loaded and synced. Existing editable fields were preserved.`);
  } else {
    saveState();
  }
  render();
}

function isOngoing(caseItem) {
  if (!caseItem.caseStartValue || !caseItem.caseEndValue) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return caseItem.caseStartValue <= todayUtc && todayUtc <= caseItem.caseEndValue;
}

function statusCounts(cases, field, options) {
  return options.reduce((counts, option) => {
    counts[option] = cases.filter((item) => item.editable[field] === option).length;
    return counts;
  }, {});
}

function renderStatusStrip(target, counts, options) {
  const total = Math.max(
    1,
    options.reduce((sum, option) => sum + (counts[option] ?? 0), 0),
  );
  target.innerHTML = options
    .map((option) => {
      const count = counts[option] ?? 0;
      const percent = Math.round((count / total) * 100);
      const className =
        option === "Yes" ? "yes" : option === "No" ? "no" : option === "NA" ? "na" : "progress";
      return `
        <div class="status-row">
          <span>${option}</span>
          <div class="bar-track"><div class="bar-fill ${className}" style="width:${percent}%"></div></div>
          <strong>${count}</strong>
        </div>
      `;
    })
    .join("");
}

function filteredCases() {
  const query = els.searchInput.value.trim().toLowerCase();
  const location = els.locationFilter.value;
  const contact = els.contactFilter.value;
  const network = els.networkFilter.value;
  const meeting = els.meetingFilter.value;
  const source = els.sourceFilter.value;

  return state.cases.filter((caseItem) => {
    const searchText = [
      caseItem.caseName,
      caseItem.caseLocation,
      caseItem.caseTeamSpoc,
      caseItem.caseCode,
      caseItem.editable.itTeamSpoc,
      caseItem.editable.remarks,
    ]
      .join(" ")
      .toLowerCase();

    if (query && !searchText.includes(query)) return false;
    if (location !== "all" && !locationTokens(caseItem.caseLocation).includes(location)) return false;
    if (contact !== "all" && caseItem.editable.caseTeamContacted !== contact) return false;
    if (network !== "all" && caseItem.editable.networkConnectivity !== network) return false;
    if (meeting !== "all" && caseItem.editable.meetingRoomEnablement !== meeting) return false;
    if (source !== "all" && caseItem.sourceStatus !== source) return false;
    if (els.ongoingOnly.checked && !isOngoing(caseItem)) return false;
    return true;
  });
}

function optionMarkup(options, selected) {
  return options
    .map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${option}</option>`)
    .join("");
}

function render() {
  const allCases = state.cases;
  renderLocationFilterOptions();
  const visible = filteredCases();
  const uploadedAt = state.meta?.uploadedAt ? new Date(state.meta.uploadedAt) : null;
  const sourceRows = state.meta?.sourceRows ?? 0;
  const carriedOver = state.meta?.carriedOver ?? allCases.filter((item) => item.sourceStatus === "Carried over").length;
  const backendLabel = TEAM_BACKEND_ENABLED ? "Shared SharePoint mode" : "Local browser mode";

  els.sourceName.textContent = state.meta?.sourceName ?? "Source file";
  els.sourceMeta.textContent = `${sourceRows.toLocaleString()} source rows grouped into ${allCases.length.toLocaleString()} cases${
    carriedOver ? `, including ${carriedOver.toLocaleString()} carried over from the prior tracker` : ""
  }${uploadedAt ? ` · Updated ${uploadedAt.toLocaleString()}` : ""} · ${backendLabel}`;

  const ongoing = visible.filter(isOngoing).length;
  els.ongoingCount.textContent = ongoing.toLocaleString();
  els.ongoingCaption.textContent = `${visible.length.toLocaleString()} of ${allCases.length.toLocaleString()} cases in filter context`;

  const contacted = statusCounts(visible, "caseTeamContacted", CONTACT_OPTIONS);
  const network = statusCounts(visible, "networkConnectivity", PROGRESS_OPTIONS);
  const meeting = statusCounts(visible, "meetingRoomEnablement", PROGRESS_OPTIONS);

  els.contactedCount.textContent = (contacted.Yes ?? 0).toLocaleString();
  els.networkDoneCount.textContent = (network.Yes ?? 0).toLocaleString();
  els.meetingDoneCount.textContent = (meeting.Yes ?? 0).toLocaleString();
  renderStatusStrip(els.contactedStrip, contacted, CONTACT_OPTIONS);
  renderStatusStrip(els.networkStrip, network, PROGRESS_OPTIONS);
  renderStatusStrip(els.meetingStrip, meeting, PROGRESS_OPTIONS);
  renderPowerBiVisuals(visible, { contacted, network, meeting });

  els.visibleCount.textContent = `${visible.length.toLocaleString()} cases shown`;
  renderTable(visible);
}

function renderPowerBiVisuals(cases, counts) {
  renderLocationChart(cases);
  renderStatusMatrix(counts);
  renderTimelineList(cases);
}

function renderLocationChart(cases) {
  if (!els.locationChart) return;
  const locationCounts = new Map();
  cases.forEach((caseItem) => {
    const locations = locationTokens(caseItem.caseLocation);
    (locations.length ? locations : ["Unassigned"]).forEach((location) => {
      locationCounts.set(location, (locationCounts.get(location) ?? 0) + 1);
    });
  });

  const rows = [...locationCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  els.locationChart.innerHTML = rows.length
    ? rows
        .map(([location, count]) => {
          const width = Math.max(4, Math.round((count / max) * 100));
          return `
            <div class="location-bar">
              <span class="location-name" title="${escapeAttribute(location)}">${escapeHtml(location)}</span>
              <div class="location-track"><div class="location-fill" style="width:${width}%"></div></div>
              <strong>${count}</strong>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">No locations in the current filter.</div>`;
}

function renderStatusMatrix(counts) {
  if (!els.statusMatrix) return;
  const rows = ["Yes", "No", "NA", "In Progress"];
  const fieldConfigs = [
    ["Contacted", counts.contacted],
    ["Network", counts.network],
    ["Meeting", counts.meeting],
  ];
  els.statusMatrix.innerHTML = [
    `<div class="status-matrix-row header"><span>Status</span><span>Contacted</span><span>Network</span><span>Meeting</span></div>`,
    ...rows.map((status) => {
      const className = status === "Yes" ? "yes" : status === "No" ? "no" : status === "NA" ? "na" : "progress";
      return `
        <div class="status-matrix-row">
          <strong>${status}</strong>
          ${fieldConfigs
            .map(([, fieldCounts]) => `<span class="status-dot ${className}">${fieldCounts?.[status] ?? 0}</span>`)
            .join("")}
        </div>
      `;
    }),
  ].join("");
}

function renderTimelineList(cases) {
  if (!els.timelineList) return;
  const upcoming = cases
    .filter((caseItem) => caseItem.caseEndValue)
    .sort((a, b) => a.caseEndValue - b.caseEndValue)
    .slice(0, 7);

  els.timelineList.innerHTML = upcoming.length
    ? upcoming
        .map((caseItem) => {
          const days = daysUntil(caseItem.caseEndValue);
          const badge = days < 0 ? `${Math.abs(days)}d late` : `${days}d`;
          return `
            <div class="timeline-item">
              <div>
                <strong title="${escapeAttribute(caseItem.caseName)}">${escapeHtml(caseItem.caseName)}</strong>
                <span>${escapeHtml(caseItem.caseLocation)} · Ends ${escapeHtml(caseItem.caseEndDate)}</span>
              </div>
              <div class="timeline-badge">${escapeHtml(badge)}</div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">No case end dates in the current filter.</div>`;
}

function daysUntil(timestamp) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((timestamp - todayUtc) / 86400000);
}

function renderLocationFilterOptions() {
  const selected = els.locationFilter.value || "all";
  const locations = getLocationOptions();
  els.locationFilter.innerHTML = [
    `<option value="all">All</option>`,
    ...locations.map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`),
  ].join("");
  els.locationFilter.value = locations.includes(selected) ? selected : "all";
}

function renderTable(cases) {
  if (!cases.length) {
    els.tableBody.innerHTML = `<tr><td class="empty-state" colspan="12">No cases match the current filters.</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = cases
    .map((caseItem) => {
      const carried = caseItem.sourceStatus === "Carried over";
      return `
        <tr data-key="${escapeHtml(caseItem.key)}">
          <td class="case-name-cell"><span class="text-clamp" title="${escapeHtml(caseItem.caseName)}">${escapeHtml(caseItem.caseName)}</span></td>
          <td class="wide-cell"><span class="text-clamp" title="${escapeHtml(caseItem.caseLocation)}">${escapeHtml(caseItem.caseLocation)}</span></td>
          <td class="wide-cell"><span class="text-clamp" title="${escapeHtml(caseItem.caseTeamSpoc)}">${escapeHtml(caseItem.caseTeamSpoc)}</span></td>
          <td class="date-cell">${escapeHtml(caseItem.caseStartDate)}</td>
          <td class="date-cell">${escapeHtml(caseItem.caseEndDate)}</td>
          <td class="code-cell">${escapeHtml(caseItem.caseCode)}</td>
          <td><input class="editable-input" data-field="itTeamSpoc" value="${escapeAttribute(caseItem.editable.itTeamSpoc)}" aria-label="IT Team SPOC for ${escapeAttribute(caseItem.caseName)}" /></td>
          <td><select class="editable-select" data-field="caseTeamContacted" aria-label="Case team contacted for ${escapeAttribute(caseItem.caseName)}">${optionMarkup(CONTACT_OPTIONS, caseItem.editable.caseTeamContacted)}</select></td>
          <td><select class="editable-select" data-field="networkConnectivity" aria-label="Network connectivity for ${escapeAttribute(caseItem.caseName)}">${optionMarkup(PROGRESS_OPTIONS, caseItem.editable.networkConnectivity)}</select></td>
          <td><select class="editable-select" data-field="meetingRoomEnablement" aria-label="Meeting room enablement for ${escapeAttribute(caseItem.caseName)}">${optionMarkup(PROGRESS_OPTIONS, caseItem.editable.meetingRoomEnablement)}</select></td>
          <td><textarea class="remarks-input" data-field="remarks" aria-label="Remarks for ${escapeAttribute(caseItem.caseName)}">${escapeHtml(caseItem.editable.remarks)}</textarea></td>
          <td><span class="status-pill ${carried ? "carried" : "latest"}">${escapeHtml(caseItem.sourceStatus)}</span></td>
        </tr>
      `;
    })
    .join("");
}

function updateCaseField(target, immediate = false) {
  if (!target.matches("[data-field]")) return;
  const row = target.closest("tr[data-key]");
  if (!row) return;
  const key = row.dataset.key;
  const field = target.dataset.field;
  const caseItem = state.cases.find((item) => item.key === key);
  if (!caseItem || !field) return;
  caseItem.editable = { ...DEFAULT_EDITABLE, ...caseItem.editable, [field]: target.value };
  scheduleCaseSave(caseItem, immediate);
  updateWidgetsOnly();
}

function updateWidgetsOnly() {
  const visible = filteredCases();
  const contacted = statusCounts(visible, "caseTeamContacted", CONTACT_OPTIONS);
  const network = statusCounts(visible, "networkConnectivity", PROGRESS_OPTIONS);
  const meeting = statusCounts(visible, "meetingRoomEnablement", PROGRESS_OPTIONS);
  const ongoing = visible.filter(isOngoing).length;
  els.ongoingCount.textContent = ongoing.toLocaleString();
  els.ongoingCaption.textContent = `${visible.length.toLocaleString()} of ${state.cases.length.toLocaleString()} cases in filter context`;
  els.contactedCount.textContent = (contacted.Yes ?? 0).toLocaleString();
  els.networkDoneCount.textContent = (network.Yes ?? 0).toLocaleString();
  els.meetingDoneCount.textContent = (meeting.Yes ?? 0).toLocaleString();
  renderStatusStrip(els.contactedStrip, contacted, CONTACT_OPTIONS);
  renderStatusStrip(els.networkStrip, network, PROGRESS_OPTIONS);
  renderStatusStrip(els.meetingStrip, meeting, PROGRESS_OPTIONS);
  renderPowerBiVisuals(visible, { contacted, network, meeting });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("visible"), 3600);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv(filename, cases) {
  const headers = [
    "Case Name",
    "Case Location",
    "Case Team SPOC",
    "Case Start Date",
    "Case End Date",
    "Case Code",
    "IT Team SPOC",
    "Case Team Contacted",
    "Network Connectivity",
    "Meeting Room Enablement",
    "Remarks",
    "Source Status",
    "Source Rows",
  ];
  const rows = cases.map((caseItem) => [
    caseItem.caseName,
    caseItem.caseLocation,
    caseItem.caseTeamSpoc,
    caseItem.caseStartDate,
    caseItem.caseEndDate,
    caseItem.caseCode,
    caseItem.editable.itTeamSpoc,
    caseItem.editable.caseTeamContacted,
    caseItem.editable.networkConnectivity,
    caseItem.editable.meetingRoomEnablement,
    caseItem.editable.remarks,
    caseItem.sourceStatus,
    caseItem.sourceRows,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleSourceUpload(event) {
  const [file] = event.target.files;
  if (!file) return;

  if (/\.(xlsx|xls)$/i.test(file.name)) {
    showToast("This offline dashboard reads CSV exports. Save the Excel workbook as CSV, then upload that file.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rows = parseCsv(String(reader.result ?? ""));
      const incoming = buildCasesFromRows(rows);
      if (!incoming.length) throw new Error("No case rows found");
      await mergeIncomingCases(incoming, file.name, rows.length - 1);
      if (!TEAM_BACKEND_ENABLED) {
        showToast(`${file.name} loaded. Existing tracker fields were preserved where case code and name matched.`);
      }
    } catch (error) {
      showToast(`Could not load file: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function handleBackupUpload(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(String(reader.result ?? ""));
      if (!Array.isArray(imported.cases)) throw new Error("Backup does not contain case data");
      state = {
        cases: imported.cases.map((item) => ({
          ...item,
          editable: { ...DEFAULT_EDITABLE, ...(item.editable ?? {}) },
        })),
        meta: imported.meta ?? {
          sourceName: file.name,
          sourceRows: imported.cases.length,
          uploadedAt: new Date().toISOString(),
          carriedOver: 0,
          backend: TEAM_BACKEND_ENABLED ? "sharepoint" : "local",
        },
      };
      render();
      if (TEAM_BACKEND_ENABLED) {
        showToast("Backup loaded. Syncing shared tracker data to SharePoint...");
        await syncSharePointCases(state.cases);
        showToast("Tracker backup restored and synced.");
      } else {
        saveState();
        showToast("Tracker backup restored.");
      }
    } catch (error) {
      showToast(`Could not import backup: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetToInitialData() {
  if (TEAM_BACKEND_ENABLED) {
    showToast("Shared mode uses the SharePoint List as the source of truth. Use monthly upload or backup import to update it.");
    return;
  }

  const initial = window.STAFFING_DASHBOARD_INITIAL_DATA;
  state = {
    cases: (initial?.cases ?? []).map((item) => ({
      ...item,
      editable: { ...DEFAULT_EDITABLE, ...(item.editable ?? {}) },
      sourceStatus: "Latest file",
    })),
    meta: {
      sourceName: initial?.sourceName ?? "Initial source",
      sourceRows: initial?.sourceRows ?? 0,
      uploadedAt: new Date().toISOString(),
      carriedOver: 0,
    },
  };
  saveState();
  render();
  showToast("Original source data reloaded. Manual fields were reset.");
}

["input", "change"].forEach((eventName) => {
  els.searchInput.addEventListener(eventName, render);
});

[els.locationFilter, els.contactFilter, els.networkFilter, els.meetingFilter, els.sourceFilter, els.ongoingOnly].forEach((control) => {
  control.addEventListener("change", render);
});

els.tableBody.addEventListener("input", (event) => updateCaseField(event.target, false));
els.tableBody.addEventListener("change", (event) => {
  updateCaseField(event.target, true);
  if (event.target.matches("select")) render();
});

els.sourceUpload.addEventListener("change", handleSourceUpload);
els.backupUpload.addEventListener("change", handleBackupUpload);
els.exportCsvButton.addEventListener("click", () => {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`case-connectivity-dashboard-${stamp}.csv`, state.cases);
});
els.exportStateButton.addEventListener("click", () => {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(`case-connectivity-tracker-${stamp}.json`, state);
});
els.resetButton.addEventListener("click", resetToInitialData);

async function initDashboard() {
  if (!TEAM_BACKEND_ENABLED) {
    state = loadLocalState();
    render();
    return;
  }

  els.tableBody.innerHTML = `<tr><td class="empty-state" colspan="12">Loading shared tracker data from SharePoint...</td></tr>`;
  try {
    const cases = await fetchSharePointCases();
    if (cases.length) {
      state = {
        cases,
        meta: {
          sourceName: CONFIG.listTitle,
          sourceRows: cases.reduce((sum, item) => sum + (Number(item.sourceRows) || 0), 0),
          uploadedAt: new Date().toISOString(),
          carriedOver: cases.filter((item) => item.sourceStatus === "Carried over").length,
          backend: "sharepoint",
        },
      };
      render();
      showToast("Shared tracker data loaded from SharePoint.");
      return;
    }

    state = createInitialState();
    state.meta.sourceName = CONFIG.listTitle;
    state.meta.backend = "sharepoint";
    render();
    showToast("SharePoint List is empty. Seeding it with the initial dashboard cases...");
    await syncSharePointCases(state.cases);
    showToast("Initial cases synced to SharePoint.");
  } catch (error) {
    state = loadLocalState();
    render();
    showToast(`SharePoint mode failed, showing local data instead: ${error.message}`);
  }
}

initDashboard();
