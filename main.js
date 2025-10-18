// ==UserScript==
// @name         AI Selection → Poe API
// @namespace    ai-quick-ask-poe
// @version      2.1.0
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
  const CONFIG_VERSION = 2; // Увеличиваем при изменении структуры шаблонов

  const DEFAULTS = {
    version: CONFIG_VERSION,
    baseUrl: "https://api.poe.com/v1",
    defaultModel: "Claude-Sonnet-4",
    apiKey: "",
    autoPopup: true,
    showModelSelector: false,
    popupOffset: { x: 14, y: 12 },
    templates: [
      {
        id: "what",
        name: "What?",
        model: "GPT-4o",
        prompt: "Объясни тезисно и простыми словами, что это такое?:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      },
      {
        id: "sum",
        name: "SUM",
        model: "GPT-5",
        prompt: "**РОЛЬ:**\n\nТы — высококвалифицированный аналитик-редактор, специализирующийся на создании **экстрактивных и абстрактивных резюме** для академических и деловых текстов. Твоя главная задача — обеспечить **нулевую потерю критически важных деталей и скрытых нюансов** из исходного текста.\n\n\n\n**МЕТОДОЛОГИЯ (Chain-of-Thought):**\n\nПрежде чем начать суммаризацию, выполни следующие шаги:\n\n1. **Идентификация ключевых сущностей:** Составь внутренний список всех имен, дат, статистических данных, уникальных терминов и ключевых концепций.\n\n2. **Определение основной идеи и подтем:** Разбей текст на логические блоки и определи основную мысль каждого блока, включая любые противоречия или тонкие оговорки автора.\n\n3. **Формулировка тезисов:** Сформулируй 5-7 основных тезисов, которые, будучи объединенными, полностью передают суть и все важные детали текста.\n\n4. **Проверка на нюансы:** Убедись, что резюме отражает тон голоса (например, скептический, восторженный, нейтральный) и любые 'скрытые' предположения или оговорки, сделанные автором.\n\n\n\n**ТРЕБОВАНИЯ К ВЫВОДУ:**\n\n1. **Формат:** Резюме должно быть представлено в виде **экстрактивной (выбирающей фразы из оригинала) и абстрактивной (перефразирующей) комбинации** объемом **не более 500 слов**.\n\n2. **Точность:** Каждое утверждение в резюме должно быть **фактически подтверждено** исходным текстом.\n\n3. **Детализация:** Включи в резюме **все** ключевые статистические данные, имена и даты, упомянутые в тексте, чтобы избежать потери деталей.\n\n4. **Язык:** Резюме должно быть написано на русском профессиональным, академическим тоном.\n\n\n\n**ИСХОДНЫЙ ТЕКСТ ДЛЯ АНАЛИЗА:**\n\n---\n\n{{selection}}\n\n---\n\n",
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

  // Цены моделей (USD за 1M токенов: input / output)
  const POE_PRICING = {
    "Claude-Sonnet-4.5": { in: 3.0, out: 15.0 },
    "Claude-Sonnet-4": { in: 3.0, out: 15.0 },
    "Claude-Opus-4.1": { in: 15.0, out: 75.0 },
    "Claude-Haiku-4.5": { in: 0.8, out: 4.0 },
    "GPT-5": { in: 10.0, out: 30.0 },
    "GPT-5-Codex": { in: 10.0, out: 30.0 },
    "ChatGPT-5": { in: 5.0, out: 15.0 },
    "GPT-4.1": { in: 10.0, out: 30.0 },
    "GPT-4o": { in: 2.5, out: 10.0 },
    "Gemini-2.5-Pro": { in: 1.25, out: 5.0 },
    "Gemini-2.5-Flash": { in: 0.075, out: 0.3 },
    "Gemini-2.0-Flash": { in: 0.0, out: 0.0 },
    "Grok-4": { in: 5.0, out: 15.0 },
    "Grok-3": { in: 2.0, out: 10.0 },
    "Llama-3.1-405B": { in: 2.0, out: 2.0 },
    "Llama-3.3-70B": { in: 0.6, out: 0.6 },
    "DeepSeek-R1": { in: 0.55, out: 2.19 },
    "Qwen3-72B": { in: 0.4, out: 0.4 }
  };

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
    retryCount: 0,
    dragState: null,
    resizeState: null
  };

  function loadConfig() {
    try {
      const saved = GM_getValue(CFG_KEY);
      if (!saved) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(saved);

      // Проверяем версию конфига
      if (!parsed.version || parsed.version < CONFIG_VERSION) {
        console.log("[Poe API] Обновление конфига до версии", CONFIG_VERSION);
        // Обновляем только дефолтные шаблоны
        parsed.templates = DEFAULTS.templates;
        parsed.version = CONFIG_VERSION;
      }

      // Мержим с дефолтами для обратной совместимости
      return {
        ...DEFAULTS,
        ...parsed,
        popupOffset: { ...DEFAULTS.popupOffset, ...parsed.popupOffset },
        showModelSelector: parsed.showModelSelector ?? DEFAULTS.showModelSelector
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveConfig() {
    config.version = CONFIG_VERSION;
    GM_setValue(CFG_KEY, JSON.stringify(config));
  }

  function formatPrice(model) {
    const price = POE_PRICING[model];
    if (!price) return "";
    if (price.in === 0 && price.out === 0) return " 🆓";
    const avg = (price.in + price.out) / 2;
    return ` $${avg.toFixed(2)}/1M`;
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
      // Разрешаем выделение в body окна ответа
      if (el.id === "aqp-mini-body") return false;
      // Блокируем только для bubble и других UI элементов
      if (el.classList?.contains("aqp-bubble") || el.classList?.contains("aqp-mini")) return true;
      el = el.parentElement;
    }
    return false;
  };

  // Улучшенные стили
  GM_addStyle(`
    .aqp-bubble {
      position: fixed; z-index: 2147483648 !important; background: #1a1a1a !important; color: #f0f0f0 !important;
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
      position: fixed; z-index: 2147483647; min-width: 300px; max-width: 90vw; min-height: 150px;
      background: #fff !important; border: 1px solid #ccc; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.25) !important; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .aqp-mini-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; background: #f5f5f5 !important; border-bottom: 1px solid #ddd;
      font: 600 13px system-ui; color: #1a1a1a !important; cursor: move;
      user-select: none; flex-shrink: 0;
    }
    .aqp-mini-body {
      padding: 12px; overflow: auto; flex: 1;
      white-space: pre-wrap; font: 13px/1.5 system-ui; color: #1a1a1a !important;
      user-select: text !important; cursor: text !important;
    }
    .aqp-mini-resize {
      position: absolute; bottom: 0; right: 0; width: 20px; height: 20px;
      cursor: nwse-resize; display: flex; align-items: flex-end; justify-content: flex-end;
      padding: 2px; opacity: 0.5;
    }
    .aqp-mini-resize:hover { opacity: 1; }
    .aqp-mini-resize::after {
      content: '⋱'; font-size: 16px; color: #999; line-height: 1;
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

    // Добавляем выпадающий список моделей (только если включена опция)
    let modelSelect = null;
    if (config.showModelSelector) {
      modelSelect = el("select", {
        class: "aqp-select",
        style: { width: "auto", padding: "4px 6px", fontSize: "11px", marginRight: "6px" }
      });
      modelSelect.appendChild(el("option", { value: "" }, "Модель по умолчанию"));
      POE_MODELS.forEach(m => {
        modelSelect.appendChild(el("option", { value: m }, m + formatPrice(m)));
      });
      state.bubble.appendChild(modelSelect);
    }

    templates.forEach(tpl => {
      state.bubble.appendChild(el("button", {
        onClick: () => {
          const selectedModel = modelSelect ? modelSelect.value : "";
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

    const header = el("div", { class: "aqp-mini-header" },
      el("div", {}, title),
      el("div", {},
        el("button", { class: "sec", onClick: copyMini }, "Копировать"),
        el("button", { class: "sec", onClick: closeMini }, "Закрыть")
      )
    );

    const resizeHandle = el("div", { class: "aqp-mini-resize" });

    state.miniPanel = el("div", { class: "aqp-mini aqp-ui", style: { width: "600px", height: "400px" } },
      header,
      el("div", { class: "aqp-mini-body", id: "aqp-mini-body" }, text),
      resizeHandle
    );

    // Добавляем drag & drop
    header.addEventListener("mousedown", startDrag);

    // Добавляем resize
    resizeHandle.addEventListener("mousedown", startResize);

    const pt = getAnchorPoint();
    state.miniPanel.style.left = clamp(pt.x + 20, 10, window.innerWidth - 320) + "px";
    state.miniPanel.style.top = clamp(pt.y + 20, 10, window.innerHeight - 100) + "px";
    document.body.appendChild(state.miniPanel);

    // Закрытие при клике вне окна
    setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick, { capture: true });
    }, 100);
  }

  function handleOutsideClick(e) {
    if (!state.miniPanel) {
      document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
      return;
    }

    // Если кликнули внутри miniPanel или bubble - не закрываем
    if (state.miniPanel.contains(e.target) || (state.bubble && state.bubble.contains(e.target))) {
      return;
    }

    // Закрываем окно
    closeMini();
    document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
  }

  function startDrag(e) {
    if (e.target.tagName === "BUTTON") return; // Не тащим, если кликнули на кнопку

    state.dragState = {
      startX: e.clientX,
      startY: e.clientY,
      panelLeft: parseInt(state.miniPanel.style.left) || 0,
      panelTop: parseInt(state.miniPanel.style.top) || 0
    };

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
    e.preventDefault();
  }

  function onDrag(e) {
    if (!state.dragState) return;

    const dx = e.clientX - state.dragState.startX;
    const dy = e.clientY - state.dragState.startY;

    const newLeft = state.dragState.panelLeft + dx;
    const newTop = state.dragState.panelTop + dy;

    state.miniPanel.style.left = clamp(newLeft, 0, window.innerWidth - 300) + "px";
    state.miniPanel.style.top = clamp(newTop, 0, window.innerHeight - 100) + "px";
  }

  function stopDrag() {
    state.dragState = null;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  function startResize(e) {
    state.resizeState = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: state.miniPanel.offsetWidth,
      startHeight: state.miniPanel.offsetHeight
    };

    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", stopResize);
    e.preventDefault();
    e.stopPropagation();
  }

  function onResize(e) {
    if (!state.resizeState) return;

    const dx = e.clientX - state.resizeState.startX;
    const dy = e.clientY - state.resizeState.startY;

    const newWidth = clamp(state.resizeState.startWidth + dx, 300, window.innerWidth * 0.9);
    const newHeight = clamp(state.resizeState.startHeight + dy, 150, window.innerHeight * 0.9);

    state.miniPanel.style.width = newWidth + "px";
    state.miniPanel.style.height = newHeight + "px";
  }

  function stopResize() {
    state.resizeState = null;
    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("mouseup", stopResize);
  }

  function updateMini(text, replace) {
    const body = document.getElementById("aqp-mini-body");
    if (body) body.textContent = replace ? text : body.textContent + text;
  }

  function closeMini() {
    if (state.miniPanel) {
      state.miniPanel.remove();
      state.miniPanel = null;
      document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
    }
  }

  function copyMini() {
    const body = document.getElementById("aqp-mini-body");
    if (body?.textContent) GM_setClipboard(body.textContent);
  }

  function callAPI(model, prompt, extraParams, onDone, onError) {
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
      stream: false,
      ...extraParams
    };

    const makeRequest = () => {
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
            onDone(content);
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
              updateMini(`\n\n⏳ Повтор попытки ${state.retryCount}/3...`, false);
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

    openMini(tpl.name + " • " + model, "⏳ Отправка запроса...");

    callAPI(
      model,
      prompt,
      extraParams,
      (content) => updateMini(content, true),
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
          POE_MODELS.forEach(m => s.appendChild(el("option", { value: m }, m + formatPrice(m))));
          s.value = config.defaultModel;
          return s;
        })()
      ),
      el("label", { class: "aqp-checkbox" },
        el("input", { id: "f-popup", type: "checkbox", checked: config.autoPopup }),
        "Автопанель при выделении"
      ),
      el("label", { class: "aqp-checkbox" },
        el("input", { id: "f-showmodel", type: "checkbox", checked: config.showModelSelector }),
        "Показывать выбор модели в панели кнопок"
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
              POE_MODELS.forEach(m => s.appendChild(el("option", { value: m }, m + formatPrice(m))));
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
      config.showModelSelector = document.getElementById("f-showmodel").checked;
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