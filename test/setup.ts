import { afterEach, beforeEach, vi } from "vitest";

let logSpy: ReturnType<typeof vi.spyOn> | null = null;
let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy?.mockRestore();
  errorSpy?.mockRestore();
  logSpy = null;
  errorSpy = null;
});
