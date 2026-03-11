import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { ProxyTestResultView } from "../../../src/tui/proxyTestResult.js";

describe("ProxyTestResultView", () => {
  const successResult = {
    success: true,
    status: "200",
    message: "Connection successful",
    latency: 150,
  };

  const failureResult = {
    success: false,
    status: "ETIMEDOUT",
    message: "Connection timeout",
  };

  it("should render success message when test succeeds", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("测试成功");

    unmount();
  });

  it("should render failure message when test fails", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={failureResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("测试失败");

    unmount();
  });

  it("should render test type for direct connection", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("测试类型: 直连测试");

    unmount();
  });

  it("should render test type for proxy connection", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="proxy"
        proxyUrl="http://proxy.example.com:8080"
        result={successResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("测试类型: 代理测试");
    expect(output).toContain("http://proxy.example.com:8080");

    unmount();
  });

  it("should render status", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={failureResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("状态: ETIMEDOUT");

    unmount();
  });

  it("should render message", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={failureResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("消息: Connection timeout");

    unmount();
  });

  it("should render latency when provided", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("响应时间: 150ms");

    unmount();
  });

  it("should not render latency when not provided", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={{ success: true, status: "200", message: "OK" }}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).not.toContain("响应时间");

    unmount();
  });

  it("should render navigation hint", () => {
    const { lastFrame, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={() => {}}
      />,
    );

    const output = lastFrame() ?? "";
    expect(output).toContain("按任意键返回");

    unmount();
  });

  it("should call onBack when q is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={onBack}
      />,
    );

    stdin.write("q");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when escape is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={onBack}
      />,
    );

    stdin.write("\u001b");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("should call onBack when enter is pressed", () => {
    const onBack = vi.fn();
    const { stdin, unmount } = render(
      <ProxyTestResultView
        testType="direct"
        result={successResult}
        onBack={onBack}
      />,
    );

    stdin.write("\r");

    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });
});
