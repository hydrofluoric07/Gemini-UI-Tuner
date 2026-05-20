(() => {
  "use strict";

  const STYLE_ID = "gemini-style-tuner-style";
  const THEME_ATTR = "data-gemini-style-tuner-theme";
  const OBSERVER_DEBOUNCE_MS = 120;
  const {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    mergeConfig,
  } = globalThis.GeminiStyleTunerConfig;
  let config = { ...DEFAULT_CONFIG };

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

  const CODE_SELECTORS = [
    "pre",
    "pre code",
    "code",
    "[class*='code'] pre",
    "[class*='code'] code",
    "code-block pre",
    "code-block code[data-test-id='code-content']",
    "code-block code[data-test-id='code-content'] span",
    ".formatted-code-block-internal-container pre",
    ".formatted-code-block-internal-container code[data-test-id='code-content']",
    ".formatted-code-block-internal-container code[data-test-id='code-content'] span",
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
      }

      ${topOverlayCleanupStyle}

    `;
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    const nextText = buildStyleText();
    if (style.textContent !== nextText) {
      style.textContent = nextText;
    }
  }

  function applyTweaks() {
    updateThemeState();
    ensureStyle();
  }

  async function loadSavedConfig() {
    if (!globalThis.chrome?.storage?.sync) {
      return;
    }

    const items = await chrome.storage.sync.get(STORAGE_KEY);
    config = mergeConfig(items[STORAGE_KEY]);
    applyTweaks();
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
      applyTweaks();
    });
  }

  let timer = null;
  function scheduleApply() {
    if (timer !== null) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      timer = null;
      applyTweaks();
    }, OBSERVER_DEBOUNCE_MS);
  }

  function observeDom() {
    const observer = new MutationObserver(() => {
      scheduleApply();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  applyTweaks();
  loadSavedConfig().catch(() => {
    applyTweaks();
  });
  observeConfig();
  observeDom();
})();
