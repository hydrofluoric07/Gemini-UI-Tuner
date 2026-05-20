(() => {
  "use strict";

  const STORAGE_KEY = "geminiStyleTunerConfig";

  const DEFAULT_CONFIG = {
    bodyFontSize: "16px",
    bodyLineHeight: "1.75",
    bodyBoldWeight: "800",
    codeFontSize: "14px",
    codeLineHeight: "1.6",
    inlineCodeBackground: "#e9eef6",
    codeBlockRadius: "16px",
    codeBlockOuterPadding: "8px",
    codeBlockInnerPadding: "16px 0 16px 16px",
    codeBlockMarginTop: "0px",
    headingH1FontSize: "22px",
    headingH2FontSize: "20px",
    headingH3ToH6FontSize: "16px",
    headingWeight: "750",
    headingLineHeight: "1.35",
    headingMarginTop: "0px",
    sidenavBackground: "#e9eef6",
    userQueryBubbleBackground: "#e9eef6",
    userQueryBubblePadding: "16px 24px",
    removeTopOverlay: "true",
    listPaddingLeft: "1.2em",
    listItemGap: "0.15em",
    listMarkerSize: "0.95em",
    codeFontFamily: `"Google Sans Code", "Cascadia Code", Consolas, "Courier New", monospace`,
    bodyFontFamily: "inherit",
  };

  const CONFIG_FIELDS = [
    {
      title: "模型回答正文",
      description: "调整普通正文和回答区域基础排版。",
      fields: [
        { key: "bodyFontSize", label: "正文字号", type: "text", placeholder: "16px" },
        { key: "bodyLineHeight", label: "正文行高", type: "text", placeholder: "1.75" },
        { key: "bodyBoldWeight", label: "正文加粗字重", type: "text", placeholder: "800" },
        { key: "bodyFontFamily", label: "正文字体", type: "text", placeholder: "inherit" },
      ],
    },
    {
      title: "标题",
      description: "控制模型回答中 h1 到 h6 的字号、字重和间距。",
      fields: [
        { key: "headingH1FontSize", label: "H1 字号", type: "text", placeholder: "22px" },
        { key: "headingH2FontSize", label: "H2 字号", type: "text", placeholder: "20px" },
        { key: "headingH3ToH6FontSize", label: "H3-H6 字号", type: "text", placeholder: "16px" },
        { key: "headingWeight", label: "标题字重", type: "text", placeholder: "750" },
        { key: "headingLineHeight", label: "标题行高", type: "text", placeholder: "1.35" },
        { key: "headingMarginTop", label: "标题上边距", type: "text", placeholder: "0px" },
      ],
    },
    {
      title: "代码块",
      description: "调整代码文字、外层容器和内部容器的视觉密度。",
      fields: [
        { key: "codeFontSize", label: "代码字号", type: "text", placeholder: "14px" },
        { key: "codeLineHeight", label: "代码行高", type: "text", placeholder: "1.6" },
        { key: "inlineCodeBackground", label: "行内代码背景色", type: "color", placeholder: "#e9eef6" },
        { key: "codeFontFamily", label: "代码字体", type: "text", placeholder: "Consolas, monospace" },
        { key: "codeBlockRadius", label: "代码块圆角", type: "text", placeholder: "16px" },
        { key: "codeBlockOuterPadding", label: "外层 padding", type: "text", placeholder: "8px" },
        { key: "codeBlockInnerPadding", label: "内层 padding", type: "text", placeholder: "16px 0 16px 16px" },
        { key: "codeBlockMarginTop", label: "顶部 margin", type: "text", placeholder: "0px" },
      ],
    },
    {
      title: "列表",
      description: "控制无序列表圆点、有序列表序号和列表文字间距。",
      fields: [
        { key: "listPaddingLeft", label: "列表左缩进", type: "text", placeholder: "1.2em" },
        { key: "listItemGap", label: "标记文字间距", type: "text", placeholder: "0.15em" },
        { key: "listMarkerSize", label: "标记大小", type: "text", placeholder: "0.95em" },
      ],
    },
    {
      title: "侧栏设置",
      description: "调整浅色模式下侧栏、底部区域和选中对话的背景色。",
      fields: [
        { key: "sidenavBackground", label: "侧栏背景色", type: "color", placeholder: "#e9eef6" },
      ],
    },
    {
      title: "用户消息",
      description: "调整用户消息气泡背景色，以及气泡与内部文字区域的留白。",
      fields: [
        { key: "userQueryBubbleBackground", label: "用户消息气泡背景色", type: "color", placeholder: "#e9eef6" },
        { key: "userQueryBubblePadding", label: "气泡 padding", type: "text", placeholder: "16px 24px" },
      ],
    },
    {
      title: "界面清理",
      description: "控制是否移除 Gemini 页面顶部的半透明遮罩。",
      fields: [
        { key: "removeTopOverlay", label: "移除顶部半透明遮罩", type: "switch" },
      ],
    },
  ];

  function mergeConfig(savedConfig) {
    if (!savedConfig || typeof savedConfig !== "object") {
      return { ...DEFAULT_CONFIG };
    }

    const legacyLightBackground = savedConfig.lightSurfaceBackground;

    return Object.fromEntries(
      Object.entries(DEFAULT_CONFIG).map(([key, defaultValue]) => {
        const savedValue = savedConfig[key] ?? (
          (key === "sidenavBackground" || key === "userQueryBubbleBackground")
            ? legacyLightBackground
            : undefined
        );
        return [key, typeof savedValue === "string" && savedValue.trim() ? savedValue : defaultValue];
      }),
    );
  }

  globalThis.GeminiStyleTunerConfig = {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    CONFIG_FIELDS,
    mergeConfig,
  };
})();
