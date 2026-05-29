(() => {
  "use strict";

  const STYLE_ID = "gemini-style-tuner-style";
  const CODE_THEME_STYLE_ID = "gemini-style-tuner-code-theme";
  const THEME_ATTR = "data-gemini-style-tuner-theme";
  const SHIKI_RENDER_ATTR = "data-gemini-style-tuner-shiki";
  const SHIKI_THEME_ATTR = "data-gemini-style-tuner-shiki-theme";
  const SHIKI_PENDING_ATTR = "data-gemini-style-tuner-shiki-pending";
  const PLAIN_TEXT_LANGUAGE_ID = "plaintext";
  const OBSERVER_DEBOUNCE_MS = 120;
  const {
    STORAGE_KEY,
    CODE_THEME_PRESETS,
    DEFAULT_CONFIG,
    mergeConfig,
  } = globalThis.GeminiStyleTunerConfig;
  let config = { ...DEFAULT_CONFIG };
  const codeBlockSnapshots = new WeakMap();
  const codeBlockRenderState = new WeakMap();
  const shikiModuleCache = new Map();
  const shikiThemeCache = new Map();
  const shikiLanguageCache = new Map();
  let shikiHighlighterPromise = null;

  const CODE_THEME_METADATA = Object.fromEntries(
    (Array.isArray(CODE_THEME_PRESETS) ? CODE_THEME_PRESETS : []).map((preset) => [preset.key, preset]),
  );

  const SHIKI_THEME_LOADERS = Object.fromEntries(
    (Array.isArray(CODE_THEME_PRESETS) ? CODE_THEME_PRESETS : [])
      .filter((preset) => preset?.shikiTheme)
      .map((preset) => [preset.shikiTheme, () => loadShikiModule(`./vendor/shiki/themes/${preset.shikiTheme}.mjs`)]),
  );

  const SHIKI_LANGUAGE_REGISTRY = globalThis.GeminiStyleTunerShikiLanguages || { languages: [], aliasMap: {} };
  const SHIKI_LANGUAGE_METADATA = Object.fromEntries(
    (Array.isArray(SHIKI_LANGUAGE_REGISTRY.languages) ? SHIKI_LANGUAGE_REGISTRY.languages : [])
      .map((language) => [language.id, language]),
  );
  const LANGUAGE_ALIAS_MAP = SHIKI_LANGUAGE_REGISTRY.aliasMap || {};

  const ANSWER_ROOTS = [
    "chat-app .chat-history",
    "chat-app .conversation-container",
    "chat-app [class*='conversation']",
    "chat-app [class*='response']",
    "chat-app [class*='markdown']",
    "chat-app [class*='rich-text']",
    "chat-app main",
  ];

  const USER_CONTENT_EXCLUDES = [
    ".user-query-container",
    ".query-text",
    "textarea",
    "input",
    "[contenteditable='true']",
    ".initial-input-area",
    "[class*='input-area']",
    "[class*='composer']",
  ];

  const BODY_TEXT_SELECTORS = [
    "p",
    "li",
    "blockquote",
    "td",
    "th",
  ];

  const BOLD_TEXT_SELECTORS = [
    "p b",
    "p strong",
    "li b",
    "li strong",
    "blockquote b",
    "blockquote strong",
    "td b",
    "td strong",
    "th b",
    "th strong",
  ];

  const MATH_TEXT_SELECTORS = [
    ".math-block",
    ".math-block .katex",
    ".math-block .katex-display",
  ];

  const CODE_CONTENT_SELECTORS = [
    "code[data-test-id='code-content']",
    ".formatted-code-block-internal-container code",
    "code.code-container.formatted",
    "pre > code",
  ];

  const CODE_SELECTORS = [
    "pre",
    "pre code",
    "code",
    "[class*='code'] pre",
    "[class*='code'] code",
    "code-block pre",
    "code-block code[data-test-id='code-content']",
    "code-block code[data-test-id='code-content'] span",
    "code-block code.code-container.formatted",
    "code-block code.code-container.formatted span",
    ".formatted-code-block-internal-container pre",
    ".formatted-code-block-internal-container code[data-test-id='code-content']",
    ".formatted-code-block-internal-container code[data-test-id='code-content'] span",
    ".formatted-code-block-internal-container code",
    ".formatted-code-block-internal-container code span",
  ];

  const INLINE_CODE_SELECTORS = [
    "h1 code:not([data-test-id='code-content'])",
    "h2 code:not([data-test-id='code-content'])",
    "h3 code:not([data-test-id='code-content'])",
    "h4 code:not([data-test-id='code-content'])",
    "h5 code:not([data-test-id='code-content'])",
    "h6 code:not([data-test-id='code-content'])",
    "p code:not([data-test-id='code-content'])",
    "li code:not([data-test-id='code-content'])",
    "blockquote code:not([data-test-id='code-content'])",
    "td code:not([data-test-id='code-content'])",
    "th code:not([data-test-id='code-content'])",
  ];

  const SOURCE_CHIP_SELECTORS = [
    "button.multiple-button",
    "button[aria-label*='source details']",
    ".source-label-container",
  ];

  const CODE_BLOCK_SELECTORS = [
    "pre",
    "code-block",
    "[class*='code'] pre",
    ".formatted-code-block-internal-container",
    ".formatted-code-block-internal-container pre",
  ];

  const CODE_BLOCK_OUTER_SELECTORS = [
    "code-block .code-block",
  ];

  const CODE_BLOCK_INNER_SELECTORS = [
    "code-block .formatted-code-block-internal-container",
    ".formatted-code-block-internal-container",
  ];

  const CODE_BLOCK_VISUAL_SURFACE_SELECTORS = [
    "code-block .code-block",
    "code-block .formatted-code-block-internal-container",
    "code-block .formatted-code-block-internal-container .animated-opacity",
    "code-block .formatted-code-block-internal-container pre",
    ".formatted-code-block-internal-container",
    ".formatted-code-block-internal-container .animated-opacity",
    ".formatted-code-block-internal-container pre",
  ];

  const USER_QUERY_BUBBLE_SELECTORS = [
    "user-query .user-query-bubble-with-background",
    ".user-query-bubble-with-background",
  ];

  const USER_QUERY_CONTENT_SELECTORS = [
    "user-query .query-content",
    ".query-content",
  ];

  const LUMINOUS_TOGGLE_SURFACE_SELECTORS = [
    ".luminous-toggle-container",
    ".luminous-expand-fade",
    "[data-test-id='luminous-expand-button']",
    "[data-test-id='luminous-expand-pill']",
    "[data-test-id='luminous-collapse-button']",
    "[data-test-id='luminous-collapse-pill']",
  ];

  const SIDENAV_SURFACE_SELECTORS = [
    ".overflow-container",
    ".sidenav-with-history-container",
    ".side-navigation-content",
    "bard-sidenav",
  ];

  const SIDENAV_FOOTER_SELECTORS = [
    ".sidenav-mavatar-footer",
    ".mavatar-footer-row",
  ];

  const SIDENAV_SELECTED_CONVERSATION_SELECTORS = [
    ".conversation.selected",
    ".conversations-container .conversation.selected",
    ".conversation-items-container .conversation.selected",
    ".gem-nav-list-item.is-active",
    ".gem-nav-list-item.is-active[class]",
  ];

  const DIRECT_LIST_ITEM_TARGETS = [
    "ul > li",
    "ol > li",
    "ul ul > li",
    "ol ol > li",
    "ul ol > li",
    "ol ul > li",
  ];

  const DIRECT_LIST_TEXT_TARGETS = [
    "ul > li > p",
    "ul > li > div",
    "ul > li > span",
    "ol > li > p",
    "ol > li > div",
    "ol > li > span",
    "ul ul > li > p",
    "ul ul > li > div",
    "ul ul > li > span",
    "ol ol > li > p",
    "ol ol > li > div",
    "ol ol > li > span",
    "ul ol > li > p",
    "ul ol > li > div",
    "ul ol > li > span",
    "ol ul > li > p",
    "ol ul > li > div",
    "ol ul > li > span",
  ];

  const DIRECT_ORDERED_LIST_ITEM_TARGETS = [
    "ol > li",
    "ol ol > li",
    "ul ol > li",
  ];

  const DIRECT_ORDERED_LIST_TEXT_TARGETS = [
    "ol > li > p:first-child",
    "ol > li > div:first-child",
    "ol > li > span:first-child",
    "ol ol > li > p:first-child",
    "ol ol > li > div:first-child",
    "ol ol > li > span:first-child",
    "ul ol > li > p:first-child",
    "ul ol > li > div:first-child",
    "ul ol > li > span:first-child",
  ];

  function buildScopedSelectors(baseSelectors, targets) {
    const excludeTail = USER_CONTENT_EXCLUDES.map((selector) => `:not(${selector})`).join("");
    return baseSelectors.flatMap((base) => {
      return targets.map((target) => `${base} ${target}${excludeTail}`);
    }).join(",\n");
  }

  function buildPseudoScopedSelectors(baseSelectors, targets, pseudo) {
    const excludeTail = USER_CONTENT_EXCLUDES.map((selector) => `:not(${selector})`).join("");
    return baseSelectors.flatMap((base) => {
      return targets.map((target) => `${base} ${target}${excludeTail}${pseudo}`);
    }).join(",\n");
  }

  function buildLightModeSelectors(selectors) {
    return selectors
      .map((selector) => `:root[${THEME_ATTR}="light"] ${selector}`)
      .join(",\n");
  }

  function buildLightModeStateSelectors(selectors, states) {
    return selectors.flatMap((selector) => {
      return states.map((state) => `:root[${THEME_ATTR}="light"] ${selector}${state}`);
    }).join(",\n");
  }

  function buildLightScopedSelectors(baseSelectors, targets) {
    const excludeTail = USER_CONTENT_EXCLUDES.map((selector) => `:not(${selector})`).join("");
    return baseSelectors.flatMap((base) => {
      return targets.map((target) => `:root[${THEME_ATTR}="light"] ${base} ${target}${excludeTail}`);
    }).join(",\n");
  }

  function hasDarkThemeSignal(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const signalText = [
      element.className,
      element.getAttribute("data-theme"),
      element.getAttribute("theme"),
      element.getAttribute("aria-label"),
    ].join(" ").toLowerCase();

    if (/\b(dark|dark-theme|theme-dark)\b/.test(signalText)) {
      return true;
    }

    const colorScheme = window.getComputedStyle(element).colorScheme.toLowerCase();
    return colorScheme.split(/\s+/).includes("dark");
  }

  function detectGeminiTheme() {
    const candidates = [
      document.documentElement,
      document.body,
      document.querySelector("chat-app"),
      document.querySelector("bard-sidenav"),
      document.querySelector("main"),
    ];

    return candidates.some(hasDarkThemeSignal) ? "dark" : "light";
  }

  function updateThemeState() {
    document.documentElement.setAttribute(THEME_ATTR, detectGeminiTheme());
  }

  function getActiveCodeThemePreset() {
    const themeMode = document.documentElement.getAttribute(THEME_ATTR);
    return themeMode === "dark"
      ? config.darkCodeThemePreset
      : config.lightCodeThemePreset;
  }

  function getActiveCodeThemeDefinition() {
    const presetKey = getActiveCodeThemePreset();
    if (!presetKey || presetKey === "default") {
      return null;
    }

    return CODE_THEME_METADATA[presetKey] || null;
  }

  function loadShikiModule(relativePath) {
    const absoluteUrl = chrome.runtime.getURL(relativePath);
    if (!shikiModuleCache.has(absoluteUrl)) {
      shikiModuleCache.set(absoluteUrl, import(absoluteUrl));
    }
    return shikiModuleCache.get(absoluteUrl);
  }

  async function getShikiHighlighter() {
    if (!shikiHighlighterPromise) {
      shikiHighlighterPromise = Promise.all([
        loadShikiModule("./vendor/shiki/core/index.mjs"),
        loadShikiModule("./vendor/shiki/engine-oniguruma/index.mjs"),
        loadShikiModule("./vendor/shiki/engine-oniguruma/wasm-inlined.mjs"),
      ]).then(async ([coreModule, engineModule, wasmModule]) => {
        return coreModule.createHighlighterCore({
          themes: [],
          langs: [],
          engine: await engineModule.createOnigurumaEngine(wasmModule),
        });
      });
    }

    return shikiHighlighterPromise;
  }

  async function ensureShikiThemeLoaded(highlighter, themeId) {
    if (!themeId) {
      return null;
    }

    if (!shikiThemeCache.has(themeId)) {
      const loader = SHIKI_THEME_LOADERS[themeId];
      if (!loader) {
        throw new Error(`Unsupported Shiki theme: ${themeId}`);
      }

      shikiThemeCache.set(themeId, loader().then((module) => module.default || module));
    }

    const theme = await shikiThemeCache.get(themeId);
    await highlighter.loadTheme(theme);
    return theme;
  }

  async function ensureShikiLanguageLoaded(highlighter, languageId) {
    if (!languageId) {
      return null;
    }

    if (!shikiLanguageCache.has(languageId)) {
      const languageDefinition = SHIKI_LANGUAGE_METADATA[languageId];
      const languageFile = languageDefinition?.file || `${languageId}.mjs`;
      if (!languageDefinition || !/^[\w.+-]+\.mjs$/.test(languageFile)) {
        return null;
      }

      shikiLanguageCache.set(
        languageId,
        loadShikiModule(`./vendor/shiki/langs/${languageFile}`).then((module) => module.default || module),
      );
    }

    let language = null;
    try {
      language = await shikiLanguageCache.get(languageId);
    } catch {
      shikiLanguageCache.delete(languageId);
      return null;
    }

    await highlighter.loadLanguage(language);
    return language;
  }

  function getCodeBlockElements(root) {
    if (!(root instanceof Element)) {
      return null;
    }

    const codeContentSelector = CODE_CONTENT_SELECTORS.join(", ");
    const codeElement = root.matches?.(codeContentSelector)
      ? root
      : root.querySelector?.(codeContentSelector);
    const preElement = root.matches?.("pre")
      ? root
      : root.querySelector?.("pre") || codeElement?.closest?.("pre");
    const innerElement = root.closest?.(".formatted-code-block-internal-container")
      || root.querySelector?.(".formatted-code-block-internal-container")
      || codeElement?.closest?.(".formatted-code-block-internal-container")
      || preElement?.closest?.(".formatted-code-block-internal-container");
    const outerElement = innerElement?.closest?.(".code-block") || root.closest?.(".code-block") || root.querySelector?.(".code-block");
    const codeBlockElement = innerElement?.closest?.("code-block") || root.closest?.("code-block");

    if (!(codeElement instanceof HTMLElement) || !(preElement instanceof HTMLElement) || !(innerElement instanceof HTMLElement)) {
      return null;
    }

    return {
      codeElement,
      preElement,
      innerElement,
      outerElement: outerElement instanceof HTMLElement ? outerElement : null,
      codeBlockElement: codeBlockElement instanceof HTMLElement ? codeBlockElement : null,
    };
  }

  function getCodeBlockTargets() {
    const matches = new Set();
    document.querySelectorAll([
      "code-block",
      ".formatted-code-block-internal-container",
      ...CODE_CONTENT_SELECTORS,
    ].join(", ")).forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }

      const elements = getCodeBlockElements(node);
      if (elements?.innerElement) {
        matches.add(elements.innerElement);
      }
    });
    return [...matches];
  }

  function shouldApplyCustomCodeTheme() {
    const themeDefinition = getActiveCodeThemeDefinition();
    return Boolean(themeDefinition?.shikiTheme);
  }

  function getShikiStateHosts(elements) {
    return [
      elements.innerElement,
      elements.outerElement,
      elements.codeBlockElement,
    ].filter((node, index, nodes) => node instanceof HTMLElement && nodes.indexOf(node) === index);
  }

  function setShikiPending(elements, isPending) {
    getShikiStateHosts(elements).forEach((host) => {
      if (isPending) {
        host.setAttribute(SHIKI_PENDING_ATTR, "true");
      } else {
        host.removeAttribute(SHIKI_PENDING_ATTR);
      }
    });
  }

  function markPendingCodeBlocks(root = document) {
    if (!shouldApplyCustomCodeTheme()) {
      return;
    }

    const childMatches = root instanceof Element
      ? root.querySelectorAll?.("code-block, .formatted-code-block-internal-container, code[data-test-id='code-content'], code.code-container.formatted, pre > code") || []
      : [];
    const nodes = root instanceof Element
      ? [root, ...childMatches]
      : getCodeBlockTargets();

    nodes.forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }

      const elements = getCodeBlockElements(node);
      if (!elements || elements.codeElement.hasAttribute(SHIKI_RENDER_ATTR)) {
        return;
      }

      setShikiPending(elements, true);
    });
  }

  function clearPendingCodeBlocks() {
    document.querySelectorAll(`[${SHIKI_PENDING_ATTR}="true"]`).forEach((node) => {
      if (node instanceof HTMLElement) {
        node.removeAttribute(SHIKI_PENDING_ATTR);
      }
    });
  }

  function ensureCodeBlockSnapshot(target) {
    const elements = getCodeBlockElements(target);
    if (!elements) {
      return null;
    }

    if (!codeBlockSnapshots.has(elements.codeElement)) {
      const hasShikiState = elements.innerElement.hasAttribute(SHIKI_THEME_ATTR)
        || elements.codeElement.hasAttribute(SHIKI_RENDER_ATTR);
      codeBlockSnapshots.set(elements.codeElement, {
        innerHTML: elements.codeElement.innerHTML,
        textContent: elements.codeElement.textContent || "",
        preBackground: elements.preElement.style.backgroundColor || "",
        preColor: hasShikiState ? "" : elements.preElement.style.color || "",
        innerBackground: elements.innerElement.style.backgroundColor || "",
        innerColor: hasShikiState ? "" : elements.innerElement.style.color || "",
      });
    }

    return {
      elements,
      snapshot: codeBlockSnapshots.get(elements.codeElement),
    };
  }

  function restoreOriginalCodeBlock(target) {
    const payload = ensureCodeBlockSnapshot(target);
    if (!payload) {
      return;
    }

    const { elements, snapshot } = payload;
    setShikiPending(elements, false);
    elements.codeElement.innerHTML = snapshot.innerHTML;
    elements.codeElement.removeAttribute(SHIKI_RENDER_ATTR);
    clearShikiThemeSurface(elements);
    elements.preElement.style.backgroundColor = snapshot.preBackground;
    elements.preElement.style.color = snapshot.preColor;
    elements.innerElement.style.backgroundColor = snapshot.innerBackground;
    elements.innerElement.style.color = snapshot.innerColor;
    codeBlockRenderState.delete(elements.codeElement);
  }

  function normalizeLanguageId(value) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^language-/, "")
      .replace(/^lang-/, "")
      .replace(/\s+/g, "-");

    return LANGUAGE_ALIAS_MAP[normalized] || null;
  }

  function detectCodeLanguage(target) {
    const payload = ensureCodeBlockSnapshot(target);
    if (!payload) {
      return null;
    }

    const { elements } = payload;
    const candidates = [];
    const attributeKeys = ["data-language", "language", "lang", "data-lang"];
    const languageLabel = elements.innerElement
      .querySelector?.(".code-block-decoration > span:first-child")
      ?.textContent;
    if (languageLabel) {
      candidates.push(languageLabel);
    }

    [elements.codeElement, elements.preElement, elements.innerElement, elements.outerElement, elements.codeBlockElement]
      .filter(Boolean)
      .forEach((node) => {
        attributeKeys.forEach((key) => {
          const attrValue = node.getAttribute?.(key);
          if (attrValue) {
            candidates.push(attrValue);
          }
        });

        String(node.className || "")
          .split(/\s+/)
          .forEach((className) => {
            if (/^(language|lang)-/i.test(className)) {
              candidates.push(className);
            }
          });
      });

    for (const candidate of candidates) {
      const languageId = normalizeLanguageId(candidate);
      if (languageId) {
        return languageId;
      }
    }

    return null;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseColor(value) {
    const color = String(value || "").trim();
    const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1].length === 3
        ? hexMatch[1].split("").map((char) => char + char).join("")
        : hexMatch[1];

      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }

    const rgbMatch = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch) {
      return {
        r: Math.max(0, Math.min(255, Number(rgbMatch[1]))),
        g: Math.max(0, Math.min(255, Number(rgbMatch[2]))),
        b: Math.max(0, Math.min(255, Number(rgbMatch[3]))),
      };
    }

    return null;
  }

  function getRelativeLuminance(color) {
    const toLinear = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return (0.2126 * toLinear(color.r)) + (0.7152 * toLinear(color.g)) + (0.0722 * toLinear(color.b));
  }

  function buildThemeSurfaceColors(foreground, background) {
    const backgroundColor = parseColor(background);
    const isDarkBackground = backgroundColor ? getRelativeLuminance(backgroundColor) < 0.45 : true;
    const overlayColor = isDarkBackground ? "255, 255, 255" : "0, 0, 0";

    return {
      foreground: foreground || (isDarkBackground ? "#f8f8f2" : "#24292f"),
      background: background || (isDarkBackground ? "#1f1f1f" : "#ffffff"),
      mutedForeground: foreground || (isDarkBackground ? "#f8f8f2" : "#24292f"),
      hoverBackground: `rgba(${overlayColor}, ${isDarkBackground ? "0.14" : "0.08"})`,
    };
  }

  function getThemeColor(theme, tokenResult, colorName) {
    if (colorName === "foreground") {
      return theme.colors?.["editor.foreground"]
        || theme.colors?.foreground
        || theme.fg
        || tokenResult.fg
        || "";
    }

    return theme.colors?.["editor.background"]
      || theme.colors?.background
      || theme.bg
      || tokenResult.bg
      || "";
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "").trim());
  }

  function getActiveCodeBlockBackground(themeBackground) {
    const themeMode = document.documentElement.getAttribute(THEME_ATTR);
    const enabledKey = themeMode === "dark"
      ? "darkCodeBlockBackgroundOverrideEnabled"
      : "lightCodeBlockBackgroundOverrideEnabled";
    const colorKey = themeMode === "dark"
      ? "darkCodeBlockBackgroundOverride"
      : "lightCodeBlockBackgroundOverride";
    const overrideColor = String(config[colorKey] || "").trim();

    if (config[enabledKey] === "true" && isHexColor(overrideColor)) {
      return overrideColor;
    }

    return themeBackground;
  }

  function getShikiThemeSurfaceHosts(elements) {
    return getShikiStateHosts(elements);
  }

  function getShikiThemeBackgroundTargets(elements) {
    return [
      elements.outerElement,
      elements.innerElement,
      elements.innerElement.querySelector?.(".animated-opacity"),
    ].filter((node, index, nodes) => node instanceof HTMLElement && nodes.indexOf(node) === index);
  }

  function getShikiThemeTransparentTargets(elements) {
    return [
      elements.preElement,
      elements.codeElement,
    ].filter((node, index, nodes) => node instanceof HTMLElement && nodes.indexOf(node) === index);
  }

  function getShikiToolbarTargets(elements) {
    const toolbarControls = elements.innerElement.querySelectorAll?.(
      ".buttons gem-icon-button, .buttons button, .buttons gem-icon, .buttons mat-icon, .buttons [data-test-id='gem-copy-button'], .buttons [data-test-id*='download' i], .buttons [aria-label*='Copy' i], .buttons [aria-label*='Download' i]",
    ) || [];

    return [
      elements.innerElement.querySelector?.(".code-block-decoration > span:first-child"),
      ...toolbarControls,
    ].filter((node, index, nodes) => node instanceof HTMLElement && nodes.indexOf(node) === index);
  }

  function applyShikiToolbarColor(elements, colors) {
    getShikiToolbarTargets(elements).forEach((target) => {
      target.style.setProperty("color", colors.foreground, "important");
      target.style.setProperty("--gem-sys-color--on-surface", colors.foreground, "important");
      target.style.setProperty("--gem-sys-color--on-surface-variant", colors.foreground, "important");
      target.style.setProperty("--lumi-sys-color--on-surface", colors.foreground, "important");
      target.style.setProperty("--mat-button-text-label-text-color", colors.foreground, "important");
      target.style.setProperty("--mat-button-text-state-layer-color", colors.foreground, "important");
      target.style.setProperty("--mat-icon-button-icon-color", colors.foreground, "important");
      target.style.setProperty("--mdc-icon-button-icon-color", colors.foreground, "important");
    });
  }

  function clearShikiToolbarColor(elements) {
    getShikiToolbarTargets(elements).forEach((target) => {
      [
        "color",
        "--gem-sys-color--on-surface",
        "--gem-sys-color--on-surface-variant",
        "--lumi-sys-color--on-surface",
        "--mat-button-text-label-text-color",
        "--mat-button-text-state-layer-color",
        "--mat-icon-button-icon-color",
        "--mdc-icon-button-icon-color",
      ].forEach((propertyName) => {
        target.style.removeProperty(propertyName);
      });
    });
  }

  function applyShikiThemeSurface(elements, tokenResult, theme) {
    const colors = buildThemeSurfaceColors(
      getThemeColor(theme, tokenResult, "foreground"),
      getActiveCodeBlockBackground(getThemeColor(theme, tokenResult, "background")),
    );

    getShikiThemeSurfaceHosts(elements).forEach((host) => {
      host.setAttribute(SHIKI_THEME_ATTR, "true");
      host.style.setProperty("--gemini-shiki-toolbar-fg", colors.foreground);
      host.style.setProperty("--gemini-shiki-toolbar-bg", colors.background);
      host.style.setProperty("--gemini-shiki-toolbar-hover-bg", colors.hoverBackground);
    });
    setShikiPending(elements, false);

    getShikiThemeBackgroundTargets(elements).forEach((target) => {
      target.style.setProperty("background-color", colors.background, "important");
      target.style.setProperty("background-image", "none", "important");
      target.style.setProperty("border-color", colors.background, "important");
      target.style.setProperty("outline-color", colors.background, "important");
      target.style.setProperty("box-shadow", "none", "important");
    });
    getShikiThemeTransparentTargets(elements).forEach((target) => {
      target.style.setProperty("background-color", "transparent", "important");
      target.style.setProperty("background-image", "none", "important");
    });
    applyShikiToolbarColor(elements, colors);
    elements.innerElement.style.removeProperty("color");
    elements.preElement.style.removeProperty("color");
  }

  function clearShikiThemeSurface(elements) {
    getShikiThemeSurfaceHosts(elements).forEach((host) => {
      host.removeAttribute(SHIKI_THEME_ATTR);
      [
        "--gemini-shiki-code-fg",
        "--gemini-shiki-code-bg",
        "--gemini-shiki-code-muted-fg",
        "--gemini-shiki-code-hover-bg",
        "--gemini-shiki-toolbar-fg",
        "--gemini-shiki-toolbar-bg",
        "--gemini-shiki-toolbar-hover-bg",
      ].forEach((propertyName) => {
        host.style.removeProperty(propertyName);
      });
    });
    getShikiThemeBackgroundTargets(elements).forEach((target) => {
      target.style.removeProperty("background-color");
      target.style.removeProperty("background-image");
      target.style.removeProperty("border-color");
      target.style.removeProperty("outline-color");
      target.style.removeProperty("box-shadow");
    });
    getShikiThemeTransparentTargets(elements).forEach((target) => {
      target.style.removeProperty("background-color");
      target.style.removeProperty("background-image");
    });
    clearShikiToolbarColor(elements);
  }

  function tokenStyleToString(token) {
    const styles = [];
    if (token.color) {
      styles.push(`color: ${token.color}`);
    }
    if (token.bgColor) {
      styles.push(`background-color: ${token.bgColor}`);
    }
    if (token.fontStyle) {
      if (token.fontStyle & 1) {
        styles.push("font-style: italic");
      }
      if (token.fontStyle & 2) {
        styles.push("font-weight: 700");
      }
      const decorations = [];
      if (token.fontStyle & 4) {
        decorations.push("underline");
      }
      if (token.fontStyle & 8) {
        decorations.push("line-through");
      }
      if (decorations.length) {
        styles.push(`text-decoration: ${decorations.join(" ")}`);
      }
    }
    return styles.join("; ");
  }

  function renderShikiHtml(tokenResult) {
    return tokenResult.tokens.map((line) => {
      if (!Array.isArray(line) || line.length === 0) {
        return "\n";
      }

      const html = line.map((token) => {
        const style = tokenStyleToString(token);
        const content = escapeHtml(token.content);
        return style ? `<span style="${style}">${content}</span>` : `<span>${content}</span>`;
      }).join("");

      return `${html}\n`;
    }).join("");
  }

  function createPlainTextTokenResult(text, theme) {
    const foreground = getThemeColor(theme, {}, "foreground") || "#24292e";
    const background = getThemeColor(theme, {}, "background") || "";
    const lines = String(text || "").split("\n");

    return {
      fg: foreground,
      bg: background,
      tokens: lines.map((line) => {
        return line ? [{ content: line, color: foreground }] : [];
      }),
    };
  }

  async function renderCodeBlockWithShiki(target) {
    const themeDefinition = getActiveCodeThemeDefinition();
    const payload = ensureCodeBlockSnapshot(target);
    if (!payload) {
      return;
    }

    if (!themeDefinition || !themeDefinition.shikiTheme) {
      restoreOriginalCodeBlock(target);
      return;
    }

    const { elements, snapshot } = payload;
    const detectedLanguageId = detectCodeLanguage(target);

    const highlighter = await getShikiHighlighter();
    const theme = await ensureShikiThemeLoaded(highlighter, themeDefinition.shikiTheme);
    if (!theme) {
      restoreOriginalCodeBlock(target);
      return;
    }

    const language = await ensureShikiLanguageLoaded(highlighter, detectedLanguageId);
    const languageId = language ? detectedLanguageId : PLAIN_TEXT_LANGUAGE_ID;
    const renderKey = `${themeDefinition.shikiTheme}::${languageId}::${snapshot.textContent}`;
    if (codeBlockRenderState.get(elements.codeElement) === renderKey) {
      applyShikiThemeSurface(elements, { fg: "", bg: "" }, theme);
      return;
    }

    const tokenResult = language
      ? highlighter.codeToTokens(snapshot.textContent, {
        lang: languageId,
        theme: theme.name,
      })
      : createPlainTextTokenResult(snapshot.textContent, theme);

    elements.codeElement.innerHTML = renderShikiHtml(tokenResult);
    elements.codeElement.setAttribute(SHIKI_RENDER_ATTR, "true");
    applyShikiThemeSurface(elements, tokenResult, theme);
    codeBlockRenderState.set(elements.codeElement, renderKey);
  }

  async function refreshCodeThemes() {
    if (!shouldApplyCustomCodeTheme()) {
      clearPendingCodeBlocks();
    }
    markPendingCodeBlocks();
    const targets = getCodeBlockTargets();
    await Promise.all(targets.map(async (target) => {
      try {
        await renderCodeBlockWithShiki(target);
      } catch {
        restoreOriginalCodeBlock(target);
      }
    }));
  }

  function buildStyleText() {
    const bodySelector = buildScopedSelectors(ANSWER_ROOTS, BODY_TEXT_SELECTORS);
    const boldTextSelector = buildScopedSelectors(ANSWER_ROOTS, BOLD_TEXT_SELECTORS);
    const mathTextSelector = buildScopedSelectors(ANSWER_ROOTS, MATH_TEXT_SELECTORS);
    const blockquoteSelector = buildScopedSelectors(ANSWER_ROOTS, ["blockquote"]);
    const codeSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_SELECTORS);
    const inlineCodeSelector = buildLightScopedSelectors(ANSWER_ROOTS, INLINE_CODE_SELECTORS);
    const sourceChipSelector = buildLightScopedSelectors(ANSWER_ROOTS, SOURCE_CHIP_SELECTORS);
    const codeBlockSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_BLOCK_SELECTORS);
    const codeBlockOuterSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_BLOCK_OUTER_SELECTORS);
    const codeBlockInnerSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_BLOCK_INNER_SELECTORS);
    const codeBlockVisualSurfaceSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_BLOCK_VISUAL_SURFACE_SELECTORS);
    const headingSelector = buildScopedSelectors(ANSWER_ROOTS, ["h1", "h2", "h3", "h4", "h5", "h6"]);
    const headingH1Selector = buildScopedSelectors(ANSWER_ROOTS, ["h1"]);
    const headingH2Selector = buildScopedSelectors(ANSWER_ROOTS, ["h2"]);
    const headingH3ToH6Selector = buildScopedSelectors(ANSWER_ROOTS, ["h3", "h4", "h5", "h6"]);
    const userQueryBubbleSelector = USER_QUERY_BUBBLE_SELECTORS.join(",\n");
    const lightUserQueryBubbleSelector = buildLightModeSelectors(USER_QUERY_BUBBLE_SELECTORS);
    const userQueryContentSelector = buildLightModeSelectors(USER_QUERY_CONTENT_SELECTORS);
    const luminousToggleSurfaceSelector = buildLightModeSelectors(LUMINOUS_TOGGLE_SURFACE_SELECTORS);
    const sidenavSurfaceSelector = buildLightModeSelectors(SIDENAV_SURFACE_SELECTORS);
    const sidenavFooterSelector = buildLightModeSelectors(SIDENAV_FOOTER_SELECTORS);
    const sidenavSelectedConversationSelector = buildLightModeSelectors(SIDENAV_SELECTED_CONVERSATION_SELECTORS);
    const sidenavSelectedConversationStateSelector = buildLightModeStateSelectors(
      SIDENAV_SELECTED_CONVERSATION_SELECTORS,
      [":hover", ":focus", ":focus-visible", ":active"],
    );
    const sidenavSelectedConversationRippleSelector = buildLightModeSelectors([
      ".conversation.selected .mat-mdc-button-persistent-ripple",
      ".conversation.selected .mat-ripple-element",
      ".gem-nav-list-item.is-active .mat-mdc-button-persistent-ripple",
      ".gem-nav-list-item.is-active .mat-ripple-element",
    ]);
    const unorderedListSelector = buildScopedSelectors(ANSWER_ROOTS, ["ul", "ul ul"]);
    const orderedListSelector = buildScopedSelectors(ANSWER_ROOTS, ["ol", "ol ol", "ul ol"]);
    const listItemSelector = buildScopedSelectors(ANSWER_ROOTS, ["li"]);
    const listTextSelector = buildScopedSelectors(ANSWER_ROOTS, [
      "li > p",
      "li > div",
      "li > span",
    ]);
    const directListItemSelector = buildScopedSelectors(ANSWER_ROOTS, DIRECT_LIST_ITEM_TARGETS);
    const directListTextSelector = buildScopedSelectors(ANSWER_ROOTS, DIRECT_LIST_TEXT_TARGETS);
    const directOrderedListItemSelector = buildScopedSelectors(ANSWER_ROOTS, DIRECT_ORDERED_LIST_ITEM_TARGETS);
    const directOrderedListTextSelector = buildScopedSelectors(ANSWER_ROOTS, DIRECT_ORDERED_LIST_TEXT_TARGETS);
    const listItemBeforeSelector = buildPseudoScopedSelectors(ANSWER_ROOTS, ["li"], "::before");
    const listItemMarkerSelector = buildPseudoScopedSelectors(ANSWER_ROOTS, ["li"], "::marker");
    const directOrderedListItemMarkerSelector = buildPseudoScopedSelectors(
      ANSWER_ROOTS,
      DIRECT_ORDERED_LIST_ITEM_TARGETS,
      "::marker",
    );
    const directOrderedListTextBeforeSelector = buildPseudoScopedSelectors(
      ANSWER_ROOTS,
      DIRECT_ORDERED_LIST_TEXT_TARGETS,
      "::before",
    );
    const chatHistoryMaskSelector = [
      ".chat-history-scroll-container.lm",
      ".chat-history-scroll-container.lm::before",
      ".chat-history-scroll-container.lm::after",
      "chat-window-content .chat-history-scroll-container",
      "chat-window-content .chat-history-scroll-container::before",
      "chat-window-content .chat-history-scroll-container::after",
    ].join(",\n");
    const topBarOverlaySelector = [
      "top-bar-actions",
      ".top-bar-actions",
      "top-bar-actions::before",
      "top-bar-actions::after",
      ".top-bar-actions::before",
      ".top-bar-actions::after",
      "top-bar-actions > *",
      ".top-bar-actions > *",
    ].join(",\n");
    const bottomGradientSelector = [
      ".bottom-gradient",
      "infinite-scroller .bottom-gradient",
      "chat-window-content .bottom-gradient",
    ].join(",\n");
    const sidenavTopGradientSelector = [
      "side-navigation-content infinite-scroller .top-gradient-container",
      "side-navigation-content infinite-scroller .top-gradient",
      ".sidenav-with-history-container infinite-scroller .top-gradient-container",
      ".sidenav-with-history-container infinite-scroller .top-gradient",
      ".overflow-container infinite-scroller .top-gradient-container",
      ".overflow-container infinite-scroller .top-gradient",
    ].join(",\n");
    const disclaimerSelector = [
      "[data-test-id='disclaimer']",
      "p[data-test-id='disclaimer']",
    ].join(",\n");
    const topOverlayCleanupStyle = config.removeTopOverlay === "true" ? `
      ${chatHistoryMaskSelector} {
        mask-image: none !important;
        -webkit-mask-image: none !important;
        background-image: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      ${topBarOverlaySelector} {
        background: transparent !important;
        background-image: none !important;
        background-color: transparent !important;
        box-shadow: none !important;
        border: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        mask-image: none !important;
        -webkit-mask-image: none !important;
      }

      ${bottomGradientSelector} {
        display: none !important;
        background: none !important;
        background-image: none !important;
        pointer-events: none !important;
      }

      ${sidenavTopGradientSelector} {
        display: none !important;
        opacity: 0 !important;
        background: none !important;
        background-image: none !important;
        pointer-events: none !important;
      }
    ` : "";

    return `
      :root {
        --gemini-body-font-size: ${config.bodyFontSize};
        --gemini-body-line-height: ${config.bodyLineHeight};
        --gemini-body-bold-font-weight: ${config.bodyBoldWeight};
        --gemini-math-font-size: ${config.mathFontSize};
        --gemini-code-font-size: ${config.codeFontSize};
        --gemini-code-line-height: ${config.codeLineHeight};
        --gemini-inline-code-background: ${config.inlineCodeBackground};
        --gemini-code-block-radius: ${config.codeBlockRadius};
        --gemini-code-block-outer-padding: ${config.codeBlockOuterPadding};
        --gemini-code-block-inner-padding: ${config.codeBlockInnerPadding};
        --gemini-code-block-margin-top: ${config.codeBlockMarginTop};
        --gemini-heading-h1-font-size: ${config.headingH1FontSize};
        --gemini-heading-h2-font-size: ${config.headingH2FontSize};
        --gemini-heading-h3-to-h6-font-size: ${config.headingH3ToH6FontSize};
        --gemini-heading-font-weight: ${config.headingWeight};
        --gemini-heading-line-height: ${config.headingLineHeight};
        --gemini-heading-margin-top: ${config.headingMarginTop};
        --gemini-sidenav-background: ${config.sidenavBackground};
        --gemini-sidenav-selected-background: color-mix(in srgb, var(--gemini-sidenav-background) 92%, #000 8%);
        --gemini-user-query-bubble-padding: ${config.userQueryBubblePadding};
        --gemini-user-query-bubble-background: ${config.userQueryBubbleBackground};
        --gemini-list-padding-left: ${config.listPaddingLeft};
        --gemini-list-item-gap: ${config.listItemGap};
        --gemini-list-marker-size: ${config.listMarkerSize};
        --gemini-code-font-family: ${config.codeFontFamily};
        --gemini-body-font-family: ${config.bodyFontFamily};
      }

      ${bodySelector} {
        font-size: var(--gemini-body-font-size) !important;
        line-height: var(--gemini-body-line-height) !important;
        font-family: var(--gemini-body-font-family) !important;
      }

      ${boldTextSelector} {
        font-weight: var(--gemini-body-bold-font-weight) !important;
        font-synthesis-weight: auto !important;
      }

      ${mathTextSelector} {
        font-size: var(--gemini-math-font-size) !important;
        line-height: var(--gemini-body-line-height) !important;
      }

      ${blockquoteSelector} {
        padding-inline-start: 18px !important;
        margin-inline-start: 20px !important;
        border-inline-start-width: 2px !important;
      }

      ${headingSelector} {
        font-weight: var(--gemini-heading-font-weight) !important;
        line-height: var(--gemini-heading-line-height) !important;
        margin-top: var(--gemini-heading-margin-top) !important;
        letter-spacing: normal !important;
      }

      ${headingH1Selector} {
        font-size: var(--gemini-heading-h1-font-size) !important;
      }

      ${headingH2Selector} {
        font-size: var(--gemini-heading-h2-font-size) !important;
      }

      ${headingH3ToH6Selector} {
        font-size: var(--gemini-heading-h3-to-h6-font-size) !important;
      }

      ${userQueryBubbleSelector} {
        padding: var(--gemini-user-query-bubble-padding) !important;
      }

      ${lightUserQueryBubbleSelector} {
        background-color: var(--gemini-user-query-bubble-background) !important;
      }

      ${luminousToggleSurfaceSelector} {
        background-color: var(--gemini-user-query-bubble-background) !important;
      }

      :root[${THEME_ATTR}="light"] .luminous-expand-fade {
        background: linear-gradient(
          to bottom,
          transparent,
          var(--gemini-user-query-bubble-background)
        ) !important;
      }

      ${sidenavSurfaceSelector},
      ${sidenavFooterSelector} {
        background-color: var(--gemini-sidenav-background) !important;
      }

      ${sidenavSelectedConversationSelector} {
        background-color: var(--gemini-sidenav-selected-background) !important;
        background-image: none !important;
        --mat-list-list-item-hover-state-layer-opacity: 0 !important;
        --mat-list-list-item-focus-state-layer-opacity: 0 !important;
        --mat-list-list-item-pressed-state-layer-opacity: 0 !important;
      }

      ${sidenavSelectedConversationStateSelector} {
        background-color: var(--gemini-sidenav-selected-background) !important;
        background-image: none !important;
        --mat-list-list-item-hover-state-layer-opacity: 0 !important;
        --mat-list-list-item-focus-state-layer-opacity: 0 !important;
        --mat-list-list-item-pressed-state-layer-opacity: 0 !important;
      }

      ${sidenavSelectedConversationRippleSelector} {
        background: transparent !important;
        background-color: transparent !important;
      }

      ${unorderedListSelector} {
        display: block !important;
        flex-direction: column !important;
        align-items: stretch !important;
        list-style-type: disc !important;
        list-style-position: outside !important;
        overflow: visible !important;
        visibility: visible !important;
        opacity: 1 !important;
        padding-left: var(--gemini-list-padding-left) !important;
        margin-left: 0 !important;
      }

      ${orderedListSelector} {
        display: block !important;
        flex-direction: column !important;
        align-items: stretch !important;
        list-style-type: decimal !important;
        list-style-position: outside !important;
        overflow: visible !important;
        visibility: visible !important;
        opacity: 1 !important;
        padding-left: var(--gemini-list-padding-left) !important;
        margin-left: 0 !important;
      }

      ${listItemSelector} {
        display: list-item !important;
        list-style-position: inherit !important;
        list-style-type: inherit !important;
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
        height: auto !important;
        min-height: 0 !important;
        white-space: normal !important;
        padding-left: var(--gemini-list-item-gap) !important;
        margin-left: 0 !important;
      }

      ${directListItemSelector} {
        display: list-item !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }

      ${directOrderedListItemSelector} {
        display: list-item !important;
        list-style-type: decimal !important;
        list-style-position: outside !important;
      }

      ${listTextSelector} {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        min-height: 0 !important;
        color: inherit !important;
      }

      ${directListTextSelector} {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        color: inherit !important;
      }

      ${listItemBeforeSelector} {
        content: none !important;
        display: none !important;
        background: none !important;
        border: none !important;
        box-shadow: none !important;
      }

      ${listItemMarkerSelector} {
        font-size: var(--gemini-list-marker-size) !important;
      }

      ${directOrderedListItemMarkerSelector} {
        content: counter(list-item) ". " !important;
        font-size: var(--gemini-list-marker-size) !important;
        font-variant-numeric: tabular-nums !important;
      }

      ${directOrderedListTextBeforeSelector} {
        content: none !important;
        display: none !important;
      }

      ${codeSelector} {
        font-size: var(--gemini-code-font-size) !important;
        line-height: var(--gemini-code-line-height) !important;
        font-family: var(--gemini-code-font-family) !important;
      }

      ${inlineCodeSelector} {
        background-color: var(--gemini-inline-code-background) !important;
      }

      ${sourceChipSelector} {
        background-color: var(--gemini-inline-code-background) !important;
        border-color: transparent !important;
      }

      ${codeBlockSelector} {
        border-radius: var(--gemini-code-block-radius) !important;
        overflow: hidden !important;
      }

      ${codeBlockOuterSelector} {
        margin-top: var(--gemini-code-block-margin-top) !important;
        margin-bottom: 0 !important;
        padding: var(--gemini-code-block-outer-padding) !important;
      }

      ${codeBlockInnerSelector} {
        padding: var(--gemini-code-block-inner-padding) !important;
      }

      ${disclaimerSelector} {
        margin-top: 4px !important;
        margin-bottom: 4px !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
      }

      ${topOverlayCleanupStyle}

    `;
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    const nextText = buildStyleText();
    if (style.textContent !== nextText) {
      style.textContent = nextText;
    }
  }

  function buildCodeThemeStyleText() {
    const codeBlockInnerSelector = buildScopedSelectors(ANSWER_ROOTS, CODE_BLOCK_INNER_SELECTORS);
    const shikiCodeSelector = CODE_CONTENT_SELECTORS
      .map((selector) => `${codeBlockInnerSelector} ${selector}[${SHIKI_RENDER_ATTR}="true"]`)
      .join(",\n");
    const shikiSurfaceSelectors = [
      ...CODE_BLOCK_INNER_SELECTORS,
      ...CODE_BLOCK_OUTER_SELECTORS,
      "code-block",
    ].map((selector) => `${selector}[${SHIKI_THEME_ATTR}="true"]`);
    const shikiContainerSelector = buildScopedSelectors(ANSWER_ROOTS, shikiSurfaceSelectors);
    const shikiPendingSelectors = [
      ...CODE_BLOCK_INNER_SELECTORS,
      ...CODE_BLOCK_OUTER_SELECTORS,
      "code-block",
    ].map((selector) => `${selector}[${SHIKI_PENDING_ATTR}="true"]`);
    const shikiPendingSelector = buildScopedSelectors(ANSWER_ROOTS, shikiPendingSelectors);
    return `
      ${shikiPendingSelector} pre,
      ${shikiPendingSelector} code,
      ${shikiPendingSelector} code span {
        color: transparent !important;
      }

      ${shikiPendingSelector} code {
        visibility: hidden !important;
      }

      ${shikiCodeSelector} {
        display: block !important;
        white-space: pre !important;
      }

      ${shikiContainerSelector} .code-block-decoration > span:first-child,
      ${shikiContainerSelector} .buttons gem-icon-button,
      ${shikiContainerSelector} .buttons gem-icon,
      ${shikiContainerSelector} .buttons button,
      ${shikiContainerSelector} .buttons mat-icon,
      ${shikiContainerSelector} .buttons [data-test-id='gem-copy-button'],
      ${shikiContainerSelector} .buttons [data-test-id*='download' i],
      ${shikiContainerSelector} .buttons [aria-label*='Copy' i],
      ${shikiContainerSelector} .buttons [aria-label*='Download' i] {
        color: var(--gemini-shiki-toolbar-fg) !important;
        --gem-sys-color--on-surface: var(--gemini-shiki-toolbar-fg) !important;
        --gem-sys-color--on-surface-variant: var(--gemini-shiki-toolbar-fg) !important;
        --lumi-sys-color--on-surface: var(--gemini-shiki-toolbar-fg) !important;
        --mat-button-text-label-text-color: var(--gemini-shiki-toolbar-fg) !important;
        --mat-button-text-state-layer-color: var(--gemini-shiki-toolbar-fg) !important;
        --mat-icon-button-icon-color: var(--gemini-shiki-toolbar-fg) !important;
        --mdc-icon-button-icon-color: var(--gemini-shiki-toolbar-fg) !important;
      }

      ${shikiContainerSelector} .buttons button:hover,
      ${shikiContainerSelector} .buttons button:focus-visible,
      ${shikiContainerSelector} .buttons button:active,
      ${shikiContainerSelector} .buttons [data-test-id='gem-copy-button'] button:hover,
      ${shikiContainerSelector} .buttons [data-test-id='gem-copy-button'] button:focus-visible,
      ${shikiContainerSelector} .buttons [data-test-id='gem-copy-button'] button:active,
      ${shikiContainerSelector} .buttons [data-test-id*='download' i] button:hover,
      ${shikiContainerSelector} .buttons [data-test-id*='download' i] button:focus-visible,
      ${shikiContainerSelector} .buttons [data-test-id*='download' i] button:active {
        background-color: var(--gemini-shiki-toolbar-hover-bg) !important;
      }

      ${shikiContainerSelector} .buttons .mat-mdc-button-persistent-ripple::before,
      ${shikiContainerSelector} .buttons .mdc-icon-button__ripple::before {
        background-color: var(--gemini-shiki-toolbar-fg) !important;
      }
    `;
  }

  function ensureCodeThemeStyle() {
    let style = document.getElementById(CODE_THEME_STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = CODE_THEME_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    const nextText = buildCodeThemeStyleText();
    if (style.textContent !== nextText) {
      style.textContent = nextText;
    }
  }

  function ensureDisclaimerStyle() {
    const disclaimers = document.querySelectorAll("[data-test-id='disclaimer']");
    disclaimers.forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      node.style.setProperty("font-size", "12px", "important");
      node.style.setProperty("line-height", "1.4", "important");
      node.style.setProperty("margin-top", "4px", "important");
      node.style.setProperty("margin-bottom", "4px", "important");
    });
  }

  async function applyTweaks() {
    updateThemeState();
    ensureStyle();
    ensureCodeThemeStyle();
    ensureDisclaimerStyle();
    await refreshCodeThemes();
  }

  async function loadSavedConfig() {
    if (!globalThis.chrome?.storage?.sync) {
      return;
    }

    const items = await chrome.storage.sync.get(STORAGE_KEY);
    config = mergeConfig(items[STORAGE_KEY]);
    await applyTweaks();
  }

  function observeConfig() {
    if (!globalThis.chrome?.storage?.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes[STORAGE_KEY]) {
        return;
      }

      config = mergeConfig(changes[STORAGE_KEY].newValue);
      applyTweaks().catch(() => {});
    });
  }

  let timer = null;
  function scheduleApply() {
    if (timer !== null) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      timer = null;
      applyTweaks().catch(() => {});
    }, OBSERVER_DEBOUNCE_MS);
  }

  function observeDom() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            markPendingCodeBlocks(node);
          }
        });
      });
      scheduleApply();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  applyTweaks().catch(() => {});
  loadSavedConfig().catch(() => {
    applyTweaks().catch(() => {});
  });
  observeConfig();
  observeDom();
})();
