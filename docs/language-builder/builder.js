(() => {
  "use strict";

  const BASE_PATH = "assets/";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const state = {
    data: null,
    selected: new Set(),
    visibleIds: [],
  };

  const elements = {
    versionText: document.getElementById("versionText"),
    selectedText: document.getElementById("selectedText"),
    sizeText: document.getElementById("sizeText"),
    searchInput: document.getElementById("searchInput"),
    selectBundledButton: document.getElementById("selectBundledButton"),
    selectVisibleButton: document.getElementById("selectVisibleButton"),
    clearButton: document.getElementById("clearButton"),
    languageList: document.getElementById("languageList"),
    resultCount: document.getElementById("resultCount"),
    downloadButton: document.getElementById("downloadButton"),
    statusText: document.getElementById("statusText"),
  };

  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  })();

  function setStatus(message) {
    elements.statusText.textContent = message;
  }

  function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
    }
    return `${Math.ceil(bytes / 1024)} KiB`;
  }

  function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  }

  function readUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  function readUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  function writeUint16(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
  }

  function writeUint32(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
  }

  function concatParts(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function crc32(data) {
    let crc = 0xffffffff;
    data.forEach((byte) => {
      crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    });
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  function findEndOfCentralDirectory(bytes) {
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66000); offset -= 1) {
      if (
        bytes[offset] === 0x50
        && bytes[offset + 1] === 0x4b
        && bytes[offset + 2] === 0x05
        && bytes[offset + 3] === 0x06
      ) {
        return offset;
      }
    }
    throw new Error("无法读取基础扩展 zip。");
  }

  function parseZip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const endOffset = findEndOfCentralDirectory(bytes);
    const entryCount = readUint16(view, endOffset + 10);
    const centralOffset = readUint32(view, endOffset + 16);
    const entries = new Map();
    let offset = centralOffset;

    for (let index = 0; index < entryCount; index += 1) {
      if (readUint32(view, offset) !== 0x02014b50) {
        throw new Error("基础扩展 zip 中央目录异常。");
      }

      const method = readUint16(view, offset + 10);
      const compressedSize = readUint32(view, offset + 20);
      const uncompressedSize = readUint32(view, offset + 24);
      const nameLength = readUint16(view, offset + 28);
      const extraLength = readUint16(view, offset + 30);
      const commentLength = readUint16(view, offset + 32);
      const localOffset = readUint32(view, offset + 42);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));

      if (method !== 0) {
        throw new Error(`基础扩展 zip 包含压缩条目，当前生成器不支持：${name}`);
      }

      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const data = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (data.length !== uncompressedSize) {
        throw new Error(`基础扩展 zip 条目大小异常：${name}`);
      }

      entries.set(normalizePath(name), data);
      offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
  }

  function createStoredZip(entries) {
    const localParts = [];
    const centralParts = [];
    const { time, date } = dosDateTime();
    let offset = 0;
    const sortedEntries = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b, "en"));

    sortedEntries.forEach(([path, data]) => {
      const name = encoder.encode(normalizePath(path));
      const content = data instanceof Uint8Array ? data : new Uint8Array(data);
      const checksum = crc32(content);
      const localHeader = new Uint8Array(30);

      writeUint32(localHeader, 0, 0x04034b50);
      writeUint16(localHeader, 4, 20);
      writeUint16(localHeader, 6, 0);
      writeUint16(localHeader, 8, 0);
      writeUint16(localHeader, 10, time);
      writeUint16(localHeader, 12, date);
      writeUint32(localHeader, 14, checksum);
      writeUint32(localHeader, 18, content.length);
      writeUint32(localHeader, 22, content.length);
      writeUint16(localHeader, 26, name.length);
      writeUint16(localHeader, 28, 0);
      localParts.push(localHeader, name, content);

      const centralHeader = new Uint8Array(46);
      writeUint32(centralHeader, 0, 0x02014b50);
      writeUint16(centralHeader, 4, 20);
      writeUint16(centralHeader, 6, 20);
      writeUint16(centralHeader, 8, 0);
      writeUint16(centralHeader, 10, 0);
      writeUint16(centralHeader, 12, time);
      writeUint16(centralHeader, 14, date);
      writeUint32(centralHeader, 16, checksum);
      writeUint32(centralHeader, 20, content.length);
      writeUint32(centralHeader, 24, content.length);
      writeUint16(centralHeader, 28, name.length);
      writeUint16(centralHeader, 30, 0);
      writeUint16(centralHeader, 32, 0);
      writeUint16(centralHeader, 34, 0);
      writeUint16(centralHeader, 36, 0);
      writeUint32(centralHeader, 38, 0);
      writeUint32(centralHeader, 42, offset);
      centralParts.push(centralHeader, name);

      offset += localHeader.length + name.length + content.length;
    });

    const localData = concatParts(localParts);
    const centralData = concatParts(centralParts);
    const endRecord = new Uint8Array(22);
    writeUint32(endRecord, 0, 0x06054b50);
    writeUint16(endRecord, 8, sortedEntries.length);
    writeUint16(endRecord, 10, sortedEntries.length);
    writeUint32(endRecord, 12, centralData.length);
    writeUint32(endRecord, 16, localData.length);
    return concatParts([localData, centralData, endRecord]);
  }

  function getSelectedFiles() {
    const files = new Set();
    state.selected.forEach((id) => {
      const language = state.data.languages.find((item) => item.id === id);
      if (language) {
        language.files.forEach((file) => files.add(file));
      }
    });
    return files;
  }

  function updateSummary() {
    const selectedLanguages = [...state.selected]
      .map((id) => state.data.languages.find((language) => language.id === id))
      .filter(Boolean);
    const selectedFiles = getSelectedFiles();
    const extraBytes = [...selectedFiles].reduce((sum, file) => sum + (state.data.files?.[file] || 0), 0);

    elements.selectedText.textContent = `${selectedLanguages.length} languages`;
    elements.sizeText.textContent = formatBytes(extraBytes);
  }

  function renderLanguages() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const fragment = document.createDocumentFragment();
    const languages = state.data.languages.filter((language) => {
      const searchable = [
        language.id,
        language.displayName,
        ...(language.aliases || []),
      ].join(" ").toLowerCase();
      return !query || searchable.includes(query);
    });
    state.visibleIds = languages.map((language) => language.id);
    elements.resultCount.textContent = `${languages.length}`;
    elements.languageList.textContent = "";

    languages.forEach((language) => {
      const label = document.createElement("label");
      label.className = "language-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selected.has(language.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selected.add(language.id);
        } else {
          state.selected.delete(language.id);
        }
        updateSummary();
      });

      const text = document.createElement("span");
      const name = document.createElement("span");
      name.className = "language-name";
      name.textContent = language.displayName;
      const meta = document.createElement("span");
      meta.className = "language-meta";
      meta.textContent = [language.id, ...(language.aliases || []).slice(0, 6)].join(" / ");
      text.append(name, meta);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = language.bundled ? "Default" : formatBytes(language.bytes);
      label.append(checkbox, text, badge);
      fragment.append(label);
    });

    elements.languageList.append(fragment);
    updateSummary();
  }

  async function fetchArrayBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败：${url} (${response.status})`);
    }
    return response.arrayBuffer();
  }

  async function downloadCustomZip() {
    elements.downloadButton.disabled = true;
    try {
      const files = getSelectedFiles();
      setStatus(`读取基础扩展包...\n${state.data.baseZip}`);
      const baseBuffer = await fetchArrayBuffer(state.data.baseZip);
      const zipEntries = parseZip(baseBuffer);
      let completed = 0;

      for (const file of files) {
        const targetPath = `vendor/shiki/langs/${file}`;
        if (!zipEntries.has(targetPath)) {
          setStatus(`下载语言文件 ${completed + 1}/${files.size}\n${file}`);
          const data = await fetchArrayBuffer(`${BASE_PATH}langs/${file}`);
          zipEntries.set(targetPath, new Uint8Array(data));
        }
        completed += 1;
      }

      setStatus("正在生成压缩包...");
      const output = createStoredZip(zipEntries);
      const blob = new Blob([output], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Gemini-UI-Tuner-v${state.data.version}-custom-langs.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus(`已生成：${link.download}\n选择语言：${state.selected.size}\n写入语言文件：${files.size}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      elements.downloadButton.disabled = false;
    }
  }

  async function init() {
    try {
      const response = await fetch("assets/builder-data.json");
      if (!response.ok) {
        throw new Error(`语言清单读取失败：${response.status}`);
      }
      state.data = await response.json();
      elements.versionText.textContent = `v${state.data.version}`;
      state.data.languages
        .filter((language) => language.bundled)
        .forEach((language) => state.selected.add(language.id));
      renderLanguages();
      setStatus(`已加载 ${state.data.languages.length} 个 Shiki 语言。\n版本：@shikijs/langs ${state.data.shikiLanguagesVersion}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      elements.downloadButton.disabled = true;
    }
  }

  elements.searchInput.addEventListener("input", renderLanguages);
  elements.selectBundledButton.addEventListener("click", () => {
    state.selected.clear();
    state.data.languages
      .filter((language) => language.bundled)
      .forEach((language) => state.selected.add(language.id));
    renderLanguages();
  });
  elements.selectVisibleButton.addEventListener("click", () => {
    state.visibleIds.forEach((id) => state.selected.add(id));
    renderLanguages();
  });
  elements.clearButton.addEventListener("click", () => {
    state.selected.clear();
    renderLanguages();
  });
  elements.downloadButton.addEventListener("click", downloadCustomZip);

  init();
})();
