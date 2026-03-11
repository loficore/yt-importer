import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { CheckboxView } from "../../../src/tui/checkbox.js";
import { sendKey } from "./inkTestUtils.js";

describe("CheckboxView", () => {
  it("should render message and all choices", () => {
    const { lastFrame, unmount } = render(
      <CheckboxView
        message="Pick tracks"
        choices={[
          { name: "A", value: "a" },
          { name: "B", value: "b" },
        ]}
        onSubmit={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Pick tracks");
    expect(output).toContain("A");
    expect(output).toContain("B");
    expect(output).toContain("Space to select");

    unmount();
  });

  it("should submit pre-checked value on enter", () => {
    const onSubmit = vi.fn();
    const { stdin, unmount } = render(
      <CheckboxView
        message="Pick tracks"
        choices={[
          { name: "A", value: "a", checked: true },
          { name: "B", value: "b" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    stdin.write("\r");

    expect(onSubmit).toHaveBeenCalledWith(["a"]);
    unmount();
  });

  it("should submit both choices after toggle-all", async () => {
    const onSubmit = vi.fn();
    const instance = render(
      <CheckboxView
        message="Pick tracks"
        choices={[
          { name: "A", value: "a" },
          { name: "B", value: "b" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    await sendKey(instance, "a");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await sendKey(instance, "\r", false);

    const submitted = onSubmit.mock.calls[0]?.[0] as string[];
    expect(new Set(submitted)).toEqual(new Set(["a", "b"]));
    instance.unmount();
  });

  it("should show validation error when submit is invalid", async () => {
    const onSubmit = vi.fn();
    const instance = render(
      <CheckboxView
        message="Pick tracks"
        choices={[{ name: "A", value: "a" }]}
        validate={(values) =>
          values.length > 0 ? true : "Please select at least one"
        }
        onSubmit={onSubmit}
      />,
    );

    await sendKey(instance, "\r");

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("Please select at least one");
    expect(onSubmit).not.toHaveBeenCalled();
    instance.unmount();
  });
});
