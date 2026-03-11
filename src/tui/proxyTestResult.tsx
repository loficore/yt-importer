import React from "react";
import { Box, Text, render, useInput } from "ink";

/**
 * `ProxyTestResultView` 组件的 props 定义。
 */
interface ProxyTestResultProps {
  /** 测试类型：直连或代理 */
  testType: "direct" | "proxy";
  /** 代理地址（仅在代理测试时有效） */
  proxyUrl?: string;
  /** 测试结果 */
  result: {
    /** 测试是否成功 */
    success: boolean;
    /** HTTP 状态码或其他状态描述 */
    status: string;
    /**  结果消息，供 UI 显示 */
    message: string;
    /** 可选的响应时间（毫秒） */
    latency?: number;
  };
  /** 用户按键返回的回调函数 */
  onBack: () => void;
}

/**
 * `ProxyTestResultView` 组件：用于显示代理测试结果。
 * @param {ProxyTestResultProps} param0 组件 props
 * @returns {React.JSX.Element} 渲染的代理测试结果视图元素
 */
export function ProxyTestResultView({
  testType,
  proxyUrl,
  result,
  onBack,
}: ProxyTestResultProps): React.JSX.Element {
  useInput((input, key) => {
    if (input === "q" || key.escape || key.return) {
      onBack();
    }
  });

  const title = testType === "direct" ? "直连测试" : "代理测试";

  return (
    <Box
      flexDirection="column"
      gap={1}
      padding={1}
      borderStyle="round"
      borderColor={result.success ? "green" : "red"}
    >
      <Text bold color={result.success ? "green" : "red"}>
        {result.success ? "✅ 测试成功" : "❌ 测试失败"}
      </Text>
      <Text dimColor>{"─".repeat(40)}</Text>

      <Box flexDirection="column" gap={0}>
        <Text>测试类型: {title}</Text>
        {proxyUrl && <Text>代理地址: {proxyUrl}</Text>}
        <Text>状态: {result.status}</Text>
        <Text>消息: {result.message}</Text>
        {result.latency && <Text>响应时间: {result.latency}ms</Text>}
      </Box>

      <Text dimColor>{"─".repeat(40)}</Text>
      <Text dimColor>按任意键返回</Text>
    </Box>
  );
}

/**
 * 显示代理测试结果的 TUI。
 * @param {("direct" | "proxy")} testType 测试类型
 * @param {string | undefined} proxyUrl 代理地址（仅在代理测试时有效）
 * @param {object} result 测试结果
 * @param {boolean} result.success 测试是否成功
 * @param {string} result.status HTTP 状态码或其他状态描述
 * @param {string} result.message 结果消息，供 UI 显示
 * @param {number} [result.latency] 可选的响应时间（毫秒）
 * @returns {Promise<void>} 异步操作完成的 Promise
 */
export async function showProxyTestResult(
  testType: "direct" | "proxy",
  proxyUrl: string | undefined,
  result: {
    /** 测试是否成功 */
    success: boolean;
    /** HTTP 状态码或其他状态描述 */
    status: string;
    /** 结果消息，供 UI 显示 */
    message: string;
    /** 可选的响应时间（毫秒） */
    latency?: number;
  },
): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <ProxyTestResultView
        testType={testType}
        proxyUrl={proxyUrl}
        result={result}
        onBack={() => {
          unmount();
          setTimeout(() => resolve(), 100);
        }}
      />,
    );
  });
}
