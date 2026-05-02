# 📝 面试回答生成器小程序 - 开发记录文档

> 本文档与 `req.md`（需求文档）并列，用于记录开发过程、技术决策和待办事项。

---

## 一、项目信息

| 项 | 内容 |
|----|------|
| 项目名称 | 面试回答生成器小程序 |
| 开发阶段 | MVP v1.0 + v1.1 增强功能 + v1.2 爆款功能 |
| 技术栈 | 微信小程序原生 + 微信云开发 |
| AI 模型 | DeepSeek（深度求索） |
| 启动日期 | 2026-05-01 |

---

## 二、开发进度

### ✅ 已完成

#### 2026-05-01（MVP v1.0）
- [x] 阅读并理解需求文档 `req.md`
- [x] 与用户确认 MVP 范围、技术选型（DeepSeek + 云开发）
- [x] 检查项目结构（基于微信云开发 QuickStart 模板）
- [x] 创建开发记录文档 `dev-log.md`
- [x] 编写 `generateAnswer` 云函数（AI 生成核心逻辑）
- [x] 编写 `quota` 云函数（次数管理：查询、检查、扣除）
- [x] 创建数据库集合初始化逻辑（`usage`、`quota`）
- [x] 重写首页（输入页）`pages/index`
- [x] 新建结果页 `pages/result`
- [x] 更新 `app.json`（页面路由、导航栏配置）
- [x] 更新 `app.js`（云开发环境提示）
- [x] 更新 `app.wxss`（全局样式优化）
- [x] 代码审查与文档更新

#### 2026-05-01（v1.1 增强功能）
- [x] 升级 `generateAnswer` 云函数 Prompt，增加评分（score）和推荐问题（recommendQuestions）输出
- [x] 结果页新增评分展示模块（总分 + 三维度进度条 + 优化建议）
- [x] 结果页新增推荐问题模块（点击可直接跳转生成）
- [x] 新建 `getHistory` 云函数（分页查询使用记录）
- [x] 新建历史记录页 `pages/history`（列表展示、下拉刷新、加载更多、点击查看详情）
- [x] 首页新增「历史记录」入口
- [x] 结果页支持从历史记录进入（免重复调用 API）
- [x] 更新 `app.json` 注册 history 页面
- [x] 更新开发记录文档

#### 2026-05-01（v1.2 爆款功能）
- [x] 新建 `userStatus` 云函数（用户解锁状态管理：get/unlock/getVip）
- [x] 新建 `user_unlock` 数据库集合（记录用户解锁行为）
- [x] 结果页新增 Canvas 分享卡片绘制功能（含标题/岗位/问题/回答摘要/评分/渐变背景）
- [x] 结果页新增「生成分享卡片」按钮 + 弹窗 + 保存到相册功能
- [x] 结果页新增内容锁定机制（高级表达/追问应对默认部分展示）
- [x] 结果页新增解锁弹窗 UI（观看广告解锁 / 免费体验 / 开通会员）
- [x] 前端本地缓存解锁状态（recordId 维度）
- [x] 更新开发记录文档

---

## 三、技术架构

### 3.1 目录结构

```
mini-mshd/
├── cloudfunctions/
│   ├── quickstartFunctions/      # 模板示例云函数（保留）
│   ├── generateAnswer/           # 【新建】AI生成面试回答
│   │   ├── index.js
│   │   ├── config.json
│   │   └── package.json
│   ├── quota/                    # 【新建】次数管理
│   │   ├── index.js
│   │   ├── config.json
│   │   └── package.json
│   ├── getHistory/               # 【v1.1 新建】获取历史记录
│   │   ├── index.js
│   │   ├── config.json
│   │   └── package.json
│   └── userStatus/               # 【v1.2 新建】用户解锁状态管理
│       ├── index.js
│       ├── config.json
│       └── package.json
├── miniprogram/
│   ├── pages/
│   │   ├── index/                # 【重写】首页-输入页
│   │   ├── result/               # 【新建】结果页
│   │   └── history/              # 【v1.1 新建】历史记录页
│   ├── app.js
│   ├── app.json
│   └── app.wxss
└── docs/
    ├── req.md                    # 需求文档
    ├── dev-log.md                # 开发记录
    ├── test-checklist.md         # 功能测试清单
    └── troubleshooting.md        # 问题库与部署指南（v1.2 新增）
```

### 3.2 数据库集合

| 集合名 | 说明 | 字段 |
|--------|------|------|
| `usage` | 使用记录 | `_id`, `openid`, `role`, `question`, `background`, `result`, `createTime` |
| `quota` | 次数控制 | `_id`, `openid`, `date`, `usedCount`, `createTime`, `updateTime` |
| `user_unlock` | 用户解锁记录 | `_id`, `openid`, `recordId`, `createTime`（v1.2） |

### 3.3 云函数列表

| 云函数 | 功能 | 说明 |
|--------|------|------|
| `generateAnswer` | 生成面试回答 | 接收岗位/问题/背景，调用 DeepSeek API，返回结构化结果（含评分+推荐问题） |
| `quota` | 次数管理 | 支持 `get`（查询剩余次数）、`check`（检查并扣减次数） |
| `getHistory` | 获取历史记录 | 分页查询当前用户的使用记录，按时间倒序 |
| `userStatus` | 用户状态管理 | 获取解锁状态 / 解锁内容 / 查询 VIP（v1.2） |

### 3.4 接口设计

#### generateAnswer
- **调用方式**: `wx.cloud.callFunction({ name: 'generateAnswer', data: { role, question, background } })`
- **返回字段**:
  ```json
  {
    "code": 0,
    "data": {
      "answer": "标准回答",
      "advanced": "高级表达",
      "insight": "面试官视角",
      "followup": "追问与应对",
      "score": {
        "total": 85,
        "clarity": 88,
        "logic": 82,
        "authenticity": 86,
        "target": 92,
        "suggestion": "具体优化建议"
      },
      "recommendQuestions": ["自我介绍", "优缺点", "职业规划"]
    }
  }
  ```

#### quota
- **查询剩余次数**: `type: 'get'`
- **检查并扣减**: `type: 'check'`
- **返回**: `{ code: 0, remaining: 3, canUse: true }`

---

## 四、关键实现细节

### 4.1 DeepSeek API 接入

- **API 端点**: `https://api.deepseek.com/chat/completions`
- **模型**: `deepseek-chat`（DeepSeek-V3）
- **调用方式**: 云函数内使用 `axios` 发送 POST 请求
- **API Key 配置**: 存储在云函数环境变量中，通过 `process.env.DEEPSEEK_API_KEY` 读取
- **Prompt 设计**: 严格按需求文档中的模板，要求输出 JSON 格式便于解析

### 4.2 次数限制逻辑

- 每日免费次数: **3 次**
- 以自然日为单位（`YYYY-MM-DD`）
- 流程:
  1. 用户点击【一键生成】
  2. 前端调用 `quota` 云函数 `check`
  3. 若 `canUse: true`，扣减次数并继续
  4. 若 `canUse: false`，提示"今日次数已用完"

### 4.3 评分系统（v1.1）

- AI 在生成回答的同时，对回答质量进行自评
- 评分维度：
  - **total**: 总分 0-100
  - **clarity**: 表达清晰度 0-100
  - **logic**: 逻辑结构 0-100
  - **authenticity**: 真实感 0-100
  - **target**: 优化后可达分数
  - **suggestion**: 一句话优化建议
- 结果页以圆形分数 + 进度条 + 建议的形式展示

### 4.4 推荐问题（v1.1）

- AI 根据岗位和当前问题，智能推荐 3 个最可能被追问的问题
- 结果页以标签形式展示，点击可直接跳转生成新回答
- 有效提升复用率

### 4.5 历史记录（v1.1）

- 每次生成成功后，结果自动保存到 `usage` 集合
- 历史记录页支持：
  - 分页加载（每页 20 条）
  - 下拉刷新
  - 点击条目查看详情（直接展示缓存结果，不消耗 API 次数）
- 首页顶部新增「历史记录」入口

### 4.6 分享卡片（v1.2）

- 使用 Canvas 绘制高清分享图片（750x1100，2倍图输出）
- 卡片内容包含：
  - 顶部绿色装饰条 + 标题「🔥 HR会点头的回答」
  - 岗位标签 + 面试问题
  - 回答内容摘要（最多120字）
  - 评分大圆圈展示
  - 底部扫码提示 + 绿色装饰条
- 支持保存到相册，便于朋友圈/小红书传播
- 绘制工具：自定义 `drawWrapText` 实现多行文本自动换行

### 4.7 付费解锁体系（v1.2）

- **内容锁定策略**：
  - 高级表达和追问应对默认只展示前2行（CSS `max-height` + 渐变遮罩）
  - 超出部分模糊隐藏，显示「🔒 查看完整版」按钮
- **解锁方式**：
  - 「观看广告免费解锁」（预留广告 SDK 接入点）
  - 「免费体验解锁」（测试环境快速验证）
  - 「开通会员」（预留微信支付接入点）
- **状态管理**：
  - 云数据库 `user_unlock` 集合持久化记录
  - 前端 `wx.getStorageSync` 本地缓存，避免重复查询
  - 历史记录默认视为已解锁（不重复收费）
- **触发点**：
  - 用户点击被锁定的「高级表达」内容区域
  - 用户点击被锁定的「追问应对」内容区域

### 4.3 结果页数据结构

结果页接收 `generateAnswer` 返回的数据，按模块展示:
1. 标准回答（首屏，可复制）
2. 面试官视角
3. 高级表达（MVP 阶段直接展示，付费逻辑后续版本实现）
4. 追问与应对

---

## 五、待办事项 / 后续版本

### MVP 遗留（需在真机/开发者工具中配置）
- [ ] 在微信开发者工具中配置云开发环境 ID
- [ ] 在云开发控制台创建数据库集合 `usage` 和 `quota`
- [ ] 在云函数配置中设置 `DEEPSEEK_API_KEY` 环境变量
- [ ] 部署云函数到云端并测试

### v1.1 增强功能 ✅ 已完成
- [x] 评分系统（表达清晰度、逻辑结构、真实感）
- [x] 推荐问题（引导二次使用）
- [x] 历史记录页

### v1.2 爆款功能 ✅ 已完成
- [x] 分享卡片生成（canvas 绘制图片）
- [x] 高级表达付费解锁
- [x] 追问机制付费解锁

### 优化项
- [ ] 加载状态优化（骨架屏）
- [ ] 错误重试机制
- [ ] 用户反馈入口

---

## 六、注意事项

1. **云开发环境 ID**: `app.js` 中 `env` 为空字符串，需要在微信开发者工具中获取并填入
2. **API Key 安全**: DeepSeek API Key 绝不存放在前端代码中，仅通过云函数环境变量使用
3. **数据库权限**: 创建集合后需要设置权限为"所有用户可读，仅创建者可写"或根据业务调整
4. **JSON 模式**: DeepSeek 支持 `response_format: { type: 'json_object' }`，确保输出可解析
5. **免费额度**: 新用户 DeepSeek API 有一定免费额度，MVP 阶段足够测试使用

---

## 七、变更记录

| 日期 | 版本 | 变更内容 | 变更人 |
|------|------|----------|--------|
| 2026-05-01 | v0.1 | 初始化项目，完成 MVP 核心代码编写 | Kimi |
| 2026-05-01 | v0.2 | 完成 v1.1 增强功能：评分系统、推荐问题、历史记录页 | Kimi |
| 2026-05-01 | v0.3 | 完成 v1.2 爆款功能：分享卡片、付费解锁框架、userStatus 云函数 | Kimi |
