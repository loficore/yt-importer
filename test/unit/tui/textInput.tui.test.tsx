import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextInputView } from "../../../src/tui/textInput.js";
import { sendKey } from "./inkTestUtils.js";

describe("TextInputView", () => {
  it("should render message and placeholder", () => {
    const { lastFrame, unmount } = render(
      <TextInputView
        message="Playlist name"
        placeholder="type here"
        onSubmit={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Playlist name");
    expect(output).toContain("type here");

    unmount();
  });

  it("should submit default value on enter", () => {
    const onSubmit = vi.fn();
    const { stdin, unmount } = render(
      <TextInputView
        message="Playlist name"
        defaultValue="LoFi Mix"
        onSubmit={onSubmit}
      />,
    );

    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith("LoFi Mix");
    unmount();
  });

  it("should append typed input then submit", async () => {
    const onSubmit = vi.fn();
    const instance = render(
      <TextInputView message="Playlist name" onSubmit={onSubmit} />,
    );

    await sendKey(instance, "A");
    await sendKey(instance, "B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await sendKey(instance, "\r", false);

    expect(onSubmit).toHaveBeenCalledWith("AB");
    instance.unmount();
  });

  it("should show validation error and block submit", async () => {
    const onSubmit = vi.fn();
    const instance = render(
      <TextInputView
        message="Playlist name"
        validate={(value) => (value.trim() ? true : "Name required")}
        onSubmit={onSubmit}
      />,
    );

    await sendKey(instance, "\r");

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("Name required");
    expect(onSubmit).not.toHaveBeenCalled();
    instance.unmount();
  });
});
