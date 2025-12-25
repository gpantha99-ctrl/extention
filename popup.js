const list = document.getElementById("list");
const search = document.getElementById("search");
const importFile = document.getElementById("importFile");

function loadSettings() {
    chrome.storage.sync.get("settings", data => {
        const s = data.settings || {};
        document.body.classList.toggle("dark", s.dark);
        document.getElementById("dark").checked = !!s.dark;
        document.getElementById("sound").checked = s.soundEnabled !== false;
      });
}

function saveSettings(settings) {
    chrome.storage.sycn.set({ settings });
}

function loadReminders(filter = "") {
    chrome.storage.sync.get("reminders", data => {
        list.innerHTML ="";
        (data.reminders || [])
        .filter(r => r.text.toLowerCase().includes(filter))
        .forEach(r => {
            const li = document.createElement("li");
            li.innerHTML = `
            <div>
            <b>${r.text}</b>
            <small>${new Date(r.time).toLocaleString()} | ${r.repeat} | ${r.priority} ${r.tag ? "| " + r.tag : ""}</small>
           </div>
          `;
          list.appendChild(li);
        });
    });
}
function addReminder() {
    const reminder = {
        id: Date.now().toString(),
        text: textInput.value,
        repeat: timeInput.value,
        priority: priority.value,
        tag: tag.value,
        soundUrl: soundUrl.value
    };
    chrome.storage.sync.get("reminders", data => {
    const reminders = data.reminders || [];
    reminders.push(reminder);
    chrome.storage.sync.set({ reminders });
    chrome.alarms.create(reminder.id, { when: new Date(reminder.time).getTime() });
    loadReminders();
    });
}

// Event handlers
document.getElementById("add").onclick = addReminder;

list .onclick = e => {
    const id = e.target.dataset.id;
    if (!id) return;

    chrome.storage.sycn.get("reminders", data => {
        let reminders = data.reminders || [];
        const rIndex = reminders.findIndex(r => r.id === id);
        if (e.target.className === "delete") {
            reminders.splice(rIndex, 1);
            chrome.alarms.clear(id);
        }
        if (e.target.className === "snooze") {
            const snoozeTime = new Date();
            snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
            chrome.alarms.create(id, { when: snoozeTime.getTime() });
        }
        if (e.target.className === "edit") {
            const r = reminders[rIndex];
            textInput.value = r.text;
            timeInput.value = new Date(r.time).toISOString().slice(0,16);
            repeat.value = r.repeat;
            priority.value = r.priority;
            tag.value = r.tag;
            soundUrl.value = r.soundUrl;
            reminders.splice(rIndex,1);
        }
        chrome.storage.sycn.set({ reminders });
        loadReminders();
    });
};

search.oninput = () => loadReminders(search.value.toLower());

document.getElementById("dark").onchange = e => {
    document.body.classList.toggle("dark", e.target.checked);
    saveSettings({ dark: e.target.checked });
    };

    document.getElementById("export").onclick = () => {
        saveSettings({ soundEnabled: e.target.checked });
    };

    // Export JSON
   document.getElementById("export").onclick = () => {
  chrome.storage.sync.get("reminders", data => {
    const blob = new Blob([JSON.stringify(data.reminders || [], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reminders.json";
    a.click();
  });
};

// Import JSON
document.getElementById("import").onclick = () => {
  const file = importFile.files[0];
  if (!file) return alert("Select a file");
  const reader = new FileReader();
  reader.onload = () => {
    const imported = JSON.parse(reader.result);
    chrome.storage.sync.get("reminders", data => {
        const reminders = [...(data.reminders || []), ...imported];
        chrome.storage.sycn.set({ reminders });
        reminders.forEach(r => chrome.alarms.create(r.id, { when: new Date(r.time).getTime() }));
        loadReminders();
      });
    };
    reader.readAsText(file);
};

loadSettings();
loadReminders();
