// ─────────────────────────────────────────────
//  MindPulse – popup.js
// ─────────────────────────────────────────────

/** @type {HTMLElement} */
const formPanel    = document.getElementById("formPanel");
const btnOpenForm  = document.getElementById("btnOpenForm");
const btnCancel    = document.getElementById("btnCancel");
const btnSave      = document.getElementById("btnSave");

const inputTitle   = document.getElementById("inputTitle");
const inputNote    = document.getElementById("inputNote");
const inputTime    = document.getElementById("inputTime");
const selectRepeat = document.getElementById("selectRepeat");

const emojiBtn     = document.getElementById("emojiBtn");
const emojiPicker  = document.getElementById("emojiPicker");

const reminderList = document.getElementById("reminderList");
const emptyState   = document.getElementById("emptyState");
const tabs         = document.getElementById("tabs");

const statTotal    = document.getElementById("statTotal");
const statPending  = document.getElementById("statPending");
const statDone     = document.getElementById("statDone");

let currentFilter  = "all";
let selectedEmoji  = "🔔";
let allReminders   = [];

// ── Default datetime to "now + 1 hour" ───────
function setDefaultTime() {
  const d = new Date(Date.now() + 3600 * 1000);
  // Format: YYYY-MM-DDTHH:MM
  const pad = (n) => String(n).padStart(2, "0");
  const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  inputTime.value = local;
}

// ── Open / Close form ────────────────────────
btnOpenForm.addEventListener("click", () => {
  if (formPanel.classList.contains("open")) {
    closeForm();
  } else {
    openForm();
  }
});

btnCancel.addEventListener("click", closeForm);

function openForm() {
  formPanel.classList.add("open");
  setDefaultTime();
  inputTitle.focus();
  btnOpenForm.textContent = "✕ Close";
  btnOpenForm.style.background = "#3a3a50";
  btnOpenForm.style.boxShadow = "none";
}

function closeForm() {
  formPanel.classList.remove("open");
  emojiPicker.classList.remove("open");
  resetForm();
  btnOpenForm.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg> New`;
  btnOpenForm.style.background = "";
  btnOpenForm.style.boxShadow = "";
}

function resetForm() {
  inputTitle.value = "";
  inputNote.value  = "";
  selectRepeat.value = "none";
  setDefaultTime();
  selectedEmoji = "🔔";
  emojiBtn.textContent = "🔔";
}

// ── Emoji Picker ─────────────────────────────
emojiBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  emojiPicker.classList.toggle("open");
});

emojiPicker.querySelectorAll("span").forEach((span) => {
  span.addEventListener("click", () => {
    selectedEmoji = span.textContent;
    emojiBtn.textContent = selectedEmoji;
    emojiPicker.classList.remove("open");
  });
});

document.addEventListener("click", () => {
  emojiPicker.classList.remove("open");
});

// ── Save Reminder ─────────────────────────────
btnSave.addEventListener("click", async () => {
  const title = inputTitle.value.trim();
  if (!title) {
    shake(inputTitle);
    return;
  }
  if (!inputTime.value) {
    shake(inputTime);
    return;
  }

  const timeMs = new Date(inputTime.value).getTime();
  if (isNaN(timeMs)) {
    showToast("⚠️ Invalid date/time");
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = "Saving…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CREATE_REMINDER",
      payload: {
        title,
        note:   inputNote.value.trim(),
        time:   timeMs,
        repeat: selectRepeat.value,
        emoji:  selectedEmoji,
      },
    });

    if (response?.success) {
      showToast("✅ Reminder saved!");
      closeForm();
      await loadReminders();
    } else {
      showToast("❌ Something went wrong");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Error saving reminder");
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Save Reminder`;
  }
});

// ── Load & Render Reminders ───────────────────
async function loadReminders() {
  try {
    allReminders = await chrome.runtime.sendMessage({ type: "GET_REMINDERS" });
  } catch {
    allReminders = [];
  }
  updateStats();
  renderList();
}

function updateStats() {
  const pending = allReminders.filter((r) => !r.done).length;
  const done    = allReminders.filter((r) => r.done).length;
  statTotal.textContent   = allReminders.length;
  statPending.textContent = pending;
  statDone.textContent    = done;
}

function renderList() {
  let filtered = allReminders;
  if (currentFilter === "pending") filtered = allReminders.filter((r) => !r.done);
  if (currentFilter === "done")    filtered = allReminders.filter((r) => r.done);

  // Sort: pending first, then by time
  filtered = filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.time - b.time;
  });

  // Clear existing cards
  reminderList.querySelectorAll(".card").forEach((c) => c.remove());

  if (filtered.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  filtered.forEach((r) => {
    const card = buildCard(r);
    reminderList.appendChild(card);
  });
}

function buildCard(reminder) {
  const card = document.createElement("div");
  card.className = `card${reminder.done ? " done" : ""}`;
  card.dataset.id = reminder.id;

  const isOverdue = !reminder.done && reminder.time < Date.now() && reminder.repeat === "none";
  const timeStr   = formatTime(reminder.time);
  const repeatBadge = reminder.repeat !== "none"
    ? `<span class="badge-repeat">${capitalize(reminder.repeat)}</span>` : "";
  const overdueBadge = isOverdue
    ? `<span class="badge-overdue">Overdue</span>` : "";

  card.innerHTML = `
    <div class="card-check">
      <div class="check-box" title="Mark as done">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5l2.8 2.8 5.2-5.6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="card-emoji">${reminder.emoji}</span>
    </div>
    <div class="card-body">
      <div class="card-title">${escHtml(reminder.title)}</div>
      ${reminder.note ? `<div class="card-note">${escHtml(reminder.note)}</div>` : ""}
      <div class="card-meta">
        <span class="card-time">🕐 ${timeStr}</span>
        ${repeatBadge}${overdueBadge}
      </div>
    </div>
    <button class="btn-delete" title="Delete">
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>`;

  // Toggle done
  card.querySelector(".check-box").addEventListener("click", async (e) => {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ type: "TOGGLE_DONE", id: reminder.id });
    await loadReminders();
    showToast(reminder.done ? "↩️ Marked pending" : "✅ Marked done");
  });

  // Delete
  card.querySelector(".btn-delete").addEventListener("click", async (e) => {
    e.stopPropagation();
    card.style.opacity = "0";
    card.style.transform = "translateX(30px)";
    card.style.transition = "opacity 0.2s, transform 0.2s";
    setTimeout(async () => {
      await chrome.runtime.sendMessage({ type: "DELETE_REMINDER", id: reminder.id });
      await loadReminders();
      showToast("🗑️ Deleted");
    }, 200);
  });

  return card;
}

// ── Filter Tabs ───────────────────────────────
tabs.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    renderList();
  });
});

// ── Utils ─────────────────────────────────────
function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday  = d.toDateString() === now.toDateString();
  const tmrw = new Date(now); tmrw.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tmrw.toDateString();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday)    return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function shake(el) {
  el.style.animation = "none";
  el.style.borderColor = "#f87171";
  el.style.boxShadow = "0 0 0 3px rgba(248,113,113,0.2)";
  setTimeout(() => {
    el.style.borderColor = "";
    el.style.boxShadow   = "";
  }, 900);
  el.focus();
}

let toastTimer = null;
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ── Init ──────────────────────────────────────
loadReminders();
