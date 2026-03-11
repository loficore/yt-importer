/** 选择列表的选项定义 */
export interface SelectListChoice<T = string> {
  /** 选项名称 */
  name: string;
  /** 选项值 */
  value: T;
  /** 是否禁用 */
  disabled?: boolean;
  /** 选项描述 */
  description?: string;
}

export interface SelectListKey {
  upArrow?: boolean;
  downArrow?: boolean;
  return?: boolean;
}

export type SelectListInputAction = "up" | "down" | "select" | "none";

export interface RenderableSelectListChoice<T = string>
  extends SelectListChoice<T> {
  active: boolean;
}

/** 返回所有可选项，忽略被禁用的分隔项。 */
export function getEnabledChoices<T>(
  choices: SelectListChoice<T>[],
): SelectListChoice<T>[] {
  return choices.filter((choice) => !choice.disabled);
}

/** 将输入映射成选择列表动作，便于在不依赖 Ink 的情况下测试。 */
export function getInputAction(
  input: string,
  key: SelectListKey,
): SelectListInputAction {
  if (key.upArrow || input === "k") {
    return "up";
  }

  if (key.downArrow || input === "j") {
    return "down";
  }

  if (key.return) {
    return "select";
  }

  return "none";
}

/** 根据方向移动当前选中索引。 */
export function moveSelection(
  currentIndex: number,
  enabledCount: number,
  direction: "up" | "down",
  loop = false,
): number {
  if (enabledCount <= 0) {
    return -1;
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), enabledCount - 1);

  if (direction === "up") {
    if (loop) {
      return (safeIndex - 1 + enabledCount) % enabledCount;
    }
    return Math.max(0, safeIndex - 1);
  }

  if (loop) {
    return (safeIndex + 1) % enabledCount;
  }

  return Math.min(enabledCount - 1, safeIndex + 1);
}

/** 返回当前索引对应的可选项。 */
export function getSelectedChoice<T>(
  choices: SelectListChoice<T>[],
  selectedIndex: number,
): SelectListChoice<T> | undefined {
  if (selectedIndex < 0) {
    return undefined;
  }

  return getEnabledChoices(choices)[selectedIndex];
}

/** 计算每个选项当前的渲染状态，供 UI 层直接消费。 */
export function getRenderableChoices<T>(
  choices: SelectListChoice<T>[],
  selectedIndex: number,
): RenderableSelectListChoice<T>[] {
  let enabledIndex = 0;

  return choices.map((choice) => {
    if (choice.disabled) {
      return {
        ...choice,
        active: false,
      };
    }

    const active = enabledIndex === selectedIndex;
    enabledIndex += 1;

    return {
      ...choice,
      active,
    };
  });
}