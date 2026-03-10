import { readFile } from "fs/promises";
import { t } from "./i18n.js";

/**
 * Cookie条目接口
 */
export interface CookieEntry {
  /** Cookie名称 */
  name: string;
  /** Cookie值 */
  value: string;
  /** Cookie域 */
  domain?: string;
  /** Cookie路径 */
  path?: string;
  /** Cookie过期时间（Unix时间戳） */
  expires?: number;
  /** 是否为HttpOnly Cookie */
  httpOnly?: boolean;
  /** 是否为Secure Cookie */
  secure?: boolean;
  /** SameSite属性 */
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * 加载并解析Cookie文件
 * @param {string} source Cookie文件内容
 * @param {"json" | "text" | "auto"} mode 解析模式
 * @returns {Promise<CookieEntry[]>} 解析后的CookieEntry数组
 */
export const loadCookieHeader = async (
  source: string,
  mode: "json" | "text" | "auto" = "auto",
): Promise<string> => {
  try {
    const raw = await readFile(source, { encoding: "utf-8" });
    const trimmed = raw.trim();
    const resolvedMode =
      mode === "auto" ? (trimmed.startsWith("[") ? "json" : "text") : mode;

    if (resolvedMode === "text") {
      if (!validateCookieHeader(trimmed)) {
        throw new Error("Cookie请求头无效或长度异常");
      }
      return trimmed;
    }

    const parsedCookies = parseCookieJson(trimmed);
    const filteredCookies = filterYoutubeCookies(parsedCookies);
    const dedupedCookies = dedupeCookies(filteredCookies);
    const header = buildCookiesHeader(dedupedCookies);

    if (!validateCookieHeader(header)) {
      throw new Error("Cookie请求头无效或长度异常");
    }

    return header;
  } catch (e) {
    console.error(t("error_cookies_read_file"));
    return Promise.reject(
      new Error(t("error_cookies_read_file"), { cause: e }),
    );
  }
};

/**
 *  解析JSON格式的Cookie字符串
 * @param {string} raw 原始的JSON格式Cookie字符串
 * @returns {Promise<CookieEntry[]>} 解析后的CookieEntry数组
 */
const parseCookieJson = (raw: string): CookieEntry[] => {
  let cookiesData: unknown;
  try {
    cookiesData = JSON.parse(raw);
  } catch (e) {
    console.error(t("error_cookies_parse_json"));
    throw new Error(t("error_cookies_parse_json"), { cause: e });
  }

  if (!Array.isArray(cookiesData)) {
    console.error(t("error_cookies_not_array"));
    throw new Error(t("error_cookies_not_array"), {
      cause: cookiesData,
    });
  }

  const parsedCookies: CookieEntry[] = [];
  for (const cookie of cookiesData) {
    if (typeof cookie !== "object" || cookie === null) {
      console.error(t("error_cookies_item_not_object"));
      throw new Error(t("error_cookies_item_not_object"), {
        cause: cookie,
      });
    }

    const candidate = cookie as CookieEntry;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.value !== "string"
    ) {
      console.error(t("error_cookies_missing_field", { field: "name/value" }));
      throw new Error(
        t("error_cookies_missing_field", { field: "name/value" }),
        { cause: candidate },
      );
    }

    parsedCookies.push({
      name: candidate.name,
      value: candidate.value,
      domain: candidate.domain || undefined,
      path: candidate.path || undefined,
      expires: candidate.expires || undefined,
      httpOnly: candidate.httpOnly || undefined,
      secure: candidate.secure || undefined,
      sameSite: candidate.sameSite || undefined,
    });
  }

  return parsedCookies;
};

/**
 * 过滤并规范化YouTube相关的Cookie
 * @param {CookieEntry[]} entries 原始的CookieEntry数组
 * @returns {Promise<CookieEntry[]>} 过滤并规范化后的CookieEntry数组
 */
export const filterYoutubeCookies = (entries: CookieEntry[]): CookieEntry[] => {
  const normalizedCookies: CookieEntry[] = entries
    .map((cookie) => ({
      ...cookie,
      domain: cookie.domain?.toLowerCase().trim(),
    }))
    .filter((cookie) => {
      if (typeof cookie.domain !== "string") {
        return false;
      }

      const domain = cookie.domain;
      return (
        domain === "youtube.com" ||
        domain === "ytmusic.com" ||
        domain.endsWith(".youtube.com") ||
        domain.endsWith(".ytmusic.com")
      );
    });

  return normalizedCookies;
};

/**
 * 去重Cookie数组，保留第一个出现的Cookie
 * @param {CookieEntry[]} entries 原始的CookieEntry数组
 * @returns {CookieEntry[]} 去重后的CookieEntry数组
 */
export const dedupeCookies = (entries: CookieEntry[]): CookieEntry[] => {
  const indexByName = new Map<string, number>();
  const deduped: CookieEntry[] = [];

  for (const cookie of entries) {
    const identifier = cookie.name;
    const existingIndex = indexByName.get(identifier);

    if (existingIndex === undefined) {
      indexByName.set(identifier, deduped.length);
      deduped.push(cookie);
    } else {
      deduped[existingIndex] = cookie;
    }
  }

  return deduped;
};

/**
 * 构建Cookie请求头字符串
 * @param {CookieEntry[]} entries CookieEntry数组
 * @returns {string} 构建后的Cookie请求头字符串
 */
export const buildCookiesHeader = (entries: CookieEntry[]): string => {
  return entries.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
};

/**
 * 验证Cookie请求头字符串的有效性
 * @param {string} header Cookie请求头字符串
 * @returns {boolean} 是否为有效的Cookie请求头字符串
 */
export const validateCookieHeader = (header: string): boolean => {
  if (
    typeof header !== "string" ||
    header.trim() === "" ||
    header.length < 5 ||
    header.length > 8192
  ) {
    return false;
  }
  return true;
};
