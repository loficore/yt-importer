import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  ErrorDialogView,
  type ErrorAction,
} from "../../../src/tui/errorDialog.js";
import { sendKey } from "./inkTestUtils.js";

describe("ErrorDialogView", () => {
  const mockStats = {
    total: 50,
    matched: 30,
    failed: 5,
  };

  it("should render error title", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("导入错误");

    unmount();
  });

  it("should render error message", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Network connection failed"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Network connection failed");

    unmount();
  });

  it("should truncate long error messages", () => {
    const longMessage = "a".repeat(100);
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage={longMessage}
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("...");

    unmount();
  });

  it("should render stats", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("已处理: 50");
    expect(output).toContain("已匹配: 30");
    expect(output).toContain("已失败: 5");

    unmount();
  });

  it("should render all action options", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("重试 (Retry)");
    expect(output).toContain("继续 (Continue)");
    expect(output).toContain("退出 (Exit)");

    unmount();
  });

  it("should highlight first option by default", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("❯ 重试 (Retry)");

    unmount();
  });

  it("should call onAction with retry on enter when first option selected", () => {
    const onAction = vi.fn();
    const { stdin, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={onAction}
      />,
    );

    stdin.write("\r");

    expect(onAction).toHaveBeenCalledWith("retry");
    unmount();
  });

  it("should navigate down with down arrow", async () => {
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down arrow

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ 继续 (Continue)");

    instance.unmount();
  });

  it("should navigate up with up arrow", async () => {
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down to second
    await sendKey(instance, "\u001b[A"); // up back to first

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ 重试 (Retry)");

    instance.unmount();
  });

  it("should navigate with j/k keys", async () => {
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    await sendKey(instance, "j"); // vim-style down
    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ 继续 (Continue)");

    instance.unmount();
  });

  it("should call onAction with continue when second option selected", async () => {
    const onAction = vi.fn();
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={onAction}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down to second
    await new Promise((resolve) => setTimeout(resolve, 50));
    await sendKey(instance, "\r", false);

    expect(onAction).toHaveBeenCalledWith("continue");
    instance.unmount();
  });

  it("should call onAction with exit when third option selected", async () => {
    const onAction = vi.fn();
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={onAction}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down to second
    await new Promise((resolve) => setTimeout(resolve, 50));
    await sendKey(instance, "\u001b[B"); // down to third
    await new Promise((resolve) => setTimeout(resolve, 50));
    await sendKey(instance, "\r", false);

    expect(onAction).toHaveBeenCalledWith("exit");
    instance.unmount();
  });

  it("should render navigation hint", () => {
    const { lastFrame, unmount } = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("↑/↓ or j/k 选择");

    unmount();
  });

  it("should not navigate past last option", async () => {
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down to second
    await sendKey(instance, "\u001b[B"); // down to third
    await sendKey(instance, "\u001b[B"); // try to go past last - should stay

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ 退出 (Exit)");

    instance.unmount();
  });

  it("should not navigate before first option", async () => {
    const instance = render(
      <ErrorDialogView
        errorMessage="Test error"
        stats={mockStats}
        onAction={() => {}}
      />,
    );

    await sendKey(instance, "\u001a[A"); // try to go before first - should stay

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ 重试 (Retry)");

    instance.unmount();
  });
});
