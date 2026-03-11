import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { LowConfidenceResolverView } from "../../../src/tui/lowConfidenceResolver.js";
import type {
  MatchResultWithCandidates,
  YouTubeSong,
} from "../../../src/types/index.js";

const mockCandidates: MatchResultWithCandidates[] = [
  {
    track: {
      uri: "spotify:track:1",
      name: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      duration: 180000,
    },
    youtubeSong: {
      videoId: "abc123",
      name: "Test Song",
      artist: "Test Artist",
    },
    confidence: "low",
    matchReason: "duration",
    candidates: [
      { videoId: "vid1", name: "Song A", artist: "Artist A", duration: 180000 },
      { videoId: "vid2", name: "Song B", artist: "Artist B", duration: 185000 },
    ],
  },
  {
    track: {
      uri: "spotify:track:2",
      name: "Another Song",
      artist: "Another Artist",
      album: "Another Album",
      duration: 200000,
    },
    youtubeSong: {
      videoId: "def456",
      name: "Another Song",
      artist: "Another Artist",
    },
    confidence: "low",
    matchReason: "fuzzy",
    candidates: [
      { videoId: "vid3", name: "Song C", artist: "Artist C", duration: 200000 },
    ],
  },
];

describe("LowConfidenceResolverView", () => {
  const defaultProps = {
    candidates: mockCandidates,
    currentIndex: 0,
    selectedCandidateIndex: 0,
    onSelect: vi.fn(),
    onSkip: vi.fn(),
    onResolveAll: vi.fn(),
    onQuit: vi.fn(),
  };

  it("should render title with progress", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Low Confidence Resolution");
    expect(output).toContain("(1/2)");

    unmount();
  });

  it("should render current track info", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Track:");
    expect(output).toContain("Test Song");
    expect(output).toContain("Test Artist");
    expect(output).toContain("Test Album");

    unmount();
  });

  it("should render candidates", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Candidates:");
    expect(output).toContain("Song A");
    expect(output).toContain("Artist A");
    expect(output).toContain("Song B");

    unmount();
  });

  it("should show selected candidate with marker", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView
        {...defaultProps}
        selectedCandidateIndex={1}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("❯ 2.");

    unmount();
  });

  it("should render navigation hints", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("[1-5] Select");
    expect(output).toContain("[s] Skip");
    expect(output).toContain("[a] Import All");
    expect(output).toContain("[q] Quit");

    unmount();
  });

  it("should show completion message when candidates is empty", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} candidates={[]} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("All low confidence songs have been resolved");

    unmount();
  });

  it("should show confirm dialog when pressing a", async () => {
    const { stdin, lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    stdin.write("a");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = lastFrame() ?? "";
    expect(output).toContain("Confirm Bulk Import");
    expect(output).toContain("Y");

    unmount();
  });

  it("should show confirm dialog when pressing q", async () => {
    const { stdin, lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    stdin.write("q");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = lastFrame() ?? "";
    expect(output).toContain("Confirm Quit");

    unmount();
  });

  it("should call onResolveAll when confirming resolve all", async () => {
    const onResolveAll = vi.fn();
    const { stdin, unmount } = render(
      <LowConfidenceResolverView
        {...defaultProps}
        onResolveAll={onResolveAll}
      />,
    );

    stdin.write("a"); // open confirm
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("y"); // confirm

    expect(onResolveAll).toHaveBeenCalled();
    unmount();
  });

  it("should call onQuit when confirming quit", async () => {
    const onQuit = vi.fn();
    const { stdin, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} onQuit={onQuit} />,
    );

    stdin.write("q"); // open confirm
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("y"); // confirm

    expect(onQuit).toHaveBeenCalled();
    unmount();
  });

  it("should cancel confirm when pressing n", async () => {
    const onQuit = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} onQuit={onQuit} />,
    );

    stdin.write("q"); // open confirm
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("n"); // cancel
    await new Promise((resolve) => setTimeout(resolve, 50));

    const output = lastFrame() ?? "";
    expect(output).not.toContain("Confirm Quit");
    expect(onQuit).not.toHaveBeenCalled();

    unmount();
  });

  it("should format duration correctly", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("3:00"); // 180000ms = 3:00

    unmount();
  });

  it("should show star for first candidate", () => {
    const { lastFrame, unmount } = render(
      <LowConfidenceResolverView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("★");

    unmount();
  });
});
