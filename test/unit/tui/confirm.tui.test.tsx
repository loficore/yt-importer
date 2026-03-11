import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ConfirmView } from "../../../src/tui/confirm.js";
import { sendKey } from "./inkTestUtils.js";

describe("ConfirmView", () => {
  it("should submit default false on enter", () => {
    const onSubmit = vi.fn();
    const { stdin, unmount } = render(
      <ConfirmView message="Continue?" onSubmit={onSubmit} />,
    );

    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith(false);
    unmount();
  });

  it("should submit true when default value is true", () => {
    const onSubmit = vi.fn();
    const { stdin, unmount } = render(
      <ConfirmView message="Continue?" defaultValue={true} onSubmit={onSubmit} />,
    );

    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith(true);
    unmount();
  });

  it("should submit true when toggling with right arrow then enter", async () => {
    const onSubmit = vi.fn();
    const instance = render(
      <ConfirmView message="Continue?" onSubmit={onSubmit} />,
    );

    await sendKey(instance, "\u001b[C");
    const movedOutput = instance.lastFrame() ?? "";
    expect(movedOutput).toContain("❯ Yes");

    await new Promise((resolve) => setTimeout(resolve, 20));
    await sendKey(instance, "\r", false);

    expect(onSubmit).toHaveBeenCalledWith(true);
    instance.unmount();
  });

  it("should render labels and input hint", () => {
    const { lastFrame, unmount } = render(
      <ConfirmView message="Continue?" onSubmit={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Yes");
    expect(output).toContain("No");
    expect(output).toContain("Enter to confirm");

    unmount();
  });
});
