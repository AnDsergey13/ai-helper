// ==UserScript==
// @name         AI Selection → Poe API
// @namespace    ai-quick-ask-poe
// @version      2.5.0
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
  const CONFIG_VERSION = 5;

  // Константы для повторяющихся значений
  const MAX_Z_INDEX = 2147483647;
  const PANEL_MIN_WIDTH = 300;
  const PANEL_MIN_HEIGHT = 150;
  const MAX_RETRY_ATTEMPTS = 2;
  const REQUEST_TIMEOUT = 120000;
  
  // Константы безопасности
  const MAX_IMPORT_SIZE = 1024 * 1024; // 1MB
  const MAX_PROMPT_LENGTH = 100000; // 100K символов
  const MAX_TEMPLATES = 50;

  const DEFAULTS = {
    version: CONFIG_VERSION,
    baseUrl: "https://api.poe.com/v1",
    defaultModel: "Claude-Sonnet-4",
    apiKey: "",
    showModelSelector: false,
    popupOffset: { x: -45, y: 45 },
    defaultWindowSize: { width: 400, height: 400 },
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
    "DeepSeek-R1"
  ];

  // Актуальная стоимость в Poe points за 1 сообщение (октябрь 2025)
  const POE_PRICING = {
    "Claude-Sonnet-4.5": 300,
    "Claude-Sonnet-4": 200,
    "Claude-Opus-4.1": 600,
    "Claude-Haiku-4.5": 30,
    "GPT-5": 800,
    "GPT-5-Codex": 800,
    "ChatGPT-5": 400,
    "GPT-4.1": 800,
    "GPT-4o": 150,
    "Gemini-2.5-Pro": 100,
    "Gemini-2.5-Flash": 10,
    "Gemini-2.0-Flash": 0,
    "Grok-4": 500,
    "Grok-3": 200,
    "Llama-3.1-405B": 150,
    "Llama-3.3-70B": 80,
    "DeepSeek-R1": 50
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
    miniPanels: [],
    requestInProgress: false,
    retryCount: 0,
    dragState: null,
    resizeState: null,
    zIndexCounter: MAX_Z_INDEX
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
        defaultWindowSize: { ...DEFAULTS.defaultWindowSize, ...parsed.defaultWindowSize },
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

  function sanitizeFilename(name) {
    // Безопасная санитизация имени файла
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function exportConfig() {
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-").replace("T", "_");
    const filename = sanitizeFilename(`aqp_config_backup_${timestamp}`) + ".json";
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importConfig() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Проверка размера файла (DoS защита)
      if (file.size > MAX_IMPORT_SIZE) {
        alert(`❌ Файл слишком большой (макс ${MAX_IMPORT_SIZE / 1024 / 1024}MB)`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          
          // Строгая валидация структуры
          if (!imported.baseUrl || !Array.isArray(imported.templates)) {
            alert("❌ Неверный формат файла конфигурации");
            return;
          }
          
          // Валидация количества шаблонов
          if (imported.templates.length > MAX_TEMPLATES) {
            alert(`❌ Слишком много шаблонов (макс ${MAX_TEMPLATES})`);
            return;
          }
          
          // Валидация каждого шаблона
          for (const tpl of imported.templates) {
            if (!tpl.name || !tpl.prompt) {
              alert("❌ Некорректная структура шаблона");
              return;
            }
            if (tpl.prompt.length > MAX_PROMPT_LENGTH) {
              alert(`❌ Промпт слишком длинный (макс ${MAX_PROMPT_LENGTH} символов)`);
              return;
            }
          }
          
          config = {
            ...DEFAULTS,
            ...imported,
            version: CONFIG_VERSION
          };
          
          saveConfig();
          alert("✓ Настройки импортированы! Перезагрузите страницу для применения.");
        } catch (err) {
          alert("❌ Ошибка чтения файла: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  function formatPrice(model) {
    const points = POE_PRICING[model];
    if (points === undefined) return "";
    if (points === 0) return " FREE";
    return ` ${points}⚡`;
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") e.className = v;
      else if (k === "style") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "checked" || k === "disabled" || k === "selected") e[k] = v;
      else if (k === "value") e.value = v;
      else e.setAttribute(k, v);
    });
    children.forEach(ch => e.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch));
    return e;
  };

  const isOurUI = (node) => {
    let el = node?.nodeType === 1 ? node : node?.parentElement;
    while (el) {
      // Разрешаем выделение в body окна ответа
      if (el.classList?.contains("aqp-mini-body")) return false;
      // Блокируем только для bubble и других UI элементов
      if (el.classList?.contains("aqp-bubble") || el.classList?.contains("aqp-mini")) return true;
      el = el.parentElement;
    }
    return false;
  };

  // Улучшенные стили
  GM_addStyle(`
    .aqp-bubble {
      position: fixed; z-index: ${MAX_Z_INDEX + 1} !important; background: #1a1a1a !important; color: #f0f0f0 !important;
      padding: 8px 10px; border-radius: 10px; display: flex; gap: 6px; flex-wrap: wrap;
      box-shadow: 0 4px 16px rgba(0,0,0,.35) !important; font: 12px system-ui;
      border: 1px solid #333 !important; align-items: center;
    }
    .aqp-bubble button {
      background: #f0f0f0 !important; color: #1a1a1a !important; border: none; padding: 6px 10px;
      border-radius: 6px; cursor: pointer; font: 12px system-ui; font-weight: 500;
    }
    .aqp-bubble button:hover { background: #fff !important; }
    .aqp-bubble button.settings-btn {
      background: transparent !important; border: 1px solid #666 !important; color: #f0f0f0 !important;
      padding: 4px 8px; font-size: 14px; margin-left: 6px;
    }
    .aqp-bubble button.settings-btn:hover { background: #333 !important; border-color: #999 !important; }

    .aqp-mini {
      position: fixed; z-index: ${MAX_Z_INDEX}; min-width: ${PANEL_MIN_WIDTH}px; max-width: 90vw; min-height: ${PANEL_MIN_HEIGHT}px;
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
    
    /* 8-сторонний resize */
    .aqp-resize {
      position: absolute; z-index: 10;
    }
    .aqp-resize-t { top: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
    .aqp-resize-r { top: 0; right: 0; bottom: 0; width: 6px; cursor: ew-resize; }
    .aqp-resize-b { bottom: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; }
    .aqp-resize-l { top: 0; left: 0; bottom: 0; width: 6px; cursor: ew-resize; }
    .aqp-resize-tl { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    .aqp-resize-tr { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    .aqp-resize-bl { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    .aqp-resize-br { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; }

    .aqp-mini button {
      background: #1a1a1a !important; color: #fff !important; border: none; padding: 5px 10px;
      border-radius: 6px; cursor: pointer; font: 11px system-ui; margin-left: 6px;
      transition: all 0.15s ease;
    }
    .aqp-mini button:hover { background: #2a2a2a !important; }
    .aqp-mini button.sec { background: #e0e0e0 !important; color: #1a1a1a !important; }
    .aqp-mini button.sec:hover { background: #d0d0d0 !important; }
    .aqp-mini button.copied { background: #10b981 !important; }

    .aqp-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,.6) !important;
      z-index: ${MAX_Z_INDEX + 1}; display: flex; align-items: center; justify-content: center;
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

    state.bubble.appendChild(el("button", {
      class: "settings-btn",
      onClick: () => {
        openSettings();
        hideBubble();
      }
    }, "⚙"));

    const pt = getAnchorPoint();
    const offX = config.popupOffset?.x ?? -45;
    const offY = config.popupOffset?.y ?? 45;
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

  function bringToFront(panel) {
    panel.style.zIndex = ++state.zIndexCounter;
  }

  function openMini(title, text) {
    const copyBtn = el("button", { class: "sec copy-btn" }, "Копировать");
    const closeBtn = el("button", { class: "sec" }, "Закрыть");

    const header = el("div", { class: "aqp-mini-header" },
      el("div", {}, title),
      el("div", {}, copyBtn, closeBtn)
    );

    const miniPanel = el("div", { class: "aqp-mini aqp-ui" },
      header,
      el("div", { class: "aqp-mini-body" }, text),
      // 8 resize-ручек
      el("div", { class: "aqp-resize aqp-resize-t", "data-dir": "t" }),
      el("div", { class: "aqp-resize aqp-resize-r", "data-dir": "r" }),
      el("div", { class: "aqp-resize aqp-resize-b", "data-dir": "b" }),
      el("div", { class: "aqp-resize aqp-resize-l", "data-dir": "l" }),
      el("div", { class: "aqp-resize aqp-resize-tl", "data-dir": "tl" }),
      el("div", { class: "aqp-resize aqp-resize-tr", "data-dir": "tr" }),
      el("div", { class: "aqp-resize aqp-resize-bl", "data-dir": "bl" }),
      el("div", { class: "aqp-resize aqp-resize-br", "data-dir": "br" })
    );

    // Устанавливаем размер из конфига
    miniPanel.style.width = config.defaultWindowSize.width + "px";
    miniPanel.style.height = config.defaultWindowSize.height + "px";

    // Центрируем окно с небольшим случайным смещением
    const randomOffset = () => Math.floor(Math.random() * 60) - 30; // ±30px
    const centerX = (window.innerWidth - config.defaultWindowSize.width) / 2 + randomOffset();
    const centerY = (window.innerHeight - config.defaultWindowSize.height) / 2 + randomOffset();

    miniPanel.style.left = clamp(centerX, 10, window.innerWidth - config.defaultWindowSize.width - 10) + "px";
    miniPanel.style.top = clamp(centerY, 10, window.innerHeight - config.defaultWindowSize.height - 10) + "px";

    // Устанавливаем z-index и добавляем обработчик для всплытия
    bringToFront(miniPanel);
    miniPanel.addEventListener("mousedown", () => bringToFront(miniPanel));

    const dragHandler = (e) => startDrag(e, miniPanel);
    header.addEventListener("mousedown", dragHandler);
    
    const resizeHandlers = [];
    miniPanel.querySelectorAll(".aqp-resize").forEach(handle => {
      const handler = (e) => startResize(e, miniPanel);
      handle.addEventListener("mousedown", handler);
      resizeHandlers.push({ handle, handler });
    });

    const copyHandler = () => copyMini(miniPanel, copyBtn);
    const closeHandler = () => {
      // Очистка event listeners (memory leak fix)
      header.removeEventListener("mousedown", dragHandler);
      resizeHandlers.forEach(({ handle, handler }) => {
        handle.removeEventListener("mousedown", handler);
      });
      copyBtn.removeEventListener("click", copyHandler);
      closeBtn.removeEventListener("click", closeHandler);
      closeMini(miniPanel);
    };

    copyBtn.addEventListener("click", copyHandler);
    closeBtn.addEventListener("click", closeHandler);

    document.body.appendChild(miniPanel);
    state.miniPanels.push(miniPanel);

    // Закрытие всех окон при клике вне
    if (state.miniPanels.length === 1) {
      setTimeout(() => {
        document.addEventListener("mousedown", handleOutsideClick, { capture: true });
      }, 100);
    }
  }

  function handleOutsideClick(e) {
    if (state.miniPanels.length === 0) {
      document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
      return;
    }

    // Проверяем, кликнули ли внутри хотя бы одного окна или bubble
    const clickedInside = state.miniPanels.some(panel => panel.contains(e.target)) ||
                          (state.bubble && state.bubble.contains(e.target));

    if (!clickedInside) {
      closeAllMini();
      document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
    }
  }

  function startDrag(e, panel) {
    if (e.target.tagName === "BUTTON") return; // Не тащим, если кликнули на кнопку

    state.dragState = {
      panel: panel,
      startX: e.clientX,
      startY: e.clientY,
      panelLeft: parseInt(panel.style.left) || 0,
      panelTop: parseInt(panel.style.top) || 0
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

    state.dragState.panel.style.left = clamp(newLeft, 0, window.innerWidth - PANEL_MIN_WIDTH) + "px";
    state.dragState.panel.style.top = clamp(newTop, 0, window.innerHeight - 100) + "px";
  }

  function stopDrag() {
    state.dragState = null;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  function startResize(e, panel) {
    const dir = e.target.dataset.dir;

    state.resizeState = {
      panel: panel,
      dir: dir,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: panel.offsetWidth,
      startHeight: panel.offsetHeight,
      startLeft: parseInt(panel.style.left) || 0,
      startTop: parseInt(panel.style.top) || 0
    };

    document.addEventListener("mousemove", onResize);
    document.addEventListener("mouseup", stopResize);
    e.preventDefault();
    e.stopPropagation();
  }

  function onResize(e) {
    if (!state.resizeState) return;

    const { panel, dir, startX, startY, startWidth, startHeight, startLeft, startTop } = state.resizeState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    // Resize по направлениям
    if (dir.includes("r")) newWidth = startWidth + dx;
    if (dir.includes("l")) { newWidth = startWidth - dx; newLeft = startLeft + dx; }
    if (dir.includes("b")) newHeight = startHeight + dy;
    if (dir.includes("t")) { newHeight = startHeight - dy; newTop = startTop + dy; }

    // Ограничиваем размеры
    newWidth = clamp(newWidth, PANEL_MIN_WIDTH, window.innerWidth * 0.9);
    newHeight = clamp(newHeight, PANEL_MIN_HEIGHT, window.innerHeight * 0.9);

    // Корректируем позицию при изменении с левой/верхней стороны
    if (dir.includes("l")) newLeft = startLeft + (startWidth - newWidth);
    if (dir.includes("t")) newTop = startTop + (startHeight - newHeight);

    panel.style.width = newWidth + "px";
    panel.style.height = newHeight + "px";
    panel.style.left = newLeft + "px";
    panel.style.top = newTop + "px";
  }

  function stopResize() {
    state.resizeState = null;
    document.removeEventListener("mousemove", onResize);
    document.removeEventListener("mouseup", stopResize);
  }

  function updateMini(panel, text, replace) {
    const body = panel.querySelector(".aqp-mini-body");
    if (body) body.textContent = replace ? text : body.textContent + text;
  }

  function closeMini(panel) {
    panel.remove();
    state.miniPanels = state.miniPanels.filter(p => p !== panel);

    if (state.miniPanels.length === 0) {
      document.removeEventListener("mousedown", handleOutsideClick, { capture: true });
    }
  }

  function closeAllMini() {
    state.miniPanels.forEach(panel => panel.remove());
    state.miniPanels = [];
  }

  function copyMini(panel, button) {
    const body = panel.querySelector(".aqp-mini-body");
    if (body?.textContent) {
      GM_setClipboard(body.textContent);

      // Анимация копирования
      const originalText = button.textContent;
      button.textContent = "✓ Скопировано!";
      button.classList.add("copied");

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("copied");
      }, 1500);
    }
  }

  function callAPI(model, prompt, extraParams, panel, onDone, onError) {
    if (state.requestInProgress) {
      onError("Предыдущий запрос ещё не завершён");
      return;
    }

    // Валидация длины промпта
    if (prompt.length > MAX_PROMPT_LENGTH) {
      onError(`Промпт слишком длинный (макс ${MAX_PROMPT_LENGTH} символов)`);
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
          if (state.retryCount < MAX_RETRY_ATTEMPTS) {
            state.retryCount++;
            setTimeout(() => {
              updateMini(panel, `\n\n⏳ Повтор попытки ${state.retryCount}/${MAX_RETRY_ATTEMPTS + 1}...`, false);
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
        timeout: REQUEST_TIMEOUT
      });
    };

    makeRequest();
  }

  function handleTemplate(tpl, overrideModel) {
    const selection = getSelection();
    if (!selection) return;

    let prompt = tpl.prompt.replace(/\{\{selection\}\}/g, selection);
    const model = overrideModel || tpl.model || config.defaultModel;

    // Дополнительные параметры для Poe API
    const extraParams = {};

    // ИСПРАВЛЕНО: Web Search через модификацию системного промпта
    // Это самый надёжный способ для Poe API
    if (tpl.webSearch && WEB_SEARCH_MODELS.includes(model)) {
      // Добавляем инструкцию в промпт вместо параметра API
      prompt = "Search the web for the most recent and relevant information to help answer this query.\n\n" + prompt;
    }

    // Reasoning effort (для поддерживаемых моделей)
    if (tpl.reasoningEffort && tpl.reasoningEffort !== "none" && REASONING_MODELS.includes(model)) {
      extraParams.reasoning_effort = tpl.reasoningEffort;
    }

    openMini(tpl.name + " • " + model, "⏳ Отправка запроса...");

    // Берём последнее созданное окно
    const panel = state.miniPanels[state.miniPanels.length - 1];

    callAPI(
      model,
      prompt,
      extraParams,
      panel,
      (content) => updateMini(panel, content, true),
      (err) => updateMini(panel, "\n\n❌ " + err, false)
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
        el("input", { id: "f-showmodel", type: "checkbox", checked: config.showModelSelector }),
        "Показывать выбор модели в панели кнопок"
      ),
      el("div", { class: "aqp-row" },
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Смещение панели X (px)"),
          el("input", { id: "f-offx", class: "aqp-input", type: "number", value: config.popupOffset.x })
        ),
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Смещение панели Y (px)"),
          el("input", { id: "f-offy", class: "aqp-input", type: "number", value: config.popupOffset.y })
        )
      ),
      el("div", { class: "aqp-row" },
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Ширина окна (px)"),
          el("input", { id: "f-winw", class: "aqp-input", type: "number", value: config.defaultWindowSize.width })
        ),
        el("div", { class: "aqp-field", style: { flex: "1" } },
          el("label", { class: "aqp-label" }, "Высота окна (px)"),
          el("input", { id: "f-winh", class: "aqp-input", type: "number", value: config.defaultWindowSize.height })
        )
      )
    ));

    body.appendChild(el("div", { class: "aqp-section" },
      el("div", { class: "aqp-section-title" }, "Резервное копирование"),
      el("div", { class: "aqp-row" },
        el("button", { class: "aqp-btn", onClick: exportConfig }, "📥 Экспорт настроек"),
        el("button", { class: "aqp-btn sec", onClick: importConfig }, "📤 Импорт настроек")
      ),
      el("div", { class: "aqp-info" }, "Экспорт сохранит все настройки в JSON файл. Импорт восстановит настройки из файла.")
    ));

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
      if (config.templates.length >= MAX_TEMPLATES) {
        alert(`❌ Достигнут лимит шаблонов (макс ${MAX_TEMPLATES})`);
        return;
      }
      
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
      config.showModelSelector = document.getElementById("f-showmodel").checked;
      config.popupOffset = {
        x: parseInt(document.getElementById("f-offx").value, 10) || -45,
        y: parseInt(document.getElementById("f-offy").value, 10) || 45
      };
      config.defaultWindowSize = {
        width: clamp(parseInt(document.getElementById("f-winw").value, 10) || 400, PANEL_MIN_WIDTH, 2000),
        height: clamp(parseInt(document.getElementById("f-winh").value, 10) || 400, PANEL_MIN_HEIGHT, 2000)
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