import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  ImportSummaryView,
  type ImportSummaryData,
} from "../../../src/tui/importSummary.js";

describe("ImportSummaryView", () => {
  const mockData: ImportSummaryData = {
    total: 100,
    matched: 80,
    highConfidence: 50,
    mediumConfidence: 20,
    lowConfidence: 10,
    unmatched: 20,
    success: 75,
    failed: 5,
    skipped: 10,
    duration: 120000,
  };

  it("should render title", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Import Complete" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Import Complete");

    unmount();
  });

  it("should render total tracks", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("100 tracks total");

    unmount();
  });

  it("should render matched tracks", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("80 matched");

    unmount();
  });

  it("should render confidence breakdown", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("50 high");
    expect(output).toContain("20 medium");
    expect(output).toContain("10 low");

    unmount();
  });

  it("should render unmatched tracks", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("20 unmatched");

    unmount();
  });

  it("should render success count when provided", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("75 imported successfully");

    unmount();
  });

  it("should render failed count when provided", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("5 import failed");

    unmount();
  });

  it("should render skipped count when provided", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("10 skipped");

    unmount();
  });

  it("should render duration when provided", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Duration: 120s");

    unmount();
  });

  it("should render hint when showActions is false", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("按任意键返回主菜单");

    unmount();
  });

  it("should render action options when showActions is true", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView
        title="Test"
        data={mockData}
        showActions
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Yes - Import to playlist");
    expect(output).toContain("No - Skip import");
    expect(output).toContain("y/n or j/k to select");

    unmount();
  });

  it("should call onConfirm when key pressed and showActions is false", () => {
    const onConfirm = vi.fn();
    const { stdin, unmount } = render(
      <ImportSummaryView title="Test" data={mockData} onConfirm={onConfirm} />,
    );

    stdin.write("a"); // any key

    expect(onConfirm).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should handle minimal data without optional fields", () => {
    const minimalData: ImportSummaryData = {
      total: 10,
      matched: 5,
      highConfidence: 3,
      mediumConfidence: 1,
      lowConfidence: 1,
      unmatched: 5,
    };

    const { lastFrame, unmount } = render(
      <ImportSummaryView title="Test" data={minimalData} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("10 tracks total");
    expect(output).toContain("5 matched");

    unmount();
  });

  it("should highlight first action option by default when showActions is true", () => {
    const { lastFrame, unmount } = render(
      <ImportSummaryView
        title="Test"
        data={mockData}
        showActions
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("❯ Yes");

    unmount();
  });
});
