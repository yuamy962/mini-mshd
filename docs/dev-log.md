# 📝 面试回答生成器小程序 - 开发记录文档

> 本文档与 `req.md`（需求文档）并列，用于记录开发过程、技术决策和待办事项。

---

## 一、项目信息

| 项 | 内容 |
|----|------|
| 项目名称 | 面试回答生成器小程序 |
| 开发阶段 | MVP v1.0 |
| 技术栈 | 微信小程序原生 + 微信云开发 |
| AI 模型 | DeepSeek（深度求索） |
| 启动日期 | 2026-05-01 |

---

## 二、开发进度

### ✅ 已完成

#### 2026-05-01
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
│   └── quota/                    # 【新建】次数管理
│       ├── index.js
│       ├── config.json
│       └── package.json
├── miniprogram/
│   ├── pages/
│   │   ├── index/                # 【重写】首页-输入页
│   │   └── result/               # 【新建】结果页
│   ├── app.js
│   ├── app.json
│   └── app.wxss
└── docs/
    ├── req.md                    # 需求文档
    └── dev-log.md                # 开发记录（本文件）
```

### 3.2 数据库集合

| 集合名 | 说明 | 字段 |
|--------|------|------|
| `usage` | 使用记录 | `_id`, `openid`, `role`, `question`, `background`, `result`, `createTime` |
| `quota` | 次数控制 | `_id`, `openid`, `date`, `usedCount`, `createTime`, `updateTime` |

### 3.3 云函数列表

| 云函数 | 功能 | 说明 |
|--------|------|------|
| `generateAnswer` | 生成面试回答 | 接收岗位/问题/背景，调用 DeepSeek API，返回结构化结果 |
| `quota` | 次数管理 | 支持 `get`（查询剩余次数）、`check`（检查并扣减次数） |

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
      "followup": "追问与应对"
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

### v1.1 增强功能
- [ ] 评分系统（表达清晰度、逻辑结构、真实感）
- [ ] 推荐问题（引导二次使用）
- [ ] 历史记录页

### v1.2 爆款功能
- [ ] 分享卡片生成（canvas 绘制图片）
- [ ] 高级表达付费解锁
- [ ] 追问机制付费解锁

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
