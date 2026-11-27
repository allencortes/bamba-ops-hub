// OPS Hub v2 — Step 4 (Per-User Filters, Date Range From/To, Editable Operations_Stage, Dual Pax Phones & Operation Service Schedules)
const DEFAULT_START_DATE = "2026-11-01";
const CHECKLIST_NOTE_TITLE = "[OPS_CHECKLIST]";
const MANAGEMENT_PROFILES = ["administrator", "management"];
const MANAGEMENT_ROLES = ["manager", "management", "ceo", "director"];
const MANAGEMENT_EMAILS = ["allen@bambatravel.com"];

const OPERATIONS_STAGES = [
  "Nothing is booked",
  "Working on trip bookings",
  "Booked all services",
  "Working on Booking Confirmation",
  "Booking Confirmation Sent - Missing Details",
  "Booking Confirmation Sent"
];

const STATE = {
  bookings: [],
  filteredBookings: [],
  expandedBookingId: null,
  editingDealId: null,
  passengerFormDealId: null,
  editingPassengerKey: null,
  loadServicesDealId: null,
  loadServicesMode: "TEXT",
  parsedPreviewServices: [],
  pendingChecklistItemId: null,
  editingOpRecord: null,
  operationsByDeal: {},
  opFullRecord: {},
  passengersByDeal: {},
  notesByDeal: {},
  checklistByDeal: {},
  attachmentsByDeal: {},
  dealFullRecord: {},
  openSubDrawers: {},
  crmUsers: [],
  vendors: [],
  products: [],
  currentUser: null,
  activeTab: "operations",
  booted: false
};

const BOOKS_ACCOUNTS = [
  "Brex Card Account",
  "Mercury Credit",
  "Wise Bamba Travel Inc",
  "USD PayPal Bamba Travel Inc",
  "EUR account",
  "GBP account",
  "Zoho Payments Clearing",
  "Cash"
];

function $(id) {
  return document.getElementById(id);
}

function showToast(msg, ms = 3000) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), ms);
}

window.copyText = function (e, text, label = "Text") {
  if (e) e.stopPropagation();
  if (!text || text === "N/A" || text === "-") return;
  navigator.clipboard.writeText(String(text));
  showToast(`Copied ${label}: ${text}`);
};

function fmtMoney(val) {
  const num = parseFloat(val) || 0;
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDateSafe(dateVal) {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);
    const m = (p1 > 12 ? p2 : p1) - 1;
    const d = p1 > 12 ? p1 : p2;
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toIsoDateInput(dateVal) {
  const dt = parseDateSafe(dateVal);
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateDisplay(dateVal, fallback = "-") {
  const dt = parseDateSafe(dateVal);
  if (!dt) return fallback;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// --- PER-USER FILTER PREFERENCES (localStorage) ---
function getUserFilterStorageKey() {
  const uid = STATE.currentUser?.id || STATE.currentUser?.email || "default";
  return `ops_hub_filters_${uid}`;
}

function saveUserFilterPrefs() {
  try {
    const prefs = {
      platform: $("filterPlatform")?.value || "ALL",
      owner: $("filterOwner")?.value || "ALL",
      startDateWin: $("filterStartDate")?.value || "ALL",
      sinceDate: $("filterSinceDate")?.value || DEFAULT_START_DATE,
      toDate: $("filterToDate")?.value || ""
    };
    localStorage.setItem(getUserFilterStorageKey(), JSON.stringify(prefs));
  } catch (e) {
    console.warn("Could not save filter prefs:", e);
  }
}

function loadUserFilterPrefs() {
  try {
    const raw = localStorage.getItem(getUserFilterStorageKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function applySavedFilterPrefs(prefs) {
  if (!prefs) return;
  if ($("filterPlatform") && prefs.platform) {
    if ([...$("filterPlatform").options].some((o) => o.value === prefs.platform)) {
      $("filterPlatform").value = prefs.platform;
    }
  }
  if ($("filterStartDate") && prefs.startDateWin) {
    if ([...$("filterStartDate").options].some((o) => o.value === prefs.startDateWin)) {
      $("filterStartDate").value = prefs.startDateWin;
    }
  }
  if ($("filterSinceDate") && prefs.sinceDate) {
    $("filterSinceDate").value = prefs.sinceDate;
  }
  if ($("filterToDate") && typeof prefs.toDate === "string") {
    $("filterToDate").value = prefs.toDate;
  }
}

function resetAllFilters() {
  try {
    localStorage.removeItem(getUserFilterStorageKey());
  } catch (e) {
    // ignore
  }
  if ($("filterStage")) $("filterStage").value = "Booking Won";
  if ($("filterPlatform")) $("filterPlatform").value = "ALL";
  if ($("filterOwner")) $("filterOwner").value = "ALL";
  if ($("filterStartDate")) $("filterStartDate").value = "ALL";
  if ($("filterSinceDate")) $("filterSinceDate").value = DEFAULT_START_DATE;
  if ($("filterToDate")) $("filterToDate").value = "";
  if ($("searchInput")) $("searchInput").value = "";
  loadBookings();
  showToast("Filters reset to default.");
}

function canManageOwner() {
  const user = STATE.currentUser;
  if (!user) return false;

  const email = (user.email || user.email_id || "").trim().toLowerCase();
  if (email && MANAGEMENT_EMAILS.includes(email)) return true;

  const profileName = (user.profile?.name || "").trim().toLowerCase();
  if (profileName && MANAGEMENT_PROFILES.some((p) => profileName.includes(p))) return true;

  const roleName = (user.role?.name || "").trim().toLowerCase();
  if (roleName && MANAGEMENT_ROLES.some((r) => roleName.includes(r))) return true;

  return false;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeJsAttr(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, " ");
}

function sanitizeNoteHtml(rawHtml) {
  if (!rawHtml) return "";
  try {
    const doc = new DOMParser().parseFromString(String(rawHtml), "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed").forEach((el) => el.remove());

    doc.body.querySelectorAll("*").forEach((el) => {
      const href = el.tagName === "A" ? el.getAttribute("href") : null;
      [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
      if (href && /^(https?:|mailto:|tel:)/i.test(href.trim())) {
        el.setAttribute("href", href.trim());
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });

    return doc.body.innerHTML.trim();
  } catch (e) {
    return escapeHtml(rawHtml);
  }
}

window.openDealInCrm = function (e, dealId) {
  if (e) e.stopPropagation();
  const url = `https://crm.zoho.com/crm/tab/Potentials/${dealId}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

window.downloadCrmAttachment = async function (e, dealId, attachmentId, fileName) {
  if (e) e.stopPropagation();
  try {
    if (window.ZOHO && ZOHO.CRM && ZOHO.CRM.API && typeof ZOHO.CRM.API.getFile === "function") {
      showToast(`Downloading ${fileName || "attachment"}...`);
      const fileRes = await ZOHO.CRM.API.getFile({ id: attachmentId });
      if (fileRes instanceof Blob) {
        const blobUrl = URL.createObjectURL(fileRes);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName || "attachment";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return;
      }
    }
  } catch (err) {
    console.warn("Direct file download fallback to CRM tab:", err);
  }
  showToast("Opening Booking in Zoho CRM to view/download attachment...");
  window.openDealInCrm(null, dealId);
};

function getPlatformBadgeHtml(platform) {
  const p = (platform || "N/A").trim();
  const lower = p.toLowerCase();
  let cls = "plat-other";
  if (lower.includes("bamba")) cls = "plat-bamba";
  else if (lower.includes("bedmc") || lower.includes("dmc")) cls = "plat-bedmc";
  else if (lower.includes("baboo")) cls = "plat-baboo";
  return `<span class="plat-badge ${cls}">${escapeHtml(p)}</span>`;
}

function getOpsStageClass(stage) {
  const s = (stage || "").trim();
  if (!s || s === "Nothing is booked") return "stage-danger";
  if (s === "Booking Confirmation Sent") return "stage-ok";
  if (s === "Booked all services" || s === "Working on Booking Confirmation") return "stage-info";
  return "stage-warn";
}

function parseCleanProductDetails(rawText) {
  if (!rawText) return { title: "No service details", meta: "", items: [] };

  const lines = String(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanedItems = [];
  lines.forEach((line) => {
    let clean = line.replace(/^\[[^\]]*\]\s*/, "");
    let paxInfo = "";
    const paxMatch = clean.match(/\|\s*[a-f0-9]{15,}:\s*(\d+\s*PAX)/i);
    if (paxMatch) {
      paxInfo = paxMatch[1].toUpperCase();
    }
    clean = clean.replace(/\s*\|\s*[a-f0-9]{15,}:.*$/i, "");
    clean = clean.replace(/\bnull\b/gi, "").replace(/\s{2,}/g, " ").trim();

    const parts = clean
      .split(/\s+•\s+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      parts.forEach((part) => cleanedItems.push({ name: part, pax: paxInfo }));
    } else {
      cleanedItems.push({ name: clean || "Service", pax: paxInfo });
    }
  });

  const titles = cleanedItems.map((i) => i.name).join(" • ");
  const paxList = [...new Set(cleanedItems.map((i) => i.pax).filter(Boolean))].join(", ");
  return { title: titles, meta: paxList, items: cleanedItems };
}

function renderOperationServicesCell(op) {
  const fullOp = STATE.opFullRecord[op.id];
  if (fullOp && Array.isArray(fullOp.Product_Details) && fullOp.Product_Details.length > 0) {
    const linesHtml = fullOp.Product_Details.map((row) => {
      const prodName = row.Product_Name?.name || row.Product_Name || "Service";
      const startDt = row.Trip_Start_Date ? fmtDateDisplay(row.Trip_Start_Date) : "";
      const startTime = (row.Start_Time || "").trim();
      const qty = row.Qty ? `${row.Qty} PAX` : "";
      const timeBadge = startTime
        ? `<span class="time-pill">🕒 ${escapeHtml(startTime)}</span>`
        : `<span class="time-pill pending">Time TBD</span>`;

      return `
        <div class="service-line-item">
          ${startDt ? `<span class="badge">${escapeHtml(startDt)}</span>` : ""}
          <strong>${escapeHtml(prodName)}</strong>
          ${timeBadge}
          ${qty ? `<span class="subtitle">(${escapeHtml(qty)})</span>` : ""}
        </div>
      `;
    }).join("");

    const notesHtml = fullOp.Details_of_Product
      ? `<div class="product-clean-sub" style="margin-top:4px;">📝 ${escapeHtml(fullOp.Details_of_Product)}</div>`
      : "";

    return `<div class="service-line-list">${linesHtml}</div>${notesHtml}`;
  }

  const cleanProd = parseCleanProductDetails(op.Product_Deatails);
  const itemsHtml = cleanProd.items.length
    ? `<div class="service-line-list">
        ${cleanProd.items.map((it) => `
          <div class="service-line-item">
            <strong>${escapeHtml(it.name)}</strong>
            ${it.pax ? `<span class="subtitle">(${escapeHtml(it.pax)})</span>` : ""}
          </div>
        `).join("")}
      </div>`
    : `<div class="product-clean-title">${escapeHtml(cleanProd.title)}</div>`;

  const notesHtml = op.Details_of_Product
    ? `<div class="product-clean-sub" style="margin-top:4px;">📝 ${escapeHtml(op.Details_of_Product)}</div>`
    : "";

  return `${itemsHtml}${notesHtml}`;
}

function computeOperationsProgress(ops) {
  if (!Array.isArray(ops) || !ops.length) {
    return {
      opsCount: 0,
      activeOpsCount: 0,
      totalServices: 0,
      confirmedServices: 0,
      paidServices: 0,
      cancelledServices: 0,
      percent: 0
    };
  }

  let activeOpsCount = 0;
  let totalServices = 0;
  let confirmedServices = 0;
  let paidServices = 0;
  let cancelledServices = 0;
  let weightedPoints = 0;

  ops.forEach((op) => {
    const fullOp = STATE.opFullRecord[op.id];
    const parsed = parseCleanProductDetails(op.Product_Deatails);
    const serviceCount = fullOp && Array.isArray(fullOp.Product_Details) && fullOp.Product_Details.length
      ? fullOp.Product_Details.length
      : Math.max(1, parsed.items.length || 1);
    const status = (op.Bill_Status || "").trim();
    const payStatus = (op.Payment_Status || "").trim();

    if (status === "Cancelled") {
      cancelledServices += serviceCount;
      return;
    }

    activeOpsCount++;
    totalServices += serviceCount;

    const isConfirmed =
      status === "Supplier Confirmed" ||
      status === "Traveler Confirmation Sent" ||
      status === "Trip Ended";
    const isPaid = payStatus === "Paid";

    if (isConfirmed) {
      confirmedServices += serviceCount;
      if (isPaid) {
        paidServices += serviceCount;
        weightedPoints += serviceCount * 1.0;
      } else {
        weightedPoints += serviceCount * 0.5;
      }
    }
  });

  const percent = totalServices > 0 ? Math.round((weightedPoints / totalServices) * 100) : 0;

  return {
    opsCount: ops.length,
    activeOpsCount,
    totalServices,
    confirmedServices,
    paidServices,
    cancelledServices,
    percent
  };
}

// --- SERVICE CHECKLIST SERIALIZATION (Stored in [OPS_CHECKLIST] CRM Note) ---
function serializeChecklistNote(items) {
  const header = "OPS Service Checklist (Managed by OPS Hub v2):";
  const lines = items.map((item) => {
    const mark = item.done ? "[x]" : "[ ]";
    const datePart = item.date ? `${item.date} | ` : "";
    const notePart = item.note ? ` — Note: ${item.note}` : "";
    return `${mark} ${datePart}${item.service}${notePart}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

function parseChecklistNoteContent(rawContent) {
  if (!rawContent) return [];
  const tmp = document.createElement("div");
  tmp.innerHTML = String(rawContent).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n");
  const plain = tmp.textContent || tmp.innerText || "";

  const lines = plain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^\[(x| )\]/i.test(l));

  return lines.map((line, idx) => {
    const done = /^\[x\]/i.test(line);
    let rest = line.replace(/^\[(x| )\]\s*/i, "").trim();

    let note = "";
    const noteMatch = rest.match(/\s+—\s+Note:\s*(.+)$/i);
    if (noteMatch) {
      note = noteMatch[1].trim();
      rest = rest.slice(0, noteMatch.index).trim();
    }

    let date = "";
    let service = rest;
    const pipeIdx = rest.indexOf("|");
    if (pipeIdx > -1) {
      const possibleDate = rest.slice(0, pipeIdx).trim();
      if (parseDateSafe(possibleDate)) {
        date = toIsoDateInput(possibleDate);
        service = rest.slice(pipeIdx + 1).trim();
      }
    }

    return {
      id: `chk_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
      date,
      service: service || "Service",
      note,
      done
    };
  });
}

function extractChecklistFromNotes(dealId, notesArray) {
  if (!Array.isArray(notesArray)) {
    STATE.checklistByDeal[dealId] = { noteId: null, items: [] };
    return [];
  }

  const checklistNotes = notesArray.filter(
    (n) => (n.Note_Title || "").trim().toUpperCase() === CHECKLIST_NOTE_TITLE
  );

  if (!checklistNotes.length) {
    STATE.checklistByDeal[dealId] = { noteId: null, items: [] };
    return notesArray;
  }

  const latestNote = checklistNotes[0];
  const parsedItems = parseChecklistNoteContent(latestNote.Note_Content || "");
  STATE.checklistByDeal[dealId] = {
    noteId: latestNote.id,
    items: parsedItems
  };

  return notesArray.filter(
    (n) => (n.Note_Title || "").trim().toUpperCase() !== CHECKLIST_NOTE_TITLE
  );
}

async function persistChecklistToCrm(dealId, items) {
  const existing = STATE.checklistByDeal[dealId] || { noteId: null, items: [] };
  const content = serializeChecklistNote(items);

  if (existing.noteId && typeof ZOHO.CRM.API.updateNotes === "function") {
    try {
      await ZOHO.CRM.API.updateNotes({
        Entity: "Deals",
        RecordID: dealId,
        NoteID: existing.noteId,
        Title: CHECKLIST_NOTE_TITLE,
        Content: content
      });
      STATE.checklistByDeal[dealId] = { noteId: existing.noteId, items };
      return;
    } catch (e) {
      console.warn("updateNotes fallback to delete+add:", e);
    }
  }

  if (existing.noteId && typeof ZOHO.CRM.API.deleteNotes === "function") {
    try {
      await ZOHO.CRM.API.deleteNotes({
        Entity: "Deals",
        RecordID: dealId,
        NoteID: existing.noteId
      });
    } catch (e) {
      console.warn("Could not delete old checklist note:", e);
    }
  }

  await ZOHO.CRM.API.addNotes({
    Entity: "Deals",
    RecordID: dealId,
    Title: CHECKLIST_NOTE_TITLE,
    Content: content
  });

  await fetchNotesForDeal(dealId);
}

function autoMatchChecklistWithOperations(dealId) {
  const checklistState = STATE.checklistByDeal[dealId];
  const ops = STATE.operationsByDeal[dealId];
  if (!checklistState || !Array.isArray(checklistState.items) || !checklistState.items.length) return;
  if (!Array.isArray(ops) || !ops.length) return;

  const opServiceTexts = [];
  ops.forEach((op) => {
    const parsed = parseCleanProductDetails(op.Product_Deatails);
    parsed.items.forEach((it) => {
      if (it.name) opServiceTexts.push(it.name.toLowerCase());
    });
  });

  if (!opServiceTexts.length) return;

  checklistState.items.forEach((item) => {
    if (item.done) return;
    const needle = (item.service || "").toLowerCase().trim();
    if (needle.length >= 4 && opServiceTexts.some((txt) => txt.includes(needle) || needle.includes(txt))) {
      item.done = true;
      item.autoMatched = true;
    }
  });
}

async function runBootSequence(triggerSource) {
  if (STATE.booted) return;
  STATE.booted = true;

  const statusEl = $("sdkStatus");
  const accordion = $("bookingsAccordion");

  try {
    const userRes = await ZOHO.CRM.CONFIG.getCurrentUser();
    STATE.currentUser = userRes?.users?.[0] || null;

    if (statusEl) {
      statusEl.textContent = "Zoho Connected";
      statusEl.className = "badge badge-ok";
    }

    await initApp();
  } catch (err) {
    STATE.booted = false;
    console.error(`Zoho SDK connection error (${triggerSource}):`, err);
    if (statusEl) {
      statusEl.textContent = "Connection Failed";
      statusEl.className = "badge badge-danger";
    }
    if (accordion) {
      accordion.innerHTML = `
        <div class="empty-state">
          <strong>Could not establish Zoho CRM bridge (${escapeHtml(triggerSource)}).</strong><br/>
          <span class="subtitle">Error: ${escapeHtml(err?.message || JSON.stringify(err) || "No response from parent CRM frame")}</span><br/><br/>
          <span class="subtitle">Check Setup - Developer Hub - Widgets and confirm Base URL matches: <code>${escapeHtml(window.location.origin + window.location.pathname)}</code></span>
        </div>
      `;
    }
  }
}

function bootZohoSDK() {
  const statusEl = $("sdkStatus");

  if (typeof ZOHO === "undefined" || !ZOHO.embeddedApp) {
    if (statusEl) {
      statusEl.textContent = "SDK Missing";
      statusEl.className = "badge badge-danger";
    }
    return;
  }

  ZOHO.embeddedApp.on("PageLoad", function () {
    runBootSequence("PageLoad");
  });

  try {
    ZOHO.embeddedApp.init();
  } catch (e) {
    console.error("ZOHO.embeddedApp.init threw:", e);
  }

  setTimeout(function () {
    if (!STATE.booted) {
      runBootSequence("DirectInit");
    }
  }, 1200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootZohoSDK);
} else {
  bootZohoSDK();
}

async function initApp() {
  try {
    const usersListRes = await ZOHO.CRM.API.getAllUsers({ Type: "ActiveUsers" });
    STATE.crmUsers = usersListRes?.users || [];
  } catch (e) {
    console.warn("Could not fetch CRM users", e);
  }

  if ($("filterSinceDate") && !$("filterSinceDate").value) {
    $("filterSinceDate").value = DEFAULT_START_DATE;
  }

  const savedPrefs = loadUserFilterPrefs();
  applySavedFilterPrefs(savedPrefs);

  populatePayModalAccounts();
  bindEvents();
  await Promise.all([loadBookings(savedPrefs?.owner || "ALL"), loadVendorsAndProducts()]);
}

function populatePayModalAccounts() {
  const payMethodSel = $("payMethod");
  if (payMethodSel) {
    payMethodSel.innerHTML = BOOKS_ACCOUNTS
      .map((acc) => `<option value="${acc}">${acc}</option>`)
      .join("");
  }
}

let searchDebounceTimer = null;

function bindEvents() {
  if ($("filterStage")) $("filterStage").addEventListener("change", () => loadBookings());
  if ($("filterSinceDate")) {
    $("filterSinceDate").addEventListener("change", () => {
      saveUserFilterPrefs();
      loadBookings();
    });
  }
  if ($("filterToDate")) {
    $("filterToDate").addEventListener("change", () => {
      saveUserFilterPrefs();
      applyFilters();
    });
  }
  if ($("filterPlatform")) {
    $("filterPlatform").addEventListener("change", () => {
      saveUserFilterPrefs();
      applyFilters();
    });
  }
  if ($("filterOwner")) {
    $("filterOwner").addEventListener("change", () => {
      saveUserFilterPrefs();
      applyFilters();
    });
  }
  if ($("filterStartDate")) {
    $("filterStartDate").addEventListener("change", () => {
      saveUserFilterPrefs();
      applyFilters();
    });
  }
  if ($("btnResetFilters")) {
    $("btnResetFilters").addEventListener("click", resetAllFilters);
  }
  if ($("searchInput")) {
    $("searchInput").addEventListener("input", () => {
      applyFilters();
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(async () => {
        const term = ($("searchInput")?.value || "").trim();
        if (term.length >= 3 && STATE.filteredBookings.length === 0) {
          await searchHistoricalBookings(term);
        }
      }, 500);
    });
  }
  if ($("btnRefresh")) {
    $("btnRefresh").addEventListener("click", () => {
      STATE.operationsByDeal = {};
      STATE.opFullRecord = {};
      STATE.passengersByDeal = {};
      STATE.notesByDeal = {};
      STATE.checklistByDeal = {};
      STATE.attachmentsByDeal = {};
      STATE.dealFullRecord = {};
      loadBookings();
    });
  }

  document.querySelectorAll("#mainTabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      STATE.activeTab = target;

      document.querySelectorAll("#mainTabs .tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-view").forEach((view) => view.classList.add("hidden"));
      const targetView = $(`tab-${target}`);
      if (targetView) targetView.classList.remove("hidden");

      if (target === "finance") renderFinanceOverview();
    });
  });

  // Load Services Modal events
  if ($("closeLoadServicesModal")) $("closeLoadServicesModal").onclick = () => toggleModal("loadServicesModal", false);
  if ($("cancelLoadServices")) $("cancelLoadServices").onclick = () => toggleModal("loadServicesModal", false);
  if ($("btnModeText")) $("btnModeText").onclick = () => setLoadServicesMode("TEXT");
  if ($("btnModeCsv")) $("btnModeCsv").onclick = () => setLoadServicesMode("CSV");
  if ($("btnPreviewServices")) $("btnPreviewServices").onclick = previewParsedServices;
  if ($("servicesCsvFile")) $("servicesCsvFile").onchange = previewParsedServices;
  if ($("submitLoadServices")) $("submitLoadServices").onclick = submitLoadedServicesChecklist;

  // Bulk Operations Modal events
  if ($("closeBulkModal")) $("closeBulkModal").onclick = () => toggleModal("bulkModal", false);
  if ($("cancelBulk")) $("cancelBulk").onclick = () => toggleModal("bulkModal", false);
  if ($("btnAddRow")) $("btnAddRow").onclick = () => addBulkRow();
  if ($("submitBulk")) $("submitBulk").onclick = submitBulkOperations;

  // Pay & Schedule Modal events
  if ($("closePayModal")) $("closePayModal").onclick = () => toggleModal("payModal", false);
  if ($("cancelPay")) $("cancelPay").onclick = () => toggleModal("payModal", false);
  if ($("payActionType")) {
    $("payActionType").onchange = (e) => {
      const val = e.target.value;
      $("scheduledFields")?.classList.toggle("hidden", val !== "SCHEDULED");
      $("paidNowFields")?.classList.toggle("hidden", val !== "PAID_NOW");
    };
  }
  if ($("submitPay")) $("submitPay").onclick = submitOperationUpdate;
}

function toggleModal(id, show) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !show);
}

async function fetchPaginatedDeals(criteriaQuery) {
  let all = [];
  let page = 1;
  let moreRecords = true;

  while (moreRecords && page <= 15) {
    const res = await ZOHO.CRM.API.searchRecord({
      Entity: "Deals",
      Type: "criteria",
      Query: criteriaQuery,
      page,
      per_page: 200
    });
    const batch = Array.isArray(res?.data) ? res.data : [];
    all = all.concat(batch);
    moreRecords = Boolean(res?.info?.more_records) && batch.length > 0;
    page++;
  }

  return all;
}

async function loadBookings(preferredOwnerId = null) {
  const accordion = $("bookingsAccordion");
  if (accordion) accordion.innerHTML = `<div class="empty-state">Loading Bookings...</div>`;

  const stage = $("filterStage")?.value || "Booking Won";
  const sinceDate = $("filterSinceDate")?.value || DEFAULT_START_DATE;

  try {
    let rows = [];
    if (sinceDate) {
      const cutoffDt = parseDateSafe(sinceDate);
      const dayBeforeDt = cutoffDt ? new Date(cutoffDt.getFullYear(), cutoffDt.getMonth(), cutoffDt.getDate() - 1) : null;
      const dayBeforeIso = dayBeforeDt ? toIsoDateInput(dayBeforeDt) : sinceDate;
      const criteriaWithDate = `((Stage:equals:${stage})and(Trip_Start_Date:greater_than:${dayBeforeIso}))`;

      try {
        rows = await fetchPaginatedDeals(criteriaWithDate);
      } catch (criteriaErr) {
        console.warn("Date criteria fallback to stage + client filter:", criteriaErr);
        const stageRows = await fetchPaginatedDeals(`(Stage:equals:${stage})`);
        rows = stageRows.filter((b) => {
          const startDt = parseDateSafe(b.Trip_Start_Date);
          return cutoffDt && startDt && startDt >= cutoffDt;
        });
      }
    } else {
      rows = await fetchPaginatedDeals(`(Stage:equals:${stage})`);
    }

    const map = new Map();
    rows.forEach((r) => {
      if (r && r.id) map.set(r.id, r);
    });
    STATE.bookings = Array.from(map.values());

    buildOwnerFilterOptions(preferredOwnerId);
    applyFilters();
  } catch (err) {
    console.error("Error loading Deals:", err);
    if (accordion) accordion.innerHTML = `<div class="empty-state">No records found or query error.</div>`;
  }
}

async function searchHistoricalBookings(term) {
  const cleanTerm = term.trim();
  if (!cleanTerm) return;

  try {
    const [byNumRes, byWordRes] = await Promise.all([
      ZOHO.CRM.API.searchRecord({
        Entity: "Deals",
        Type: "criteria",
        Query: `(Booking_Number:equals:${cleanTerm})`
      }).catch(() => ({ data: [] })),
      ZOHO.CRM.API.searchRecord({
        Entity: "Deals",
        Type: "word",
        Query: cleanTerm
      }).catch(() => ({ data: [] }))
    ]);

    const found = [...(byNumRes?.data || []), ...(byWordRes?.data || [])];
    if (!found.length) return;

    let added = 0;
    found.forEach((item) => {
      if (item?.id && !STATE.bookings.some((b) => b.id === item.id)) {
        STATE.bookings.push(item);
        added++;
      }
    });

    if (added > 0) {
      buildOwnerFilterOptions();
      applyFilters();
      showToast(`Found ${added} matching Booking(s) from CRM archive.`);
    }
  } catch (e) {
    console.warn("Historical search error:", e);
  }
}

function buildOwnerFilterOptions(preferredOwnerId = null) {
  const ownersMap = {};
  STATE.bookings.forEach((b) => {
    const ownerId = b.Owner?.id || "UNASSIGNED";
    const ownerName = b.Owner?.name || "Unassigned";
    if (!ownersMap[ownerId]) ownersMap[ownerId] = { id: ownerId, name: ownerName };
  });

  const ownerList = Object.values(ownersMap).sort((a, b) => a.name.localeCompare(b.name));
  const sel = $("filterOwner");
  if (sel) {
    const current = preferredOwnerId || sel.value || "ALL";
    sel.innerHTML = `<option value="ALL">All Coordinators</option>` +
      ownerList.map((o) => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");
    if ([...sel.options].some((opt) => opt.value === current)) sel.value = current;
  }
}

function matchesStartDateWindow(dateStr, windowKey) {
  if (windowKey === "ALL") return true;
  const target = parseDateSafe(dateStr);
  if (!target) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (windowKey === "NEXT_7") return diffDays >= 0 && diffDays <= 7;
  if (windowKey === "NEXT_14") return diffDays >= 0 && diffDays <= 14;
  if (windowKey === "THIS_MONTH") {
    return target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
  }
  if (windowKey === "NEXT_MONTH") {
    const nextM = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return target.getFullYear() === nextM.getFullYear() && target.getMonth() === nextM.getMonth();
  }
  return true;
}

function matchesDateRange(dateStr, fromIso, toIso) {
  if (!fromIso && !toIso) return true;
  const target = parseDateSafe(dateStr);
  if (!target) return false;

  if (fromIso) {
    const fromDt = parseDateSafe(fromIso);
    if (fromDt && target < fromDt) return false;
  }
  if (toIso) {
    const toDt = parseDateSafe(toIso);
    if (toDt && target > toDt) return false;
  }
  return true;
}

function applyFilters() {
  const platform = $("filterPlatform")?.value || "ALL";
  const owner = $("filterOwner")?.value || "ALL";
  const startWin = $("filterStartDate")?.value || "ALL";
  const fromIso = $("filterSinceDate")?.value || "";
  const toIso = $("filterToDate")?.value || "";
  const q = ($("searchInput")?.value || "").trim().toLowerCase();

  STATE.filteredBookings = STATE.bookings.filter((b) => {
    const matchPlat = platform === "ALL" || b.Sales_Platform === platform;
    const bOwnerId = b.Owner?.id || "UNASSIGNED";
    const matchOwner = owner === "ALL" || bOwnerId === owner;
    const matchDateWin = matchesStartDateWindow(b.Trip_Start_Date, startWin);
    const matchRange = matchesDateRange(b.Trip_Start_Date, fromIso, toIso);
    const text = `${b.Booking_Number || ""} ${b.Deal_Name || ""} ${b.Contact_Name?.name || ""} ${b.Owner?.name || ""}`.toLowerCase();
    return matchPlat && matchOwner && matchDateWin && matchRange && text.includes(q);
  });

  renderBookingsAccordion();
  if (STATE.activeTab === "finance") renderFinanceOverview();
}

window.updateBookingOpsStage = async function (e, dealId, newStage) {
  if (e) e.stopPropagation();
  try {
    showToast("Updating Operations Stage...");
    await ZOHO.CRM.API.updateRecord({
      Entity: "Deals",
      APIData: {
        id: dealId,
        Operations_Stage: newStage || null
      },
      Trigger: ["workflow"]
    });

    const booking = STATE.bookings.find((b) => b.id === dealId);
    if (booking) booking.Operations_Stage = newStage;
    if (STATE.dealFullRecord[dealId]) STATE.dealFullRecord[dealId].Operations_Stage = newStage;

    renderBookingsAccordion();
    showToast(`Operations Stage updated to "${newStage || "None"}"`);
  } catch (err) {
    console.error("Error updating Operations_Stage:", err);
    showToast("Could not update Operations Stage.");
    renderBookingsAccordion();
  }
};

function renderBookingsAccordion() {
  const countEl = $("bookingsCount");
  const accordion = $("bookingsAccordion");
  if (countEl) countEl.textContent = STATE.filteredBookings.length;
  if (!accordion) return;

  if (!STATE.filteredBookings.length) {
    accordion.innerHTML = `<div class="empty-state">No Bookings match these filters.</div>`;
    return;
  }

  accordion.innerHTML = STATE.filteredBookings.map((b) => {
    const full = STATE.dealFullRecord[b.id] || b;
    const isExpanded = STATE.expandedBookingId === b.id;
    const currentStage = (full.Operations_Stage || "").trim();
    const stageCls = getOpsStageClass(currentStage);
    const ownerName = full.Owner?.name || "Unassigned";

    const stageOptionsHtml = [
      `<option value="" ${!currentStage ? "selected" : ""}>- None -</option>`,
      ...OPERATIONS_STAGES.map(
        (st) => `<option value="${escapeHtml(st)}" ${currentStage === st ? "selected" : ""}>${escapeHtml(st)}</option>`
      )
    ].join("");

    const loadedOps = STATE.operationsByDeal[b.id];
    const progressHtml = Array.isArray(loadedOps) && loadedOps.length
      ? (() => {
          const prog = computeOperationsProgress(loadedOps);
          const badgeCls = prog.percent === 100 ? "badge-ok" : (prog.percent > 0 ? "badge-info" : "badge-warn");
          return `<span class="badge ${badgeCls}">${prog.percent}% Ops (${prog.totalServices} svc)</span>`;
        })()
      : "";

    return `
      <div class="accordion-item ${isExpanded ? "expanded" : ""}" id="acc_${b.id}">
        <div class="accordion-header" onclick="toggleBookingAccordion('${b.id}')">
          <div class="acc-id-col">
            <span class="mono"><strong>#${escapeHtml(full.Booking_Number || "N/A")}</strong></span>
            ${getPlatformBadgeHtml(full.Sales_Platform)}
          </div>

          <div class="acc-main-col">
            <div class="acc-title">${escapeHtml(full.Deal_Name || "Untitled Booking")}</div>
            <div class="acc-sub">
              Passenger: <strong>${escapeHtml(full.Contact_Name?.name || "No passenger")}</strong> · ${full.Number_of_Passengers || 1} PAX · Owner: <strong>${escapeHtml(ownerName)}</strong>
            </div>
          </div>

          <div class="acc-dates-col">
            <span><strong>Start:</strong> ${escapeHtml(fmtDateDisplay(full.Trip_Start_Date, "No date"))}</span>
            <span class="subtitle">End: ${escapeHtml(fmtDateDisplay(full.Trip_End_Date, "-"))} (${full.Trip_Duration_Days || "?"}d)</span>
          </div>

          <div class="acc-status-col">
            <select
              class="ops-stage-select ${stageCls}"
              title="Change Operations Stage"
              onclick="event.stopPropagation()"
              onchange="updateBookingOpsStage(event, '${b.id}', this.value)"
            >
              ${stageOptionsHtml}
            </select>
            ${progressHtml}
          </div>

          <div class="acc-chevron">▼</div>
        </div>

        ${isExpanded ? `<div class="accordion-body" id="acc_body_${b.id}">${renderExpandedBookingBody(b)}</div>` : ""}
      </div>
    `;
  }).join("");
}

window.toggleBookingAccordion = async function (dealId) {
  if (STATE.expandedBookingId === dealId) {
    STATE.expandedBookingId = null;
    if (STATE.editingDealId === dealId) STATE.editingDealId = null;
    if (STATE.passengerFormDealId === dealId) STATE.passengerFormDealId = null;
    STATE.editingPassengerKey = null;
    renderBookingsAccordion();
    return;
  }

  STATE.expandedBookingId = dealId;
  if (!STATE.openSubDrawers[dealId]) {
    STATE.openSubDrawers[dealId] = { passengers: true, notes: false };
  }
  renderBookingsAccordion();

  await Promise.all([
    !STATE.operationsByDeal[dealId] ? fetchOperationsForDeal(dealId) : Promise.resolve(),
    !STATE.passengersByDeal[dealId] ? fetchPassengersForDeal(dealId) : Promise.resolve(),
    !STATE.notesByDeal[dealId] ? fetchNotesForDeal(dealId) : Promise.resolve(),
    !STATE.attachmentsByDeal[dealId] ? fetchAttachmentsForDeal(dealId) : Promise.resolve(),
    !STATE.dealFullRecord[dealId] ? fetchFullDealRecord(dealId) : Promise.resolve()
  ]);

  autoMatchChecklistWithOperations(dealId);

  if (STATE.expandedBookingId === dealId) {
    renderBookingsAccordion();
  }
};

window.toggleSubDrawer = function (dealId, drawerKey) {
  if (!STATE.openSubDrawers[dealId]) {
    STATE.openSubDrawers[dealId] = { passengers: false, notes: false };
  }
  STATE.openSubDrawers[dealId][drawerKey] = !STATE.openSubDrawers[dealId][drawerKey];
  renderBookingsAccordion();
};

async function fetchFullDealRecord(dealId) {
  try {
    const res = await ZOHO.CRM.API.getRecord({ Entity: "Deals", RecordID: dealId });
    if (res?.data?.[0]) {
      STATE.dealFullRecord[dealId] = res.data[0];
    }
  } catch (e) {
    console.warn("Full deal fetch fallback:", e);
  }
}

async function fetchOperationsForDeal(dealId) {
  try {
    const relRes = await ZOHO.CRM.API.getRelatedRecords({
      Entity: "Deals",
      RecordID: dealId,
      RelatedList: "Operations"
    });
    if (relRes && relRes.data) {
      STATE.operationsByDeal[dealId] = relRes.data;
      await hydrateOperationsSubforms(relRes.data);
      return;
    }
    throw new Error("Fallback search");
  } catch (e) {
    const searchRes = await ZOHO.CRM.API.searchRecord({
      Entity: "Bills",
      Type: "criteria",
      Query: `(Booking_Name:equals:${dealId})`
    });
    const list = (searchRes && searchRes.data) ? searchRes.data : [];
    STATE.operationsByDeal[dealId] = list;
    await hydrateOperationsSubforms(list);
  }
}

async function hydrateOperationsSubforms(opsList) {
  if (!Array.isArray(opsList) || !opsList.length) return;
  await Promise.all(
    opsList.map(async (op) => {
      if (!op?.id) return;
      try {
        const res = await ZOHO.CRM.API.getRecord({ Entity: "Bills", RecordID: op.id });
        if (res?.data?.[0]) {
          STATE.opFullRecord[op.id] = res.data[0];
        }
      } catch (err) {
        console.warn("Could not hydrate operation subform:", op.id, err);
      }
    })
  );
}

async function fetchPassengersForDeal(dealId) {
  try {
    const relRes = await ZOHO.CRM.API.getRelatedRecords({
      Entity: "Deals",
      RecordID: dealId,
      RelatedList: "Passengers"
    });
    if (relRes && Array.isArray(relRes.data) && relRes.data.length > 0) {
      STATE.passengersByDeal[dealId] = relRes.data;
      return;
    }
  } catch (e) {
    // Fallback to CustomModule5 search
  }

  try {
    const searchRes = await ZOHO.CRM.API.searchRecord({
      Entity: "CustomModule5",
      Type: "criteria",
      Query: `(Booking_Name:equals:${dealId})`
    });
    STATE.passengersByDeal[dealId] = (searchRes && searchRes.data) ? searchRes.data : [];
  } catch (err) {
    console.warn("No passengers found in CustomModule5:", err);
    STATE.passengersByDeal[dealId] = [];
  }
}

async function fetchNotesForDeal(dealId) {
  try {
    const relNotes = await ZOHO.CRM.API.getRelatedRecords({
      Entity: "Deals",
      RecordID: dealId,
      RelatedList: "Notes"
    });
    const allNotes = (relNotes && relNotes.data) ? relNotes.data : [];
    STATE.notesByDeal[dealId] = extractChecklistFromNotes(dealId, allNotes);
  } catch (e) {
    STATE.notesByDeal[dealId] = [];
    if (!STATE.checklistByDeal[dealId]) {
      STATE.checklistByDeal[dealId] = { noteId: null, items: [] };
    }
  }
}

async function fetchAttachmentsForDeal(dealId) {
  try {
    const relAtt = await ZOHO.CRM.API.getRelatedRecords({
      Entity: "Deals",
      RecordID: dealId,
      RelatedList: "Attachments"
    });
    STATE.attachmentsByDeal[dealId] = (relAtt && relAtt.data) ? relAtt.data : [];
  } catch (e) {
    STATE.attachmentsByDeal[dealId] = [];
  }
}

window.assignBookingOwner = async function (dealId, newOwnerId) {
  if (!canManageOwner()) {
    showToast("Only Management / Administrators can change Booking Coordinator.");
    renderBookingsAccordion();
    return;
  }
  if (!newOwnerId) return;

  try {
    showToast("Updating Booking Owner...");
    await ZOHO.CRM.API.updateRecord({
      Entity: "Deals",
      APIData: {
        id: dealId,
        Owner: newOwnerId
      }
    });

    const userObj = STATE.crmUsers.find((u) => u.id === newOwnerId);
    const ownerPayload = userObj
      ? { id: userObj.id, name: userObj.full_name }
      : { id: newOwnerId, name: "Assigned" };

    const booking = STATE.bookings.find((b) => b.id === dealId);
    if (booking) booking.Owner = ownerPayload;
    if (STATE.dealFullRecord[dealId]) STATE.dealFullRecord[dealId].Owner = ownerPayload;

    buildOwnerFilterOptions();
    renderBookingsAccordion();
    showToast(`Assigned to ${userObj?.full_name || "coordinator"}`);
  } catch (err) {
    console.error("Error updating owner:", err);
    showToast("Could not update Booking Owner.");
    renderBookingsAccordion();
  }
};

// --- SUBHEADER QUICK EDIT (Pick-up, Accommodation, Flights) ---
window.toggleEditSubheader = function (e, dealId, enable) {
  if (e) e.stopPropagation();
  STATE.editingDealId = enable ? dealId : null;
  renderBookingsAccordion();
};

window.saveSubheaderDetails = async function (e, dealId) {
  if (e) e.stopPropagation();

  const pickupVal = ($(`edit_pickup_${dealId}`)?.value || "").trim();
  const flightsVal = ($(`edit_flights_${dealId}`)?.value || "").trim();

  const payload = {
    id: dealId,
    Accommodation_Pick_up_Point: pickupVal,
    Flight_Details: flightsVal
  };

  try {
    showToast("Saving Booking details...");
    await ZOHO.CRM.API.updateRecord({
      Entity: "Deals",
      APIData: payload,
      Trigger: ["workflow"]
    });

    const booking = STATE.bookings.find((b) => b.id === dealId);
    if (booking) {
      booking.Accommodation_Pick_up_Point = pickupVal;
      booking.Flight_Details = flightsVal;
    }
    if (STATE.dealFullRecord[dealId]) {
      STATE.dealFullRecord[dealId].Accommodation_Pick_up_Point = pickupVal;
      STATE.dealFullRecord[dealId].Flight_Details = flightsVal;
    }

    STATE.editingDealId = null;
    renderBookingsAccordion();
    showToast("Pick-up & Flights updated!");
  } catch (err) {
    console.error("Error updating subheader details:", err);
    showToast("Could not save Booking details.");
  }
};

// --- PASSENGERS & PASSPORTS (Add & Inline Edit in CustomModule5) ---
window.toggleAddPassengerForm = function (e, dealId, show) {
  if (e) e.stopPropagation();
  if (!STATE.openSubDrawers[dealId]) {
    STATE.openSubDrawers[dealId] = { passengers: true, notes: false };
  }
  STATE.openSubDrawers[dealId].passengers = true;
  STATE.passengerFormDealId = show ? dealId : null;
  STATE.editingPassengerKey = null;
  renderBookingsAccordion();
};

window.createPassengerRecord = async function (e, dealId) {
  if (e) e.stopPropagation();

  const nameVal = ($(`new_pax_name_${dealId}`)?.value || "").trim();
  if (!nameVal) {
    showToast("Passenger Name is required.");
    return;
  }

  const countryVal = ($(`new_pax_country_${dealId}`)?.value || "").trim();
  const dobVal = ($(`new_pax_dob_${dealId}`)?.value || "").trim();
  const passportVal = ($(`new_pax_passport_${dealId}`)?.value || "").trim();
  const expiryVal = ($(`new_pax_expiry_${dealId}`)?.value || "").trim();
  const genderVal = ($(`new_pax_gender_${dealId}`)?.value || "").trim();
  const mobileVal = ($(`new_pax_mobile_${dealId}`)?.value || "").trim();
  const phoneVal = ($(`new_pax_phone_${dealId}`)?.value || "").trim();
  const emailVal = ($(`new_pax_email_${dealId}`)?.value || "").trim();
  const dietVal = ($(`new_pax_diet_${dealId}`)?.value || "").trim();
  const medVal = ($(`new_pax_med_${dealId}`)?.value || "").trim();

  const recordData = {
    Name: nameVal,
    Booking_Name: dealId
  };
  if (countryVal) recordData.Country = countryVal;
  if (dobVal) recordData.Date_of_Birth = dobVal;
  if (passportVal) recordData.Passport_Number = passportVal;
  if (expiryVal) recordData.Passport_Expiry_Date = expiryVal;
  if (genderVal) recordData.Gender = genderVal;
  if (mobileVal) recordData.Passenger_Mobile = mobileVal;
  if (phoneVal) recordData.Passenger_Phone = phoneVal;
  if (emailVal) recordData.Email = emailVal;
  if (dietVal) recordData.Dietary_Requirements = dietVal;
  if (medVal) recordData.Medical_Conditions = medVal;

  try {
    showToast("Adding passenger to Zoho CRM...");
    await ZOHO.CRM.API.insertRecord({
      Entity: "CustomModule5",
      APIData: [recordData],
      Trigger: ["workflow"]
    });

    STATE.passengerFormDealId = null;
    await fetchPassengersForDeal(dealId);
    renderBookingsAccordion();
    showToast(`Passenger "${nameVal}" added!`);
  } catch (err) {
    console.error("Error creating passenger:", err);
    showToast("Could not add passenger. Check field permissions.");
  }
};

window.startEditPassengerRow = function (e, dealId, passengerId, rowIndex) {
  if (e) e.stopPropagation();
  STATE.editingPassengerKey = `${dealId}__${passengerId || rowIndex}`;
  renderBookingsAccordion();
};

window.cancelEditPassengerRow = function (e) {
  if (e) e.stopPropagation();
  STATE.editingPassengerKey = null;
  renderBookingsAccordion();
};

window.savePassengerRowEdit = async function (e, dealId, passengerId, rowIndex) {
  if (e) e.stopPropagation();
  const paxList = STATE.passengersByDeal[dealId] || [];
  const currentPax = paxList[rowIndex] || {};
  const targetId = passengerId || currentPax.id;

  if (!targetId) {
    showToast("Missing passenger record ID.");
    return;
  }

  const key = `${dealId}__${targetId}`;
  const nameVal = ($(`pax_edit_name_${key}`)?.value || "").trim();
  if (!nameVal) {
    showToast("Passenger Name cannot be empty.");
    return;
  }

  const updatePayload = {
    id: targetId,
    Name: nameVal,
    Country: ($(`pax_edit_country_${key}`)?.value || "").trim(),
    Date_of_Birth: ($(`pax_edit_dob_${key}`)?.value || "").trim() || null,
    Passport_Number: ($(`pax_edit_passport_${key}`)?.value || "").trim(),
    Passport_Expiry_Date: ($(`pax_edit_expiry_${key}`)?.value || "").trim() || null,
    Gender: ($(`pax_edit_gender_${key}`)?.value || "").trim(),
    Passenger_Mobile: ($(`pax_edit_mobile_${key}`)?.value || "").trim(),
    Passenger_Phone: ($(`pax_edit_phone_${key}`)?.value || "").trim(),
    Email: ($(`pax_edit_email_${key}`)?.value || "").trim(),
    Dietary_Requirements: ($(`pax_edit_diet_${key}`)?.value || "").trim(),
    Medical_Conditions: ($(`pax_edit_med_${key}`)?.value || "").trim()
  };

  try {
    showToast("Saving passenger details...");
    await ZOHO.CRM.API.updateRecord({
      Entity: "CustomModule5",
      APIData: updatePayload,
      Trigger: ["workflow"]
    });

    STATE.editingPassengerKey = null;
    await fetchPassengersForDeal(dealId);
    renderBookingsAccordion();
    showToast(`Updated passenger "${nameVal}".`);
  } catch (err) {
    console.error("Error updating passenger:", err);
    showToast("Could not update passenger record.");
  }
};

window.copyAllManifest = function (e, dealId) {
  if (e) e.stopPropagation();
  const paxList = STATE.passengersByDeal[dealId] || [];
  const b = STATE.dealFullRecord[dealId] || STATE.bookings.find((item) => item.id === dealId);
  if (!paxList.length) {
    showToast("No passengers to copy.");
    return;
  }

  const lines = paxList.map((p, idx) => {
    const phones = [p.Passenger_Mobile, p.Passenger_Phone].filter(Boolean).join(" / ");
    const parts = [
      `${idx + 1}. ${p.Name || "Unnamed"}`,
      p.Country ? `Nationality: ${p.Country}` : "",
      p.Date_of_Birth ? `DOB: ${fmtDateDisplay(p.Date_of_Birth)}` : "",
      p.Passport_Number ? `Passport: ${p.Passport_Number}` : "",
      p.Passport_Expiry_Date ? `Exp: ${fmtDateDisplay(p.Passport_Expiry_Date)}` : "",
      p.Gender ? `Gender: ${p.Gender}` : "",
      phones ? `Phone: ${phones}` : "",
      p.Dietary_Requirements ? `Diet: ${p.Dietary_Requirements}` : "",
      p.Medical_Conditions ? `Medical: ${p.Medical_Conditions}` : ""
    ].filter(Boolean);
    return parts.join(" | ");
  });

  const header = `Booking #${b?.Booking_Number || ""} — ${b?.Deal_Name || ""} (${paxList.length} PAX)\n`;
  navigator.clipboard.writeText(header + lines.join("\n"));
  showToast(`Copied manifest for ${paxList.length} passenger(s)!`);
};

// --- LOAD SERVICES MODAL & CHECKLIST ACTIONS ---
window.openLoadServicesModal = function (e, dealId) {
  if (e) e.stopPropagation();
  const b = STATE.dealFullRecord[dealId] || STATE.bookings.find((item) => item.id === dealId);
  if (!b) return;

  STATE.loadServicesDealId = dealId;
  STATE.parsedPreviewServices = [];
  if ($("loadServicesBookingLabel")) {
    $("loadServicesBookingLabel").textContent = `#${b.Booking_Number || ""} (${b.Deal_Name || ""})`;
  }
  if ($("servicesTextInput")) $("servicesTextInput").value = "";
  if ($("servicesCsvFile")) $("servicesCsvFile").value = "";
  if ($("servicesPreviewBox")) $("servicesPreviewBox").classList.add("hidden");
  if ($("servicesPreviewTbody")) $("servicesPreviewTbody").innerHTML = "";

  setLoadServicesMode("TEXT");
  toggleModal("loadServicesModal", true);
};

function setLoadServicesMode(mode) {
  STATE.loadServicesMode = mode;
  const isText = mode === "TEXT";
  $("modeTextBox")?.classList.toggle("hidden", !isText);
  $("modeCsvBox")?.classList.toggle("hidden", isText);

  if ($("btnModeText")) {
    $("btnModeText").className = isText ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm";
  }
  if ($("btnModeCsv")) {
    $("btnModeCsv").className = !isText ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm";
  }
}

function splitDelimitedLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseRawServiceLines(rawText, defaultDateIso) {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const sample = lines[0];
  const delimiter = sample.includes(";") && !sample.includes(",") ? ";" : (sample.includes("\t") ? "\t" : ",");
  const parsed = [];

  lines.forEach((line, idx) => {
    const cols = splitDelimitedLine(line, delimiter);

    if (idx === 0 && cols.length >= 2) {
      const c0 = cols[0].toLowerCase();
      const c1 = cols[1].toLowerCase();
      if ((c0 === "date" || c0 === "fecha") && (c1 === "service" || c1 === "servicio")) {
        return;
      }
    }

    let dateIso = "";
    let service = "";
    let note = "";

    if (cols.length === 1) {
      service = cols[0];
      dateIso = defaultDateIso || "";
    } else if (parseDateSafe(cols[0])) {
      dateIso = toIsoDateInput(cols[0]);
      service = cols[1] || "";
      note = cols.slice(2).join(", ").trim();
    } else {
      dateIso = defaultDateIso || "";
      service = cols[0] || "";
      note = cols.slice(1).join(", ").trim();
    }

    if (service) {
      parsed.push({
        id: `chk_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`,
        date: dateIso,
        service,
        note,
        done: false
      });
    }
  });

  return parsed;
}

async function getParsedServicesFromModal() {
  const dealId = STATE.loadServicesDealId;
  const b = STATE.dealFullRecord[dealId] || STATE.bookings.find((item) => item.id === dealId);
  const defaultDateIso = toIsoDateInput(b?.Trip_Start_Date);

  let rawText = "";
  if (STATE.loadServicesMode === "CSV") {
    const file = $("servicesCsvFile")?.files?.[0];
    if (!file) return [];
    rawText = await file.text();
  } else {
    rawText = $("servicesTextInput")?.value || "";
  }

  return parseRawServiceLines(rawText, defaultDateIso);
}

async function previewParsedServices() {
  const items = await getParsedServicesFromModal();
  STATE.parsedPreviewServices = items;

  const box = $("servicesPreviewBox");
  const tbody = $("servicesPreviewTbody");
  if (!box || !tbody) return;

  if (!items.length) {
    box.classList.add("hidden");
    showToast("No valid service lines detected.");
    return;
  }

  tbody.innerHTML = items.map((it) => `
    <tr>
      <td>${escapeHtml(fmtDateDisplay(it.date, "Trip Start"))}</td>
      <td><strong>${escapeHtml(it.service)}</strong></td>
      <td>${escapeHtml(it.note || "-")}</td>
    </tr>
  `).join("");
  box.classList.remove("hidden");
}

async function submitLoadedServicesChecklist() {
  const dealId = STATE.loadServicesDealId;
  if (!dealId) return;

  const newItems = await getParsedServicesFromModal();
  if (!newItems.length) {
    showToast("Please paste a service list or choose a valid CSV file.");
    return;
  }

  const append = $("appendServicesChk")?.checked ?? true;
  const currentItems = STATE.checklistByDeal[dealId]?.items || [];
  const merged = append ? [...currentItems, ...newItems] : newItems;

  try {
    showToast("Saving service checklist to Booking notes...");
    await persistChecklistToCrm(dealId, merged);
    autoMatchChecklistWithOperations(dealId);

    if (!STATE.openSubDrawers[dealId]) {
      STATE.openSubDrawers[dealId] = { passengers: false, notes: true };
    } else {
      STATE.openSubDrawers[dealId].notes = true;
    }

    toggleModal("loadServicesModal", false);
    renderBookingsAccordion();
    showToast(`Saved ${newItems.length} service(s) to checklist!`);
  } catch (err) {
    console.error("Error saving service checklist:", err);
    showToast("Could not save service checklist.");
  }
}

window.toggleChecklistItemDone = async function (dealId, itemId, checked) {
  const entry = STATE.checklistByDeal[dealId];
  if (!entry || !Array.isArray(entry.items)) return;

  const target = entry.items.find((it) => it.id === itemId);
  if (!target) return;
  target.done = Boolean(checked);

  renderBookingsAccordion();
  try {
    await persistChecklistToCrm(dealId, entry.items);
    showToast(checked ? "Service marked as completed." : "Service marked as pending.");
  } catch (err) {
    console.error("Error updating checklist item:", err);
    showToast("Could not sync checklist update.");
  }
};

window.removeChecklistItem = async function (e, dealId, itemId) {
  if (e) e.stopPropagation();
  const entry = STATE.checklistByDeal[dealId];
  if (!entry || !Array.isArray(entry.items)) return;

  const updated = entry.items.filter((it) => it.id !== itemId);
  entry.items = updated;
  renderBookingsAccordion();

  try {
    await persistChecklistToCrm(dealId, updated);
    showToast("Service removed from checklist.");
  } catch (err) {
    console.error("Error removing checklist item:", err);
    showToast("Could not sync checklist removal.");
  }
};

window.convertChecklistItemToOp = function (e, dealId, itemId) {
  if (e) e.stopPropagation();
  const entry = STATE.checklistByDeal[dealId];
  const item = entry?.items?.find((it) => it.id === itemId);
  if (!item) return;

  STATE.pendingChecklistItemId = itemId;
  openBulkModal(dealId, {
    date: item.date,
    serviceName: item.service
  });
};

window.addBookingNote = async function (dealId) {
  const input = $(`note_input_${dealId}`);
  const content = input?.value.trim();
  if (!content) return;

  try {
    showToast("Saving note to Zoho CRM...");
    await ZOHO.CRM.API.addNotes({
      Entity: "Deals",
      RecordID: dealId,
      Title: "OPS Hub Note",
      Content: content
    });
    input.value = "";
    await fetchNotesForDeal(dealId);
    renderBookingsAccordion();
    showToast("Note added to Booking.");
  } catch (err) {
    console.error("Error adding note:", err);
    showToast("Error saving note.");
  }
};

function renderExpandedBookingBody(b) {
  const full = STATE.dealFullRecord[b.id] || b;
  const ops = STATE.operationsByDeal[b.id];
  const pax = STATE.passengersByDeal[b.id];
  const notes = STATE.notesByDeal[b.id];
  const checklistItems = STATE.checklistByDeal[b.id]?.items || [];
  const dealAttachments = STATE.attachmentsByDeal[b.id] || [];
  const drawers = STATE.openSubDrawers[b.id] || { passengers: true, notes: false };
  const isEditingDeal = STATE.editingDealId === b.id;
  const isAddingPax = STATE.passengerFormDealId === b.id;
  const allowOwnerChange = canManageOwner();

  const noteAttachmentsCount = Array.isArray(notes)
    ? notes.reduce((sum, n) => sum + (Array.isArray(n.$attachments) ? n.$attachments.length : 0), 0)
    : 0;
  const totalAttachmentsCount = noteAttachmentsCount + dealAttachments.length;

  const hasDesc = Boolean(full.Description && String(full.Description).trim());
  const notesCount = (Array.isArray(notes) ? notes.length : 0) + (hasDesc ? 1 : 0);
  const doneChecklistCount = checklistItems.filter((it) => it.done).length;

  const currentOwnerId = full.Owner?.id || b.Owner?.id || "";
  const ownerOptions = STATE.crmUsers.length
    ? STATE.crmUsers.map((u) => `<option value="${u.id}" ${u.id === currentOwnerId ? "selected" : ""}>${escapeHtml(u.full_name)}</option>`).join("")
    : `<option value="${currentOwnerId}">${escapeHtml(full.Owner?.name || "Unassigned")}</option>`;

  const hasAnyHealthOrDiet = Array.isArray(pax) && pax.some(
    (p) => Boolean((p.Dietary_Requirements && String(p.Dietary_Requirements).trim()) || (p.Medical_Conditions && String(p.Medical_Conditions).trim()))
  );

  // 1. SUBHEADER HTML
  const subheaderGridHtml = isEditingDeal
    ? `
      <div class="subheader-grid" style="margin-top:10px; padding:10px; border-radius:6px; background:rgba(0,0,0,0.03);">
        <div class="meta-item">
          <span class="meta-label">Pick-up / Accommodation</span>
          <input type="text" id="edit_pickup_${b.id}" value="${escapeHtml(full.Accommodation_Pick_up_Point || "")}" placeholder="Hotel / pick-up point..." style="width:100%; padding:5px 8px; font-size:12px;" />
        </div>
        <div class="meta-item">
          <span class="meta-label">Flight Details</span>
          <input type="text" id="edit_flights_${b.id}" value="${escapeHtml(full.Flight_Details || "")}" placeholder="Arrival / departure flights..." style="width:100%; padding:5px 8px; font-size:12px;" />
        </div>
        <div class="meta-item" style="display:flex; align-items:flex-end; gap:6px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="saveSubheaderDetails(event, '${b.id}')">Save Details</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="toggleEditSubheader(event, '${b.id}', false)">Cancel</button>
        </div>
      </div>
    `
    : `
      <div class="subheader-grid">
        <div class="meta-item">
          <span class="meta-label">Lead Passenger &amp; Contact</span>
          <span class="meta-val">
            <span class="copy-inline" onclick="copyText(event, '${escapeJsAttr(full.Contact_Name?.name || "")}', 'Name')">${escapeHtml(full.Contact_Name?.name || "N/A")}</span>
            ${full.Email ? ` · <span class="copy-inline" onclick="copyText(event, '${escapeJsAttr(full.Email)}', 'Email')">${escapeHtml(full.Email)}</span>` : ""}
            ${full.Phone ? ` · <span class="copy-inline" onclick="copyText(event, '${escapeJsAttr(full.Phone)}', 'Phone')">${escapeHtml(full.Phone)}</span>` : ""}
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Pick-up / Accommodation</span>
          <span class="meta-val">${escapeHtml(full.Accommodation_Pick_up_Point || "Not specified")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Flight Details</span>
          <span class="meta-val">${escapeHtml(full.Flight_Details || "Not specified")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Trip Type</span>
          <span class="meta-val">${escapeHtml(full.Interested_In_Services || "Tailor-Made")}</span>
        </div>
      </div>
    `;

  const subheaderHtml = `
    <div class="booking-subheader">
      <div class="subheader-top">
        <div class="subheader-id-group">
          <div class="copyable-id-box">
            <span>#${escapeHtml(full.Booking_Number || "N/A")}</span>
            ${full.Booking_Number ? `<button type="button" class="copy-btn-mini" onclick="copyText(event, '${escapeJsAttr(full.Booking_Number)}', 'Booking ID')">Copy ID</button>` : ""}
          </div>

          <button type="button" class="badge ${notesCount > 0 ? "badge-warn" : ""}" style="cursor:pointer; border:none;" onclick="toggleSubDrawer('${b.id}', 'notes')">
            📝 Notes (${notesCount})
          </button>

          ${checklistItems.length > 0 ? `
            <button type="button" class="badge ${doneChecklistCount === checklistItems.length ? "badge-ok" : "badge-info"}" style="cursor:pointer; border:none;" onclick="toggleSubDrawer('${b.id}', 'notes')">
              ☑️ Checklist (${doneChecklistCount}/${checklistItems.length})
            </button>
          ` : ""}

          ${totalAttachmentsCount > 0 ? `
            <button type="button" class="badge badge-info" style="cursor:pointer; border:none;" onclick="toggleSubDrawer('${b.id}', 'notes')">
              📎 Attachments (${totalAttachmentsCount})
            </button>
          ` : ""}

          <button type="button" class="badge badge-info" style="cursor:pointer; border:none;" onclick="toggleSubDrawer('${b.id}', 'passengers')">
            👥 Passengers (${Array.isArray(pax) ? pax.length : "..."})
          </button>

          ${hasAnyHealthOrDiet ? `<span class="badge badge-danger" style="cursor:pointer;" onclick="toggleSubDrawer('${b.id}', 'passengers')">⚠️ Dietary / Medical Alert</span>` : ""}
        </div>

        <div class="subheader-id-group">
          <label class="subtitle" style="font-weight:600;">Coordinator:</label>
          <select
            style="padding:4px 8px; font-size:12px;"
            ${allowOwnerChange ? `onchange="assignBookingOwner('${b.id}', this.value)"` : `disabled title="Management / Administrator only"`}
          >
            ${ownerOptions}
          </select>
          ${!allowOwnerChange ? `<span class="badge">Locked</span>` : ""}
          ${!isEditingDeal ? `<button type="button" class="btn btn-secondary btn-sm" onclick="toggleEditSubheader(event, '${b.id}', true)">Edit Details</button>` : ""}
          <button type="button" class="btn btn-secondary btn-sm" onclick="openLoadServicesModal(event, '${b.id}')">📋 Load Services</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openDealInCrm(event, '${b.id}')">Open in CRM ↗</button>
          <button class="btn btn-primary btn-sm" onclick="openBulkModal('${b.id}')">+ Add Operations</button>
        </div>
      </div>

      ${subheaderGridHtml}
    </div>
  `;

  // 2. PASSENGERS ACCORDION HTML
  const addPassengerFormHtml = isAddingPax
    ? `
      <div style="padding:12px; border-bottom:1px solid var(--border, #e5e7eb); background:rgba(0,0,0,0.02);">
        <div style="font-weight:600; font-size:12px; margin-bottom:8px;">+ New Passenger Record</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
          <input type="text" id="new_pax_name_${b.id}" placeholder="Full Name *" style="padding:5px 8px; font-size:12px;" />
          <input type="text" id="new_pax_country_${b.id}" placeholder="Country / Nationality" style="padding:5px 8px; font-size:12px;" />
          <div>
            <label class="subtitle" style="font-size:10px; display:block;">Date of Birth</label>
            <input type="date" id="new_pax_dob_${b.id}" style="width:100%; padding:4px 6px; font-size:12px;" />
          </div>
          <input type="text" id="new_pax_passport_${b.id}" placeholder="Passport Number" style="padding:5px 8px; font-size:12px;" />
          <div>
            <label class="subtitle" style="font-size:10px; display:block;">Passport Expiry</label>
            <input type="date" id="new_pax_expiry_${b.id}" style="width:100%; padding:4px 6px; font-size:12px;" />
          </div>
          <select id="new_pax_gender_${b.id}" style="padding:5px 8px; font-size:12px;">
            <option value="">Gender...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <input type="text" id="new_pax_mobile_${b.id}" placeholder="Mobile / WhatsApp" style="padding:5px 8px; font-size:12px;" />
          <input type="text" id="new_pax_phone_${b.id}" placeholder="Phone" style="padding:5px 8px; font-size:12px;" />
          <input type="email" id="new_pax_email_${b.id}" placeholder="Email" style="padding:5px 8px; font-size:12px;" />
          <input type="text" id="new_pax_diet_${b.id}" placeholder="Dietary Requirements" style="padding:5px 8px; font-size:12px;" />
          <input type="text" id="new_pax_med_${b.id}" placeholder="Medical Conditions" style="padding:5px 8px; font-size:12px;" />
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="createPassengerRecord(event, '${b.id}')">Save Passenger</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="toggleAddPassengerForm(event, '${b.id}', false)">Cancel</button>
        </div>
      </div>
    `
    : "";

  let paxBodyHtml = `<div class="empty-state">Loading passengers from CRM...</div>`;
  if (Array.isArray(pax)) {
    if (!pax.length) {
      paxBodyHtml = `${addPassengerFormHtml}<div class="empty-state" style="padding:14px;">No passenger records linked to this Booking yet.</div>`;
    } else {
      const paxRows = pax.map((p, idx) => {
        const paxKey = `${b.id}__${p.id || idx}`;
        const isEditingThisPax = STATE.editingPassengerKey === paxKey;

        if (isEditingThisPax) {
          return `
            <tr>
              <td>
                <input type="text" id="pax_edit_name_${paxKey}" value="${escapeHtml(p.Name || "")}" placeholder="Full Name" style="width:100%; padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <input type="text" id="pax_edit_country_${paxKey}" value="${escapeHtml(p.Country || "")}" placeholder="Country" style="width:100%; padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <input type="date" id="pax_edit_dob_${paxKey}" value="${escapeHtml(toIsoDateInput(p.Date_of_Birth))}" style="padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <input type="text" id="pax_edit_passport_${paxKey}" value="${escapeHtml(p.Passport_Number || "")}" placeholder="Passport #" style="width:115px; padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <input type="date" id="pax_edit_expiry_${paxKey}" value="${escapeHtml(toIsoDateInput(p.Passport_Expiry_Date))}" style="padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <select id="pax_edit_gender_${paxKey}" style="padding:4px 6px; font-size:12px;">
                  <option value="" ${!p.Gender ? "selected" : ""}>-</option>
                  <option value="Male" ${p.Gender === "Male" ? "selected" : ""}>Male</option>
                  <option value="Female" ${p.Gender === "Female" ? "selected" : ""}>Female</option>
                  <option value="Other" ${p.Gender === "Other" ? "selected" : ""}>Other</option>
                </select>
              </td>
              <td>
                <input type="text" id="pax_edit_mobile_${paxKey}" value="${escapeHtml(p.Passenger_Mobile || "")}" placeholder="Mobile" style="width:100%; padding:4px 6px; font-size:12px; margin-bottom:4px;" />
                <input type="text" id="pax_edit_phone_${paxKey}" value="${escapeHtml(p.Passenger_Phone || "")}" placeholder="Phone" style="width:100%; padding:4px 6px; font-size:12px; margin-bottom:4px;" />
                <input type="email" id="pax_edit_email_${paxKey}" value="${escapeHtml(p.Email || "")}" placeholder="Email" style="width:100%; padding:4px 6px; font-size:12px;" />
              </td>
              <td>
                <input type="text" id="pax_edit_diet_${paxKey}" value="${escapeHtml(p.Dietary_Requirements || "")}" placeholder="Diet" style="width:100%; padding:4px 6px; font-size:12px; margin-bottom:4px;" />
                <input type="text" id="pax_edit_med_${paxKey}" value="${escapeHtml(p.Medical_Conditions || "")}" placeholder="Medical" style="width:100%; padding:4px 6px; font-size:12px;" />
              </td>
              <td style="white-space:nowrap;">
                <button type="button" class="btn btn-primary btn-sm" onclick="savePassengerRowEdit(event, '${b.id}', '${p.id || ""}', ${idx})">Save</button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="cancelEditPassengerRow(event)">✕</button>
              </td>
            </tr>
          `;
        }

        const alerts = [];
        if (p.Dietary_Requirements) alerts.push(`<span class="badge badge-warn">Diet: ${escapeHtml(p.Dietary_Requirements)}</span>`);
        if (p.Medical_Conditions) alerts.push(`<span class="badge badge-danger">Med: ${escapeHtml(p.Medical_Conditions)}</span>`);

        const hasMobile = Boolean(p.Passenger_Mobile && String(p.Passenger_Mobile).trim());
        const hasPhone = Boolean(p.Passenger_Phone && String(p.Passenger_Phone).trim() && p.Passenger_Phone !== p.Passenger_Mobile);

        return `
          <tr>
            <td>
              <strong><span class="copy-inline" onclick="copyText(event, '${escapeJsAttr(p.Name || "")}', 'Passenger Name')">${escapeHtml(p.Name || "-")}</span></strong>
              ${p.Passenger_Type ? `<div class="product-clean-sub">${escapeHtml(p.Passenger_Type)}</div>` : ""}
            </td>
            <td>${escapeHtml(p.Country || "-")}</td>
            <td>${escapeHtml(fmtDateDisplay(p.Date_of_Birth, "-"))}</td>
            <td class="mono">
              ${p.Passport_Number ? `<span class="copy-inline" onclick="copyText(event, '${escapeJsAttr(p.Passport_Number)}', 'Passport Number')"><strong>${escapeHtml(p.Passport_Number)}</strong></span>` : `<span class="subtitle">No passport</span>`}
            </td>
            <td>${escapeHtml(fmtDateDisplay(p.Passport_Expiry_Date, "-"))}</td>
            <td>${escapeHtml(p.Gender || "-")}</td>
            <td>
              ${hasMobile ? `<div class="mono copy-inline" onclick="copyText(event, '${escapeJsAttr(p.Passenger_Mobile)}', 'Mobile')">📱 ${escapeHtml(p.Passenger_Mobile)}</div>` : ""}
              ${hasPhone ? `<div class="mono copy-inline" onclick="copyText(event, '${escapeJsAttr(p.Passenger_Phone)}', 'Phone')">📞 ${escapeHtml(p.Passenger_Phone)}</div>` : ""}
              ${p.Email ? `<div class="product-clean-sub copy-inline" onclick="copyText(event, '${escapeJsAttr(p.Email)}', 'Email')">${escapeHtml(p.Email)}</div>` : ""}
              ${!hasMobile && !hasPhone && !p.Email ? `<span class="subtitle">-</span>` : ""}
            </td>
            <td>${alerts.length ? alerts.join(" ") : `<span class="subtitle">—</span>`}</td>
            <td>
              <button type="button" class="btn btn-secondary btn-sm" onclick="startEditPassengerRow(event, '${b.id}', '${p.id || ""}', ${idx})">Edit</button>
            </td>
          </tr>
        `;
      }).join("");

      paxBodyHtml = `
        ${addPassengerFormHtml}
        <table>
          <thead>
            <tr>
              <th>Passenger Name (Click to copy)</th>
              <th>Country</th>
              <th>Date of Birth</th>
              <th>Passport Number</th>
              <th>Passport Expiry</th>
              <th>Gender</th>
              <th>Phone / Email</th>
              <th>Dietary &amp; Medical</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>${paxRows}</tbody>
        </table>
      `;
    }
  }

  const passengersDrawerHtml = `
    <div class="inner-drawer">
      <div class="inner-drawer-header" onclick="toggleSubDrawer('${b.id}', 'passengers')">
        <div style="display:flex; gap:8px; align-items:center;">
          <span>👥 Passengers &amp; Manifest (${Array.isArray(pax) ? pax.length : "..."})</span>
          ${hasAnyHealthOrDiet ? `<span class="badge badge-danger">⚠️ Dietary / Medical Info</span>` : ""}
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="toggleAddPassengerForm(event, '${b.id}', true)">+ Add Passenger</button>
          ${Array.isArray(pax) && pax.length ? `<button type="button" class="btn btn-secondary btn-sm" onclick="copyAllManifest(event, '${b.id}')">Copy All Manifest</button>` : ""}
          <span>${drawers.passengers ? "▲" : "▼"}</span>
        </div>
      </div>
      ${drawers.passengers ? `<div class="inner-drawer-body" style="padding:0;">${paxBodyHtml}</div>` : ""}
    </div>
  `;

  // 3. NOTES, SERVICE CHECKLIST & ATTACHMENTS ACCORDION HTML
  let notesListHtml = "";

  if (checklistItems.length) {
    const rowsHtml = checklistItems.map((it) => `
      <div class="checklist-row ${it.done ? "checked" : ""}">
        <div class="checklist-left">
          <input type="checkbox" ${it.done ? "checked" : ""} onchange="toggleChecklistItemDone('${b.id}', '${it.id}', this.checked)" />
          <div>
            <div>
              ${it.date ? `<span class="badge" style="margin-right:4px;">${escapeHtml(fmtDateDisplay(it.date))}</span>` : ""}
              <strong class="checklist-service-name">${escapeHtml(it.service)}</strong>
            </div>
            ${it.note ? `<div class="product-clean-sub">${escapeHtml(it.note)}</div>` : ""}
          </div>
        </div>
        <div class="checklist-actions">
          ${!it.done ? `<button type="button" class="btn btn-primary btn-sm" onclick="convertChecklistItemToOp(event, '${b.id}', '${it.id}')">+ Add Op</button>` : `<span class="badge badge-ok">Linked</span>`}
          <button type="button" class="btn-icon" title="Remove from checklist" onclick="removeChecklistItem(event, '${b.id}', '${it.id}')">✕</button>
        </div>
      </div>
    `).join("");

    notesListHtml += `
      <div class="checklist-panel">
        <div class="checklist-panel-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:12px;">☑️ Trip Service Checklist (${doneChecklistCount}/${checklistItems.length})</strong>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openLoadServicesModal(event, '${b.id}')">+ Import More</button>
        </div>
        <div class="checklist-items">${rowsHtml}</div>
      </div>
    `;
  }

  if (dealAttachments.length) {
    const dealAttChips = dealAttachments.map((att) => `
      <button type="button" class="attachment-chip" onclick="downloadCrmAttachment(event, '${b.id}', '${att.id}', '${escapeJsAttr(att.File_Name || "Attachment")}')">
        📎 ${escapeHtml(att.File_Name || "File")} ⬇
      </button>
    `).join("");

    notesListHtml += `
      <div class="attachments-banner">
        <div>
          <strong style="font-size:12px; color:#1e40af;">📎 Booking Files (${dealAttachments.length})</strong>
          <div class="attachment-strip" style="border-top:none; margin-top:4px; padding-top:0;">${dealAttChips}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="openDealInCrm(event, '${b.id}')">Open Booking in CRM ↗</button>
      </div>
    `;
  }

  if (hasDesc) {
    notesListHtml += `
      <div class="note-card">
        <div class="note-card-meta"><span>Deal Description / General Notes</span></div>
        <div class="note-card-text">${sanitizeNoteHtml(full.Description)}</div>
      </div>
    `;
  }

  if (Array.isArray(notes) && notes.length) {
    notesListHtml += notes.map((n) => {
      const nAtts = Array.isArray(n.$attachments) ? n.$attachments : [];
      const nAttHtml = nAtts.length
        ? `<div class="attachment-strip">
            ${nAtts.map((att) => `
              <button type="button" class="attachment-chip" onclick="downloadCrmAttachment(event, '${b.id}', '${att.id}', '${escapeJsAttr(att.File_Name || "Attachment")}')">
                📎 ${escapeHtml(att.File_Name || "Attached file")} ⬇
              </button>
            `).join("")}
            <button type="button" class="attachment-chip" onclick="openDealInCrm(event, '${b.id}')">View in CRM ↗</button>
          </div>`
        : "";

      return `
        <div class="note-card">
          <div class="note-card-meta">
            <span>${escapeHtml(n.Note_Title || "Note")} · ${escapeHtml(n.Created_By?.name || "")} (${escapeHtml(fmtDateDisplay(n.Created_Time, ""))})</span>
            ${nAtts.length ? `<span class="badge badge-info">📎 ${nAtts.length} Attachment(s)</span>` : ""}
          </div>
          <div class="note-card-text">${sanitizeNoteHtml(n.Note_Content || "")}</div>
          ${nAttHtml}
        </div>
      `;
    }).join("");
  }

  if (!notesListHtml) {
    notesListHtml = `<div class="subtitle" style="margin-bottom:8px;">No notes or service checklist recorded for this Booking yet.</div>`;
  }

  const notesDrawerHtml = `
    <div class="inner-drawer">
      <div class="inner-drawer-header" onclick="toggleSubDrawer('${b.id}', 'notes')">
        <div style="display:flex; gap:8px; align-items:center;">
          <span>📝 Booking Notes, Checklist &amp; Instructions (${notesCount})</span>
          ${checklistItems.length > 0 ? `<span class="badge ${doneChecklistCount === checklistItems.length ? "badge-ok" : "badge-info"}">☑️ ${doneChecklistCount}/${checklistItems.length} Services</span>` : ""}
          ${totalAttachmentsCount > 0 ? `<span class="badge badge-info">📎 ${totalAttachmentsCount} Attachment(s)</span>` : ""}
        </div>
        <span>${drawers.notes ? "▲" : "▼"}</span>
      </div>
      ${drawers.notes ? `
        <div class="inner-drawer-body">
          ${notesListHtml}
          <div class="add-note-row">
            <input type="text" id="note_input_${b.id}" placeholder="Write a quick operational note for this Booking..." />
            <button type="button" class="btn btn-secondary btn-sm" onclick="addBookingNote('${b.id}')">+ Add Note</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;

  // 4. OPERATIONS TABLE HTML
  const progress = computeOperationsProgress(ops);
  let opsHeaderSummary = `<span>📋 Linked Operations (${Array.isArray(ops) ? ops.length : "..."})</span>`;

  if (Array.isArray(ops) && ops.length > 0) {
    const progBadgeCls = progress.percent === 100 ? "badge-ok" : (progress.percent > 0 ? "badge-info" : "badge-warn");
    opsHeaderSummary = `
      <span>📋 Linked Operations (${progress.opsCount} ops · ${progress.totalServices} active service${progress.totalServices === 1 ? "" : "s"})</span>
      <div class="progress-pill-wrap">
        <span class="subtitle">${progress.confirmedServices}/${progress.totalServices} confirmed · ${progress.paidServices}/${progress.totalServices} paid</span>
        <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%;"></div></div>
        <span class="badge ${progBadgeCls}">${progress.percent}%</span>
      </div>
    `;
  }

  let opsBodyHtml = `<div class="empty-state">Loading Booking operations...</div>`;
  if (Array.isArray(ops)) {
    const opsRows = ops.length
      ? ops.map((op) => {
          const isConfirmed = op.Bill_Status === "Supplier Confirmed" || op.Bill_Status === "Traveler Confirmation Sent" || op.Bill_Status === "Trip Ended";
          const resBadge = op.Bill_Status === "Cancelled" ? "badge-danger" : (isConfirmed ? "badge-ok" : "badge-warn");
          const billPayBadge = op.Payment_Status === "Paid" ? "badge-ok" : (op.Payment_Status === "Programmed Payment" ? "badge-info" : "badge-warn");

          return `
            <tr>
              <td><strong>${escapeHtml(fmtDateDisplay(op.Bill_Date, "-"))}</strong><br/><span class="mono subtitle">${escapeHtml(op.Name || "New")}</span></td>
              <td><strong>${escapeHtml(op.Supplier_Vendor_Name?.name || "No Supplier")}</strong><br/><span class="mono subtitle">${escapeHtml(op.Xero_Bill_Name || "")}</span></td>
              <td>${renderOperationServicesCell(op)}</td>
              <td><span class="badge ${resBadge}">${escapeHtml(op.Bill_Status || "N/A")}</span></td>
              <td>
                <span class="badge ${billPayBadge}">${escapeHtml(op.Payment_Status || "Awaiting Payment")}</span>
                ${op.Expected_Payment_Date ? `<div class="product-clean-sub">Due: ${escapeHtml(fmtDateDisplay(op.Expected_Payment_Date))}</div>` : ""}
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="openPayModal('${b.id}', '${op.id}')">Manage / Pay</button>
              </td>
            </tr>
          `;
        }).join("")
      : `<tr><td colspan="6" class="empty-state">This Booking has no Operations yet. Click "+ Add Operations" to create them.</td></tr>`;

    opsBodyHtml = `
      <table>
        <thead>
          <tr>
            <th>Service Date / ID</th>
            <th>Supplier / Ref</th>
            <th>Service Details &amp; Schedules</th>
            <th>Reservation Status</th>
            <th>Payment Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${opsRows}</tbody>
      </table>
    `;
  }

  const opsSectionHtml = `
    <div class="ops-table-box">
      <div class="ops-table-header">
        ${opsHeaderSummary}
      </div>
      ${opsBodyHtml}
    </div>
  `;

  return `${subheaderHtml}${passengersDrawerHtml}${notesDrawerHtml}${opsSectionHtml}`;
}

function renderFinanceOverview() {
  const container = $("financeContainer");
  if (!container) return;

  if (!STATE.filteredBookings.length) {
    container.innerHTML = `<div class="empty-state">No Bookings match current filters.</div>`;
    return;
  }

  const rows = STATE.filteredBookings.map((b) => {
    const full = STATE.dealFullRecord[b.id] || b;
    const ops = STATE.operationsByDeal[b.id] || [];
    const hasLoadedOps = Array.isArray(STATE.operationsByDeal[b.id]);
    const totalOpsCost = ops.reduce((acc, op) => acc + (parseFloat(op.Grand_Total) || 0), 0);
    const grossSale = parseFloat(full.Total_Gross_Price || full.Amount) || 0;
    const netSale = parseFloat(full.Total_Net_Amount || full.Amount) || 0;
    const quotedCost = parseFloat(full.Total_Trip_Cost2) || 0;
    const realMargin = netSale > 0 && hasLoadedOps ? (((netSale - totalOpsCost) / netSale) * 100).toFixed(1) : null;
    const payBadge = full.Booking_Payment_Status === "Paid" ? "badge-ok" : "badge-warn";

    return `
      <tr>
        <td class="mono"><strong>#${escapeHtml(full.Booking_Number || "N/A")}</strong><br/>${getPlatformBadgeHtml(full.Sales_Platform)}</td>
        <td><strong>${escapeHtml(full.Deal_Name || "Untitled")}</strong><br/><span class="subtitle">Start: ${escapeHtml(fmtDateDisplay(full.Trip_Start_Date, "-"))}</span></td>
        <td><span class="badge ${payBadge}">${escapeHtml(full.Booking_Payment_Status || "Unpaid")}</span></td>
        <td>${fmtMoney(grossSale)}</td>
        <td><strong>${fmtMoney(netSale)}</strong></td>
        <td>${fmtMoney(quotedCost)}</td>
        <td>${hasLoadedOps ? `<strong>${fmtMoney(totalOpsCost)}</strong> (${ops.length} ops)` : `<button class="btn btn-secondary btn-sm" onclick="loadFinanceRowOps('${b.id}')">Calculate Ops</button>`}</td>
        <td>${realMargin !== null ? `<strong style="color:${parseFloat(realMargin) >= 20 ? "var(--success)" : "var(--danger)"}">${realMargin}%</strong>` : `<span class="subtitle">—</span>`}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Booking / Brand</th>
          <th>Trip Name</th>
          <th>Client Payment</th>
          <th>Gross Sale</th>
          <th>Net Sale</th>
          <th>Quoted Cost</th>
          <th>Actual Ops Cost</th>
          <th>Real Margin</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

window.loadFinanceRowOps = async function (dealId) {
  await fetchOperationsForDeal(dealId);
  renderFinanceOverview();
};

async function liveSearchCatalog(entityName, term) {
  try {
    const res = await ZOHO.CRM.API.searchRecord({
      Entity: entityName,
      Type: "word",
      Query: term
    });
    return (res && res.data) ? res.data : [];
  } catch (e) {
    return [];
  }
}

async function loadVendorsAndProducts() {
  try {
    const [vRes, pRes] = await Promise.all([
      ZOHO.CRM.API.getAllRecords({ Entity: "Vendors", page: 1, per_page: 200 }),
      ZOHO.CRM.API.getAllRecords({ Entity: "Products", page: 1, per_page: 200 })
    ]);
    STATE.vendors = vRes?.data || [];
    STATE.products = pRes?.data || [];
    STATE.vendors.sort((a, b) => (a.Vendor_Name || "").localeCompare(b.Vendor_Name || ""));
    STATE.products.sort((a, b) => (a.Product_Name || "").localeCompare(b.Product_Name || ""));
  } catch (e) {
    console.warn("Error loading catalogs:", e);
  }
}

window.openBulkModal = function (dealId, prefill = null) {
  const targetId = dealId || STATE.expandedBookingId;
  const b = STATE.bookings.find((item) => item.id === targetId);
  if (!b) return;

  if (!prefill) {
    STATE.pendingChecklistItemId = null;
  }

  STATE.expandedBookingId = b.id;
  if ($("modalBookingLabel")) $("modalBookingLabel").textContent = `#${b.Booking_Number} (${b.Deal_Name})`;
  if ($("bulkTbody")) $("bulkTbody").innerHTML = "";
  addBulkRow(prefill);
  toggleModal("bulkModal", true);
};

function renderDatalistOptions(datalistEl, items, nameKey) {
  datalistEl.innerHTML = items.map((item) => {
    const label = item[nameKey] || "";
    return `<option value="${label.replace(/"/g, "&quot;")}"></option>`;
  }).join("");
}

function addBulkRow(prefill = null) {
  const b = STATE.bookings.find((item) => item.id === STATE.expandedBookingId);
  if (!b) return;

  const tbody = $("bulkTbody");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const rowUid = "row_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  const accountOptions = BOOKS_ACCOUNTS
    .map((acc) => `<option value="${acc}">${acc}</option>`)
    .join("");

  const defaultRowDate = prefill?.date || toIsoDateInput(b.Trip_Start_Date);
  const prefillService = prefill?.serviceName || "";

  tr.innerHTML = `
    <td><input type="date" class="row-date" value="${defaultRowDate}" required /></td>
    <td><input type="text" class="row-time" placeholder="e.g. 08:00 AM or Variable" style="width:140px;" /></td>
    <td>
      <input type="text" class="row-vendor-input" list="dl_v_${rowUid}" placeholder="Type or select supplier..." autocomplete="off" style="min-width:170px;" />
      <input type="hidden" class="row-vendor" />
      <datalist id="dl_v_${rowUid}"></datalist>
    </td>
    <td>
      <input type="text" class="row-product-input" list="dl_p_${rowUid}" value="${escapeHtml(prefillService)}" placeholder="Type or select service..." autocomplete="off" style="min-width:170px;" />
      <input type="hidden" class="row-product" />
      <datalist id="dl_p_${rowUid}"></datalist>
    </td>
    <td><input type="number" class="row-pax" value="${b.Number_of_Passengers || 1}" min="1" style="width:60px" /></td>
    <td><input type="number" step="0.01" class="row-cost" placeholder="0.00" style="width:85px" /></td>
    <td>
      <select class="row-payflow">
        <option value="PO_ONLY">Create PO Only</option>
        <option value="SCHEDULED">Scheduled Payment (Due)</option>
        <option value="PAID_NOW">Paid Immediately (Paid)</option>
      </select>
    </td>
    <td>
      <input type="date" class="row-paydate" value="${new Date().toISOString().split("T")[0]}" />
      <select class="row-paymethod" style="margin-top:4px;">${accountOptions}</select>
    </td>
    <td><button type="button" class="btn-icon" onclick="this.closest('tr').remove()">✕</button></td>
  `;

  const vInput = tr.querySelector(".row-vendor-input");
  const vHidden = tr.querySelector(".row-vendor");
  const vList = tr.querySelector(`#dl_v_${rowUid}`);

  const pInput = tr.querySelector(".row-product-input");
  const pHidden = tr.querySelector(".row-product");
  const pList = tr.querySelector(`#dl_p_${rowUid}`);
  const costInput = tr.querySelector(".row-cost");

  renderDatalistOptions(vList, STATE.vendors, "Vendor_Name");
  renderDatalistOptions(pList, STATE.products, "Product_Name");

  if (prefillService) {
    const exactProd = STATE.products.find((p) => (p.Product_Name || "").toLowerCase() === prefillService.toLowerCase());
    if (exactProd) {
      pHidden.value = exactProd.id;
      if (parseFloat(exactProd.Unit_Price) > 0) costInput.value = parseFloat(exactProd.Unit_Price).toFixed(2);
    } else {
      liveSearchCatalog("Products", prefillService).then((found) => {
        if (found.length) {
          found.forEach((item) => {
            if (!STATE.products.some((existing) => existing.id === item.id)) STATE.products.push(item);
          });
          renderDatalistOptions(pList, STATE.products, "Product_Name");
          const match = STATE.products.find((p) => (p.Product_Name || "").toLowerCase() === prefillService.toLowerCase());
          if (match) {
            pHidden.value = match.id;
            if (parseFloat(match.Unit_Price) > 0) costInput.value = parseFloat(match.Unit_Price).toFixed(2);
          }
        }
      });
    }
  }

  let vTimer = null;
  vInput.addEventListener("input", () => {
    const val = vInput.value.trim();
    const match = STATE.vendors.find((v) => (v.Vendor_Name || "").toLowerCase() === val.toLowerCase());
    vHidden.value = match ? match.id : "";

    clearTimeout(vTimer);
    if (val.length >= 2) {
      vTimer = setTimeout(async () => {
        const found = await liveSearchCatalog("Vendors", val);
        if (found.length) {
          found.forEach((item) => {
            if (!STATE.vendors.some((existing) => existing.id === item.id)) STATE.vendors.push(item);
          });
          renderDatalistOptions(vList, STATE.vendors, "Vendor_Name");
          const exact = STATE.vendors.find((v) => (v.Vendor_Name || "").toLowerCase() === val.toLowerCase());
          if (exact) vHidden.value = exact.id;
        }
      }, 300);
    }
  });

  let pTimer = null;
  pInput.addEventListener("input", () => {
    const val = pInput.value.trim();
    const match = STATE.products.find((p) => (p.Product_Name || "").toLowerCase() === val.toLowerCase());
    pHidden.value = match ? match.id : "";
    if (match && parseFloat(match.Unit_Price) > 0) costInput.value = parseFloat(match.Unit_Price).toFixed(2);

    clearTimeout(pTimer);
    if (val.length >= 2) {
      pTimer = setTimeout(async () => {
        const found = await liveSearchCatalog("Products", val);
        if (found.length) {
          found.forEach((item) => {
            if (!STATE.products.some((existing) => existing.id === item.id)) STATE.products.push(item);
          });
          renderDatalistOptions(pList, STATE.products, "Product_Name");
          const exact = STATE.products.find((p) => (p.Product_Name || "").toLowerCase() === val.toLowerCase());
          if (exact) {
            pHidden.value = exact.id;
            if (parseFloat(exact.Unit_Price) > 0) costInput.value = parseFloat(exact.Unit_Price).toFixed(2);
          }
        }
      }, 300);
    }
  });

  tbody.appendChild(tr);
}

async function submitBulkOperations() {
  const b = STATE.bookings.find((item) => item.id === STATE.expandedBookingId);
  if (!b) return;

  const rows = Array.from(document.querySelectorAll("#bulkTbody tr"));
  if (!rows.length) return;

  const isGroup = $("bulkIsGroup")?.checked || false;
  const recordsToInsert = [];

  for (const r of rows) {
    const serviceDate = r.querySelector(".row-date").value;
    const serviceTime = (r.querySelector(".row-time")?.value || "").trim();
    const vendorId = r.querySelector(".row-vendor").value;
    const productId = r.querySelector(".row-product").value;
    const pax = parseInt(r.querySelector(".row-pax").value, 10) || 1;
    const costPerPerson = parseFloat(r.querySelector(".row-cost").value) || 0;
    const payFlow = r.querySelector(".row-payflow").value;
    const payDate = r.querySelector(".row-paydate").value;
    const payMethod = r.querySelector(".row-paymethod").value;

    if (!vendorId || !productId || !serviceDate) {
      showToast("Please select a valid Supplier and Service from the list, and enter a Service Date.");
      return;
    }

    const totalRowCost = pax * costPerPerson;
    const productRow = {
      Product_Name: productId,
      Trip_Start_Date: serviceDate,
      Qty: pax,
      List_Price: costPerPerson
    };
    if (serviceTime) productRow.Start_Time = serviceTime;

    const payload = {
      Booking_Name: b.id,
      Booking_Number: String(b.Booking_Number || ""),
      Sales_Platform: b.Sales_Platform || "Bamba Travel",
      Supplier_Vendor_Name: vendorId,
      Bill_Date: serviceDate,
      Bill_Status: "Supplier Confirmation Awaited",
      Payment_Status: "Awaiting Payment",
      Group_Departure_Operation: isGroup,
      Passenger_Details: b.Contact_Name?.name || "",
      Accommodation_Pick_up_Point: b.Accommodation_Pick_up_Point || "",
      Flight_Details: b.Flight_Details || "",
      Product_Details: [productRow]
    };

    if (payFlow === "SCHEDULED" && payDate) {
      payload.Expected_Payment_Date = payDate;
    } else if (payFlow === "PAID_NOW" && payDate) {
      payload.st_Payment_Date = payDate;
      payload.st_Payment_Amount = totalRowCost;
      payload.st_Payment_platform = payMethod;
      if (STATE.currentUser?.id) payload.Payment_By = STATE.currentUser.id;
      payload.st_Payment_to_Books = true;
    }

    recordsToInsert.push(payload);
  }

  try {
    showToast("Creating operations in Zoho CRM...");
    await ZOHO.CRM.API.insertRecord({
      Entity: "Bills",
      APIData: recordsToInsert,
      Trigger: ["workflow"]
    });

    if (STATE.pendingChecklistItemId && STATE.checklistByDeal[b.id]?.items) {
      const targetItem = STATE.checklistByDeal[b.id].items.find((it) => it.id === STATE.pendingChecklistItemId);
      if (targetItem) {
        targetItem.done = true;
        await persistChecklistToCrm(b.id, STATE.checklistByDeal[b.id].items);
      }
      STATE.pendingChecklistItemId = null;
    }

    toggleModal("bulkModal", false);
    showToast(`${recordsToInsert.length} operation(s) created successfully!`);
    await fetchOperationsForDeal(b.id);
    autoMatchChecklistWithOperations(b.id);
    renderBookingsAccordion();
  } catch (err) {
    console.error("Error inserting into Bills:", err);
    showToast("Error creating operations. Check browser console for details.");
  }
}

// --- MANAGE / PAY & SERVICE SCHEDULES EDITOR ---
function renderOpServicesEditor(fullOp) {
  const wrap = $("opServicesEditorWrap");
  if (!wrap) return;

  const lines = Array.isArray(fullOp?.Product_Details) ? fullOp.Product_Details : [];
  if (!lines.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:12px;">No subform service lines found on this Operation.</div>`;
    return;
  }

  const rowsHtml = lines.map((line, idx) => {
    const prodName = line.Product_Name?.name || line.Product_Name || "Service";
    const startIso = toIsoDateInput(line.Trip_Start_Date);
    const startTime = line.Start_Time || "";
    const qty = line.Qty ?? 1;
    const price = line.List_Price ?? 0;

    return `
      <tr data-line-idx="${idx}">
        <td><strong>${escapeHtml(prodName)}</strong></td>
        <td><input type="date" class="op-line-date" value="${escapeHtml(startIso)}" style="padding:4px 6px; font-size:12px;" /></td>
        <td><input type="text" class="op-line-time" value="${escapeHtml(startTime)}" placeholder="e.g. 07:30 AM / Variable" style="width:165px; padding:4px 6px; font-size:12px;" /></td>
        <td><input type="number" class="op-line-pax" value="${escapeHtml(qty)}" min="1" style="width:65px; padding:4px 6px; font-size:12px;" /></td>
        <td><input type="number" step="0.01" class="op-line-price" value="${escapeHtml(price)}" style="width:85px; padding:4px 6px; font-size:12px;" /></td>
      </tr>
    `;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Start Date</th>
          <th>Start Time / Schedule</th>
          <th>Pax</th>
          <th>Cost pp</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

window.openPayModal = async function (dealId, opId) {
  STATE.expandedBookingId = dealId;
  const ops = STATE.operationsByDeal[dealId] || [];
  const op = ops.find((o) => o.id === opId);
  if (!op) return;

  if ($("payOpId")) $("payOpId").value = op.id;
  if ($("payOpName")) $("payOpName").textContent = op.Name || "Operation";
  if ($("payResStatus")) $("payResStatus").value = op.Bill_Status || "Supplier Confirmation Awaited";
  if ($("payActionType")) $("payActionType").value = "NONE";
  $("scheduledFields")?.classList.add("hidden");
  $("paidNowFields")?.classList.add("hidden");

  const today = new Date().toISOString().split("T")[0];
  if ($("payExpectedDate")) $("payExpectedDate").value = toIsoDateInput(op.Expected_Payment_Date) || today;
  if ($("payDate")) $("payDate").value = today;
  if ($("payAmount")) $("payAmount").value = op.Grand_Total || 0;
  if ($("payDetailsNotes")) $("payDetailsNotes").value = op.Details_of_Product || "";
  if ($("opServicesEditorWrap")) {
    $("opServicesEditorWrap").innerHTML = `<div class="empty-state" style="padding:12px;">Loading service schedules...</div>`;
  }

  toggleModal("payModal", true);

  let fullOp = STATE.opFullRecord[opId];
  if (!fullOp) {
    try {
      const res = await ZOHO.CRM.API.getRecord({ Entity: "Bills", RecordID: opId });
      if (res?.data?.[0]) {
        fullOp = res.data[0];
        STATE.opFullRecord[opId] = fullOp;
      }
    } catch (e) {
      console.warn("Could not load full operation record:", e);
    }
  }

  STATE.editingOpRecord = fullOp || op;
  if ($("payDetailsNotes")) {
    $("payDetailsNotes").value = (fullOp?.Details_of_Product ?? op.Details_of_Product) || "";
  }
  renderOpServicesEditor(STATE.editingOpRecord);
};

async function submitOperationUpdate() {
  const dealId = STATE.expandedBookingId;
  const opId = $("payOpId")?.value;
  const resStatus = $("payResStatus")?.value;
  const actionType = $("payActionType")?.value;
  const detailsNotes = ($("payDetailsNotes")?.value || "").trim();
  const ops = STATE.operationsByDeal[dealId] || [];
  const op = STATE.editingOpRecord || ops.find((o) => o.id === opId);

  const updateData = {
    id: opId,
    Bill_Status: resStatus,
    Details_of_Product: detailsNotes
  };

  // Collect updated Product_Details rows (Start Date, Start Time, Pax, List_Price)
  const existingLines = Array.isArray(op?.Product_Details) ? op.Product_Details : [];
  const editorRows = Array.from(document.querySelectorAll("#opServicesEditorWrap tbody tr"));

  if (existingLines.length && editorRows.length) {
    const updatedProductDetails = existingLines.map((origLine, idx) => {
      const tr = editorRows[idx];
      const rowPayload = {};
      if (origLine.id) rowPayload.id = origLine.id;

      const prodId = origLine.Product_Name?.id || origLine.Product_Name;
      if (prodId) rowPayload.Product_Name = prodId;

      if (tr) {
        const dtVal = tr.querySelector(".op-line-date")?.value || "";
        const tmVal = (tr.querySelector(".op-line-time")?.value || "").trim();
        const paxVal = parseInt(tr.querySelector(".op-line-pax")?.value, 10) || 1;
        const priceVal = parseFloat(tr.querySelector(".op-line-price")?.value) || 0;

        if (dtVal) rowPayload.Trip_Start_Date = dtVal;
        rowPayload.Start_Time = tmVal;
        rowPayload.Qty = paxVal;
        rowPayload.List_Price = priceVal;
      }
      return rowPayload;
    });

    updateData.Product_Details = updatedProductDetails;
  }

  if (actionType === "SCHEDULED") {
    updateData.Expected_Payment_Date = $("payExpectedDate")?.value;
  } else if (actionType === "PAID_NOW") {
    const payDate = $("payDate")?.value;
    const payAmount = parseFloat($("payAmount")?.value) || 0;
    const payMethod = $("payMethod")?.value;
    const sendBooks = $("paySendBooks")?.checked;

    if (!op?.st_Payment_to_Books) {
      updateData.st_Payment_Date = payDate;
      updateData.st_Payment_Amount = payAmount;
      updateData.st_Payment_platform = payMethod;
      if (STATE.currentUser?.id) updateData.Payment_By = STATE.currentUser.id;
      updateData.st_Payment_to_Books = sendBooks;
    } else if (!op?.nd_Payment_to_Books) {
      updateData.nd_Payment_Date = payDate;
      updateData.nd_Payment_Amount = payAmount;
      updateData.nd_Payment_By = payMethod;
      updateData.nd_Payment_to_Books = sendBooks;
    } else {
      updateData.rd_Payment_Date = payDate;
      updateData.rd_Payment_Amount = payAmount;
      updateData.rd_Payment_By = payMethod;
      updateData.rd_Payment_to_Books = sendBooks;
    }
  }

  try {
    showToast("Updating operation & schedules...");
    await ZOHO.CRM.API.updateRecord({
      Entity: "Bills",
      APIData: updateData,
      Trigger: ["workflow"]
    });

    delete STATE.opFullRecord[opId];
    STATE.editingOpRecord = null;
    toggleModal("payModal", false);
    showToast("Operation updated and synced with Zoho CRM.");
    setTimeout(async () => {
      await fetchOperationsForDeal(dealId);
      renderBookingsAccordion();
    }, 1500);
  } catch (err) {
    console.error("Error updating Bill:", err);
    showToast("Error updating operation.");
  }
}
