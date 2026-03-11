import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { NotificationView } from "../../../src/tui/notification.js";

describe("NotificationView", () => {
  it("should render success notification", () => {
    const { lastFrame, unmount } = render(
      <NotificationView type="success" message="Done" duration={1000} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("✓ Done");

    unmount();
  });

  it("should render warning notification", () => {
    const { lastFrame, unmount } = render(
      <NotificationView type="warning" message="Careful" duration={1000} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("⚠ Careful");

    unmount();
  });

  it("should call onClose after duration", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <NotificationView
        type="info"
        message="Working"
        duration={20}
        onClose={onClose}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 180));

    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
