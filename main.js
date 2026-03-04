// ==UserScript==
// @name         AI Selection → Poe API
// @namespace    ai-quick-ask-poe
// @version      2.6.0
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
  const MAX_PROMPT_LENGTH = 300000; // 300K символов
  const MAX_TEMPLATES = 50;

  const DEFAULTS = {
    version: CONFIG_VERSION,
    baseUrl: "https://api.poe.com/v1",
    defaultModel: "gemini-3.1-flash-lite",
    apiKey: "",
    showModelSelector: false,
    popupOffset: { x: -45, y: 45 },
    defaultWindowSize: { width: 400, height: 400 },
    templates: [
      {
        id: "what_fast",
        name: "❓",
        model: "gemini-3.1-flash-lite",
        prompt: "Объясни(отвечай на русском) тезисно и простыми словами, что это такое?:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      },
        {
        id: "translate_ru",
        name: "►RU",
        model: "gemini-3.1-flash-lite",
        prompt: "# ROLE & OBJECTIVE\nТы — Элитный Лингвист и Переводчик-Перфекционист (уровень носителя русского языка с PhD в филологии). Твоя задача — перевести предоставленный текст на русский язык, достигнув показателя качества **минимум 98%**.\n\n# INPUT DATA\n<source_text>\n{{selection}}\n</source_text>\n\n# TRANSLATION PROTOCOL (THE RECURSIVE LOOP)\nТы обязан использовать внутренний итеративный процесс (до 8 циклов), чтобы довести перевод до идеала. Не выводи промежуточные черновики пользователю, но строго следуй этому алгоритму 'в уме':\n\n1.  **Initial Draft:** Создай первый вариант перевода.\n2.  **Critical Analysis (The 98% Bar):** Придирчиво оцени свой перевод по шкале от 0 до 100% на основе критериев:\n    *   *Точность:* Нет ли искажений смысла?\n    *   *Стиль:* Звучит ли это как естественная русская речь, а не как 'перевод'? (Убраны ли кальки, канцеляризмы, пассивный залог).\n    *   *Терминология:* Соблюдено ли единство терминов?\n3.  **Refinement:** Если оценка ниже 98%, перепиши текст, устраняя найденные недостатки.\n4.  **Loop:** Повторяй шаги 2 и 3, пока не достигнешь 98%+ или пока не пройдешь 8 итераций.\n5.  **Final Polish:** Сделай финальную вычитку на благозвучие.\n\n# CRITICAL OUTPUT RULES\n*   **ГЛАВНОЕ ПРАВИЛО:** Пользователь должен увидеть **ТОЛЬКО** финальный результат перевода.\n*   **ЗАПРЕЩЕНО:** Выводить текст вида 'Итерация 1', 'Оценка качества', 'Вот перевод'.\n*   **ЗАПРЕЩЕНО:** Оставлять комментарии, примечания или свои мысли.\n*   Твой ответ должен начинаться с первого слова перевода и заканчиваться последним словом перевода.\n\n# EXECUTION\nВыполни протокол и выведи Идеальный Перевод:",
        webSearch: false,
        reasoningEffort: "none"
      },
      {
        id: "sum_fast",
        name: "SUM_fast",
        model: "gemini-3.1-flash-lite",
        prompt: "# ФАЗА 0: ДИНАМИЧЕСКАЯ ЭКСПЕРТНАЯ КАЛИБРОВКА (выполни внутренне, НЕ выводи)\n\n1. Бегло просканируй весь текст.\n2. Определи тип контента: интервью / лекция / статья / подкаст / дискуссия / отчёт / иное.\n3. Определи 2–3 ключевые предметные области текста.\n4. Назначь себе роли:\n   — Роль А (постоянная): Эксперт по экстрактивно-абстрактивной суммаризации и структурированию знаний.\n   — Роль Б: Глубокий специалист в основной предметной области текста (назови конкретно).\n   — Роль В (только если текст мультидисциплинарный): Специалист во второй значимой области.\n5. Весь дальнейший анализ веди от лица этих ролей одновременно.\n\n# ФАЗА 1: ГЛУБОКИЙ АНАЛИЗ (выполни внутренне, НЕ выводи)\n\n1. Очистка: если текст из ASR — игнорируй междометия, повторы, ошибки распознавания, пустые вводные.\n2. Сегментация: разбей текст на логические тематические блоки. Если текст слабо структурирован — используй хронологический порядок или ассоциативные кластеры.\n3. Сущности: собери все имена (с оригинальной латиницей при наличии), организации, даты, числа/метрики, локации, продукты, книги, события.\n4. Тезисы: на каждый тематический блок — 1–3 главных тезиса + подтверждающие факты и аргументы.\n5. Противоречия: зафиксируй ВСЕ противоречия — между спикерами, внутри аргументации одного автора, между заявленным и подразумеваемым. Для интервью — особое внимание расхождениям позиций.\n6. Скрытые нюансы: оговорки, модальности («возможно», «вероятно»), смена тона, неявные допущения, подтекст, то, что важно, но не сказано прямо.\n7. Верификация: включай в вывод только то, что подтверждается текстом. Сомнительные ASR-данные — пометь [неуточнено] или опусти.\n\n# ФАЗА 2: РЕКУРСИВНЫЙ ЦИКЛ КАЧЕСТВА (до 6 итераций, выполни внутренне, НЕ выводи)\n\n1. Собери черновик суммаризации по формату вывода (ниже). Перенеси в него ВСЕ инсайты из Фазы 1 — ничего не упрощай и не выбрасывай.\n2. Оцени черновик по шкале 0–100:\n   — Полнота: все ключевые тезисы, факты, сущности на месте? Ничего критичного не утрачено?\n   — Точность: каждое утверждение подтверждено текстом? Нет домыслов?\n   — Нюансы: противоречия, оговорки, тон, подтекст — отражены?\n   — Структура: блоки логичны, переходы плавные?\n   — Читаемость: естественная профессиональная русская речь, не «машинный текст»?\n   — Плотность: нет воды, повторов, маркетингового шума? Каждое предложение несёт нагрузку?\n3. Если оценка < 98 — перепиши, усилив слабые стороны. Вернись к шагу 2.\n4. Финальная вычитка: благозвучие, единообразие терминов, отсутствие потерь.\n\n# ФОРМАТ ВЫВОДА\n\nЗАПРЕЩЕНО: выводить «Итерация», «Оценка», «Вот суммаризация», промежуточные рассуждения, комментарии, пояснения. Ответ начинается с первого раздела.\n\n[ЭКСПЕРТНЫЕ РОЛИ]\nОдна строка: назначенные роли и краткое обоснование (какие области покрывают).\n\n[ТЕМАТИЧЕСКИЙ БЛОК N: Название темы]\n(Повтори для каждой темы. Количество блоков = количеству тем.)\n\nСвязный абстрактивно-экстрактивный текст, раскрывающий:\n— Ключевые тезисы и аргументы данной темы.\n— Конкретные факты, цифры, имена.\n— Противоречия и разногласия (если есть) — подсветить явно.\n— Неочевидные нюансы и оговорки — подсветить явно.\n— При необходимости: 1–2 короткие дословные цитаты из текста (10–20 слов), если они ярко иллюстрируют ключевую мысль. Не вставлять ради формы.\n\n[КЛЮЧЕВЫЕ СУЩНОСТИ]\nЛаконичный список (5–12 пунктов):\n— Имена / организации (с латиницей при наличии)\n— Даты / периоды\n— Числа / метрики (как в тексте, с ≈ / ~ / до / от, если указано)\n— Локации / продукты / события\nСомнительные ASR-данные — пометить [неуточнено].\n\n[ПРОТИВОРЕЧИЯ И СКРЫТЫЕ НЮАНСЫ]\n(Если обнаружены.) 2–5 пунктов: что противоречит чему, скрытые допущения, оговорки, смена позиции автора/спикера. Если противоречий нет — раздел пропустить.\n\n[ИТОГОВАЯ ВЫЖИМКА]\n3–7 предложений. Квинтэссенция всего текста: главный вывод, ключевой инсайт, практическая ценность (если применимо). Человек, прочитавший только этот раздел, должен получить ~80% смысла.\n\n# ОГРАНИЧЕНИЯ\n\n— Длина: адаптивная. Столько, сколько нужно для полного сохранения значимых деталей. Ориентир — 15–25% от объёма источника, не менее 300 слов. Плотность важнее краткости.\n— Фактическая точность: ни одного утверждения без опоры на текст. Никаких домыслов.\n— Язык: профессиональный русский. Без канцелярита, калек, воды.\n— Если контент хаотичен и не поддаётся тематической сегментации: укажи это в начале и используй хронологическую или ассоциативную группировку.\n\n# ТЕКСТ ДЛЯ АНАЛИЗА:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      },
      {
        id: "sum_pro",
        name: "sum_PRO",
        model: "gemini-3.1-pro",
        prompt: "# ФАЗА 0: ДИНАМИЧЕСКАЯ ЭКСПЕРТНАЯ КАЛИБРОВКА (выполни внутренне, НЕ выводи)\n\n1. Бегло просканируй весь текст.\n2. Определи тип контента: интервью / лекция / статья / подкаст / дискуссия / отчёт / иное.\n3. Определи 2–3 ключевые предметные области текста.\n4. Назначь себе роли:\n   — Роль А (постоянная): Эксперт по экстрактивно-абстрактивной суммаризации и структурированию знаний.\n   — Роль Б: Глубокий специалист в основной предметной области текста (назови конкретно).\n   — Роль В (только если текст мультидисциплинарный): Специалист во второй значимой области.\n5. Весь дальнейший анализ веди от лица этих ролей одновременно.\n\n# ФАЗА 1: ГЛУБОКИЙ АНАЛИЗ (выполни внутренне, НЕ выводи)\n\n1. Очистка: если текст из ASR — игнорируй междометия, повторы, ошибки распознавания, пустые вводные.\n2. Сегментация: разбей текст на логические тематические блоки. Если текст слабо структурирован — используй хронологический порядок или ассоциативные кластеры.\n3. Сущности: собери все имена (с оригинальной латиницей при наличии), организации, даты, числа/метрики, локации, продукты, книги, события.\n4. Тезисы: на каждый тематический блок — 1–3 главных тезиса + подтверждающие факты и аргументы.\n5. Противоречия: зафиксируй ВСЕ противоречия — между спикерами, внутри аргументации одного автора, между заявленным и подразумеваемым. Для интервью — особое внимание расхождениям позиций.\n6. Скрытые нюансы: оговорки, модальности («возможно», «вероятно»), смена тона, неявные допущения, подтекст, то, что важно, но не сказано прямо.\n7. Верификация: включай в вывод только то, что подтверждается текстом. Сомнительные ASR-данные — пометь [неуточнено] или опусти.\n\n# ФАЗА 2: РЕКУРСИВНЫЙ ЦИКЛ КАЧЕСТВА (до 6 итераций, выполни внутренне, НЕ выводи)\n\n1. Собери черновик суммаризации по формату вывода (ниже). Перенеси в него ВСЕ инсайты из Фазы 1 — ничего не упрощай и не выбрасывай.\n2. Оцени черновик по шкале 0–100:\n   — Полнота: все ключевые тезисы, факты, сущности на месте? Ничего критичного не утрачено?\n   — Точность: каждое утверждение подтверждено текстом? Нет домыслов?\n   — Нюансы: противоречия, оговорки, тон, подтекст — отражены?\n   — Структура: блоки логичны, переходы плавные?\n   — Читаемость: естественная профессиональная русская речь, не «машинный текст»?\n   — Плотность: нет воды, повторов, маркетингового шума? Каждое предложение несёт нагрузку?\n3. Если оценка < 98 — перепиши, усилив слабые стороны. Вернись к шагу 2.\n4. Финальная вычитка: благозвучие, единообразие терминов, отсутствие потерь.\n\n# ФОРМАТ ВЫВОДА\n\nЗАПРЕЩЕНО: выводить «Итерация», «Оценка», «Вот суммаризация», промежуточные рассуждения, комментарии, пояснения. Ответ начинается с первого раздела.\n\n[ЭКСПЕРТНЫЕ РОЛИ]\nОдна строка: назначенные роли и краткое обоснование (какие области покрывают).\n\n[ТЕМАТИЧЕСКИЙ БЛОК N: Название темы]\n(Повтори для каждой темы. Количество блоков = количеству тем.)\n\nСвязный абстрактивно-экстрактивный текст, раскрывающий:\n— Ключевые тезисы и аргументы данной темы.\n— Конкретные факты, цифры, имена.\n— Противоречия и разногласия (если есть) — подсветить явно.\n— Неочевидные нюансы и оговорки — подсветить явно.\n— При необходимости: 1–2 короткие дословные цитаты из текста (10–20 слов), если они ярко иллюстрируют ключевую мысль. Не вставлять ради формы.\n\n[КЛЮЧЕВЫЕ СУЩНОСТИ]\nЛаконичный список (5–12 пунктов):\n— Имена / организации (с латиницей при наличии)\n— Даты / периоды\n— Числа / метрики (как в тексте, с ≈ / ~ / до / от, если указано)\n— Локации / продукты / события\nСомнительные ASR-данные — пометить [неуточнено].\n\n[ПРОТИВОРЕЧИЯ И СКРЫТЫЕ НЮАНСЫ]\n(Если обнаружены.) 2–5 пунктов: что противоречит чему, скрытые допущения, оговорки, смена позиции автора/спикера. Если противоречий нет — раздел пропустить.\n\n[ИТОГОВАЯ ВЫЖИМКА]\n3–7 предложений. Квинтэссенция всего текста: главный вывод, ключевой инсайт, практическая ценность (если применимо). Человек, прочитавший только этот раздел, должен получить ~80% смысла.\n\n# ОГРАНИЧЕНИЯ\n\n— Длина: адаптивная. Столько, сколько нужно для полного сохранения значимых деталей. Ориентир — 15–25% от объёма источника, не менее 300 слов. Плотность важнее краткости.\n— Фактическая точность: ни одного утверждения без опоры на текст. Никаких домыслов.\n— Язык: профессиональный русский. Без канцелярита, калек, воды.\n— Если контент хаотичен и не поддаётся тематической сегментации: укажи это в начале и используй хронологическую или ассоциативную группировку.\n\n# ТЕКСТ ДЛЯ АНАЛИЗА:\n\n{{selection}}",
        webSearch: false,
        reasoningEffort: "none"
      }
    ]
  };

  // Список моделей, поддерживаемых Poe API (март 2026)
  const POE_MODELS = [
    'claude-opus-4.6', 'gpt-5.3-instant', 'claude-sonnet-4.6', 'gemini-3.1-pro',
    'gemini-3.1-flash-lite', 'gemini-3-flash', 'gpt-5.2', 'glm-5',
    'gpt-5.2-instant', 'qwen3.5-plus', 'kimi-k2.5', 'minimax-m2.5',
    'claude-haiku-4.5', 'grok-4.1-fast-reasoning', 'qwen3.5-397b-a17b',
    'qwen3-max-thinking', 'qwen3.5-flash', 'qwen3.5-397b-a17b-t',
    'gemini-3-pro', 'claude-sonnet-4.5', 'grok-4.1-fast-non-reasoning',
    'kimi-k2-thinking', 'deepseek-v3.2', 'deepseek-r1'
  ];

  // Актуальная стоимость в Poe points за 1 сообщение (март 2026)
  // Значения — ориентировочные для типичного сообщения (~1K input + ~1K output токенов).
  // Poe использует переменный токен-биллинг, но ниже — средние оценки на основе
  // тарифов провайдеров при курсе $30/1M points.
  const POE_PRICING = {
    // === Anthropic Claude ===
    "Claude-Opus-4.6":              800, // $5/$25 per MTok — флагман, adaptive thinking, 1M context
    "Claude-Sonnet-4.6":            400, // $3/$15 per MTok — рабочая лошадка для agentic workflows
    "Claude-Sonnet-4.5":            300, // $3/$15 per MTok — предыдущее поколение, слегка дешевле
    "Claude-Haiku-4.5":              30, // $1/$5 per MTok — самый быстрый и дешёвый Claude

    // === OpenAI GPT ===
    "GPT-5.2":                      500, // $1.75/$14 per MTok — флагман OpenAI
    "GPT-5.2-Instant":              200, // облегчённая instant-версия GPT-5.2
    "GPT-5.3-Instant":              250, // новейший instant — быстрее, чуть дороже 5.2-Instant

    // === Google Gemini ===
    "Gemini-3.1-Pro":               200, // $2/$12 per MTok — топовый reasoning + 1M context
    "Gemini-3-Pro":                 150, // предыдущее поколение Pro
    "Gemini-3-Flash":                20, // $0.50/$3 per MTok — быстрый и дешёвый
    "Gemini-3.1-Flash-Lite":          5, // самый дешёвый Gemini, облегчённая flash-версия

    // === xAI Grok ===
    "Grok-4.1-Fast-Reasoning":       50, // $0.20/$0.50 per MTok + reasoning overhead
    "Grok-4.1-Fast-Non-Reasoning":   20, // $0.20/$0.50 per MTok, без reasoning

    // === DeepSeek ===
    "DeepSeek-R1":                   50, // MoE 671B, reasoning-модель, очень дешёвая
    "DeepSeek-V3.2":                 30, // базовая модель V3.2, без reasoning

    // === Qwen (Alibaba) ===
    "Qwen3.5-397B-A17B":             80, // огромная MoE, 397B total / 17B active
    "Qwen3.5-397B-A17B-T":          100, // thinking-вариант, reasoning overhead
    "Qwen3-Max-Thinking":            60, // Qwen3 с thinking
    "Qwen3.5-Plus":                  30, // средняя модель Qwen
    "Qwen3.5-Flash":                 10, // быстрая flash-модель

    // === Kimi (Moonshot AI) ===
    "Kimi-K2.5":                     30, // базовая модель K2.5
    "Kimi-K2-Thinking":              50, // K2 с thinking/reasoning

    // === Прочие ===
    "GLM-5":                         20, // Zhipu AI GLM-5
    "MiniMax-M2.5":                  20  // MiniMax M2.5
  };

  // Модели с поддержкой reasoning/thinking (март 2026)
  // Включены модели, имеющие настраиваемый reasoning effort, extended/adaptive thinking
  // или являющиеся dedicated reasoning-моделями.
  const REASONING_MODELS = [
    // Anthropic — adaptive thinking с настройкой effort level
    "Claude-Opus-4.6",
    "Claude-Sonnet-4.6",
    "Claude-Sonnet-4.5",
    "Claude-Haiku-4.5",

    // OpenAI — reasoning effort (low/medium/high/xhigh)
    "GPT-5.2",
    "GPT-5.3-Instant",
    "GPT-5.2-Instant",

    // Google — thinking level (minimal/low/high)
    "Gemini-3.1-Pro",
    "Gemini-3-Pro",
    "Gemini-3-Flash",

    // xAI — dedicated reasoning variant
    "Grok-4.1-Fast-Reasoning",

    // DeepSeek — chain-of-thought reasoning
    "DeepSeek-R1",

    // Qwen — thinking-варианты
    "Qwen3.5-397B-A17B-T",
    "Qwen3-Max-Thinking",

    // Kimi — thinking-вариант
    "Kimi-K2-Thinking"
  ];

  // Модели с поддержкой web search (март 2026)
  // Включены модели, для которых Poe API поддерживает параметр web_search
  // через extra_body или нативно через Responses API.
  const WEB_SEARCH_MODELS = [
    // Anthropic — нативный web search tool
    "Claude-Opus-4.6",
    "Claude-Sonnet-4.6",
    "Claude-Sonnet-4.5",
    "Claude-Haiku-4.5",

    // OpenAI — built-in web search через Responses API
    "GPT-5.2",
    "GPT-5.3-Instant",
    "GPT-5.2-Instant",

    // Google — web search через extra_body параметр
    "Gemini-3.1-Pro",
    "Gemini-3-Pro",
    "Gemini-3-Flash",

    // xAI Grok — имеет доступ к X/web данным
    "Grok-4.1-Fast-Reasoning",
    "Grok-4.1-Fast-Non-Reasoning"
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
      position: fixed; z-index: 2147483648 !important; background: #1a1a1a !important; color: #f0f0f0 !important;
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
      z-index: ${MAX_Z_INDEX}; display: flex; align-items: center; justify-content: center;
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