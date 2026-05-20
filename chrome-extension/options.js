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
  const saveButton = document.getElementById("saveButton");
  const resetButton = document.getElementById("resetButton");
  const reloadButton = document.getElementById("reloadButton");
  const inputs = new Map();
  const sectionIds = [];
  let statusTimer = null;

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

      const header = document.createElement("div");
      header.className = "section-header";
      const title = document.createElement("h2");
      title.textContent = group.title;

      const description = document.createElement("p");
      description.textContent = group.description;

      header.append(title, description);
      card.append(header);

      group.fields.forEach((field) => {
        const row = document.createElement("div");
        row.className = "field";

        const label = document.createElement("label");
        label.htmlFor = field.key;
        label.textContent = field.label;

        const control = document.createElement("div");
        control.className = "control";

        const inputOrControl = createInput(field);
        if (inputOrControl instanceof HTMLInputElement) {
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
      });

      fragment.append(card);
    });

    form.replaceChildren(fragment);
  }

  function setActiveNav(sectionId) {
    nav.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.target === sectionId);
    });
  }

  function observeSections() {
    setActiveNav(sectionIds[0]);

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry) {
        setActiveNav(visibleEntry.target.id);
      }
    }, {
      rootMargin: "-15% 0px -65% 0px",
      threshold: [0.1, 0.35, 0.6],
    });

    sectionIds.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        observer.observe(section);
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

  renderNav();
  renderForm();
  observeSections();
  loadConfig();

  saveButton.addEventListener("click", saveConfig);
  resetButton.addEventListener("click", resetConfig);
  reloadButton.addEventListener("click", loadConfig);
})();
