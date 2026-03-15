import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";

interface UntranslatedString {
  file: string;
  line: number;
  content: string;
  hasI18n: boolean;
}

const I18N_FUNC = ["t(", "t`", 't("', "t'", "getCurrentLanguage"];

const SKIP_EXTENSIONS = [".test.ts", ".test.tsx", ".d.ts"];

const SKIP_PATTERNS = [
  /^\s*import/,
  /^\s*export/,
  /^\s*const\s+\w+\s*=/,
  /^\s*let\s+\w+\s*=/,
  /^\s*logger\./,
  /^\s*return/,
  /^\s*if\s*\(/,
  /^\s*for\s*\(/,
  /^\s*while\s*\(/,
  /^\s*case\s+/,
  /^\s*default:/,
  /^\s*try\s*{/,
  /^\s*catch\s*\(/,
  /^\s*throw\s+/,
  /^\s*async\s+/,
  /^\s*\/\//,
  /^\s*\/\*/,
  /^\s*\*\s+/,
  /^\s*@/,
  /^\s*\{$/,
  /^\s*\}$/,
  /^\s*\]/,
  /^\s*\)/,
  /^\s*,$/,
  /^\s*\.\.\./,
  /^\s*$/,
];

const EXCLUDE_KEYWORDS = [
  "process.env",
  "__dirname",
  "import.meta",
  "console.clear",
  "console.dir",
  "process.exit",
  "process.cwd",
  "new Error(",
  "error.message",
  "error.stack",
  "Error:",
  "warn:",
  "info:",
  "debug:",
  "JSON.",
  "Number(",
  "String(",
  "Boolean(",
  "Array(",
  "Object(",
  "Date.now",
  "Date.ISO",
  "/^",
  "/\\",
  "RegExp",
  "SQLite",
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WHERE",
  "FROM",
  "JOIN",
  "ORDER BY",
  "GROUP BY",
  "LIMIT ",
  " OFFSET",
  ".csv",
  ".json",
  ".sqlite",
  ".toml",
  ".txt",
  ".js",
  ".ts",
  ".tsx",
  "utf-8",
  "utf8",
  "latin1",
  "UTF-",
  "Content-Type",
  "User-Agent",
  "Accept",
  "Accept-Language",
  "application/",
  "text/",
  "image/",
  "audio/",
  "video/",
  "multipart/",
  "application/json",
  "application/xml",
  "text/plain",
  "text/html",
  "text/csv",
  "200",
  "201",
  "204",
  "400",
  "401",
  "403",
  "404",
  "429",
  "500",
  "502",
  "503",
  "OK",
  "Created",
  "No Content",
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Too Many Requests",
  "Internal Server Error",
  "Bad Gateway",
  "Service Unavailable",
  "http://",
  "https://",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[",
  "]",
  "{",
  "}",
  "=",
  "==",
  "===",
  "!=",
  "!==",
  "<",
  ">",
  "<=",
  ">=",
  "&&",
  "||",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "|",
  "&",
  "~",
  "<<",
  ">>",
  ">>>",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
  "|=",
  "&=",
  "<<=",
  ">>=",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "any",
  "boolean",
  "number",
  "object",
  "string",
  "symbol",
  "void",
  "never",
  "unknown",
];

function shouldSkip(line: string): boolean {
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(line)) {
      return true;
    }
  }

  for (const keyword of EXCLUDE_KEYWORDS) {
    if (line.includes(keyword)) {
      return true;
    }
  }

  return false;
}

function containsI18n(line: string): boolean {
  return I18N_FUNC.some((f) => line.includes(f));
}

function isHardcodedString(line: string): boolean {
  const hasConsole = /console\.(log|warn|error|info|debug)/.test(line);
  if (!hasConsole) return false;

  const hasI18n = containsI18n(line);
  if (hasI18n) return false;

  const hasVariable = /\$\{[^}]+\}/.test(line) || /`[^`]*\$\{/.test(line);
  if (hasVariable) {
    return false;
  }

  if (shouldSkip(line)) {
    return false;
  }

  const isEmptyString =
    /console\.(log|warn|error|info|debug)\(\s*["'`]\s*["'`]\s*\)/.test(line);
  if (isEmptyString) {
    return false;
  }

  return true;
}

async function scanFile(filePath: string): Promise<UntranslatedString[]> {
  const results: UntranslatedString[] = [];
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    if (isHardcodedString(line)) {
      const hasI18nNext = containsI18n(nextLine);
      if (hasI18nNext) continue;

      let displayContent = line.trim();
      if (line.trim().endsWith("(") && nextLine.trim()) {
        displayContent = (line.trim() + " " + nextLine.trim()).substring(
          0,
          100,
        );
      }

      results.push({
        file: filePath,
        line: i + 1,
        content: displayContent,
        hasI18n: false,
      });
    }
  }

  return results;
}

async function scanDirectory(dir: string): Promise<UntranslatedString[]> {
  const results: UntranslatedString[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      const subResults = await scanDirectory(fullPath);
      results.push(...subResults);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (![".ts", ".tsx"].includes(ext)) continue;
      if (SKIP_EXTENSIONS.some((e) => entry.name.endsWith(e))) continue;

      const fileResults = await scanFile(fullPath);
      results.push(...fileResults);
    }
  }

  return results;
}

async function main() {
  console.log("🔍 扫描未国际化的硬编码文本...\n");

  const results = await scanDirectory("./src");

  if (results.length === 0) {
    console.log("✅ 未发现未国际化的硬编码文本！");
    return;
  }

  console.log(`❌ 发现 ${results.length} 处未国际化的文本:\n`);

  const groupedByFile = new Map<string, UntranslatedString[]>();
  for (const r of results) {
    const list = groupedByFile.get(r.file) || [];
    list.push(r);
    groupedByFile.set(r.file, list);
  }

  for (const [file, items] of groupedByFile) {
    console.log(`\n📁 ${file}`);
    console.log("─".repeat(60));
    for (const item of items.slice(0, 20)) {
      console.log(`  ${item.line}: ${item.content.substring(0, 100)}`);
    }
    if (items.length > 20) {
      console.log(`  ... 还有 ${items.length - 20} 处`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`总计: ${results.length} 处未国际化`);
}

main().catch(console.error);
