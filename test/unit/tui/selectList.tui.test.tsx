import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { SelectListView } from "../../../src/tui/selectList.js";
import { sendKey } from "./inkTestUtils.js";

describe("SelectListView", () => {
  it("should render message and choices", () => {
    const { lastFrame, unmount } = render(
      <SelectListView
        message="Select an option"
        choices={[
          { name: "Option 1", value: "opt1" },
          { name: "Option 2", value: "opt2" },
        ]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Select an option");
    expect(output).toContain("Option 1");
    expect(output).toContain("Option 2");

    unmount();
  });

  it("should select the first option on enter by default", () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <SelectListView
        message="Select"
        choices={[
          { name: "Option 1", value: "opt1" },
          { name: "Option 2", value: "opt2" },
        ]}
        onSelect={onSelect}
      />,
    );

    stdin.write("\r");

    expect(onSelect).toHaveBeenCalledWith("opt1");
    unmount();
  });

  it("should select second option when pressing j then enter", async () => {
    const onSelect = vi.fn();
    const instance = render(
      <SelectListView
        message="Select"
        choices={[
          { name: "Option 1", value: "opt1" },
          { name: "Option 2", value: "opt2" },
        ]}
        onSelect={onSelect}
      />,
    );

    await sendKey(instance, "j");
    const movedOutput = instance.lastFrame() ?? "";
    expect(movedOutput).toContain("❯ Option 2");

    await new Promise((resolve) => setTimeout(resolve, 20));
    await sendKey(instance, "\r", false);

    expect(onSelect).toHaveBeenCalledWith("opt2");
    instance.unmount();
  });

  it("should render disabled separator and active description", () => {
    const { lastFrame, unmount } = render(
      <SelectListView
        message="Select"
        choices={[
          { name: "Option 1", value: "opt1", description: "first item" },
          { name: "--------", value: "sep", disabled: true },
          { name: "Option 2", value: "opt2" },
        ]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("--------");
    expect(output).toContain("first item");

    unmount();
  });
});
