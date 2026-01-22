# AI Helper — Poe API UserScript

A browser UserScript for quick interaction with AI models via the [Poe API](https://poe.com). Allows sending selected text to AI for processing directly from any web page.

## Features

*   **Instant AI Access** — select text on any page, and a panel with templates will appear
*   **Custom Templates** — create your own prompts with the `{{selection}}` variable
*   **Multiple Models** — support for Claude, GPT, Gemini, Grok, Llama, DeepSeek
*   **Web Search** — internet search for supported models
*   **Reasoning Effort** — configurable reasoning depth (low/medium/high)
*   **Floating Response Windows** — draggable, resizable, with copy functionality
*   **Export/Import Settings** — backup configuration to JSON

## Installation

1.  Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2.  Create a new script and paste the contents of `main.js`.
3.  Obtain an API key at [poe.com/api_key](https://poe.com/api_key).
4.  Upon first run, a settings window will open — enter your API key.

## Usage

1.  Select text on any web page.
2.  A panel with template buttons will appear.
3.  Click the desired template.
4.  The AI's response will be displayed in a floating window.

## Supported Models

| Model | Web Search | Reasoning |
| :--- | :---: | :---: |
| Claude-Sonnet-4.5, Claude-Sonnet-4, Claude-Opus-4.1, Claude-Haiku-4.5 | ✓ | ✓* |
| GPT-5, GPT-5-Codex, GPT-4.1 | ✓ | ✓ |
| GPT-4o, ChatGPT-5 | ✓ | — |
| Gemini-2.5-Pro, Gemini-2.5-Flash, Gemini-2.0-Flash | ✓ | ✓** |
| Grok-4, Grok-3 | — | ✓*** |
| Llama-3.1-405B, Llama-3.3-70B | — | — |
| DeepSeek-R1 | — | ✓ |

*Claude-Opus-4.1, Claude-Haiku-4.5 | **Gemini-2.5-Flash | ***Grok-3

## Predefined Templates

*   **What?** — brief explanation of a term or concept (GPT-4o)
*   **SUM** — detailed text summarization preserving key data (GPT-5)

## Settings

Access settings: via the **⚙** button in the panel or through the Tampermonkey menu.

*   **Base URL** — API address (default: `https://api.poe.com/v1`)
*   **API Key** — your Poe key
*   **Default Model** — used if no model is specified in the template
*   **Show Model Selector** — adds a model selector to the panel
*   **Panel X/Y Offset** — panel positioning relative to the text selection
*   **Window Width/Height** — default response window size

## Creating a Template

```
Name: Translate
Model: GPT-4o
Prompt: Translate to English:\n\n{{selection}}
Web Search: false
Reasoning Effort: Disabled
```

The `{{selection}}` variable is replaced with the selected text.