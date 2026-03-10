import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAxiosGet = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...args: unknown[]) => mockAxiosGet(...args),
  },
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  testProxyConnection,
  testDirectConnection,
} = require("../../src/utils/proxy.js");

describe("proxy.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("testProxyConnection", () => {
    it("should return failed when proxy URL is empty", async () => {
      const result = await testProxyConnection("");
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.message).toBe("Proxy URL is empty");
    });

    it("should return failed when proxy URL is undefined", async () => {
      const result = await testProxyConnection(undefined as unknown as string);
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
    });

    it("should handle connection timeout error", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ECONNABORTED",
        message: "timeout",
      });

      const result = await testProxyConnection("http://proxy:8080");
      expect(result.success).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.message).toBe("Connection timeout");
    });

    it("should handle connection refused error", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ECONNREFUSED",
      });

      const result = await testProxyConnection("http://proxy:8080");
      expect(result.success).toBe(false);
      expect(result.message).toBe("Proxy connection refused");
    });

    it("should handle protocol error", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "EPROTO",
      });

      const result = await testProxyConnection("http://proxy:8080");
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Protocol error (Check if proxy type is correct)",
      );
    });

    it("should handle TLS certificate error", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ERR_TLS_CERT_ALTNAME_INVALID",
      });

      const result = await testProxyConnection("http://proxy:8080");
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "TLS certificate error (try using http instead of https)",
      );
    });
  });

  describe("testDirectConnection", () => {
    it("should handle connection timeout", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ECONNABORTED",
      });

      const result = await testDirectConnection();
      expect(result.success).toBe(false);
      expect(result.message).toBe("Connection timeout");
    });

    it("should handle connection refused", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ECONNREFUSED",
      });

      const result = await testDirectConnection();
      expect(result.success).toBe(false);
      expect(result.message).toBe("Connection refused");
    });

    it("should handle TLS certificate error", async () => {
      mockAxiosGet.mockRejectedValueOnce({
        code: "ERR_TLS_CERT_ALTNAME_INVALID",
      });

      const result = await testDirectConnection();
      expect(result.success).toBe(false);
      expect(result.message).toBe("TLS certificate error (network issue)");
    });
  });
});
