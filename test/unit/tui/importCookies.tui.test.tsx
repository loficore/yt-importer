import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ImportCookiesView } from "../../../src/tui/importCookies.js";

describe("ImportCookiesView", () => {
  const defaultProps = {
    currentCookiePath: undefined,
    autoWatchEnabled: false,
    onImport: vi
      .fn()
      .mockResolvedValue({ success: true, message: "Import successful" }),
    onSelectFile: vi.fn().mockResolvedValue(null),
    onToggleAutoWatch: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
  };

  it("should render title", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Cookies 设置");

    unmount();
  });

  it("should show current cookie path as not set when undefined", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} currentCookiePath={undefined} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("当前 Cookies 文件:");
    expect(output).toContain("未设置");

    unmount();
  });

  it("should show current cookie path when provided", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView
        {...defaultProps}
        currentCookiePath="/path/to/cookies.json"
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("/path/to/cookies.json");

    unmount();
  });

  it("should display all menu options", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("❶ 导入当前文件");
    expect(output).toContain("❷ 选择新的 Cookies 文件");
    expect(output).toContain("自动监控:");

    unmount();
  });

  it("should show auto watch status", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} autoWatchEnabled={true} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("自动监控: ✓ 开启");

    unmount();
  });

  it("should show auto watch disabled status", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} autoWatchEnabled={false} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("自动监控: ✗ 关闭");

    unmount();
  });

  it("should display navigation hints", () => {
    const { lastFrame, unmount } = render(
      <ImportCookiesView {...defaultProps} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("按数字键选择");
    expect(output).toContain("Enter/q 返回");

    unmount();
  });

  it("should call onBack when q is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ImportCookiesView {...defaultProps} onBack={onBack} />,
    );

    stdin.write("q");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when escape is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ImportCookiesView {...defaultProps} onBack={onBack} />,
    );

    stdin.write("\u001b");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when enter is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ImportCookiesView {...defaultProps} onBack={onBack} />,
    );

    stdin.write("\r");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onImport when 1 is pressed", async () => {
    const onImport = vi
      .fn()
      .mockResolvedValue({ success: true, message: "Done" });
    const { stdin, unmount } = render(
      <ImportCookiesView {...defaultProps} onImport={onImport} />,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("1");

    // Wait for async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onImport).toHaveBeenCalled();
    unmount();
  });

  it("should call onSelectFile when 2 is pressed", async () => {
    const onSelectFile = vi.fn().mockResolvedValue(null);
    const { stdin, unmount } = render(
      <ImportCookiesView {...defaultProps} onSelectFile={onSelectFile} />,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("2");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onSelectFile).toHaveBeenCalled();
    unmount();
  });

  it("should call onToggleAutoWatch when 3 is pressed", async () => {
    const onToggleAutoWatch = vi.fn().mockResolvedValue(undefined);
    const { stdin, unmount } = render(
      <ImportCookiesView
        {...defaultProps}
        onToggleAutoWatch={onToggleAutoWatch}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("3");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onToggleAutoWatch).toHaveBeenCalled();
    unmount();
  });
});
