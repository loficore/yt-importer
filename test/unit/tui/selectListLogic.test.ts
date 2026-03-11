import { describe, expect, it } from "vitest";
import {
  getEnabledChoices,
  getInputAction,
  getRenderableChoices,
  getSelectedChoice,
  moveSelection,
} from "../../../src/tui/selectListLogic.js";

describe("selectListLogic.ts", () => {
  describe("getEnabledChoices", () => {
    it("should filter out disabled choices", () => {
      const choices = [
        { name: "Option 1", value: "opt1" },
        { name: "──────────", value: "sep", disabled: true },
        { name: "Option 2", value: "opt2" },
      ];

      expect(getEnabledChoices(choices)).toEqual([
        { name: "Option 1", value: "opt1" },
        { name: "Option 2", value: "opt2" },
      ]);
    });
  });

  describe("getInputAction", () => {
    it("should map up inputs", () => {
      expect(getInputAction("k", {})).toBe("up");
      expect(getInputAction("", { upArrow: true })).toBe("up");
    });

    it("should map down inputs", () => {
      expect(getInputAction("j", {})).toBe("down");
      expect(getInputAction("", { downArrow: true })).toBe("down");
    });

    it("should map return input", () => {
      expect(getInputAction("", { return: true })).toBe("select");
    });

    it("should ignore unrelated inputs", () => {
      expect(getInputAction("x", {})).toBe("none");
    });
  });

  describe("moveSelection", () => {
    it("should not move above first option when loop is disabled", () => {
      expect(moveSelection(0, 3, "up", false)).toBe(0);
    });

    it("should not move below last option when loop is disabled", () => {
      expect(moveSelection(2, 3, "down", false)).toBe(2);
    });

    it("should wrap upward when loop is enabled", () => {
      expect(moveSelection(0, 3, "up", true)).toBe(2);
    });

    it("should wrap downward when loop is enabled", () => {
      expect(moveSelection(2, 3, "down", true)).toBe(0);
    });

    it("should return -1 when there are no enabled choices", () => {
      expect(moveSelection(0, 0, "down", false)).toBe(-1);
    });
  });

  describe("getSelectedChoice", () => {
    const choices = [
      { name: "Option 1", value: "opt1" },
      { name: "──────────", value: "sep", disabled: true },
      { name: "Option 2", value: "opt2" },
    ];

    it("should return selected enabled choice", () => {
      expect(getSelectedChoice(choices, 1)).toEqual({
        name: "Option 2",
        value: "opt2",
      });
    });

    it("should return undefined for invalid index", () => {
      expect(getSelectedChoice(choices, -1)).toBeUndefined();
      expect(getSelectedChoice(choices, 9)).toBeUndefined();
    });
  });

  describe("getRenderableChoices", () => {
    it("should mark only the selected enabled item as active", () => {
      const choices = [
        { name: "Option 1", value: "opt1" },
        { name: "──────────", value: "sep", disabled: true },
        { name: "Option 2", value: "opt2", description: "second" },
      ];

      expect(getRenderableChoices(choices, 1)).toEqual([
        { name: "Option 1", value: "opt1", active: false },
        { name: "──────────", value: "sep", disabled: true, active: false },
        {
          name: "Option 2",
          value: "opt2",
          description: "second",
          active: true,
        },
      ]);
    });
  });
});