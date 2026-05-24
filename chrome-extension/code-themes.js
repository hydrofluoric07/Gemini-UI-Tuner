(() => {
  "use strict";

  const CODE_THEME_REGISTRY = {
    "github-light": {
      id: "github-light",
      label: "GitHub Light",
      appearance: "light",
      background: "#f6f8fa",
      foreground: "#24292f",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #6e7781 !important; }
        .hljs-variable,
        .hljs-template-variable,
        .hljs-attribute,
        .hljs-tag,
        .hljs-name,
        .hljs-regexp,
        .hljs-link,
        .hljs-selector-id,
        .hljs-selector-class { color: #cf222e !important; }
        .hljs-number,
        .hljs-meta,
        .hljs-built_in,
        .hljs-builtin-name,
        .hljs-literal,
        .hljs-type,
        .hljs-params { color: #0550ae !important; }
        .hljs-string,
        .hljs-symbol,
        .hljs-bullet { color: #0a3069 !important; }
        .hljs-title,
        .hljs-section { color: #8250df !important; }
        .hljs-keyword,
        .hljs-selector-tag { color: #cf222e !important; }
        .hljs-emphasis { font-style: italic !important; }
        .hljs-strong { font-weight: 700 !important; }
      `,
    },
    "github-dark": {
      id: "github-dark",
      label: "GitHub Dark",
      appearance: "dark",
      background: "#0d1117",
      foreground: "#c9d1d9",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #8b949e !important; }
        .hljs-variable,
        .hljs-template-variable,
        .hljs-attribute,
        .hljs-tag,
        .hljs-name,
        .hljs-regexp,
        .hljs-link,
        .hljs-selector-id,
        .hljs-selector-class { color: #ff7b72 !important; }
        .hljs-number,
        .hljs-meta,
        .hljs-built_in,
        .hljs-builtin-name,
        .hljs-literal,
        .hljs-type,
        .hljs-params { color: #79c0ff !important; }
        .hljs-string,
        .hljs-symbol,
        .hljs-bullet { color: #a5d6ff !important; }
        .hljs-title,
        .hljs-section { color: #d2a8ff !important; }
        .hljs-keyword,
        .hljs-selector-tag { color: #ff7b72 !important; }
        .hljs-emphasis { font-style: italic !important; }
        .hljs-strong { font-weight: 700 !important; }
      `,
    },
    "one-dark": {
      id: "one-dark",
      label: "One Dark",
      appearance: "dark",
      background: "#282c34",
      foreground: "#abb2bf",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #5c6370 !important; font-style: italic !important; }
        .hljs-doctag,
        .hljs-keyword,
        .hljs-formula { color: #c678dd !important; }
        .hljs-section,
        .hljs-name,
        .hljs-selector-tag,
        .hljs-deletion,
        .hljs-subst { color: #e06c75 !important; }
        .hljs-literal { color: #56b6c2 !important; }
        .hljs-string,
        .hljs-regexp,
        .hljs-addition,
        .hljs-attribute,
        .hljs-meta .hljs-string { color: #98c379 !important; }
        .hljs-attr,
        .hljs-variable,
        .hljs-template-variable,
        .hljs-type,
        .hljs-selector-class,
        .hljs-selector-attr,
        .hljs-selector-pseudo,
        .hljs-number { color: #d19a66 !important; }
        .hljs-symbol,
        .hljs-bullet,
        .hljs-link,
        .hljs-meta,
        .hljs-selector-id,
        .hljs-title { color: #61afef !important; }
      `,
    },
    "tokyo-night": {
      id: "tokyo-night",
      label: "Tokyo Night",
      appearance: "dark",
      background: "#1a1b26",
      foreground: "#c0caf5",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #565f89 !important; font-style: italic !important; }
        .hljs-variable,
        .hljs-template-variable,
        .hljs-attribute,
        .hljs-tag,
        .hljs-name,
        .hljs-regexp,
        .hljs-link,
        .hljs-selector-id,
        .hljs-selector-class { color: #f7768e !important; }
        .hljs-number,
        .hljs-meta,
        .hljs-built_in,
        .hljs-builtin-name,
        .hljs-literal,
        .hljs-type,
        .hljs-params { color: #ff9e64 !important; }
        .hljs-string,
        .hljs-symbol,
        .hljs-bullet { color: #9ece6a !important; }
        .hljs-title,
        .hljs-section { color: #7aa2f7 !important; }
        .hljs-keyword,
        .hljs-selector-tag { color: #bb9af7 !important; }
      `,
    },
    "nord": {
      id: "nord",
      label: "Nord",
      appearance: "dark",
      background: "#2e3440",
      foreground: "#d8dee9",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #616e88 !important; }
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-addition { color: #81a1c1 !important; }
        .hljs-number,
        .hljs-string,
        .hljs-regexp,
        .hljs-literal,
        .hljs-doctag,
        .hljs-built_in,
        .hljs-builtin-name { color: #88c0d0 !important; }
        .hljs-title,
        .hljs-section,
        .hljs-selector-id,
        .hljs-selector-class { color: #8fbcbb !important; }
        .hljs-attribute,
        .hljs-name,
        .hljs-tag,
        .hljs-template-variable,
        .hljs-variable { color: #bf616a !important; }
        .hljs-symbol,
        .hljs-bullet,
        .hljs-link,
        .hljs-meta,
        .hljs-type { color: #b48ead !important; }
      `,
    },
    "catppuccin-mocha": {
      id: "catppuccin-mocha",
      label: "Catppuccin Mocha",
      appearance: "dark",
      background: "#1e1e2e",
      foreground: "#cdd6f4",
      cssText: `
        .hljs-comment,
        .hljs-quote { color: #9399b2 !important; font-style: italic !important; }
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-addition { color: #cba6f7 !important; }
        .hljs-number,
        .hljs-literal,
        .hljs-built_in,
        .hljs-builtin-name { color: #fab387 !important; }
        .hljs-string,
        .hljs-regexp,
        .hljs-symbol,
        .hljs-bullet { color: #a6e3a1 !important; }
        .hljs-title,
        .hljs-section,
        .hljs-selector-id,
        .hljs-selector-class { color: #89b4fa !important; }
        .hljs-attribute,
        .hljs-name,
        .hljs-tag,
        .hljs-template-variable,
        .hljs-variable { color: #f38ba8 !important; }
        .hljs-meta,
        .hljs-link,
        .hljs-type,
        .hljs-params { color: #94e2d5 !important; }
      `,
    },
  };

  function normalizeScopeSelectors(scopeSelector) {
    if (Array.isArray(scopeSelector)) {
      return scopeSelector.map((selector) => selector.trim()).filter(Boolean);
    }

    return String(scopeSelector)
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);
  }

  function scopeThemeCss(cssText, scopeSelector) {
    const scopeSelectors = normalizeScopeSelectors(scopeSelector);
    return cssText.replace(/(^|\})\s*([^{]+)\s*\{/g, (match, prefix, selectors) => {
      const ruleSelectors = selectors
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      const scopedSelectors = scopeSelectors
        .flatMap((scope) => ruleSelectors.map((selector) => `${scope} ${selector}`))
        .join(", ");
      return `${prefix}\n${scopedSelectors} {`;
    }).trim();
  }

  globalThis.GeminiStyleTunerCodeThemes = {
    CODE_THEME_REGISTRY,
    scopeThemeCss,
  };
})();
