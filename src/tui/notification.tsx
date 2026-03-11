import React, { useEffect, useState } from "react";
import { Box, Text, render } from "ink";

/**
 * 通知类型枚举（字符串字面量）。
 */
export type NotificationType = "success" | "error" | "info" | "warning";

/**
 * 通知组件的 props。
 */
interface NotificationProps {
  /** 通知类型 */
  type: NotificationType;
  /** 显示的消息文本 */
  message: string;
  /** 显示时长（毫秒），默认 2000 */
  duration?: number;
  /** 关闭时的可选回调 */
  onClose?: () => void;
}

/** 图标映射 */
const ICONS: Record<NotificationType, string> = {
  success: "✓",
  error: "✗",
  info: "ℹ",
  warning: "⚠",
};

/** 颜色映射（用于边框与文本颜色） */
const COLORS: Record<NotificationType, string> = {
  success: "green",
  error: "red",
  info: "cyan",
  warning: "yellow",
};

/**
 * 通知视图组件：显示一条带图标和颜色的简短通知并在超时后触发 `onClose`。
 * @param {NotificationProps} props 组件 props
 * @returns {React.JSX.Element} 渲染的通知元素
 */
export function NotificationView({
  type,
  message,
  duration = 2000,
  onClose,
}: NotificationProps): React.JSX.Element {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 100);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) {
    return <></>;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={COLORS[type]}
      paddingX={1}
      paddingY={0}
    >
      <Text color={COLORS[type]}>
        {ICONS[type]} {message}
      </Text>
    </Box>
  );
}

/**
 * 在终端显示一条通知并在关闭后解析。
 * @param {object} params - 包含通知参数的对象。
 * @param {NotificationType} params.type - 通知类型（success、error、info、warning）。
 * @param {string} params.message - 显示的消息文本。
 * @param {number} [params.duration] - 显示时长（毫秒），默认为 2000。
 * @returns {Promise<void>} 在通知关闭后解析
 */
export async function showNotification(params: {
  /** 通知类型（success、error、info、warning）。 */
  type: NotificationType;
  /** 显示的消息文本。 */
  message: string;
  /** 显示时长（毫秒），默认为 2000。 */
  duration?: number;
}): Promise<void> {
  console.clear();

  return new Promise<void>((resolve) => {
    const { unmount } = render(
      <NotificationView
        type={params.type}
        message={params.message}
        duration={params.duration}
        onClose={() => {
          unmount();
          setTimeout(() => resolve(), 150);
        }}
      />,
    );
  });
}

/**
 * 快速显示成功通知。
 * @param {string} message - 显示的消息文本。
 * @param {number} [duration] - 显示时长（毫秒），默认为 2000。
 * @returns {Promise<void>} 在通知关闭后解析
 */
export async function showSuccess(
  message: string,
  duration?: number,
): Promise<void> {
  return showNotification({ type: "success", message, duration });
}

/**
 * 快速显示错误通知（默认时长 3000ms）。
 * @param {string} message - 显示的消息文本。
 * @param {number} [duration] - 显示时长（毫秒），默认为 3000。
 * @returns {Promise<void>} 在通知关闭后解析
 */
export async function showError(
  message: string,
  duration?: number,
): Promise<void> {
  return showNotification({
    type: "error",
    message,
    duration: duration ?? 3000,
  });
}

/**
 * 快速显示信息通知。
 * @param {string} message - 显示的消息文本。
 * @param {number} [duration] - 显示时长（毫秒），默认为 2000。
 * @returns {Promise<void>} 在通知关闭后解析
 */
export async function showInfo(
  message: string,
  duration?: number,
): Promise<void> {
  return showNotification({ type: "info", message, duration });
}

/**
 * 快速显示警告通知（默认时长 2500ms）。
 * @param {string} message - 显示的消息文本。
 * @param {number} [duration] - 显示时长（毫秒），默认为 2500。
 * @returns {Promise<void>} 在通知关闭后解析
 */
export async function showWarning(
  message: string,
  duration?: number,
): Promise<void> {
  return showNotification({
    type: "warning",
    message,
    duration: duration ?? 2500,
  });
}
