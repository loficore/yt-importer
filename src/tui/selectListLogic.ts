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

/**
 * 选择列表的输入键定义，支持箭头键和 Vim 风格的 hjkl 键。
 */
export interface SelectListKey {
  /** 上箭头或 Vim 的 k 键 */
  upArrow?: boolean;
  /** 下箭头或 Vim 的 j 键 */
  downArrow?: boolean;
  /** 回车键 */
  return?: boolean;
}

/** 选择列表的输入动作类型 */
export type SelectListInputAction = "up" | "down" | "select" | "none";

/** 可渲染的选择列表选项 */
export interface RenderableSelectListChoice<
  T = string,
> extends SelectListChoice<T> {
  /** 当前选项是否处于激活状态（即被选中）。 */
  active: boolean;
}

/**
 * 返回所有可选项，忽略被禁用的分隔项。
 * @template T
 * @param {SelectListChoice<T>[]} choices  选择列表的所有选项
 * @returns {SelectListChoice<T>} 仅包含可选项的数组
 */
export function getEnabledChoices<T>(
  choices: SelectListChoice<T>[],
): SelectListChoice<T>[] {
  return choices.filter((choice) => !choice.disabled);
}

/**
 * 将输入映射成选择列表动作，便于在不依赖 Ink 的情况下测试。
 * @param {string} input  输入的字符串
 * @param {SelectListKey} key  选择列表的输入键
 * @returns {SelectListInputAction} 映射后的输入动作
 */
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

/**
 * 根据方向移动当前选中索引。
 * @param {number} currentIndex  当前选中的索引
 * @param {number} enabledCount  可选项的总数
 * @param {("up" | "down")} direction  移动方向
 * @param {boolean} loop  是否循环移动
 * @returns {number} 移动后的索引
 */
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

/**
 * 返回当前索引对应的可选项。
 * @template T
 * @param {SelectListChoice<T>[]} choices  选择列表的所有选项
 * @param {number} selectedIndex  选中的索引
 * @returns {SelectListChoice<T> | undefined} 对应的可选项或 undefined
 */
export function getSelectedChoice<T>(
  choices: SelectListChoice<T>[],
  selectedIndex: number,
): SelectListChoice<T> | undefined {
  if (selectedIndex < 0) {
    return undefined;
  }

  return getEnabledChoices(choices)[selectedIndex];
}

/**
 * 计算每个选项当前的渲染状态，供 UI 层直接消费。
 * @template T
 * @param {SelectListChoice<T>[]} choices  选择列表的所有选项
 * @param {number} selectedIndex  选中的索引
 * @returns {RenderableSelectListChoice<T>[]} 渲染状态数组
 */
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
