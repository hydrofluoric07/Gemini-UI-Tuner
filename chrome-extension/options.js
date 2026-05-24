(() => {
  "use strict";

  const {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    CONFIG_FIELDS,
    mergeConfig,
  } = globalThis.GeminiStyleTunerConfig;

  const form = document.getElementById("settingsForm");
  const nav = document.getElementById("settingsNav");
  const status = document.getElementById("status");
  const versionBadge = document.getElementById("versionBadge");
  const saveButton = document.getElementById("saveButton");
  const resetButton = document.getElementById("resetButton");
  const reloadButton = document.getElementById("reloadButton");
  const inputs = new Map();
  const sectionIds = [];
  const fieldRows = new Map();
  let activeSectionId = null;
  let statusTimer = null;

  const RELEASE_API_URL = "https://api.github.com/repos/hydrofluoric07/Gemini-UI-Tuner/releases/latest";

  function getCurrentVersion() {
    return chrome.runtime.getManifest().version;
  }

  function normalizeVersion(version) {
    return String(version || "")
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  }

  function compareVersions(left, right) {
    const leftParts = normalizeVersion(left);
    const rightParts = normalizeVersion(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart > rightPart) {
        return 1;
      }
      if (leftPart < rightPart) {
        return -1;
      }
    }

    return 0;
  }

  function setStatus(message, isError = false) {
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
    }

    status.textContent = message;
    status.classList.toggle("error", isError);

    if (message) {
      statusTimer = window.setTimeout(() => {
        status.textContent = "";
        status.classList.remove("error");
        statusTimer = null;
      }, 2600);
    }
  }

  function setStatusLink(message, linkText, href) {
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = linkText;

    status.replaceChildren(document.createTextNode(message), link);
    status.classList.remove("error");
  }

  function renderVersion() {
    if (versionBadge) {
      versionBadge.textContent = `v${getCurrentVersion()}`;
    }
  }

  async function checkForUpdates() {
    try {
      const response = await fetch(RELEASE_API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = String(release.tag_name || release.name || "").trim();
      if (!latestVersion) {
        return;
      }

      if (compareVersions(latestVersion, getCurrentVersion()) > 0) {
        setStatusLink(`发现新版本 ${latestVersion}，`, "前往下载", release.html_url);
      }
    } catch {
      setStatus("更新检查失败，可稍后重试", true);
    }
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value);
  }

  function createInput(field) {
    if (field.type === "switch") {
      const label = document.createElement("label");
      label.className = "switch";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = field.key;

      const track = document.createElement("span");
      track.className = "switch-track";

      label.append(input, track);
      return label;
    }

    if (field.type === "select") {
      const select = document.createElement("select");
      select.name = field.key;

      (field.options || []).forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        select.append(optionElement);
      });

      return select;
    }

    if (field.type !== "color") {
      const input = document.createElement("input");
      input.type = "text";
      input.name = field.key;
      input.placeholder = field.placeholder || "";
      return input;
    }

    const control = document.createElement("div");
    control.className = "control color-control";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.name = `${field.key}Color`;

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.name = field.key;
    textInput.placeholder = field.placeholder || "#e9eef6";

    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
    });

    textInput.addEventListener("input", () => {
      const nextValue = textInput.value.trim();
      if (isHexColor(nextValue)) {
        colorInput.value = nextValue;
      }
    });

    control.append(colorInput, textInput);
    inputs.set(`${field.key}Color`, colorInput);
    return control;
  }

  function createSectionId(index) {
    return `settings-section-${index + 1}`;
  }

  function renderNav() {
    const fragment = document.createDocumentFragment();

    CONFIG_FIELDS.forEach((group, index) => {
      const sectionId = createSectionId(index);
      const link = document.createElement("a");
      link.className = "nav-link";
      link.href = `#${sectionId}`;
      link.dataset.target = sectionId;
      link.textContent = group.title;
      fragment.append(link);
      sectionIds.push(sectionId);
    });

    nav.replaceChildren(fragment);
  }

  function renderForm() {
    const fragment = document.createDocumentFragment();

    CONFIG_FIELDS.forEach((group, index) => {
      const card = document.createElement("section");
      card.className = "section";
      card.id = createSectionId(index);
      card.dataset.sectionId = card.id;

      group.fields.forEach((field) => {
        const row = document.createElement("div");
        row.className = "field";
        row.dataset.fieldKey = field.key;
        if (field.visibility) {
          row.dataset.visibleWhenField = field.visibility.field;
          row.dataset.visibleWhenEquals = field.visibility.equals;
        }

        const label = document.createElement("label");
        label.htmlFor = field.key;
        label.textContent = field.label;

        const control = document.createElement("div");
        control.className = "control";

        const inputOrControl = createInput(field);
        if (inputOrControl instanceof HTMLInputElement || inputOrControl instanceof HTMLSelectElement) {
          inputOrControl.id = field.key;
          inputs.set(field.key, inputOrControl);
          control.append(inputOrControl);
        } else {
          const textInput = inputOrControl.querySelector(`input[name="${field.key}"]`);
          textInput.id = field.key;
          inputs.set(field.key, textInput);
          control.append(inputOrControl);
        }

        row.append(label, control);
        card.append(row);
        fieldRows.set(field.key, row);
      });

      fragment.append(card);
    });

    form.replaceChildren(fragment);
  }

  function resolveInitialSectionId() {
    const hashSectionId = window.location.hash.replace(/^#/, "");
    if (hashSectionId && sectionIds.includes(hashSectionId)) {
      return hashSectionId;
    }

    return sectionIds[0] || null;
  }

  function syncVisibleSection() {
    sectionIds.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.hidden = sectionId !== activeSectionId;
      }
    });
  }

  function setActiveSection(sectionId, updateHash = true) {
    if (!sectionIds.includes(sectionId)) {
      return;
    }

    activeSectionId = sectionId;
    setActiveNav(sectionId);
    syncVisibleSection();

    if (updateHash) {
      const nextHash = `#${sectionId}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }

  function syncFieldVisibility() {
    fieldRows.forEach((row) => {
      const dependencyKey = row.dataset.visibleWhenField;
      if (!dependencyKey) {
        row.hidden = false;
        return;
      }

      const dependencyInput = inputs.get(dependencyKey);
      if (!dependencyInput) {
        row.hidden = false;
        return;
      }

      const dependencyValue = dependencyInput.type === "checkbox"
        ? String(dependencyInput.checked)
        : dependencyInput.value;
      row.hidden = dependencyValue !== row.dataset.visibleWhenEquals;
    });
  }

  function setActiveNav(sectionId) {
    nav.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.target === sectionId);
    });
  }

  function bindNavRouting() {
    nav.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest(".nav-link") : null;
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      event.preventDefault();
      setActiveSection(link.dataset.target);
    });

    window.addEventListener("hashchange", () => {
      const nextSectionId = resolveInitialSectionId();
      if (nextSectionId && nextSectionId !== activeSectionId) {
        setActiveSection(nextSectionId, false);
      }
    });
  }

  function setFormValues(config) {
    Object.entries(config).forEach(([key, value]) => {
      const input = inputs.get(key);
      if (input) {
        if (input.type === "checkbox") {
          input.checked = value === "true";
        } else {
          input.value = value;
        }
      }

      const colorInput = inputs.get(`${key}Color`);
      if (colorInput && isHexColor(value)) {
        colorInput.value = value;
      }
    });
    syncFieldVisibility();
  }

  function readFormValues() {
    return Object.fromEntries(
      Object.keys(DEFAULT_CONFIG).map((key) => {
        const input = inputs.get(key);
        if (!input) {
          return [key, DEFAULT_CONFIG[key]];
        }

        return [key, input.type === "checkbox" ? String(input.checked) : input.value.trim()];
      }),
    );
  }

  function observeDependencies() {
    inputs.forEach((input) => {
      input.addEventListener("input", syncFieldVisibility);
      input.addEventListener("change", syncFieldVisibility);
    });
    syncFieldVisibility();
  }

  function storageGet() {
    return chrome.storage.sync.get(STORAGE_KEY).then((items) => {
      return mergeConfig(items[STORAGE_KEY]);
    });
  }

  async function loadConfig() {
    try {
      const config = await storageGet();
      setFormValues(config);
      setStatus("已载入当前配置");
    } catch (error) {
      setStatus(`载入失败：${error.message}`, true);
    }
  }

  async function saveConfig() {
    try {
      const config = mergeConfig(readFormValues());
      await chrome.storage.sync.set({ [STORAGE_KEY]: config });
      setFormValues(config);
      setStatus("设置已保存，Gemini 页面会自动应用");
    } catch (error) {
      setStatus(`保存失败：${error.message}`, true);
    }
  }

  async function resetConfig() {
    try {
      const config = { ...DEFAULT_CONFIG };
      await chrome.storage.sync.set({ [STORAGE_KEY]: config });
      setFormValues(config);
      setStatus("已恢复默认设置");
    } catch (error) {
      setStatus(`恢复默认失败：${error.message}`, true);
    }
  }

  renderVersion();
  renderNav();
  renderForm();
  observeDependencies();
  bindNavRouting();
  const initialSectionId = resolveInitialSectionId();
  if (initialSectionId) {
    setActiveSection(initialSectionId, false);
  }
  loadConfig();
  checkForUpdates();

  saveButton.addEventListener("click", saveConfig);
  resetButton.addEventListener("click", resetConfig);
  reloadButton.addEventListener("click", loadConfig);
})();
