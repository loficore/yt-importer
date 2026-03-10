import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { logger } from "@utils/logger.js";

/** 代理检查结果 */
export interface ProxyCheckResult {
  /** 代理是否成功连接 */
  success: boolean;
  /** 连接状态*/
  status: "connected" | "blocked" | "captcha" | "failed";
  /** 代理状态信息 */
  message: string;
  /** 连接延迟（毫秒） */
  latency?: number;
}

/**
 * 测试代理连接到YouTube的可用性
 * @param {string} proxyUrl 代理URL，格式为 http://host:port 或 https://host:port
 * @param {number} timeout 超时时间（毫秒），默认为10000ms
 * @returns {Promise<ProxyCheckResult>} 代理检查结果对象
 */
export async function testProxyConnection(
  proxyUrl: string,
  timeout = 10000,
): Promise<ProxyCheckResult> {
  if (!proxyUrl) {
    return { success: false, status: "failed", message: "Proxy URL is empty" };
  }

  const agent = new HttpsProxyAgent(proxyUrl);
  const startTime = Date.now();

  try {
    const response = await axios.get("https://www.youtube.com/", {
      httpsAgent: agent,
      proxy: false,
      timeout,
      maxRedirects: 5,
      validateStatus:
        /**
         * 计算状态码是否在200-499范围内，允许处理403和其他错误状态以提供更详细的反馈
         * @param {number} status HTTP状态码
         * @returns {boolean} 是否在有效范围内
         */
        (status) => status >= 200 && status < 500,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const latency = Date.now() - startTime;
    const responseObj = response.request as {
      /** 返回*/
      res?: {
        /** 返回的url链接 */
        responseUrl?: string;
      };
    };
    const finalUrl = responseObj.res?.responseUrl || "";

    if (finalUrl.includes("google.com/sorry")) {
      logger.warn(`Proxy CAPTCHA detected: ${proxyUrl}`);
      return {
        success: false,
        status: "captcha",
        message: "Rate limited: Google CAPTCHA detected",
        latency,
      };
    }

    if (response.status === 200) {
      logger.info(`Proxy test successful: ${proxyUrl}`, { latency });
      return {
        success: true,
        status: "connected",
        message: "Access successful",
        latency,
      };
    } else if (response.status === 403) {
      return {
        success: false,
        status: "blocked",
        message: "IP is blocked (403 Forbidden)",
        latency,
      };
    }

    return {
      success: false,
      status: "failed",
      message: `Unexpected status code: ${response.status}`,
      latency,
    };
  } catch (error) {
    const err = error as {
      /** HTTP状态码 */
      code?: string;
      /** 错误信息 */
      message?: string;
    };
    let message = "Unknown error";

    if (err.code === "ECONNABORTED") message = "Connection timeout";
    else if (err.code === "ECONNREFUSED") message = "Proxy connection refused";
    else if (err.code === "ECONNRESET")
      message =
        "Connection reset by proxy (proxy may be blocking or unable to reach target)";
    else if (err.code === "EPROTO")
      message = "Protocol error (Check if proxy type is correct)";
    else if (err.code === "ERR_TLS_CERT_ALTNAME_INVALID")
      message = "TLS certificate error (try using http instead of https)";
    else if (err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE")
      message =
        "Certificate verification failed (proxy may be using self-signed cert)";
    else if (err.message?.includes("certificate"))
      message =
        "Certificate error (check proxy settings or try a different proxy)";
    else if (err.message) message = err.message;

    logger.warn(`Proxy test failed: ${proxyUrl}`, { error: message });

    return {
      success: false,
      status: "failed",
      message,
    };
  }
}

/**
 * 测试直接连接到YouTube的可用性（不使用代理）
 * @param {number} timeout 超时时间（毫秒），默认为10000ms
 * @returns {Promise<ProxyCheckResult>} 直接连接测试结果对象
 */
export async function testDirectConnection(
  timeout = 10000,
): Promise<ProxyCheckResult> {
  const startTime = Date.now();

  try {
    const response = await axios.get("https://www.youtube.com/", {
      timeout,
      maxRedirects: 5,
      validateStatus:
        /**
         * 计算状态码是否在200-499范围内，允许处理403和其他错误状态以提供更详细的反馈
         * @param {number} status HTTP状态码
         * @returns {boolean} 是否在有效范围内
         */
        (status) => status >= 200 && status < 500,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const latency = Date.now() - startTime;
    const responseObj = response.request as {
      /** 返回   */
      res?: {
        /** 返回的url链接 */
        responseUrl?: string;
      };
    };
    const finalUrl = responseObj.res?.responseUrl || "";

    if (finalUrl.includes("google.com/sorry")) {
      return {
        success: false,
        status: "captcha",
        message: "Rate limited: Google CAPTCHA detected",
        latency,
      };
    }

    if (response.status === 200) {
      return {
        success: true,
        status: "connected",
        message: "Access successful",
        latency,
      };
    }

    return {
      success: false,
      status: "failed",
      message: `HTTP ${response.status}`,
      latency,
    };
  } catch (error) {
    const err = error as {
      /** HTTP状态码 */
      code?: string;
      /** 错误消息 */
      message?: string;
    };
    let message = "Unknown error";

    if (err.code === "ECONNABORTED") message = "Connection timeout";
    else if (err.code === "ECONNREFUSED") message = "Connection refused";
    else if (err.code === "ECONNRESET")
      message = "Connection reset (network may be blocked or unstable)";
    else if (err.code === "ERR_TLS_CERT_ALTNAME_INVALID")
      message = "TLS certificate error (network issue)";
    else if (err.message) message = err.message;

    return {
      success: false,
      status: "failed",
      message,
    };
  }
}
