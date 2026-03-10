import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fileWatcher } from "../../src/utils/fileWatcher.js";

describe("fileWatcher.ts", () => {
  let mockOnChange: (event: "change" | "delete", mtime: number) => void;

  beforeEach(() => {
    mockOnChange = vi.fn();
    fileWatcher.unwatchAll();
  });

  afterEach(() => {
    fileWatcher.unwatchAll();
  });

  describe("watch", () => {
    it("should not throw when watching non-existent file", async () => {
      await fileWatcher.watch({
        path: "/non/existent/file.json",
        onChange: mockOnChange,
      });
    });

    it("should accept custom poll interval", async () => {
      await fileWatcher.watch({
        path: "/non/existent/file.json",
        onChange: mockOnChange,
        pollInterval: 1000,
      });
    });
  });

  describe("unwatch", () => {
    it("should not throw when unwatching non-watched path", () => {
      expect(() => {
        fileWatcher.unwatch("/non/watched/path");
      }).not.toThrow();
    });

    it("should not throw when unwatching after watch", async () => {
      await fileWatcher.watch({
        path: "/test/file.json",
        onChange: mockOnChange,
      });

      expect(() => {
        fileWatcher.unwatch("/test/file.json");
      }).not.toThrow();
    });
  });

  describe("unwatchAll", () => {
    it("should not throw when no files are being watched", () => {
      expect(() => {
        fileWatcher.unwatchAll();
      }).not.toThrow();
    });

    it("should unwatch all watched files", async () => {
      await fileWatcher.watch({
        path: "/test/file1.json",
        onChange: mockOnChange,
      });
      await fileWatcher.watch({
        path: "/test/file2.json",
        onChange: mockOnChange,
      });

      expect(() => {
        fileWatcher.unwatchAll();
      }).not.toThrow();
    });
  });
});
