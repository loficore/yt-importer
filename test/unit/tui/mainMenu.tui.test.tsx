import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  MainMenuView,
  type MainMenuAction,
} from "../../../src/tui/mainMenu.js";
import { sendKey } from "./inkTestUtils.js";

const testItems: { label: string; value: MainMenuAction }[] = [
  { label: "First", value: "new_import" },
  { label: "Second", value: "resume" },
];

describe("MainMenuView", () => {
  it("should render title and subtitle", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView
        title="YT Importer"
        subtitle="Import your playlists"
        items={[{ label: "Test", value: "new_import" }]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("YT Importer");
    expect(output).toContain("Import your playlists");

    unmount();
  });

  it("should render all menu items", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "New Import", value: "new_import" },
          { label: "Resume", value: "resume" },
          { label: "Settings", value: "settings" },
        ]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("New Import");
    expect(output).toContain("Resume");
    expect(output).toContain("Settings");

    unmount();
  });

  it("should call onSelect with correct value on enter", () => {
    const onSelect = vi.fn();
    const { stdin, unmount } = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[{ label: "Test", value: "new_import" }]}
        onSelect={onSelect}
      />,
    );

    stdin.write("\r");

    expect(onSelect).toHaveBeenCalledWith("new_import");
    unmount();
  });

  it("should highlight first item by default", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("❯ First");
    expect(output).not.toContain("❯ Second");

    unmount();
  });

  it("should navigate down with down arrow", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down arrow

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ Second");

    instance.unmount();
  });

  it("should navigate up with up arrow", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down arrow
    await sendKey(instance, "\u001b[A"); // up arrow

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ First");

    instance.unmount();
  });

  it("should navigate with j/k keys", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "j"); // vim-style down
    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ Second");

    instance.unmount();
  });

  it("should navigate with k key (up)", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "j"); // down
    await sendKey(instance, "k"); // up

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ First");

    instance.unmount();
  });

  it("should wrap around when navigating past last item", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[B"); // down
    await sendKey(instance, "\u001b[B"); // down again - should wrap to first

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ First");

    instance.unmount();
  });

  it("should wrap around when navigating before first item", async () => {
    const instance = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[
          { label: "First", value: "new_import" },
          { label: "Second", value: "resume" },
        ]}
        onSelect={() => {}}
      />,
    );

    await sendKey(instance, "\u001b[A"); // up - should wrap to last

    const output = instance.lastFrame() ?? "";
    expect(output).toContain("❯ Second");

    instance.unmount();
  });

  it("should render langLabel when provided", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView
        title="Test"
        subtitle="Subtitle"
        langLabel="🌐 EN"
        items={[{ label: "Test", value: "new_import" }]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("🌐 EN");

    unmount();
  });

  it("should render navigation hint", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView
        title="Test"
        subtitle=""
        items={[{ label: "Test", value: "new_import" }]}
        onSelect={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("↑/↓");
    expect(output).toContain("Enter");

    unmount();
  });

  it("should handle empty items array gracefully", () => {
    const { lastFrame, unmount } = render(
      <MainMenuView title="Test" subtitle="" items={[]} onSelect={() => {}} />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("Test");

    unmount();
  });
});
