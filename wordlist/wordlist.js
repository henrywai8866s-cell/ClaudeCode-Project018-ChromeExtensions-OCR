let allWords = [];
let query = "";

// ── Load & Render ──────────────────────────────────────────────────────────────
function load() {
  chrome.storage.local.get({ words: [] }, ({ words }) => {
    allWords = words;
    render();
  });
}

function render() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const countEl = document.getElementById("word-count");

  // Filter
  const q = query.toLowerCase();
  const filtered = q
    ? allWords.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.translation.includes(query) ||
        w.exampleSentence.toLowerCase().includes(q))
    : allWords;

  // Sort: pinned first → newest
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  countEl.textContent = `${allWords.length} 個單字`;

  // Remove existing cards
  grid.querySelectorAll(".card").forEach(c => c.remove());

  if (sorted.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  sorted.forEach(w => grid.appendChild(buildCard(w)));
}

// ── Card Builder ───────────────────────────────────────────────────────────────
function buildCard(word) {
  const card = document.createElement("div");
  card.className = "card" + (word.pinned ? " pinned" : "");
  card.dataset.id = word.id;

  card.innerHTML = `
    <div class="card-top">
      <div class="card-meta">
        <span class="card-word">${esc(word.word)}</span>
        <span class="card-pos">${esc(word.partOfSpeech)}</span>
      </div>
      <div class="card-btns">
        <button class="btn-pin${word.pinned ? " active" : ""}" title="${word.pinned ? "取消置頂" : "置頂"}">📌</button>
        <button class="btn-del" title="刪除">🗑️</button>
      </div>
    </div>
    <div class="card-trans">${esc(word.translation)}</div>
    <hr class="card-hr"/>
    <div class="card-ex">
      <p class="card-ex-en">${esc(word.exampleSentence)}</p>
      <p class="card-ex-zh">${esc(word.exampleTranslation)}</p>
    </div>
    <div class="card-date">${fmtDate(word.createdAt)}</div>
  `;

  card.querySelector(".btn-pin").onclick = () => togglePin(word.id);
  card.querySelector(".btn-del").onclick = () => deleteWord(word.id);
  return card;
}

// ── Actions ────────────────────────────────────────────────────────────────────
function togglePin(id) {
  const idx = allWords.findIndex(w => w.id === id);
  if (idx === -1) return;
  allWords[idx].pinned = !allWords[idx].pinned;
  chrome.storage.local.set({ words: allWords }, render);
}

function deleteWord(id) {
  allWords = allWords.filter(w => w.id !== id);
  chrome.storage.local.set({ words: allWords }, render);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
}

// ── Events ─────────────────────────────────────────────────────────────────────
document.getElementById("search").addEventListener("input", e => {
  query = e.target.value;
  render();
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (allWords.length === 0) return;
  if (confirm(`確定要刪除全部 ${allWords.length} 個單字嗎？此操作無法復原。`)) {
    allWords = [];
    chrome.storage.local.set({ words: [] }, render);
  }
});

// Live sync when words change from another tab
chrome.storage.onChanged.addListener(changes => {
  if (changes.words) {
    allWords = changes.words.newValue || [];
    render();
  }
});

load();
