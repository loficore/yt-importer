import { describe, it, expect } from "vitest";
import {
  filterYoutubeCookies,
  dedupeCookies,
  buildCookiesHeader,
  validateCookieHeader,
  type CookieEntry,
} from "../../src/utils/cookies.js";

describe("cookies.ts", () => {
  describe("filterYoutubeCookies", () => {
    it("should filter cookies for youtube.com", () => {
      const cookies: CookieEntry[] = [
        { name: "SESSIONID", value: "abc123", domain: "youtube.com" },
        { name: "OTHER", value: "xyz", domain: "google.com" },
      ];
      const result = filterYoutubeCookies(cookies);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("SESSIONID");
    });

    it("should filter cookies for ytmusic.com", () => {
      const cookies: CookieEntry[] = [
        { name: "AUTH", value: "token", domain: "ytmusic.com" },
      ];
      const result = filterYoutubeCookies(cookies);
      expect(result).toHaveLength(1);
    });

    it("should include subdomains", () => {
      const cookies: CookieEntry[] = [
        { name: "SID", value: "session", domain: "m.youtube.com" },
        { name: "LOGIN", value: "user", domain: ".ytmusic.com" },
      ];
      const result = filterYoutubeCookies(cookies);
      expect(result).toHaveLength(2);
    });

    it("should exclude cookies without domain", () => {
      const cookies: CookieEntry[] = [{ name: "NO_DOMAIN", value: "value" }];
      const result = filterYoutubeCookies(cookies);
      expect(result).toHaveLength(0);
    });

    it("should normalize domain to lowercase", () => {
      const cookies: CookieEntry[] = [
        { name: "TEST", value: "value", domain: "YOUTUBE.COM" },
      ];
      const result = filterYoutubeCookies(cookies);
      expect(result[0]?.domain).toBe("youtube.com");
    });
  });

  describe("dedupeCookies", () => {
    it("should keep last occurrence of duplicate names", () => {
      const cookies: CookieEntry[] = [
        { name: "SID", value: "first" },
        { name: "AUTH", value: "second" },
        { name: "SID", value: "third" },
      ];
      const result = dedupeCookies(cookies);
      expect(result).toHaveLength(2);
      expect(result[0]?.value).toBe("third");
    });

    it("should keep unique cookies", () => {
      const cookies: CookieEntry[] = [
        { name: "SID", value: "first" },
        { name: "AUTH", value: "updated" },
      ];
      const result = dedupeCookies(cookies);
      expect(result).toHaveLength(2);
    });

    it("should handle empty array", () => {
      const result = dedupeCookies([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("buildCookiesHeader", () => {
    it("should build valid cookie header", () => {
      const cookies: CookieEntry[] = [
        { name: "SID", value: "session123" },
        { name: "AUTH", value: "token456" },
      ];
      const result = buildCookiesHeader(cookies);
      expect(result).toBe("SID=session123; AUTH=token456");
    });

    it("should handle empty array", () => {
      const result = buildCookiesHeader([]);
      expect(result).toBe("");
    });
  });

  describe("validateCookieHeader", () => {
    it("should return true for valid header", () => {
      expect(validateCookieHeader("SID=session123")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(validateCookieHeader("")).toBe(false);
    });

    it("should return false for whitespace only", () => {
      expect(validateCookieHeader("   ")).toBe(false);
    });

    it("should return false for string too short", () => {
      expect(validateCookieHeader("a=bc")).toBe(false);
    });

    it("should return false for string too long", () => {
      const longString = "a=" + "b".repeat(8193);
      expect(validateCookieHeader(longString)).toBe(false);
    });

    it("should return true for string at max length", () => {
      const maxString = "a=" + "b".repeat(8190);
      expect(validateCookieHeader(maxString)).toBe(true);
    });
  });
});
