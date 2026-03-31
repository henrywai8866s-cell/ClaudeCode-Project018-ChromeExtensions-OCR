const input = document.getElementById("api-key");
const toggleBtn = document.getElementById("btn-toggle");
const saveBtn = document.getElementById("btn-save");
const statusEl = document.getElementById("status");

// Load existing key
chrome.storage.local.get("apiKey", ({ apiKey }) => {
  if (apiKey) input.value = apiKey;
});

// Show / hide key
toggleBtn.addEventListener("click", () => {
  input.type = input.type === "password" ? "text" : "password";
  toggleBtn.textContent = input.type === "password" ? "👁" : "🙈";
});

// Save
saveBtn.addEventListener("click", () => {
  const key = input.value.trim();
  if (!key) { showStatus("請輸入 API Key", "error"); return; }
  if (!key.startsWith("AIza")) { showStatus("API Key 格式看起來不正確（應以 AIza 開頭）", "warn"); }

  chrome.storage.local.set({ apiKey: key }, () => {
    showStatus("✓ 已儲存", "success");
  });
});

// Enter key to save
input.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click(); });

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = "status " + type;
  statusEl.hidden = false;
  setTimeout(() => { statusEl.hidden = true; }, 3500);
}
