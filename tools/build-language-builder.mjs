import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const SHIKI_LANGS_VERSION = "4.1.0";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_PAGE_DIR = join(REPO_ROOT, "docs", "language-builder");
const EXTENSION_DIR = join(REPO_ROOT, "chrome-extension");
const REGISTRY_FILE = join(EXTENSION_DIR, "shiki-languages.js");

const SUPPLEMENTAL_ALIASES = {
  js: "javascript",
  node: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  json5: "json",
  jsonc: "json",
  yml: "yaml",
  md: "markdown",
  bash: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  console: "shellscript",
  terminal: "shellscript",
  py: "python",
  golang: "go",
  svg: "xml",
  h: "c",
  "c++": "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  "h++": "cpp",
  hh: "cpp",
  hxx: "cpp",
  objectivec: "objective-c",
  objc: "objective-c",
  "obj-c": "objective-c",
  "objective-c++": "objective-c",
  "objective-cpp": "objective-c",
  "objc++": "objective-c",
  "obj-c++": "objective-c",
  m: "objective-c",
  mm: "objective-c",
  cs: "csharp",
  "c#": "csharp",
  csharp: "csharp",
  fs: "fsharp",
  "f#": "fsharp",
  fsharp: "fsharp",
};

function parseArgs(argv) {
  const args = {
    out: join(REPO_ROOT, ".pages"),
    baseDir: EXTENSION_DIR,
    updateExtensionRegistry: false,
    skipPages: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      args.out = join(REPO_ROOT, argv[index + 1]);
      index += 1;
    } else if (arg === "--base-dir") {
      args.baseDir = join(REPO_ROOT, argv[index + 1]);
      index += 1;
    } else if (arg === "--update-extension-registry") {
      args.updateExtensionRegistry = true;
    } else if (arg === "--skip-pages") {
      args.skipPages = true;
    }
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function getNpmCacheDir() {
  for (const command of ["npm", "npm.cmd"]) {
    try {
      return run(command, ["config", "get", "cache"]);
    } catch {
      // Try the next npm launcher. PowerShell and Git Bash expose different names.
    }
  }

  const candidates = [
    process.env.npm_config_cache,
    process.env.NPM_CONFIG_CACHE,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "npm-cache") : "",
    process.env.APPDATA ? join(process.env.APPDATA, "npm-cache") : "",
    process.env.HOME ? join(process.env.HOME, ".npm") : "",
  ].filter(Boolean);

  const existing = candidates.find((candidate) => existsSync(candidate));
  if (existing) {
    return existing;
  }

  return "";
}

function readFilesRecursive(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const filePath = join(dir, name);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      entries.push(...readFilesRecursive(filePath));
    } else if (stat.isFile()) {
      entries.push(filePath);
    }
  }
  return entries;
}

function findCachedPackageTgz() {
  const cacheDir = getNpmCacheDir();
  const indexDir = cacheDir ? join(cacheDir, "_cacache", "index-v5") : "";
  if (!indexDir || !existsSync(indexDir)) {
    return null;
  }

  const target = `@shikijs/langs/-/langs-${SHIKI_LANGS_VERSION}.tgz`;
  for (const filePath of readFilesRecursive(indexDir)) {
    const text = readFileSync(filePath, "utf8");
    if (!text.includes(target)) {
      continue;
    }

    for (const line of text.split(/\r?\n/)) {
      const tabIndex = line.indexOf("\t");
      if (tabIndex < 0 || !line.includes(target)) {
        continue;
      }

      const record = JSON.parse(line.slice(tabIndex + 1));
      const integrity = String(record.integrity || "").replace(/^sha512-/, "");
      if (!integrity) {
        continue;
      }

      const hash = Buffer.from(integrity, "base64").toString("hex");
      const contentPath = join(
        cacheDir,
        "_cacache",
        "content-v2",
        "sha512",
        hash.slice(0, 2),
        hash.slice(2, 4),
        hash.slice(4),
      );
      if (existsSync(contentPath)) {
        return contentPath;
      }

      const sha512PrefixLength = 2;
      const hashWithoutAlgorithmByte = hash.slice(sha512PrefixLength);
      const legacyContentPath = join(
        cacheDir,
        "_cacache",
        "content-v2",
        "sha512",
        hashWithoutAlgorithmByte.slice(0, 2),
        hashWithoutAlgorithmByte.slice(2, 4),
        hashWithoutAlgorithmByte.slice(4),
      );
      if (existsSync(legacyContentPath)) {
        return legacyContentPath;
      }
    }
  }

  return null;
}

function resolvePackageTgz() {
  if (process.env.SHIKI_LANGS_TGZ && existsSync(process.env.SHIKI_LANGS_TGZ)) {
    return process.env.SHIKI_LANGS_TGZ;
  }

  const cached = findCachedPackageTgz();
  if (cached) {
    return cached;
  }

  const packDir = join(tmpdir(), `gemini-ui-tuner-shiki-${Date.now()}`);
  mkdirSync(packDir, { recursive: true });
  let output = "";
  let lastError = null;
  for (const command of ["npm", "npm.cmd"]) {
    try {
      output = run(command, [
        "pack",
        `@shikijs/langs@${SHIKI_LANGS_VERSION}`,
        "--pack-destination",
        packDir,
      ]);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  const tgzName = output.split(/\r?\n/).find((line) => line.endsWith(".tgz"));
  const tgzPath = join(packDir, tgzName || `shikijs-langs-${SHIKI_LANGS_VERSION}.tgz`);
  if (!existsSync(tgzPath)) {
    throw new Error("Unable to locate packed @shikijs/langs archive.");
  }
  return tgzPath;
}

function parseOctal(bytes) {
  const text = bytes.toString("utf8").replace(/\0.*$/, "").trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function readTgzEntries(tgzPath) {
  const tarBuffer = gunzipSync(readFileSync(tgzPath));
  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = parseOctal(header.subarray(124, 136));
    const typeFlag = header.subarray(156, 157).toString("utf8");
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (!typeFlag || typeFlag === "0") {
      entries.set(fullName, Buffer.from(tarBuffer.subarray(dataStart, dataEnd)));
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function parseGrammarMetadata(fileName, source) {
  const match = source.match(/JSON\.parse\("((?:\\.|[^"\\])*)"\)/);
  const id = fileName.replace(/\.mjs$/, "");
  const imports = [...source.matchAll(/from\s+['"]\.\/([^'"]+\.mjs)['"]/g)].map((item) => item[1]);

  if (!match) {
    return {
      id,
      displayName: id,
      aliases: [],
      imports,
    };
  }

  try {
    const jsonText = JSON.parse(`"${match[1]}"`);
    const grammar = JSON.parse(jsonText);
    return {
      id: grammar.name || id,
      displayName: grammar.displayName || grammar.name || id,
      aliases: Array.isArray(grammar.aliases) ? grammar.aliases : [],
      imports,
    };
  } catch {
    return {
      id,
      displayName: id,
      aliases: [],
      imports,
    };
  }
}

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^language-/, "")
    .replace(/^lang-/, "")
    .replace(/\s+/g, "-");
}

function buildLanguageData(langFiles) {
  const metadataByFile = new Map();
  const metadataById = new Map();
  const importMap = new Map();

  for (const [fileName, buffer] of langFiles) {
    const source = buffer.toString("utf8");
    const metadata = parseGrammarMetadata(fileName, source);
    metadata.file = fileName;
    metadata.bytes = buffer.byteLength;
    metadataByFile.set(fileName, metadata);
    metadataById.set(metadata.id, metadata);
    importMap.set(fileName, metadata.imports);
  }

  function collectFiles(fileName, seen = new Set()) {
    if (seen.has(fileName) || !langFiles.has(fileName)) {
      return seen;
    }

    seen.add(fileName);
    (importMap.get(fileName) || []).forEach((dependency) => collectFiles(dependency, seen));
    return seen;
  }

  const bundledFiles = existsSync(join(EXTENSION_DIR, "vendor", "shiki", "langs"))
    ? new Set(readdirSync(join(EXTENSION_DIR, "vendor", "shiki", "langs")).filter((name) => name.endsWith(".mjs")))
    : new Set();

  const languages = [...metadataById.values()]
    .map((metadata) => {
      const files = [...collectFiles(metadata.file)].sort();
      const bytes = files.reduce((total, file) => total + (langFiles.get(file)?.byteLength || 0), 0);
      return {
        id: metadata.id,
        displayName: metadata.displayName,
        aliases: [...new Set(metadata.aliases.map(normalizeAlias).filter(Boolean))].sort(),
        file: metadata.file,
        files,
        bytes,
        bundled: files.every((file) => bundledFiles.has(file)),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));

  const validIds = new Set(languages.map((language) => language.id));
  const aliasMap = {};
  languages.forEach((language) => {
    aliasMap[normalizeAlias(language.id)] = language.id;
    language.aliases.forEach((alias) => {
      aliasMap[alias] = language.id;
    });
  });
  Object.entries(SUPPLEMENTAL_ALIASES).forEach(([alias, target]) => {
    if (validIds.has(target)) {
      aliasMap[normalizeAlias(alias)] = target;
    }
  });

  return {
    languages,
    aliasMap: Object.fromEntries(Object.entries(aliasMap).sort(([a], [b]) => a.localeCompare(b, "en"))),
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

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

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  entries.sort((a, b) => a.path.localeCompare(b.path, "en")).forEach((entry) => {
    const name = Buffer.from(entry.path.replace(/\\/g, "/"));
    const data = Buffer.from(entry.data);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localFiles.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, endRecord]);
}

async function collectDirectoryEntries(dir) {
  const entries = [];
  async function walk(currentDir) {
    const items = await readdir(currentDir, { withFileTypes: true });
    for (const item of items) {
      const filePath = join(currentDir, item.name);
      if (item.isDirectory()) {
        await walk(filePath);
      } else if (item.isFile()) {
        entries.push({
          path: relative(dir, filePath).replace(/\\/g, "/"),
          data: await readFile(filePath),
        });
      }
    }
  }
  await walk(dir);
  return entries;
}

function createRegistrySource(languageData) {
  const payload = {
    languages: languageData.languages.map((language) => ({
      id: language.id,
      displayName: language.displayName,
      aliases: language.aliases,
      file: language.file,
    })),
    aliasMap: languageData.aliasMap,
  };

  return `(() => {
  "use strict";

  globalThis.GeminiStyleTunerShikiLanguages = ${JSON.stringify(payload, null, 2)};
})();
`;
}

async function copyPageSources(outDir) {
  await cp(SOURCE_PAGE_DIR, outDir, {
    recursive: true,
    filter: (source) => basename(source) !== "assets",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tgzPath = resolvePackageTgz();
  const packageEntries = readTgzEntries(tgzPath);
  const langFiles = new Map();

  for (const [entryName, buffer] of packageEntries) {
    const match = entryName.match(/^package\/dist\/(.+\.mjs)$/);
    if (match) {
      langFiles.set(match[1], buffer);
    }
  }

  const languageData = buildLanguageData(langFiles);

  if (args.updateExtensionRegistry) {
    await writeFile(REGISTRY_FILE, createRegistrySource(languageData));
  }

  if (args.skipPages) {
    return;
  }

  const siteDir = join(args.out, "language-builder");
  const assetsDir = join(siteDir, "assets");
  const langsDir = join(assetsDir, "langs");
  rmSync(siteDir, { recursive: true, force: true });
  mkdirSync(langsDir, { recursive: true });

  await copyPageSources(siteDir);

  for (const [fileName, buffer] of langFiles) {
    await writeFile(join(langsDir, fileName), buffer);
  }

  const manifest = JSON.parse(readFileSync(join(args.baseDir, "manifest.json"), "utf8"));
  const baseZip = createStoredZip(await collectDirectoryEntries(args.baseDir));
  writeFileSync(join(assetsDir, "base-extension.zip"), baseZip);
  writeFileSync(join(assetsDir, "builder-data.json"), JSON.stringify({
    version: manifest.version,
    shikiLanguagesVersion: SHIKI_LANGS_VERSION,
    baseZip: "assets/base-extension.zip",
    languages: languageData.languages,
    aliasMap: languageData.aliasMap,
    files: Object.fromEntries([...langFiles.entries()]
      .map(([fileName, buffer]) => [fileName, buffer.byteLength])
      .sort(([a], [b]) => a.localeCompare(b, "en"))),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
