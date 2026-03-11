import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  ViewProgressView,
  type PageData,
} from "../../../src/tui/viewProgress.js";
import { sendKey } from "./inkTestUtils.js";

describe("ViewProgressView", () => {
  const mockData: PageData[] = [
    {
      csv_path: "/path/to/file1.csv",
      created_at: "2024-01-01 10:00:00",
      status: "completed",
      total_tracks: 100,
      processed_tracks: 100,
      matched_tracks: 80,
      failed_tracks: 5,
      skipped_tracks: 15,
    },
    {
      csv_path: "/path/to/file2.csv",
      created_at: "2024-01-02 11:00:00",
      status: "in_progress",
      total_tracks: 50,
      processed_tracks: 25,
      matched_tracks: 20,
      failed_tracks: 1,
      skipped_tracks: 4,
    },
  ];

  it("should render title", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("导入进度");

    unmount();
  });

  it("should render all data items", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("file1.csv");
    expect(output).toContain("file2.csv");

    unmount();
  });

  it("should calculate and display percentage correctly", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("(100%)"); // file1: 100/100
    expect(output).toContain("(50%)"); // file2: 25/50

    unmount();
  });

  it("should display pagination info", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("第 1/1 页");

    unmount();
  });

  it("should display navigation hints", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("j/↓ 下一页");
    expect(output).toContain("k/↑ 上一页");
    expect(output).toContain("q/ESC 返回");

    unmount();
  });

  it("should call onBack when q is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ViewProgressView data={mockData} onBack={onBack} />,
    );

    stdin.write("q");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when escape is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ViewProgressView data={mockData} onBack={onBack} />,
    );

    stdin.write("\u001b");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should handle empty data array", () => {
    const { lastFrame, unmount } = render(
      <ViewProgressView data={[]} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("导入进度");
    expect(output).toContain("第 1/0 页");

    unmount();
  });

  it("should render single item correctly", () => {
    const singleData: PageData[] = [
      {
        csv_path: "/test.csv",
        created_at: "2024-01-01",
        status: "completed",
        total_tracks: 10,
        processed_tracks: 10,
        matched_tracks: 8,
        failed_tracks: 1,
        skipped_tracks: 1,
      },
    ];

    const { lastFrame, unmount } = render(
      <ViewProgressView data={singleData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("/test.csv");
    expect(output).toContain("(100%)");

    unmount();
  });

  it("should handle zero total tracks", () => {
    const zeroData: PageData[] = [
      {
        csv_path: "/empty.csv",
        created_at: "2024-01-01",
        status: "pending",
        total_tracks: 0,
        processed_tracks: 0,
        matched_tracks: 0,
        failed_tracks: 0,
        skipped_tracks: 0,
      },
    ];

    const { lastFrame, unmount } = render(
      <ViewProgressView data={zeroData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("(0%)");

    unmount();
  });
});
