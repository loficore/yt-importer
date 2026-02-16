import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initI18n, t, getLanguage, setLanguage } from "../src/utils/i18n.js";

const originalLang = process.env.LANG;
const originalLanguage = process.env.LANGUAGE;

describe("i18n", () => {
  beforeEach(() => {
    process.env.LANG = originalLang;
    process.env.LANGUAGE = originalLanguage;
  });

  afterEach(() => {
    process.env.LANG = originalLang;
    process.env.LANGUAGE = originalLanguage;
  });

  it("detects language from environment", () => {
    process.env.LANG = "zh_CN.UTF-8";
    expect(getLanguage()).toBe("zh-CN");

    process.env.LANG = "ja_JP.UTF-8";
    expect(getLanguage()).toBe("ja");

    process.env.LANG = "en_US.UTF-8";
    expect(getLanguage()).toBe("en");
  });

  it("formats strings with params", () => {
    initI18n("en");
    const message = t("loaded_tracks", { count: 5 });
    expect(message).toContain("5");
  });

  it("returns key when translation missing", () => {
    initI18n("en");
    const message = t("missing_key_example");
    expect(message).toBe("missing_key_example");
  });

  it("switches language with setLanguage", () => {
    setLanguage("en");
    const enText = t("welcome_title");
    setLanguage("ja");
    const jaText = t("welcome_title");
    expect(enText).not.toBe(jaText);
  });
});
