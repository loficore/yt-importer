# YouTube Music Importer - TODO

## 待实现功能

### 健壮性和可靠性

#### 错误处理增强

- [x] 区分可重试错误和不可重试错误（SearchUtils 已实现）

#### 数据一致性

- [x] 统一进度存储（SQLite）
- [x] 进度文件自动清理
  - [x] 手动清理命令（设置页）
  - [x] 清理前确认提示

### 功能扩展

#### 批量操作

- [ ] 失败曲目批量重试
  - [ ] 批量选择失败歌曲
  - [ ] 批量使用不同搜索策略重试
- [ ] 歌曲去重工具（CSV 文件内去重）

#### 搜索增强

- [ ] 搜索艺术家专辑页再找歌曲
  - [ ] 先搜索艺术家
  - [ ] 从艺术家页面中定位歌曲
- [ ] 相似歌曲推荐
  - [ ] 利用 YouTube 的推荐算法
  - [ ] 作为备选搜索策略

### 运维工具

- [ ] 健康检查命令（检查 cookies、代理、网络）
- [ ] CSV 验证工具（导入前检查文件格式）
- [ ] 配置导出/导入（备份和迁移配置）

### 数据管理

- [ ] 导入历史记录（记录每次导入的详情）

### 测试覆盖

- [x] 类型定义测试（types/index.ts）
- [x] 匹配算法测试（matcher.ts）- 50+ 测试用例
- [x] CSV 解析测试（csvParser.ts）
- [x] 导入器测试（importer.ts）
- [x] 配置管理测试（config.ts）
- [x] 数据库测试（db.ts）
- [x] 国际化测试（i18n.ts）
- [x] 搜索缓存测试（searchCache.ts）
- [x] Cookies 处理测试（cookies.ts）
- [x] 代理测试（proxy.ts）
- [x] 文件监视测试（fileWatcher.ts）
- [x] TUI 组件测试（所有 15 个组件）
  - [x] checkbox 组件测试
  - [x] confirm 组件测试
  - [x] errorDialog 组件测试
  - [x] importCookies 组件测试
  - [x] importSummary 组件测试
  - [x] lowConfidenceResolver 组件测试
  - [x] mainMenu 组件测试
  - [x] notification 组件测试
  - [x] pressKey 组件测试
  - [x] progress 组件测试
  - [x] proxyTestResult 组件测试
  - [x] selectList 组件测试
  - [x] textInput 组件测试
  - [x] viewFailed 组件测试
  - [x] viewProgress 组件测试
- [ ] Searcher 模块测试（需要 Mock youtubei.js）
- [ ] CLI 交互测试（需要 Mock TUI）
- [ ] 集成测试
- [ ] 性能测试

### 代码质量

- [x] 配置统一管理（ImporterConfigSchema 已实现）
- [x] 常量统一管理
  - [x] 创建 constants.ts 文件
  - [x] 魔法数字替换
- [ ] 依赖注入重构
  - [ ] 引入轻量级 DI 容器
  - [ ] 类之间解耦
  - [ ] 便于单元测试

### 性能和优化

- [x] 并发控制
  - [x] 添加并发配置项（concurrency, searchQps）
  - [x] 实现 RateLimiter 限流器
  - [x] 实现 ConcurrentSearcher 并发搜索器
  - [x] 修改 Importer 集成并发处理
  - [ ] 动态调整策略
- [ ] 数据库写入优化
  - [ ] 批量写入进度
  - [ ] 减少保存频率
- [ ] 内存优化
  - [ ] 大 CSV 文件流式处理
  - [ ] 分块处理避免 OOM

### 国际化 (i18n)

- [x] 提取 importer.ts 硬编码文本
- [x] 提取 searcher.ts 硬编码文本
- [x] 提取 db.ts 硬编码文本
- [x] 提取 csvParser.ts 硬编码文本
- [x] 提取 cookies.ts 硬编码文本
- [x] 新增翻译验证脚本 (scripts/validate-i18n.ts)
- [x] 继续提取其他模块硬编码文本

### 日志系统

- [x] Logger 类重构
- [x] 级别过滤（DEBUG/INFO/WARN/ERROR）
- [x] Console + 文件双输出
- [x] Emoji 前缀
- [x] 配置文件集成（logLevel）
- [x] matcher.ts 日志
- [x] csvParser.ts 日志
- [x] searcher.ts 日志
- [x] concurrentSearcher.ts 日志

## 已完成功能

### Phase 1: 基础架构 ✅

- [x] 项目初始化
- [x] 依赖安装
- [x] 类型定义
- [x] TODO 文档

### Phase 2: 核心模块 ✅

- [x] CSV 解析器
- [x] 搜索模块
- [x] 匹配算法
- [x] 导入逻辑
- [x] 断点续传

### Phase 3: 用户体验 ✅

- [x] 交互式 CLI（TUI 界面）
- [x] 确认流程
- [x] 智能重试与 fallback 查询
- [x] 搜索缓存
- [x] 菜单导航改进（支持返回主菜单）
- [x] 进度条显示
- [x] 查看进度 TUI 界面（支持翻页）
- [x] 查看失败歌曲 TUI 界面（支持翻页）
- [x] 实时统计面板（TUI 界面，支持翻页）
- [x] 置信度分布可视化
- [x] 导入报告生成（JSON/Markdown/HTML）
- [x] 详细日志系统（文件日志，按日期归档）
- [x] 日志级别控制（DEBUG/INFO/WARN/ERROR）
- [x] Console + 文件双输出
- [x] Emoji 前缀

### Phase 4: 稳定性优化 ✅

- [x] 错误处理和重试机制（指数退避、429 检测）
- [x] 搜索缓存（SQLite 基础缓存）
- [x] 缓存过期策略（TTL）
- [x] 认证错误区分

### Phase 5: 高级功能 ✅

- [x] 增量导入到已有歌单
- [x] 批量导入多个 CSV 文件
- [x] 跨播放列表去重（增量导入时自动过滤已存在歌曲）
- [x] 低置信度统一处理流程
- [x] 手动选择搜索结果

### Phase 6: 匹配算法优化 ✅

- [x] 多语言特殊字符处理（中文、日文、全角/半角）
- [x] 同义词识别（feat./ft./featuring/&/and/+）
- [x] 混音版本智能识别（Remix/Original Mix/Radio Edit）

## 已修复问题

- [x] 歌单列表获取（LockupView 类型解析）
- [x] 歌单歌曲数量显示
- [x] UI 界面清空终端问题
- [x] ESC 键退出 TUI 界面
- [x] CLI 代码拆分（app.ts 1240行 → 120行）
- [x] 低置信度解决界面 q 键退出增加确认对话框
- [x] i18n 翻译文件路径问题（使用 process.cwd() 替代 import.meta.url）
- [x] searchCache cleanupExpiredCaches() bug（修复 db.run 返回值处理）
- [x] 测试框架更新（vitest 兼容性问题修复）
- [x] 日志系统增强（Console 输出、Emoji、级别过滤）
- [x] 继续导入功能修复（promptSelectList 返回值解构问题）
- [x] 继续导入添加状态确认对话框（running 已完成/running 未完成/completed 三种情况）
