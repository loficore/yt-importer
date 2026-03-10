import { describe, it, expect, beforeEach } from "vitest";
import {
  initI18n,
  t,
  setLanguage,
  getLanguage,
  getCurrentLanguage,
  type Language,
} from "../../src/utils/i18n.js";

describe("i18n.ts", () => {
  beforeEach(() => {
    initI18n("en");
  });

  describe("initI18n", () => {
    it("should initialize with English translations", () => {
      const config = initI18n("en");
      expect(config.lang).toBe("en");
      expect(config.translations).toBeDefined();
    });

    it("should initialize with Chinese translations", () => {
      const config = initI18n("zh-CN");
      expect(config.lang).toBe("zh-CN");
    });

    it("should initialize with Japanese translations", () => {
      const config = initI18n("ja");
      expect(config.lang).toBe("ja");
    });
  });

  describe("t", () => {
    it("should return translated string", () => {
      initI18n("en");
      const message = t("welcome_title");
      expect(message).toBeDefined();
      expect(typeof message).toBe("string");
    });

    it("should return key when translation not found", () => {
      initI18n("en");
      const message = t("nonexistent_key");
      expect(message).toBe("nonexistent_key");
    });

    it("should format strings with params", () => {
      initI18n("en");
      const message = t("loaded_tracks", { count: 5 });
      expect(message).toContain("5");
    });
  });

  describe("setLanguage", () => {
    it("should change current language", () => {
      initI18n("en");
      setLanguage("ja");
      const config = getCurrentLanguage();
      expect(config).toBe("ja");
    });
  });

  describe("getLanguage", () => {
    it("should return a valid language code", () => {
      const lang = getLanguage();
      expect(["en", "zh-CN", "ja"]).toContain(lang);
    });
  });
});
