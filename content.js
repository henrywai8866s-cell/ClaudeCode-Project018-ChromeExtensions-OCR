// ── State ──────────────────────────────────────────────────────────────────────
let isActive = false;
let overlay = null;
let selBox = null;
let startX = 0;
let startY = 0;
let dragging = false;

// ── Activation ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "activateSelection" && !isActive) activate();
});

function activate() {
  isActive = true;

  overlay = make("div", "ocr-overlay");

  const hint = make("div", "ocr-hint");
  hint.textContent = "拖曳選取文字範圍　ESC 取消";
  overlay.appendChild(hint);

  selBox = make("div", "ocr-sel-box");
  overlay.appendChild(selBox);

  document.body.appendChild(overlay);

  overlay.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("keydown", onKey);
}

function deactivate() {
  isActive = false;
  dragging = false;
  overlay?.remove();
  overlay = null;
  selBox = null;
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("mouseup", onUp);
  document.removeEventListener("keydown", onKey);
}

// ── Mouse Handlers ─────────────────────────────────────────────────────────────
function onKey(e) {
  if (e.key === "Escape") deactivate();
}

function onDown(e) {
  e.preventDefault();
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  selBox.style.cssText += "display:block;left:" + startX + "px;top:" + startY + "px;width:0;height:0";
}

function onMove(e) {
  if (!dragging) return;
  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  selBox.style.left = x + "px";
  selBox.style.top = y + "px";
  selBox.style.width = w + "px";
  selBox.style.height = h + "px";
}

function onUp(e) {
  if (!dragging) return;
  dragging = false;

  const rect = selBox.getBoundingClientRect();
  if (rect.width < 5 || rect.height < 5) { deactivate(); return; }

  const text = extractTextInRect(rect);

  if (!text) {
    notify("未選取到文字，請重新選取");
    deactivate();
    return;
  }

  // Show loading spinner inside selection box
  selBox.innerHTML = '<span class="ocr-spinner"></span><span class="ocr-loading-text">翻譯中…</span>';

  const savedRect = { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, width: rect.width, height: rect.height };

  chrome.runtime.sendMessage({ action: "translate", text }, (resp) => {
    deactivate();

    if (chrome.runtime.lastError) {
      notify("連線中斷，請重試");
      return;
    }

    if (resp?.success) {
      showPopup(resp.data, savedRect);
    } else {
      notify(resp?.error || "翻譯失敗，請重試");
    }
  });
}

// ── Text Extraction ────────────────────────────────────────────────────────────
function extractTextInRect(viewportRect) {
  const sx = window.scrollX;
  const sy = window.scrollY;
  const docRect = {
    left: viewportRect.left + sx,
    top: viewportRect.top + sy,
    right: viewportRect.right + sx,
    bottom: viewportRect.bottom + sy
  };

  const seen = new Set();
  const parts = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      const tag = el.tagName?.toLowerCase();
      if (["script", "style", "noscript"].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (el.closest(".ocr-overlay, #ocr-popup, .ocr-notify")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while ((node = walker.nextNode())) {
    const raw = node.textContent;
    if (!raw.trim()) continue;

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();

    for (const r of rects) {
      const dr = { left: r.left + sx, top: r.top + sy, right: r.right + sx, bottom: r.bottom + sy };
      if (overlaps(dr, docRect) && !seen.has(node)) {
        seen.add(node);
        parts.push(raw.trim());
        break;
      }
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// ── Translation Popup ──────────────────────────────────────────────────────────
function showPopup(data, selRect) {
  document.getElementById("ocr-popup")?.remove();

  const popup = make("div", null);
  popup.id = "ocr-popup";
  popup.innerHTML = `
    <div class="ocrp-header">
      <span class="ocrp-word">${esc(data.word)}</span>
      <span class="ocrp-pos">${esc(data.partOfSpeech)}</span>
    </div>
    <div class="ocrp-trans">${esc(data.translation)}</div>
    <hr class="ocrp-hr"/>
    <div class="ocrp-ex">
      <div class="ocrp-ex-en">${esc(data.exampleSentence)}</div>
      <div class="ocrp-ex-zh">${esc(data.exampleTranslation)}</div>
    </div>
    <div class="ocrp-actions">
      <button class="ocrp-btn-save">✓ 儲存單字</button>
      <button class="ocrp-btn-close">✕</button>
    </div>
  `;

  document.body.appendChild(popup);
  positionPopup(popup, selRect);

  popup.querySelector(".ocrp-btn-save").onclick = () => { saveWord(data); popup.remove(); };
  popup.querySelector(".ocrp-btn-close").onclick = () => popup.remove();

  // Auto-close after 15 s
  setTimeout(() => popup.isConnected && popup.remove(), 15000);
}

function positionPopup(popup, sel) {
  const PAD = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Temporarily render off-screen to measure
  popup.style.visibility = "hidden";
  popup.style.top = "0";
  popup.style.left = "0";
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  popup.style.visibility = "";

  let top = (sel.bottom + PAD + ph <= vh) ? sel.bottom + PAD : sel.top - PAD - ph;
  let left = sel.left + (sel.width - pw) / 2;
  top = Math.max(PAD, Math.min(top, vh - ph - PAD));
  left = Math.max(PAD, Math.min(left, vw - pw - PAD));

  popup.style.top = top + "px";
  popup.style.left = left + "px";
}

// ── Save Word ──────────────────────────────────────────────────────────────────
function saveWord(data) {
  chrome.storage.local.get({ words: [] }, ({ words }) => {
    const idx = words.findIndex(w => w.word.toLowerCase() === data.word.toLowerCase());
    const entry = {
      id: idx >= 0 ? words[idx].id : Date.now().toString(),
      word: data.word,
      translation: data.translation,
      partOfSpeech: data.partOfSpeech,
      exampleSentence: data.exampleSentence,
      exampleTranslation: data.exampleTranslation,
      pinned: idx >= 0 ? words[idx].pinned : false,
      createdAt: idx >= 0 ? words[idx].createdAt : Date.now()
    };

    if (idx >= 0) words[idx] = entry;
    else words.unshift(entry);

    chrome.storage.local.set({ words }, () => notify(`已儲存：${data.word}`));
  });
}

// ── Notification ───────────────────────────────────────────────────────────────
function notify(msg) {
  document.querySelector(".ocr-notify")?.remove();
  const el = make("div", "ocr-notify");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.isConnected && el.remove(), 2800);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function make(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function esc(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str || ""));
  return d.innerHTML;
}
