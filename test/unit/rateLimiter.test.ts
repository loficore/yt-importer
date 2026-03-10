import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../../src/utils/rateLimiter.js";

describe("rateLimiter.ts", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  describe("init", () => {
    it("should initialize with default values", () => {
      expect(rateLimiter).toBeDefined();
    });

    it("should set searchQPS and maxTokens", () => {
      rateLimiter.init(10);
      expect((rateLimiter as unknown as { searchQPS: number }).searchQPS).toBe(
        10,
      );
      expect((rateLimiter as unknown as { maxTokens: number }).maxTokens).toBe(
        10,
      );
    });

    it("should set initial tokens equal to maxTokens", () => {
      rateLimiter.init(5);
      expect((rateLimiter as unknown as { tokens: number }).tokens).toBe(5);
    });

    it("should set refillInterval based on QPS", () => {
      rateLimiter.init(10);
      expect(
        (rateLimiter as unknown as { refillInterval: number }).refillInterval,
      ).toBe(100);
    });

    it("should handle high QPS", () => {
      rateLimiter.init(100);
      expect(
        (rateLimiter as unknown as { refillInterval: number }).refillInterval,
      ).toBe(10);
    });

    it("should set lastRefillTime", () => {
      const before = Date.now();
      rateLimiter.init(1);
      const after = Date.now();
      const lastRefillTime = (
        rateLimiter as unknown as { lastRefillTime: number }
      ).lastRefillTime;
      expect(lastRefillTime).toBeGreaterThanOrEqual(before);
      expect(lastRefillTime).toBeLessThanOrEqual(after);
    });
  });

  describe("wait", () => {
    it("should allow request immediately when tokens available", async () => {
      rateLimiter.init(10);
      const start = Date.now();
      await rateLimiter.wait();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it("should consume token on each wait", async () => {
      rateLimiter.init(2);
      await rateLimiter.wait();
      const tokensAfterFirst = (rateLimiter as unknown as { tokens: number })
        .tokens;
      expect(tokensAfterFirst).toBe(1);
      await rateLimiter.wait();
      const tokensAfterSecond = (rateLimiter as unknown as { tokens: number })
        .tokens;
      expect(tokensAfterSecond).toBe(0);
    });

    it("should return immediately when tokens are available", async () => {
      rateLimiter.init(5);
      const start = Date.now();
      await rateLimiter.wait();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });

    it("should eventually allow request after waiting", async () => {
      rateLimiter.init(1);
      await rateLimiter.wait();
      await rateLimiter.wait();
      const tokens = (rateLimiter as unknown as { tokens: number }).tokens;
      expect(tokens).toBe(0);
    }, 10000);
  });

  describe("token bucket algorithm", () => {
    it("should allow burst at start", async () => {
      rateLimiter.init(10);
      const start = Date.now();
      for (let i = 0; i < 10; i++) {
        await rateLimiter.wait();
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it("should have zero tokens after exhausting burst", async () => {
      rateLimiter.init(5);
      for (let i = 0; i < 5; i++) {
        await rateLimiter.wait();
      }
      const tokens = (rateLimiter as unknown as { tokens: number }).tokens;
      expect(tokens).toBe(0);
    });

    it("should not exceed maxTokens", async () => {
      rateLimiter.init(3);
      await rateLimiter.wait();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await rateLimiter.wait();
      const tokens = (rateLimiter as unknown as { tokens: number }).tokens;
      expect(tokens).toBeLessThanOrEqual(3);
    });
  });

  describe("edge cases", () => {
    it("should handle very small QPS", async () => {
      rateLimiter.init(0.5);
      await rateLimiter.wait();
      await rateLimiter.wait();
      const tokens = (rateLimiter as unknown as { tokens: number }).tokens;
      expect(tokens).toBeLessThanOrEqual(1);
    }, 10000);

    it("should handle fractional refill intervals", () => {
      rateLimiter.init(3);
      const refillInterval = (
        rateLimiter as unknown as { refillInterval: number }
      ).refillInterval;
      expect(refillInterval).toBeCloseTo(333.33, 0);
    });
  });
});
