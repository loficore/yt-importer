#!/usr/bin/env bun
import toml from "toml";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TRANSLATIONS_DIR = join(process.cwd(), "config/translations");
const LANGUAGES = ["en", "zh-CN", "ja"];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface TranslationFile {
  path: string;
  name: string;
  content: Record<string, string>;
}

interface Options {
  json: boolean;
  failOnWarning: boolean;
}

function readTranslationFile(lang: string): TranslationFile | null {
  const path = join(TRANSLATIONS_DIR, `${lang}.toml`);
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = toml.parse(content);
    const langSection = parsed[lang] as Record<string, string> | undefined;
    return {
      path,
      name: lang,
      content: langSection || {},
    };
  } catch {
    return null;
  }
}

function validateAllFilesExist(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const lang of LANGUAGES) {
    const file = readTranslationFile(lang);
    if (!file) {
      errors.push(`Missing translation file: ${lang}.toml`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateTomlSyntax(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const lang of LANGUAGES) {
    const path = join(TRANSLATIONS_DIR, `${lang}.toml`);
    try {
      const content = readFileSync(path, "utf-8");
      toml.parse(content);
    } catch (error) {
      errors.push(`TOML syntax error in ${lang}.toml: ${error}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateAllKeysMatch(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const files = new Map<string, Record<string, string>>();

  for (const lang of LANGUAGES) {
    const file = readTranslationFile(lang);
    if (file) {
      files.set(lang, file.content);
    }
  }

  const referenceLang = "en";
  const referenceKeys = files.get(referenceLang);

  if (!referenceKeys) {
    errors.push("Reference language (en) not found");
    return { valid: false, errors, warnings };
  }

  const referenceKeySet = new Set(Object.keys(referenceKeys));

  for (const [lang, content] of files) {
    if (lang === referenceLang) continue;

    const langKeys = new Set(Object.keys(content));

    for (const key of referenceKeySet) {
      if (!langKeys.has(key)) {
        errors.push(`Missing translation key "${key}" in ${lang}.toml`);
      }
    }
  }

  for (const [lang, content] of files) {
    if (lang === referenceLang) continue;

    const extraKeys = Object.keys(content).filter(
      (k) => !referenceKeySet.has(k),
    );
    for (const key of extraKeys) {
      warnings.push(
        `Extra translation key "${key}" in ${lang}.toml (not in ${referenceLang}.toml)`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function printResults(
  result: ValidationResult,
  title: string,
  opts: Options,
): void {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`${title}`);
  console.log("=".repeat(50));

  if (result.valid && result.warnings.length === 0) {
    console.log("✓ All checks passed!");
    return;
  }

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const opts: Options = {
    json: args.includes("--json"),
    failOnWarning: args.includes("--fail-on-warning"),
  };

  console.log("🔍 Validating i18n translation files...\n");
  console.log(`Translations directory: ${TRANSLATIONS_DIR}`);
  console.log(`Languages: ${LANGUAGES.join(", ")}`);

  const existenceResult = validateAllFilesExist();
  if (!existenceResult.valid) {
    printResults(existenceResult, "File Existence Check", opts);
    if (opts.json) {
      console.log(
        JSON.stringify({
          success: false,
          step: "existence",
          ...existenceResult,
        }),
      );
    }
    process.exit(1);
  }
  printResults(existenceResult, "File Existence Check", opts);

  const syntaxResult = validateTomlSyntax();
  if (!syntaxResult.valid) {
    printResults(syntaxResult, "TOML Syntax Check", opts);
    if (opts.json) {
      console.log(
        JSON.stringify({ success: false, step: "syntax", ...syntaxResult }),
      );
    }
    process.exit(1);
  }
  printResults(syntaxResult, "TOML Syntax Check", opts);

  const keysResult = validateAllKeysMatch();
  printResults(keysResult, "Translation Keys Check", opts);

  if (!keysResult.valid) {
    if (opts.json) {
      console.log(
        JSON.stringify({ success: false, step: "keys", ...keysResult }),
      );
    }
    process.exit(1);
  }

  if (keysResult.warnings.length > 0) {
    if (opts.failOnWarning) {
      console.log(
        "\n❌ Validation failed due to warnings (--fail-on-warning set)",
      );
      if (opts.json) {
        console.log(
          JSON.stringify({ success: false, step: "keys", ...keysResult }),
        );
      }
      process.exit(1);
    }
    console.log("\n✅ All required keys present (warnings are non-blocking)");
  } else {
    console.log("\n✅ All translation keys are perfectly aligned!");
  }

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Validation complete!");
  console.log("=".repeat(50));

  if (opts.json) {
    console.log(
      JSON.stringify({
        success: true,
        errors: [],
        warnings: keysResult.warnings,
      }),
    );
  }
}

main();
