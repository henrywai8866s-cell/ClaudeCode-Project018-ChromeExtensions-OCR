// ── Context Menu ──────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "activate-selection",
    title: "🔍 選取文字並翻譯",
    contexts: ["page", "selection", "image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "activate-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "activateSelection" });
  }
});

// ── Keyboard Command ───────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "activateSelection" });
      }
    });
  }
});

// ── Gemini Translation ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate") {
    handleTranslation(message.text)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleTranslation(text) {
  const { apiKey } = await chrome.storage.local.get("apiKey");

  if (!apiKey) {
    throw new Error("請先在設定頁面輸入 Gemini API Key（點擊擴充功能圖示 → 設定）");
  }

  const cleanText = text.trim().slice(0, 200); // safety limit

  const prompt = `You are an English dictionary assistant. Analyze the English word or phrase below and respond ONLY with a valid JSON object — no markdown, no explanation, no extra text.

JSON format:
{
  "word": "the core word or phrase (cleaned up)",
  "translation": "繁體中文翻譯",
  "partOfSpeech": "詞性（名詞／動詞／形容詞／副詞／介詞／連接詞／代詞／片語）",
  "exampleSentence": "A natural English example sentence using the word.",
  "exampleTranslation": "例句的繁體中文翻譯。"
}

English text: "${cleanText.replace(/"/g, '\\"')}"`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const msg = errorBody?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API 錯誤：${msg}`);
  }

  const body = await response.json();
  const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) throw new Error("API 回應格式異常");

  // Strip possible markdown code fences
  const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error("無法解析 API 回應，請再試一次");
  }
}
