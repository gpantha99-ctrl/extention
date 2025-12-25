
chrome.runtime.onInstalled.addListener(() => {
  console.log("Ultra Reminder installed");
});

chrome.alarms.onAlarm.addListener(alarm => {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "https://cdn-icons-png.flaticon.com/512/1827/1827392.png",
      title: "Reminder",
      message: alarm.name
    });
  });