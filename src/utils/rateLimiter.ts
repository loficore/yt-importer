/**
 * 速率限制器类，用于控制搜索请求的速率
 */
export class RateLimiter {
  private searchQPS: number;
  private tokens: number;
  private maxTokens: number;
  private lastRefillTime: number;
  private refillInterval: number;

  /**
   * 构造函数，初始化速率限制器
   */
  constructor() {
    this.searchQPS = 0;
    this.tokens = 0;
    this.maxTokens = 0;
    this.lastRefillTime = 0;
    this.refillInterval = 0;
  }

  /**
   * 初始化速率限制器
   * @param {number} searchQPS 每秒允许的搜索请求数
   */
  init(searchQPS: number) {
    // 初始化速率限制器
    this.searchQPS = searchQPS;
    this.maxTokens = searchQPS; // 最大令牌数
    this.tokens = this.maxTokens; // 当前令牌数
    this.lastRefillTime = Date.now(); // 上次补充令牌的时间
    this.refillInterval = 1000 / searchQPS; // 补充令牌的时间间隔（毫秒）
  }

  /**
   * 获取令牌
   */
  async wait(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.lastRefillTime;
      const addedTokens = Math.floor(
        (elapsed / this.refillInterval) * this.searchQPS,
      );

      if (addedTokens > 0) {
        this.tokens = Math.min(this.tokens + addedTokens, this.maxTokens);
        this.lastRefillTime = now;
      }

      if (this.tokens > 0) {
        this.tokens--;
        return;
      }

      // 如果没有令牌，等待一段时间后重试
      if (this.tokens <= 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }
}
