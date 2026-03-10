import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getConfig,
  setConfig,
  setDefaultConfig,
  mergeConfig,
  validateConfig,
  getConfigKeys,
  clearConfig,
  DEFAULT_CONFIG,
} from "../../src/utils/config.js";

describe("config.ts", () => {
  beforeEach(() => {
    clearConfig();
  });

  afterEach(() => {
    clearConfig();
  });

  describe("getConfig", () => {
    it("should return DEFAULT_CONFIG when no config set", () => {
      const config = getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("should return config for specific key", () => {
      setConfig("test-key", { minConfidence: "high" });
      const config = getConfig("test-key");
      expect(config.minConfidence).toBe("high");
    });

    it("should return default config when key not found", () => {
      const config = getConfig("non-existent-key");
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("setConfig", () => {
    it("should set config for specific key", () => {
      setConfig("my-key", { requestDelay: 3000 });
      const config = getConfig("my-key");
      expect(config.requestDelay).toBe(3000);
    });

    it("should merge with default config", () => {
      setConfig("merge-test", { minConfidence: "high" });
      const config = getConfig("merge-test");
      expect(config.minConfidence).toBe("high");
      expect(config.requestDelay).toBe(DEFAULT_CONFIG.requestDelay);
    });

    it("should update existing config", () => {
      setConfig("update-test", { requestDelay: 1000 });
      setConfig("update-test", { requestDelay: 2000 });
      const config = getConfig("update-test");
      expect(config.requestDelay).toBe(2000);
    });
  });

  describe("setDefaultConfig", () => {
    it("should set default config", () => {
      setDefaultConfig({ minConfidence: "medium" });
      const config = getConfig();
      expect(config.minConfidence).toBe("medium");
    });

    it("should merge with existing default config", () => {
      setDefaultConfig({ minConfidence: "high" });
      setDefaultConfig({ requestDelay: 5000 });
      const config = getConfig();
      expect(config.minConfidence).toBe("high");
      expect(config.requestDelay).toBe(5000);
    });
  });

  describe("mergeConfig", () => {
    it("should merge base config with overrides", () => {
      const base = { minConfidence: "low" as const, requestDelay: 1000 };
      const overrides = { requestDelay: 2000 };
      const merged = mergeConfig(base, overrides);
      expect(merged.minConfidence).toBe("low");
      expect(merged.requestDelay).toBe(2000);
    });

    it("should return default config when base is empty", () => {
      const merged = mergeConfig({}, { minConfidence: "high" as const });
      expect(merged.minConfidence).toBe("high");
    });

    it("should handle empty overrides", () => {
      const base = { minConfidence: "low" as const };
      const merged = mergeConfig(base, {});
      expect(merged.minConfidence).toBe("low");
    });
  });

  describe("validateConfig", () => {
    it("should return valid config as-is", () => {
      const input = { minConfidence: "high", requestDelay: 2000 };
      const result = validateConfig(input);
      expect(result.minConfidence).toBe("high");
      expect(result.requestDelay).toBe(2000);
    });

    it("should use defaults for missing fields", () => {
      const result = validateConfig({});
      expect(result.minConfidence).toBe("low");
      expect(result.requestDelay).toBe(1500);
      expect(result.skipConfirmation).toBe(false);
    });

    it("should return DEFAULT_CONFIG for invalid minConfidence", () => {
      const result = validateConfig({ minConfidence: "invalid" });
      expect(result.minConfidence).toBe("low");
    });

    it("should return DEFAULT_CONFIG for invalid requestDelay (too low)", () => {
      const result = validateConfig({ requestDelay: 50 });
      expect(result.requestDelay).toBe(1500);
    });

    it("should return DEFAULT_CONFIG for invalid requestDelay (too high)", () => {
      const result = validateConfig({ requestDelay: 100000 });
      expect(result.requestDelay).toBe(1500);
    });

    it("should accept valid logLevel values", () => {
      expect(validateConfig({ logLevel: "debug" }).logLevel).toBe("debug");
      expect(validateConfig({ logLevel: "info" }).logLevel).toBe("info");
      expect(validateConfig({ logLevel: "warn" }).logLevel).toBe("warn");
      expect(validateConfig({ logLevel: "error" }).logLevel).toBe("error");
    });

    it("should reject invalid logLevel", () => {
      const result = validateConfig({ logLevel: "trace" });
      expect(result.logLevel).toBe("info");
    });

    it("should accept proxyUrl when provided", () => {
      const result = validateConfig({ proxyUrl: "http://proxy:8080" });
      expect(result.proxyUrl).toBe("http://proxy:8080");
    });

    it("should set proxyUrl to undefined when not provided", () => {
      const result = validateConfig({});
      expect(result.proxyUrl).toBeUndefined();
    });
  });

  describe("getConfigKeys", () => {
    it("should return empty array when no configs", () => {
      expect(getConfigKeys()).toEqual([]);
    });

    it("should return all config keys", () => {
      setConfig("key1", {});
      setConfig("key2", {});
      const keys = getConfigKeys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
    });
  });

  describe("clearConfig", () => {
    it("should clear specific key", () => {
      setConfig("to-clear", { requestDelay: 1000 });
      clearConfig("to-clear");
      expect(getConfigKeys()).not.toContain("to-clear");
    });

    it("should clear all configs when no key provided", () => {
      setConfig("key1", {});
      setConfig("key2", {});
      clearConfig();
      expect(getConfigKeys()).toEqual([]);
    });
  });
});
