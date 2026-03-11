import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { PressKeyView } from "../../../src/tui/pressKey.js";
import { sendKey } from "./inkTestUtils.js";

describe("PressKeyView", () => {
  it("should render default message", () => {
    const { lastFrame, unmount } = render(<PressKeyView onPress={() => {}} />);

    const output = lastFrame() ?? "";
    expect(output).toContain("按任意键继续");

    unmount();
  });

  it("should render custom message", () => {
    const { lastFrame, unmount } = render(
      <PressKeyView message="Press any key to continue" onPress={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Press any key to continue");

    unmount();
  });

  it("should call onPress when key is pressed", async () => {
    const onPress = vi.fn();
    const instance = render(<PressKeyView onPress={onPress} />);

    await sendKey(instance, "x", false);

    expect(onPress).toHaveBeenCalledTimes(1);
    instance.unmount();
  });
});
