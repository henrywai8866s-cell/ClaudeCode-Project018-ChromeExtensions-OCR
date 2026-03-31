document.getElementById("btn-wordlist").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("wordlist/wordlist.html") });
  window.close();
});

document.getElementById("btn-settings").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("settings/settings.html") });
  window.close();
});
