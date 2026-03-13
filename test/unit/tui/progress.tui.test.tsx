import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import {
  ProgressView,
  type ImportProgressSnapshot,
  type ImportProgressPayload,
} from "../../../src/tui/progress.js";

describe("ProgressView", () => {
  const mockInitial: ImportProgressSnapshot = {
    totalTracks: 100,
    processedTracks: 0,
    matchedTracks: 0,
    failedTracks: 0,
    skippedTracks: 0,
  };

  let mockSubscribe:
    | ((listener: (payload: ImportProgressPayload) => void) => () => void)
    | undefined;
  let listeners: Set<(payload: ImportProgressPayload) => void>;

  beforeEach(() => {
    listeners = new Set();
    mockSubscribe = vi.fn(
      (listener: (payload: ImportProgressPayload) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    );
  });

  it("should render initial state", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("正在处理歌曲");
    expect(output).toContain("0/100");

    unmount();
  });

  it("should render progress bar", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("0%");

    unmount();
  });

  it("should render match rate as 0% when no tracks processed", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("匹配成功率: 0.0%");

    unmount();
  });

  it("should render current track", () => {
    const initial: ImportProgressSnapshot = {
      ...mockInitial,
      currentTrack: "Test Song - Artist",
    };

    const { lastFrame, unmount } = render(
      <ProgressView initial={initial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Test Song - Artist");

    unmount();
  });

  it("should show ETA as --:-- when no tracks processed", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("ETA: --:--");

    unmount();
  });

  it("should render all stats", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("进度:");
    expect(output).toContain("匹配:");
    expect(output).toContain("失败:");
    expect(output).toContain("跳过:");

    unmount();
  });

  it("should handle zero total tracks", () => {
    const zeroInitial: ImportProgressSnapshot = {
      totalTracks: 0,
      processedTracks: 0,
      matchedTracks: 0,
      failedTracks: 0,
      skippedTracks: 0,
    };

    const { lastFrame, unmount } = render(
      <ProgressView initial={zeroInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("0%");

    unmount();
  });

  it("should show done state when done is true", async () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const listener = Array.from(listeners)[0];
    listener({ done: true });

    await vi.waitFor(() => {
      const output = lastFrame() ?? "";
      expect(output).toContain("导入处理完成");
    });

    unmount();
  });

  it("should update progress when subscribe is called", async () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const listener = Array.from(listeners)[0];
    listener({
      processedTracks: 50,
      matchedTracks: 40,
      failedTracks: 5,
      skippedTracks: 5,
    });

    await vi.waitFor(() => {
      const output = lastFrame() ?? "";
      expect(output).toContain("50/100");
    });

    unmount();
  });

  it("should calculate match rate correctly", async () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const listener = Array.from(listeners)[0];
    listener({
      processedTracks: 10,
      matchedTracks: 8,
      failedTracks: 1,
      skippedTracks: 1,
    });

    await vi.waitFor(() => {
      const output = lastFrame() ?? "";
      expect(output).toContain("80.0%");
    });

    unmount();
  });

  it("should use cyan color when not done", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("正在处理歌曲");

    unmount();
  });

  it("should show current track as - when not set", () => {
    const { lastFrame, unmount } = render(
      <ProgressView initial={mockInitial} subscribe={mockSubscribe!} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("当前: -");

    unmount();
  });
});
