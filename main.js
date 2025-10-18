// ==UserScript==
// @name         AI Selection → Poe API
// @namespace    ai-quick-ask-poe
// @version      1.5.0
// @description  Панель шаблонов с поддержкой всех возможностей Poe API
// @author       you
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      api.poe.com
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const CFG_KEY = "aqp_config_v2";

  const DEFAULTS = {
    baseUrl: "https://api.poe.com/v1",
    defaultModel: "Claude-Sonnet-4",
    apiKey: "",
    autoPopup: true,
    useStream: true,
    popupOffset: { x: 14, y: 12 },
    templates: [
      {
        id: "explain",
        name: "Пояснить",
        model: "",
        prompt: "Объясни простыми словами:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      },
      {
        id: "tldr",
        name: "TL;DR",
        model: "",
        prompt: "Краткое резюме:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      }
    ]
  };

  // Список моделей, поддерживаемых Poe API
  const POE_MODELS = [
    "Claude-Sonnet-4.5",
    "Claude-Sonnet-4",
    "Claude-Opus-4.1",
    "Claude-Haiku-4.5",
    "GPT-5",
    "GPT-5-Codex",
    "ChatGPT-5",
    "GPT-4.1",
    "GPT-4o",
    "Gemini-2.5-Pro",
    "Gemini-2.5-Flash",
    "Gemini-2.0-Flash",
    "Grok-4",
    "Grok-3",
    "Llama-3.1-405B",
    "Llama-3.3-70B",
    "DeepSeek-R1",
    "Qwen3-72B"
  ];

  // Модели с поддержкой reasoning (по документации Poe)
  const REASONING_MODELS = [
    "GPT-5",
    "GPT-5-Codex",
    "GPT-4.1",
    "Claude-Opus-4.1",
    "Claude-Haiku-4.5",
    "DeepSeek-R1",
    "Gemini-2.5-Flash",
    "Qwen3-72B",
    "Grok-3-mini"
  ];

  // Модели с поддержкой web search (Claude на Anthropic API)
  const WEB_SEARCH_MODELS = [
    "Claude-Sonnet-4.5",
    "Claude-Sonnet-4",
    "Claude-Opus-4.1",
    "Claude-Haiku-4.5",
    "Gemini-2.5-Pro",
    "Gemini-2.5-Flash",
    "Gemini-2.0-Flash",
    "GPT-5",
    "GPT-4.1",
    "GPT-4o"
  ];

  let config = loadConfig();
  let state = {
    lastMouse: { x: 0, y: 0 },
    bubble: null,
    miniPanel: null,
    requestInProgress: false,
    retryCount: 0
  };

  function loadConfig() {
    try {
      const saved = GM_getValue(CFG_KEY);
      if (!saved) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(saved);
      // Мержим с дефолтами для обратной совместимости
      return {
        ...DEFAULTS,
        ...parsed,
        popupOffset: { ...DEFAULTS.popupOffset, ...parsed.popupOffset }
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveConfig() {
    GM_setValue(CFG_KEY, JSON.stringify(config));
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "style") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    children.forEach(ch => e.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch));
    return e;
  };

  const isOurUI = (node) => {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el) {
      if (el.classList?.contains("aqp-ui")) return true;
      el = el.parentElement;
    }
    return false;
  };

  // Улучшенные стили с учетом Dark Reader
  GM_addStyle(`
    .aqp-gear {
      position: fixed; right: 16px; bottom: 16px; width: 42px; height: 42px;
      border-radius: 50%; background: #1a1a1a !important; color: #fff !important; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,.4) !important; z-index: 2147483645;
      font-size: 20px; user-select: none; border: 1px solid #333 !important;
    }
    .aqp-gear:hover { background: #2a2a2a !important; transform: scale(1.05); }

    .aqp-bubble {
      position: fixed; z-index: 2147483646; background: #1a1a1a !important; color: #f0f0f0 !important;
      padding: 8px 10px; border-radius: 10px; display: flex; gap: 6px; flex-wrap: wrap;
      box-shadow: 0 4px 16px rgba(0,0,0,.35) !important; font: 12px system-ui;
      border: 1px solid #333 !important;
    }
    .aqp-bubble button {
      background: #f0f0f0 !important; color: #1a1a1a !important; border: none; padding: 6px 10px;
      border-radius: 6px; cursor: pointer; font: 12px system-ui; font-weight: 500;
    }
    .aqp-bubble button:hover { background: #fff !important; }

    .aqp-mini {
      position: fixed; z-index: 2147483647; min-width: 300px; max-width: 600px;
      background: #fff !important; border: 1px solid #ccc; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.25) !important; overflow: hidden;
    }
    .aqp-mini-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #f5f5f5 !important; border-bottom: 1px solid #ddd;
      font: 600 13px system-ui; color: #1a1a1a !important;
    }
    .aqp-mini-body {
      padding: 12px; max-height: 400px; overflow: auto;
      white-space: pre-wrap; font: 13px/1.5 system-ui; color: #1a1a1a !important;
    }
    .aqp-mini button {
      background: #1a1a1a !important; color: #fff !important; border: none; padding: 5px 10px;
      border-radius: 6px; cursor: pointer; font: 11px system-ui; margin-left: 6px;
    }
    .aqp-mini button:hover { background: #2a2a2a !important; }
    .aqp-mini button.sec { background: #e0e0e0 !important; color: #1a1a1a !important; }
    .aqp-mini button.sec:hover { background: #d0d0d0 !important; }

    .aqp-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,.6) !important;
      z-index: 2147483647; display: flex; align-items: center; justify-content: center;
    }
    .aqp-box {
      background: #fff !important; border-radius: 10px; width: 750px; max-width: 95vw;
      max-height: 90vh; box-shadow: 0 8px 32px rgba(0,0,0,.3) !important;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .aqp-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #f5f5f5 !important; border-bottom: 1px solid #ddd;
      font: 600 14px system-ui; color: #1a1a1a !important;
    }
    .aqp-body { padding: 16px; overflow: auto; }
    .aqp-section { margin-bottom: 20px; }
    .aqp-section-title { font: 600 13px system-ui; margin-bottom: 10px; color: #1a1a1a !important; }
    .aqp-field { margin-bottom: 10px; }
    .aqp-label { display: block; font: 11px system-ui; color: #555 !important; margin-bottom: 4px; }
    .aqp-input, .aqp-textarea, .aqp-select {
      width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;
      font: 12px system-ui; box-sizing: border-box; background: #fff !important; color: #1a1a1a !important;
    }
    .aqp-textarea { min-height: 80px; font-family: monospace; resize: vertical; }
    .aqp-btn {
      background: #1a1a1a !important; color: #fff !important; border: none; padding: 8px 14px;
      border-radius: 6px; cursor: pointer; font: 12px system-ui; margin-right: 6px;
    }
    .aqp-btn:hover { background: #2a2a2a !important; }
    .aqp-btn.sec { background: #e0e0e0 !important; color: #1a1a1a !important; }
    .aqp-btn.sec:hover { background: #d0d0d0 !important; }
    .aqp-tpl {
      border: 1px solid #ddd; border-radius: 8px; padding: 12px;
      margin-bottom: 10px; background: #fafafa !important;
    }
    .aqp-tpl-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px; font-weight: 600; color: #1a1a1a !important;
    }
    .aqp-tpl-actions { display: flex; gap: 4px; }
    .aqp-checkbox { display: flex; align-items: center; gap: 6px; margin: 8px 0; color: #1a1a1a !important; }
    .aqp-row { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .aqp-info { font: 11px system-ui; color: #666 !important; margin-top: 4px; font-style: italic; }

    @media (prefers-color-scheme: dark) {
      .aqp-box, .aqp-mini { background: #1e1e1e !important; }
      .aqp-header, .aqp-mini-header { background: #2a2a2a !important; color: #f0f0f0 !important; }
      .aqp-body, .aqp-mini-body { color: #f0f0f0 !important; }
      .aqp-input, .aqp-textarea, .aqp-select { background: #2a2a2a !important; color: #f0f0f0 !important; border-color: #444; }
      .aqp-tpl { background: #2a2a2a !important; }
      .aqp-section-title, .aqp-tpl-head, .aqp-checkbox { color: #f0f0f0 !important; }
    }
  `);

  function getSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    if (isOurUI(sel.anchorNode) || isOurUI(sel.focusNode)) return "";
    return sel.toString().trim();
  }

  function getAnchorPoint() {
    const sel = window.getSelection();
    if (sel?.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width || rect.height) return { x: rect.right, y: rect.bottom };
    }
    return state.lastMouse;
  }

  function showBubble() {
    if (!config.autoPopup) return;
    hideBubble();

    const templates = config.templates || [];
    if (!templates.length) return;

    state.bubble = el("div", { class: "aqp-bubble aqp-ui" });

    // Добавляем выпадающий список моделей
    const modelSelect = el("select", {
      class: "aqp-select",
      style: { width: "auto", padding: "4px 6px", fontSize: "11px", marginRight: "6px" }
    });
    modelSelect.appendChild(el("option", { value: "" }, "Модель"));
    POE_MODELS.forEach(m => modelSelect.appendChild(el("option", { value: m }, m)));
    state.bubble.appendChild(modelSelect);

    templates.forEach(tpl => {
      state.bubble.appendChild(el("button", {
        onClick: () => {
          const selectedModel = modelSelect.value;
          handleTemplate(tpl, selectedModel);
          hideBubble();
        }
      }, tpl.name));
    });

    const pt = getAnchorPoint();
    const offX = config.popupOffset?.x ?? 14;
    const offY = config.popupOffset?.y ?? 12;
    state.bubble.style.left = clamp(pt.x + offX, 10, window.innerWidth - 200) + "px";
    state.bubble.style.top = clamp(pt.y + offY, 10, window.innerHeight - 100) + "px";
    document.body.appendChild(state.bubble);

    setTimeout(() => {
      document.addEventListener("mousedown", (e) => {
        if (state.bubble && !state.bubble.contains(e.target)) hideBubble();
      }, { once: true, capture: true });
    }, 100);
  }

  function hideBubble() {
    if (state.bubble) { state.bubble.remove(); state.bubble = null; }
  }

  function openMini(title, text) {
    closeMini();

    state.miniPanel = el("div", { class: "aqp-mini aqp-ui" },
      el("div", { class: "aqp-mini-header" },
        el("div", {}, title),
        el("div", {},
          el("button", { class: "sec", onClick: copyMini }, "Копировать"),
          el("button", { class: "sec", onClick: closeMini }, "Закрыть")
        )
      ),
      el("div", { class: "aqp-mini-body", id: "aqp-mini-body" }, text)
    );

    const pt = getAnchorPoint();
    state.miniPanel.style.left = clamp(pt.x + 20, 10, window.innerWidth - 320) + "px";
    state.miniPanel.style.top = clamp(pt.y + 20, 10, window.innerHeight - 100) + "px";
    document.body.appendChild(state.miniPanel);
  }

  function updateMini(text, replace) {
    const body = document.getElementById("aqp-mini-body");
    if (body) body.textContent = replace ? text : body.textContent + text;
  }

  function closeMini() {
    if (state.miniPanel) { state.miniPanel.remove(); state.miniPanel = null; }
  }

  function copyMini() {
    const body = document.getElementById("aqp-mini-body");
    if (body?.textContent) GM_setClipboard(body.textContent);
  }

  function callAPI(model, prompt, extraParams, onChunk, onDone, onError) {
    if (state.requestInProgress) {
      onError("Предыдущий запрос ещё не завершён");
      return;
    }

    state.requestInProgress = true;
    state.retryCount = 0;

    const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
    const body = {
      model: model || config.defaultModel,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt }
      ],
      stream: config.useStream,
      ...extraParams
    };

    const makeRequest = () => {
      if (config.useStream) {
        let buffer = "";
        let lastProcessedLength = 0;

        GM_xmlhttpRequest({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.apiKey
          },
          data: JSON.stringify(body),
          onprogress: (res) => {
            try {
              const text = res.responseText || "";
              if (text.length <= lastProcessedLength) return;

              // Берём только новый кусок
              const newChunk = text.slice(lastProcessedLength);
              lastProcessedLength = text.length;
              buffer += newChunk;

              // Обрабатываем полные строки
              const lines = buffer.split(/\n/);
              buffer = lines.pop() || ""; // Последняя неполная строка остаётся в буфере

              for (const line of lines) {
                if (!line.trim() || !line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (!data || data === "[DONE]") continue;

                try {
                  const json = JSON.parse(data);
                  const delta = json?.choices?.[0]?.delta?.content;
                  if (delta) onChunk(delta);
                } catch {}
              }
            } catch {}
          },
          onload: () => {
            state.requestInProgress = false;
            onDone();
          },
          onerror: () => {
            state.requestInProgress = false;
            if (state.retryCount < 2) {
              state.retryCount++;
              setTimeout(() => {
                onError(`Ошибка сети (попытка ${state.retryCount}/3)`);
                makeRequest();
              }, 1000 * state.retryCount);
            } else {
              onError("Ошибка сети: проверьте подключение к интернету");
            }
          },
          ontimeout: () => {
            state.requestInProgress = false;
            onError("Таймаут запроса (> 2 мин)");
          },
          timeout: 120000
        });
      } else {
        GM_xmlhttpRequest({
          method: "POST",
          url: url,
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + config.apiKey
          },
          data: JSON.stringify(body),
          responseType: "json",
          onload: (res) => {
            state.requestInProgress = false;
            if (res.status >= 200 && res.status < 300) {
              const content = res.response?.choices?.[0]?.message?.content || "";
              onChunk(content);
              onDone();
            } else {
              const msg = res.response?.error?.message || `HTTP ${res.status}`;
              onError(msg);
            }
          },
          onerror: () => {
            state.requestInProgress = false;
            if (state.retryCount < 2) {
              state.retryCount++;
              setTimeout(() => {
                onError(`Ошибка сети (попытка ${state.retryCount}/3)`);
                makeRequest();
              }, 1000 * state.retryCount);
            } else {
              onError("Ошибка сети: проверьте подключение к интернету");
            }
          },
          ontimeout: () => {
            state.requestInProgress = false;
            onError("Таймаут запроса (> 2 мин)");
          },
          timeout: 120000
        });
      }
    };

    makeRequest();
  }

  function handleTemplate(tpl, overrideModel) {
    const selection = getSelection();
    if (!selection) return;

    const prompt = tpl.prompt.replace(/\{\{selection\}\}/g, selection);
    const model = overrideModel || tpl.model || config.defaultModel;

    // Дополнительные параметры для Poe API
    const extraParams = {};

    // Web Search (для поддерживаемых моделей)
    if (tpl.webSearch && WEB_SEARCH_MODELS.includes(model)) {
      extraParams.tools = [{
        type: "web_search",
        web_search: { enabled: true }
      }];
    }

    // Reasoning effort (для поддерживаемых моделей)
    if (tpl.reasoningEffort && tpl.reasoningEffort !== "none" && REASONING_MODELS.includes(model)) {
      extraParams.reasoning_effort = tpl.reasoningEffort;
    }

    openMini(tpl.name + " • " + model, "Отправка запроса...");

    let isFirst = true;
    callAPI(
      model,
      prompt,
      extraParams,
      (chunk) => {
        updateMini(chunk, isFirst);
        if (isFirst) isFirst = false;
      },
      () => {},
      (err) => updateMini("\n\n❌ " + err, false)
    );
  }

  function openSettings() {
    const modal = el("div", { class: "aqp-modal aqp-ui" });
    const box = el("div", { class: "aqp-box" });

    const header = el("div", { class: "aqp-header" },
      el("div", {}, "Настройки Poe API"),
      el("div", {},
        el("button", { class: "aqp-btn sec", onClick: () => modal.remove() }, "Отмена"),
        el("button", { class: "aqp-btn", onClick: save }, "Сохранить")
      )
    );

    const body = el("div", { class: "aqp-body" });

    // General
    body.appendChild(el("div", { class: "aqp-section" },
      el("div", { class: "aqp-section-title" }, "Основное"),
      el("div", { class: "aqp-field" },
        el("label", { class: "aqp-label" }, "Base URL"),
        el("input", { id: "f-url", class: "aqp-input", value: config.baseUrl })
      ),
      el("div", { class: "aqp-field" },
        el("label", { class: "aqp-label" }, "API Key"),
        el("input", { id: "f-key", class: "aqp-input", type: "password", value: config.apiKey })
      ),
      el("div", { class: "aqp-field" },
        el("label", { class: "aqp-label" }, "Модель по умолчанию"),
        (() => {
          const s = el("select", { id: "f-model", class: "aqp-select" });
          POE_MODELS.forEach(m => s.appendChild(el("option", { value: m }, m)));
          s.value = config.defaultModel;
          return s;
        })()
      ),
      el("label", { class: "aqp-checkbox" },
        el("input", { id: "f-popup", type: "checkbox", checked: config.autoPopup }),
        "Автопанель при выделении"
      ),
      el("label", { class: "aqp-checkbox" },
        el("input", { id: "f-stream", type: "checkbox", checked: config.useStream }),
        "Потоковый режим"
      ),
      el("div", { class: "aqp-row" },
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Смещение X (px)"),
          el("input", { id: "f-offx", class: "aqp-input", type: "number", value: config.popupOffset.x })
        ),
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Смещение Y (px)"),
          el("input", { id: "f-offy", class: "aqp-input", type: "number", value: config.popupOffset.y })
        )
      )
    ));

    // Templates
    const tplSection = el("div", { class: "aqp-section" },
      el("div", { class: "aqp-section-title" }, "Шаблоны"),
      el("div", { id: "tpl-list" }),
      el("button", { class: "aqp-btn", onClick: addTpl }, "Добавить шаблон")
    );
    body.appendChild(tplSection);

    box.appendChild(header);
    box.appendChild(body);
    modal.appendChild(box);
    document.body.appendChild(modal);

    renderTpl();

    function renderTpl() {
      const list = document.getElementById("tpl-list");
      list.innerHTML = "";

      config.templates.forEach((t, i) => {
        const modelSupportsReasoning = REASONING_MODELS.includes(t.model);
        const modelSupportsWebSearch = WEB_SEARCH_MODELS.includes(t.model);

        list.appendChild(el("div", { class: "aqp-tpl" },
          el("div", { class: "aqp-tpl-head" },
            el("div", {}, t.name),
            el("div", { class: "aqp-tpl-actions" },
              el("button", { class: "aqp-btn sec", onClick: () => move(i, -1) }, "↑"),
              el("button", { class: "aqp-btn sec", onClick: () => move(i, 1) }, "↓"),
              el("button", { class: "aqp-btn sec", onClick: () => del(i) }, "✕")
            )
          ),
          el("div", { class: "aqp-field" },
            el("label", { class: "aqp-label" }, "Название"),
            el("input", { class: "aqp-input", value: t.name, onInput: e => t.name = e.target.value })
          ),
          el("div", { class: "aqp-field" },
            el("label", { class: "aqp-label" }, "Модель (пусто = по умолчанию)"),
            (() => {
              const s = el("select", { class: "aqp-select", onInput: e => { t.model = e.target.value; renderTpl(); } });
              s.appendChild(el("option", { value: "" }, "(по умолчанию)"));
              POE_MODELS.forEach(m => s.appendChild(el("option", { value: m }, m)));
              s.value = t.model || "";
              return s;
            })()
          ),
          el("div", { class: "aqp-field" },
            el("label", { class: "aqp-label" }, "Промпт (используйте {{selection}})"),
            el("textarea", { class: "aqp-textarea", onInput: e => t.prompt = e.target.value }, t.prompt)
          ),
          el("label", { class: "aqp-checkbox" },
            el("input", {
              type: "checkbox",
              checked: t.webSearch || false,
              disabled: !modelSupportsWebSearch,
              onInput: e => t.webSearch = e.target.checked
            }),
            "Web Search (поиск в интернете)",
            !modelSupportsWebSearch ? el("span", { class: "aqp-info" }, " — недоступно для этой модели") : ""
          ),
          el("div", { class: "aqp-field" },
            el("label", { class: "aqp-label" }, "Reasoning Effort (уровень рассуждений)"),
            (() => {
              const s = el("select", {
                class: "aqp-select",
                disabled: !modelSupportsReasoning,
                onInput: e => t.reasoningEffort = e.target.value
              });
              ["none", "low", "medium", "high"].forEach(lv =>
                s.appendChild(el("option", { value: lv },
                  lv === "none" ? "Отключено" :
                  lv === "low" ? "Низкий" :
                  lv === "medium" ? "Средний" : "Высокий"
                ))
              );
              s.value = t.reasoningEffort || "none";
              if (!modelSupportsReasoning) {
                s.appendChild(el("option", { value: "none" }, "(недоступно для этой модели)"));
              }
              return s;
            })()
          )
        ));
      });
    }

    function addTpl() {
      config.templates.push({
        id: "t" + Date.now(),
        name: "Новый шаблон",
        model: "",
        prompt: "{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      });
      renderTpl();
    }

    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= config.templates.length) return;
      [config.templates[i], config.templates[j]] = [config.templates[j], config.templates[i]];
      renderTpl();
    }

    function del(i) {
      if (!confirm("Удалить шаблон?")) return;
      config.templates.splice(i, 1);
      renderTpl();
    }

    function save() {
      config.baseUrl = document.getElementById("f-url").value.trim();
      config.apiKey = document.getElementById("f-key").value.trim();
      config.defaultModel = document.getElementById("f-model").value.trim();
      config.autoPopup = document.getElementById("f-popup").checked;
      config.useStream = document.getElementById("f-stream").checked;
      config.popupOffset = {
        x: parseInt(document.getElementById("f-offx").value, 10) || 14,
        y: parseInt(document.getElementById("f-offy").value, 10) || 12
      };

      saveConfig();
      modal.remove();
      alert("Настройки сохранены");
    }
  }

  // Init
  const gear = el("div", { class: "aqp-gear aqp-ui", onClick: openSettings }, "⚙");
  document.body.appendChild(gear);

  document.addEventListener("mousemove", e => state.lastMouse = { x: e.clientX, y: e.clientY }, { passive: true });

  let selTimer;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      if (getSelection()) showBubble();
      else hideBubble();
    }, 150);
  });

  GM_registerMenuCommand("⚙ Настройки", openSettings);

  if (!config.apiKey) {
    setTimeout(() => {
      alert("⚠️ Настройте Poe API ключ!\n\nПолучите его на: https://poe.com/api_key");
      openSettings();
    }, 1500);
  }
})();