// OPS Hub v2 — Step 2 (Clean SDK Init + Attachments + Explicit Passport + Clean Notes)
const STATE = {
  bookings: [],
  filteredBookings: [],
  expandedBookingId: null,
  operationsByDeal: {},
  passengersByDeal: {},
  notesByDeal: {},
  attachmentsByDeal: {},
  dealFullRecord: {},
  openSubDrawers: {},
  crmUsers: [],
  vendors: [],
  products: [],
  currentUser: null,
  activeTab: "operations"
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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function parseCleanProductDetails(rawText) {
  if (!rawText) return { title: "No service details", meta: "" };

  const lines = String(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanedItems = lines.map((line) => {
    let clean = line.replace(/^\[[^\]]*\]\s*/, "");
    let paxInfo = "";
    const paxMatch = clean.match(/\|\s*[a-f0-9]{15,}:\s*(\d+\s*PAX)/i);
    if (paxMatch) {
      paxInfo = paxMatch[1].toUpperCase();
    }
    clean = clean.replace(/\s*\|\s*[a-f0-9]{15,}:.*$/i, "");
    clean = clean.replace(/\bnull\b/gi, "").replace(/\s{2,}/g, " ").trim();
    return { name: clean || "Service", pax: paxInfo };
  });

  const titles = cleanedItems.map((i) => i.name).join(" • ");
  const paxList = [...new Set(cleanedItems.map((i) => i.pax).filter(Boolean))].join(", ");
  return { title: titles, meta: paxList };
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

  ZOHO.embeddedApp.on("PageLoad", async function () {
    if (statusEl) {
      statusEl.textContent = "Zoho Connected";
      statusEl.className = "badge badge-ok";
    }
    try {
      await initApp();
    } catch (err) {
      console.error("initApp error:", err);
      if (statusEl) {
        statusEl.textContent = "Init Error";
        statusEl.className = "badge badge-danger";
      }
    }
  });

  ZOHO.embeddedApp.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootZohoSDK);
} else {
  bootZohoSDK();
}

async function initApp() {
  try {
    const [userRes, usersListRes] = await Promise.all([
      ZOHO.CRM.CONFIG.getCurrentUser(),
      ZOHO.CRM.API.getAllUsers({ Type: "ActiveUsers" })
    ]);
    STATE.currentUser = userRes?.users?.[0] || null;
    STATE.crmUsers = usersListRes?.users || [];
  } catch (e) {
    console.warn("Could not fetch CRM users", e);
  }

  populatePayModalAccounts();
  bindEvents();
  await Promise.all([loadBookings(), loadVendorsAndProducts()]);
}

function populatePayModalAccounts() {
  const payMethodSel = $("payMethod");
  if (payMethodSel) {
    payMethodSel.innerHTML = BOOKS_ACCOUNTS
      .map((acc) => `<option value="${acc}">${acc}</option>`)
      .join("");
  }
}

function bindEvents() {
  if ($("filterStage")) $("filterStage").addEventListener("change", loadBookings);
  if ($("filterPlatform")) $("filterPlatform").addEventListener("change", applyFilters);
  if ($("filterOwner")) $("filterOwner").addEventListener("change", applyFilters);
  if ($("filterStartDate")) $("filterStartDate").addEventListener("change", applyFilters);
  if ($("searchInput")) $("searchInput").addEventListener("input", applyFilters);
  if ($("btnRefresh")) {
    $("btnRefresh").addEventListener("click", () => {
      STATE.operationsByDeal = {};
      STATE.passengersByDeal = {};
      STATE.notesByDeal = {};
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

  if ($("closeBulkModal")) $("closeBulkModal").onclick = () => toggleModal("bulkModal", false);
  if ($("cancelBulk")) $("cancelBulk").onclick = () => toggleModal("bulkModal", false);
  if ($("btnAddRow")) $("btnAddRow").onclick = addBulkRow;
  if ($("submitBulk")) $("submitBulk").onclick = submitBulkOperations;

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

async function loadBookings() {
  const accordion = $("bookingsAccordion");
  if (accordion) accordion.innerHTML = `<div class="empty-state">Loading Bookings...</div>`;
  const stage = $("filterStage")?.value || "Booking Won";

  try {
    const res = await ZOHO.CRM.API.searchRecord({
      Entity: "Deals",
      Type: "criteria",
      Query: `(Stage:equals:${stage})`
    });

    STATE.bookings = (res && res.data) ? res.data : [];
    buildOwnerFilterAndWorkload();
    applyFilters();
  } catch (err) {
    console.error("Error loading Deals:", err);
    if (accordion) accordion.innerHTML = `<div class="empty-state">No records found or query error.</div>`;
  }
}

function buildOwnerFilterAndWorkload() {
  const counts = {};
  STATE.bookings.forEach((b) => {
    const ownerId = b.Owner?.id || "UNASSIGNED";
    const ownerName = b.Owner?.name || "Unassigned";
    if (!counts[ownerId]) counts[ownerId] = { id: ownerId, name: ownerName, count: 0 };
    counts[ownerId].count++;
  });

  const ownerList = Object.values(counts).sort((a, b) => b.count - a.count);
  const sel = $("filterOwner");
  if (sel) {
    const current = sel.value || "ALL";
    sel.innerHTML = `<option value="ALL">All Coordinators (${STATE.bookings.length})</option>` +
      ownerList.map((o) => `<option value="${o.id}">${escapeHtml(o.name)} (${o.count})</option>`).join("");
    if ([...sel.options].some((opt) => opt.value === current)) sel.value = current;
  }

  const workloadBar = $("ownerWorkloadBar");
  if (workloadBar) {
    workloadBar.innerHTML = ownerList.map((o) => `
      <span class="workload-chip" onclick="quickFilterOwner('${o.id}')">
        <strong>${escapeHtml(o.name)}:</strong> ${o.count}
      </span>
    `).join("");
  }
}

window.quickFilterOwner = function (ownerId) {
  const sel = $("filterOwner");
  if (!sel) return;
  sel.value = sel.value === ownerId ? "ALL" : ownerId;
  applyFilters();
};

function matchesStartDateWindow(dateStr, windowKey) {
  if (windowKey === "ALL") return true;
  if (!dateStr) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return false;

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

function applyFilters() {
  const platform = $("filterPlatform")?.value || "ALL";
  const owner = $("filterOwner")?.value || "ALL";
  const startWin = $("filterStartDate")?.value || "ALL";
  const q = ($("searchInput")?.value || "").trim().toLowerCase();

  STATE.filteredBookings = STATE.bookings.filter((b) => {
    const matchPlat = platform === "ALL" || b.Sales_Platform === platform;
    const bOwnerId = b.Owner?.id || "UNASSIGNED";
    const matchOwner = owner === "ALL" || bOwnerId === owner;
    const matchDate = matchesStartDateWindow(b.Trip_Start_Date, startWin);
    const text = `${b.Booking_Number || ""} ${b.Deal_Name || ""} ${b.Contact_Name?.name || ""} ${b.Owner?.name || ""}`.toLowerCase();
    return matchPlat && matchOwner && matchDate && text.includes(q);
  });

  renderBookingsAccordion();
  if (STATE.activeTab === "finance") renderFinanceOverview();
}

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
    const isExpanded = STATE.expandedBookingId === b.id;
    const opsBadge = b.Operations_Stage === "Nothing is booked" ? "badge-danger" : "badge-info";
    const clientPayBadge = b.Booking_Payment_Status === "Paid" ? "badge-ok" : "badge-warn";
    const ownerName = b.Owner?.name || "Unassigned";

    return `
      <div class="accordion-item ${isExpanded ? "expanded" : ""}" id="acc_${b.id}">
        <div class="accordion-header" onclick="toggleBookingAccordion('${b.id}')">
          <div class="acc-id-col">
            <span class="mono"><strong>#${escapeHtml(b.Booking_Number || "N/A")}</strong></span>
            ${getPlatformBadgeHtml(b.Sales_Platform)}
          </div>

          <div class="acc-main-col">
            <div class="acc-title">${escapeHtml(b.Deal_Name || "Untitled Booking")}</div>
            <div class="acc-sub">
              Passenger: <strong>${escapeHtml(b.Contact_Name?.name || "No passenger")}</strong> · ${b.Number_of_Passengers || 1} PAX · Owner: <strong>${escapeHtml(ownerName)}</strong>
            </div>
          </div>

          <div class="acc-dates-col">
            <span><strong>Start:</strong> ${b.Trip_Start_Date || "No date"}</span>
            <span class="subtitle">End: ${b.Trip_End_Date || "-"} (${b.Trip_Duration_Days || "?"}d)</span>
          </div>

          <div class="acc-status-col">
            <span class="badge ${opsBadge}">${escapeHtml(b.Operations_Stage || "Pending")}</span>
            <span class="badge ${clientPayBadge}">Client: ${escapeHtml(b.Booking_Payment_Status || "Unpaid")}</span>
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
      return;
    }
    throw new Error("Fallback search");
  } catch (e) {
    const searchRes = await ZOHO.CRM.API.searchRecord({
      Entity: "Bills",
      Type: "criteria",
      Query: `(Booking_Name:equals:${dealId})`
    });
    STATE.operationsByDeal[dealId] = (searchRes && searchRes.data) ? searchRes.data : [];
  }
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
    STATE.notesByDeal[dealId] = (relNotes && relNotes.data) ? relNotes.data : [];
  } catch (e) {
    STATE.notesByDeal[dealId] = [];
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
    const booking = STATE.bookings.find((b) => b.id === dealId);
    if (booking && userObj) {
      booking.Owner = { id: userObj.id, name: userObj.full_name };
    }
    buildOwnerFilterAndWorkload();
    renderBookingsAccordion();
    showToast(`Assigned to ${userObj?.full_name || "coordinator"}`);
  } catch (err) {
    console.error("Error updating owner:", err);
    showToast("Could not update Booking Owner.");
  }
};

window.copyAllManifest = function (e, dealId) {
  if (e) e.stopPropagation();
  const paxList = STATE.passengersByDeal[dealId] || [];
  const b = STATE.bookings.find((item) => item.id === dealId);
  if (!paxList.length) {
    showToast("No passengers to copy.");
    return;
  }

  const lines = paxList.map((p, idx) => {
    const parts = [
      `${idx + 1}. ${p.Name || "Unnamed"}`,
      p.Country ? `Nationality: ${p.Country}` : "",
      p.Date_of_Birth ? `DOB: ${p.Date_of_Birth}` : "",
      p.Passport_Number ? `Passport: ${p.Passport_Number}` : "",
      p.Passport_Expiry_Date ? `Exp: ${p.Passport_Expiry_Date}` : "",
      p.Gender ? `Gender: ${p.Gender}` : "",
      p.Dietary_Requirements ? `Diet: ${p.Dietary_Requirements}` : "",
      p.Medical_Conditions ? `Medical: ${p.Medical_Conditions}` : ""
    ].filter(Boolean);
    return parts.join(" | ");
  });

  const header = `Booking #${b?.Booking_Number || ""} — ${b?.Deal_Name || ""} (${paxList.length} PAX)\n`;
  navigator.clipboard.writeText(header + lines.join("\n"));
  showToast(`Copied manifest for ${paxList.length} passenger(s)!`);
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
  const dealAttachments = STATE.attachmentsByDeal[b.id] || [];
  const drawers = STATE.openSubDrawers[b.id] || { passengers: true, notes: false };

  const noteAttachmentsCount = Array.isArray(notes)
    ? notes.reduce((sum, n) => sum + (Array.isArray(n.$attachments) ? n.$attachments.length : 0), 0)
    : 0;
  const totalAttachmentsCount = noteAttachmentsCount + dealAttachments.length;

  const hasDesc = Boolean(full.Description && String(full.Description).trim());
  const notesCount = (Array.isArray(notes) ? notes.length : 0) + (hasDesc ? 1 : 0);

  const currentOwnerId = full.Owner?.id || b.Owner?.id || "";
  const ownerOptions = STATE.crmUsers.length
    ? STATE.crmUsers.map((u) => `<option value="${u.id}" ${u.id === currentOwnerId ? "selected" : ""}>${escapeHtml(u.full_name)}</option>`).join("")
    : `<option value="${currentOwnerId}">${escapeHtml(full.Owner?.name || "Unassigned")}</option>`;

  const travefyBtn = full.Travefy_URL
    ? `<a href="${full.Travefy_URL}" target="_blank" class="btn btn-secondary btn-sm">Open Travefy ↗</a>`
    : `<span class="badge badge-warn">No Travefy URL</span>`;

  const hasAnyHealthOrDiet = Array.isArray(pax) && pax.some(
    (p) => Boolean((p.Dietary_Requirements && String(p.Dietary_Requirements).trim()) || (p.Medical_Conditions && String(p.Medical_Conditions).trim()))
  );

  // 1. SUBHEADER HTML
  const subheaderHtml = `
    <div class="booking-subheader">
      <div class="subheader-top">
        <div class="subheader-id-group">
          <div class="copyable-id-box">
            <span>#${escapeHtml(full.Booking_Number || "N/A")}</span>
            ${full.Booking_Number ? `<button type="button" class="copy-btn-mini" onclick="copyText(event, '${escapeHtml(full.Booking_Number)}', 'Booking ID')">Copy ID</button>` : ""}
          </div>

          <button type="button" class="badge ${notesCount > 0 ? "badge-warn" : ""}" style="cursor:pointer; border:none;" onclick="toggleSubDrawer('${b.id}', 'notes')">
            📝 Notes (${notesCount})
          </button>

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
          <select style="padding:4px 8px; font-size:12px;" onchange="assignBookingOwner('${b.id}', this.value)">
            ${ownerOptions}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="openDealInCrm(event, '${b.id}')">Open in CRM ↗</button>
          ${travefyBtn}
          <button class="btn btn-primary btn-sm" onclick="openBulkModal('${b.id}')">+ Add Operations</button>
        </div>
      </div>

      <div class="subheader-grid">
        <div class="meta-item">
          <span class="meta-label">Lead Passenger &amp; Contact</span>
          <span class="meta-val">
            <span class="copy-inline" onclick="copyText(event, '${escapeHtml(full.Contact_Name?.name || "")}', 'Name')">${escapeHtml(full.Contact_Name?.name || "N/A")}</span>
            ${full.Email ? ` · <span class="copy-inline" onclick="copyText(event, '${escapeHtml(full.Email)}', 'Email')">${escapeHtml(full.Email)}</span>` : ""}
            ${full.Phone ? ` · <span class="copy-inline" onclick="copyText(event, '${escapeHtml(full.Phone)}', 'Phone')">${escapeHtml(full.Phone)}</span>` : ""}
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
          <span class="meta-label">Sales Order / Service Type</span>
          <span class="meta-val">${escapeHtml(full.Sales_Order_Number || "No SO")} · ${escapeHtml(full.Interested_In_Services || "Tailor-Made")}</span>
        </div>
      </div>
    </div>
  `;

  // 2. PASSENGERS ACCORDION HTML
  let paxBodyHtml = `<div class="empty-state">Loading passengers from CRM...</div>`;
  if (Array.isArray(pax)) {
    if (!pax.length) {
      paxBodyHtml = `<div class="empty-state" style="padding:14px;">No passenger records linked to this Booking yet.</div>`;
    } else {
      const paxRows = pax.map((p) => {
        const alerts = [];
        if (p.Dietary_Requirements) alerts.push(`<span class="badge badge-warn">Diet: ${escapeHtml(p.Dietary_Requirements)}</span>`);
        if (p.Medical_Conditions) alerts.push(`<span class="badge badge-danger">Med: ${escapeHtml(p.Medical_Conditions)}</span>`);

        return `
          <tr>
            <td>
              <strong><span class="copy-inline" onclick="copyText(event, '${escapeHtml(p.Name || "")}', 'Passenger Name')">${escapeHtml(p.Name || "-")}</span></strong>
              ${p.Passenger_Type ? `<div class="product-clean-sub">${escapeHtml(p.Passenger_Type)}</div>` : ""}
            </td>
            <td>${escapeHtml(p.Country || "-")}</td>
            <td class="mono">${escapeHtml(p.Date_of_Birth || "-")}</td>
            <td class="mono">
              ${p.Passport_Number ? `<span class="copy-inline" onclick="copyText(event, '${escapeHtml(p.Passport_Number)}', 'Passport Number')"><strong>${escapeHtml(p.Passport_Number)}</strong></span>` : `<span class="subtitle">No passport</span>`}
            </td>
            <td class="mono">${escapeHtml(p.Passport_Expiry_Date || "-")}</td>
            <td>${escapeHtml(p.Gender || "-")}</td>
            <td>
              ${p.Passenger_Mobile ? `<div class="mono copy-inline" onclick="copyText(event, '${escapeHtml(p.Passenger_Mobile)}', 'Mobile')">${escapeHtml(p.Passenger_Mobile)}</div>` : ""}
              ${p.Email ? `<div class="product-clean-sub copy-inline" onclick="copyText(event, '${escapeHtml(p.Email)}', 'Email')">${escapeHtml(p.Email)}</div>` : ""}
              ${!p.Passenger_Mobile && !p.Email ? `<span class="subtitle">-</span>` : ""}
            </td>
            ${hasAnyHealthOrDiet ? `<td>${alerts.length ? alerts.join(" ") : `<span class="subtitle">—</span>`}</td>` : ""}
          </tr>
        `;
      }).join("");

      paxBodyHtml = `
        <table>
          <thead>
            <tr>
              <th>Passenger Name (Click to copy)</th>
              <th>Country</th>
              <th>Date of Birth</th>
              <th>Passport Number</th>
              <th>Passport Expiry</th>
              <th>Gender</th>
              <th>Mobile / Email</th>
              ${hasAnyHealthOrDiet ? `<th>Dietary &amp; Medical</th>` : ""}
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
          ${Array.isArray(pax) && pax.length ? `<button type="button" class="btn btn-secondary btn-sm" onclick="copyAllManifest(event, '${b.id}')">Copy All Manifest</button>` : ""}
          <span>${drawers.passengers ? "▲" : "▼"}</span>
        </div>
      </div>
      ${drawers.passengers ? `<div class="inner-drawer-body" style="padding:0;">${paxBodyHtml}</div>` : ""}
    </div>
  `;

  // 3. NOTES & ATTACHMENTS ACCORDION HTML
  let notesListHtml = "";

  if (dealAttachments.length) {
    const dealAttChips = dealAttachments.map((att) => `
      <button type="button" class="attachment-chip" onclick="downloadCrmAttachment(event, '${b.id}', '${att.id}', '${escapeHtml(att.File_Name || "Attachment")}')">
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
              <button type="button" class="attachment-chip" onclick="downloadCrmAttachment(event, '${b.id}', '${att.id}', '${escapeHtml(att.File_Name || "Attachment")}')">
                📎 ${escapeHtml(att.File_Name || "Attached file")} ⬇
              </button>
            `).join("")}
            <button type="button" class="attachment-chip" onclick="openDealInCrm(event, '${b.id}')">View in CRM ↗</button>
          </div>`
        : "";

      return `
        <div class="note-card">
          <div class="note-card-meta">
            <span>${escapeHtml(n.Note_Title || "Note")} · ${escapeHtml(n.Created_By?.name || "")} (${(n.Created_Time || "").slice(0, 10)})</span>
            ${nAtts.length ? `<span class="badge badge-info">📎 ${nAtts.length} Attachment(s)</span>` : ""}
          </div>
          <div class="note-card-text">${sanitizeNoteHtml(n.Note_Content || "")}</div>
          ${nAttHtml}
        </div>
      `;
    }).join("");
  }

  if (!notesListHtml) {
    notesListHtml = `<div class="subtitle" style="margin-bottom:8px;">No notes recorded for this Booking yet.</div>`;
  }

  const notesDrawerHtml = `
    <div class="inner-drawer">
      <div class="inner-drawer-header" onclick="toggleSubDrawer('${b.id}', 'notes')">
        <div style="display:flex; gap:8px; align-items:center;">
          <span>📝 Booking Notes &amp; Special Instructions (${notesCount})</span>
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
  let opsBodyHtml = `<div class="empty-state">Loading Booking operations...</div>`;
  if (Array.isArray(ops)) {
    const opsRows = ops.length
      ? ops.map((op) => {
          const resBadge = op.Bill_Status === "Supplier Confirmed" || op.Bill_Status === "Traveler Confirmation Sent" ? "badge-ok" : "badge-warn";
          const billPayBadge = op.Payment_Status === "Paid" ? "badge-ok" : (op.Payment_Status === "Programmed Payment" ? "badge-info" : "badge-warn");
          const cleanProd = parseCleanProductDetails(op.Product_Deatails);

          return `
            <tr>
              <td class="mono"><strong>${op.Bill_Date || "-"}</strong><br/><span class="subtitle">${escapeHtml(op.Name || "New")}</span></td>
              <td><strong>${escapeHtml(op.Supplier_Vendor_Name?.name || "No Supplier")}</strong><br/><span class="mono subtitle">${escapeHtml(op.Xero_Bill_Name || "")}</span></td>
              <td>
                <div class="product-clean-title">${escapeHtml(cleanProd.title)}</div>
                ${cleanProd.meta ? `<div class="product-clean-sub">${escapeHtml(cleanProd.meta)}</div>` : ""}
              </td>
              <td><span class="badge ${resBadge}">${escapeHtml(op.Bill_Status || "N/A")}</span></td>
              <td>
                <span class="badge ${billPayBadge}">${escapeHtml(op.Payment_Status || "Awaiting Payment")}</span>
                ${op.Expected_Payment_Date ? `<div class="product-clean-sub">Due: ${op.Expected_Payment_Date}</div>` : ""}
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
            <th>Service Details</th>
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
        <span>📋 Linked Operations (${Array.isArray(ops) ? ops.length : "..."})</span>
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
    const ops = STATE.operationsByDeal[b.id] || [];
    const hasLoadedOps = Array.isArray(STATE.operationsByDeal[b.id]);
    const totalOpsCost = ops.reduce((acc, op) => acc + (parseFloat(op.Grand_Total) || 0), 0);
    const grossSale = parseFloat(b.Total_Gross_Price || b.Amount) || 0;
    const netSale = parseFloat(b.Total_Net_Amount || b.Amount) || 0;
    const quotedCost = parseFloat(b.Total_Trip_Cost2) || 0;
    const realMargin = netSale > 0 && hasLoadedOps ? (((netSale - totalOpsCost) / netSale) * 100).toFixed(1) : null;
    const payBadge = b.Booking_Payment_Status === "Paid" ? "badge-ok" : "badge-warn";

    return `
      <tr>
        <td class="mono"><strong>#${escapeHtml(b.Booking_Number || "N/A")}</strong><br/>${getPlatformBadgeHtml(b.Sales_Platform)}</td>
        <td><strong>${escapeHtml(b.Deal_Name || "Untitled")}</strong><br/><span class="subtitle">Start: ${b.Trip_Start_Date || "-"}</span></td>
        <td><span class="badge ${payBadge}">${escapeHtml(b.Booking_Payment_Status || "Unpaid")}</span></td>
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

window.openBulkModal = function (dealId) {
  const targetId = dealId || STATE.expandedBookingId;
  const b = STATE.bookings.find((item) => item.id === targetId);
  if (!b) return;

  STATE.expandedBookingId = b.id;
  if ($("modalBookingLabel")) $("modalBookingLabel").textContent = `#${b.Booking_Number} (${b.Deal_Name})`;
  if ($("bulkTbody")) $("bulkTbody").innerHTML = "";
  addBulkRow();
  toggleModal("bulkModal", true);
};

function renderDatalistOptions(datalistEl, items, nameKey) {
  datalistEl.innerHTML = items.map((item) => {
    const label = item[nameKey] || "";
    return `<option value="${label.replace(/"/g, "&quot;")}"></option>`;
  }).join("");
}

function addBulkRow() {
  const b = STATE.bookings.find((item) => item.id === STATE.expandedBookingId);
  if (!b) return;

  const tbody = $("bulkTbody");
  if (!tbody) return;
  const tr = document.createElement("tr");
  const rowUid = "row_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  const accountOptions = BOOKS_ACCOUNTS
    .map((acc) => `<option value="${acc}">${acc}</option>`)
    .join("");

  tr.innerHTML = `
    <td><input type="date" class="row-date" value="${b.Trip_Start_Date || ""}" required /></td>
    <td>
      <input type="text" class="row-vendor-input" list="dl_v_${rowUid}" placeholder="Type or select supplier..." autocomplete="off" style="min-width:190px;" />
      <input type="hidden" class="row-vendor" />
      <datalist id="dl_v_${rowUid}"></datalist>
    </td>
    <td>
      <input type="text" class="row-product-input" list="dl_p_${rowUid}" placeholder="Type or select service..." autocomplete="off" style="min-width:190px;" />
      <input type="hidden" class="row-product" />
      <datalist id="dl_p_${rowUid}"></datalist>
    </td>
    <td><input type="number" class="row-pax" value="${b.Number_of_Passengers || 1}" min="1" style="width:65px" /></td>
    <td><input type="number" step="0.01" class="row-cost" placeholder="0.00" style="width:90px" /></td>
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

  const isGroup =