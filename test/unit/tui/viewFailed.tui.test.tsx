import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  ViewFailedView,
  type FailedTrack,
} from "../../../src/tui/viewFailed.js";

describe("ViewFailedView", () => {
  const mockData: FailedTrack[] = [
    {
      csv_path: "/path/to/file1.csv",
      created_at: "2024-01-01 10:00:00",
      failedTracks: [
        { name: "Song 1", artist: "Artist A" },
        { name: "Song 2", artist: "Artist B" },
      ],
    },
    {
      csv_path: "/path/to/file2.csv",
      created_at: "2024-01-02 11:00:00",
      failedTracks: [
        { name: "Song 3", artist: "Artist C" },
        { name: "Song 4", artist: "Artist D" },
        { name: "Song 5", artist: "Artist E" },
      ],
    },
  ];

  it("should render title", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("失败的歌曲");

    unmount();
  });

  it("should render all data items", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("file1.csv");
    expect(output).toContain("file2.csv");

    unmount();
  });

  it("should render failed track details", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Song 1");
    expect(output).toContain("Artist A");
    expect(output).toContain("Song 3");

    unmount();
  });

  it("should display pagination info", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("第 1/1 页");

    unmount();
  });

  it("should display navigation hints", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
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
      <ViewFailedView data={mockData} onBack={onBack} />,
    );

    stdin.write("q");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when escape is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ViewFailedView data={mockData} onBack={onBack} />,
    );

    stdin.write("\u001b");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should handle empty data array", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={[]} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("失败的歌曲");
    expect(output).toContain("第 1/0 页");

    unmount();
  });

  it("should show truncated message when more than 5 tracks", () => {
    const manyFailedTracks: FailedTrack[] = [
      {
        csv_path: "/test.csv",
        created_at: "2024-01-01",
        failedTracks: [
          { name: "Song 1", artist: "Artist A" },
          { name: "Song 2", artist: "Artist B" },
          { name: "Song 3", artist: "Artist C" },
          { name: "Song 4", artist: "Artist D" },
          { name: "Song 5", artist: "Artist E" },
          { name: "Song 6", artist: "Artist F" },
        ],
      },
    ];

    const { lastFrame, unmount } = render(
      <ViewFailedView data={manyFailedTracks} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("还有 1 首");

    unmount();
  });

  it("should display failed track count", () => {
    const { lastFrame, unmount } = render(
      <ViewFailedView data={mockData} onBack={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("2 首失败曲目:");
    expect(output).toContain("3 首失败曲目:");

    unmount();
  });
});
