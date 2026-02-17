// ─────────────────────────────────────────────
//  MindPulse – background.js (Service Worker)
// ─────────────────────────────────────────────

// ── On install: restore alarms from storage ──
chrome.runtime.onInstalled.addListener(() => {
  console.log("[MindPulse] Extension installed / updated.");
  restoreAlarms();
});

// Also restore on service-worker startup (e.g. after browser restart)
restoreAlarms();

// ── Alarm fired ──────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("reminder_")) return;

  const reminderId = alarm.name.replace("reminder_", "");
  const data = await chrome.storage.local.get("reminders");
  const reminders = data.reminders || [];

  const reminder = reminders.find((r) => r.id === reminderId);
  if (!reminder) return;

  // Fire notification
  fireNotification(reminder);

  // Handle recurrence
  if (reminder.repeat === "none") {
    // Mark as completed
    const updated = reminders.map((r) =>
      r.id === reminderId ? { ...r, done: true } : r
    );
    await chrome.storage.local.set({ reminders: updated });
  }
  // For periodic repeats (daily, hourly), the alarm auto-repeats via periodInMinutes
});

// ── Create or update a reminder ──────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CREATE_REMINDER") {
    createReminder(msg.payload).then(sendResponse);
    return true; // keep channel open
  }

  if (msg.type === "DELETE_REMINDER") {
    deleteReminder(msg.id).then(sendResponse);
    return true;
  }

  if (msg.type === "TOGGLE_DONE") {
    toggleDone(msg.id).then(sendResponse);
    return true;
  }

  if (msg.type === "GET_REMINDERS") {
    chrome.storage.local.get("reminders").then((data) => {
      sendResponse(data.reminders || []);
    });
    return true;
  }
});

// ────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────

async function createReminder(payload) {
  const data = await chrome.storage.local.get("reminders");
  const reminders = data.reminders || [];

  const reminder = {
    id: Date.now().toString(),
    title: payload.title,
    note: payload.note || "",
    time: payload.time,           // ISO string or ms timestamp
    repeat: payload.repeat || "none", // "none" | "hourly" | "daily" | "weekly"
    emoji: payload.emoji || "🔔",
    done: false,
    createdAt: Date.now(),
  };

  reminders.push(reminder);
  await chrome.storage.local.set({ reminders });

  scheduleAlarm(reminder);
  return { success: true, reminder };
}

async function deleteReminder(id) {
  const data = await chrome.storage.local.get("reminders");
  const reminders = (data.reminders || []).filter((r) => r.id !== id);
  await chrome.storage.local.set({ reminders });
  chrome.alarms.clear(`reminder_${id}`);
  return { success: true };
}

async function toggleDone(id) {
  const data = await chrome.storage.local.get("reminders");
  const reminders = (data.reminders || []).map((r) =>
    r.id === id ? { ...r, done: !r.done } : r
  );
  await chrome.storage.local.set({ reminders });
  return { success: true };
}

function scheduleAlarm(reminder) {
  const fireAt = new Date(reminder.time).getTime();
  const now = Date.now();

  const alarmInfo = {};

  if (fireAt > now) {
    alarmInfo.when = fireAt;
  } else if (reminder.repeat !== "none") {
    // If the time already passed but it's repeating, fire ASAP then repeat
    alarmInfo.when = now + 5000;
  } else {
    return; // past, non-repeating – skip
  }

  if (reminder.repeat === "hourly") alarmInfo.periodInMinutes = 60;
  if (reminder.repeat === "daily")  alarmInfo.periodInMinutes = 60 * 24;
  if (reminder.repeat === "weekly") alarmInfo.periodInMinutes = 60 * 24 * 7;

  chrome.alarms.create(`reminder_${reminder.id}`, alarmInfo);
}

async function restoreAlarms() {
  const data = await chrome.storage.local.get("reminders");
  const reminders = data.reminders || [];
  const now = Date.now();

  for (const r of reminders) {
    if (r.done && r.repeat === "none") continue;
    const existing = await chrome.alarms.get(`reminder_${r.id}`);
    if (!existing) {
      scheduleAlarm(r);
    }
  }
}

function fireNotification(reminder) {
  chrome.notifications.create(`notif_${reminder.id}_${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `${reminder.emoji}  ${reminder.title}`,
    message: reminder.note || "You have a reminder!",
    priority: 2,
    requireInteraction: true,
  });
}
