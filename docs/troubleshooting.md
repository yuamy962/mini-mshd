# 🔧 面试回答生成器小程序 - 问题库与部署指南

> 本文档记录开发和部署过程中遇到的常见问题及解决方案，供测试、部署和维护时参考。
> 与 `req.md`（需求文档）、`dev-log.md`（开发记录）、`test-checklist.md`（测试清单）并列存放于 `docs` 目录。

---

## 一、部署前必读检查清单

### ✅ 环境配置（必须按顺序完成）

| 序号 | 检查项 | 操作路径 | 预期结果 |
|------|--------|----------|----------|
| 1 | 云开发环境 ID | `miniprogram/app.js` 第 8 行 | `env: "your-env-id-xxxx"`（非空） |
| 2 | 数据库集合 | 云开发 → 数据库 | 已创建 `usage`、`quota`、`user_unlock` 三个集合 |
| 3 | 数据库权限 | 每个集合 → 权限设置 | **"所有用户可读，仅创建者可写"** |
| 4 | DeepSeek API Key | 云函数 `generateAnswer` → 高级配置 → 环境变量 | 已添加 `DEEPSEEK_API_KEY`，值为有效的 `sk-xxx` |
| 5 | 云函数超时时间 | 云函数 `generateAnswer` → 高级配置 → 超时时间 | **≥ 20 秒**（默认 3 秒，必须调大！） |
| 6 | 基础库版本 | 开发者工具 → 详情 → 本地设置 | **≥ 2.20.0** |

> ⚠️ **特别提醒**：第 4 项和第 5 项是部署时最容易遗漏的，务必仔细检查！

---

## 二、常见问题库

### ❌ 问题 1：点击生成提示"网络错误" / "调用失败"

**现象**：点击【一键生成回答】后，结果页提示网络异常或加载失败。

**排查步骤**：

1. **检查云开发环境 ID 是否为空**
   - 打开 `miniprogram/app.js`
   - 确认 `env: "your-env-id-xxxx"` 已填入真实的环境 ID
   - 空字符串会导致所有云函数调用失败

2. **检查云函数是否已部署**
   - 在开发者工具左侧文件树，展开 `cloudfunctions`
   - 看云函数文件夹上是否有 ☁️ 云朵图标
   - 没有云朵 = 未部署，右键云函数 → **创建并部署：云端安装依赖**

3. **测试云开发连通性**
   - 在开发者工具控制台输入：
   ```javascript
   wx.cloud.callFunction({name: 'quota', data: {type: 'get'}}).then(res => console.log(res))
   ```
   - 如果返回正常数据 → 云开发环境正常
   - 如果报错 → 检查环境 ID 或云开发是否欠费

**根本原因**：云开发环境未正确初始化，或云函数未部署到云端。

---

### ❌ 问题 2：错误码 `-504003` / `FUNCTION_TIME_LIMIT_EXCEEDED`

**现象**：控制台报错：
```
Error: cloud.callFunction:fail Error: errCode: -504003
errMsg: Invoking task timed out after 3 seconds
```

**根本原因**：
- `generateAnswer` 云函数内部需要调用 DeepSeek API（外部网络请求）
- 云函数**默认超时时间为 3 秒**
- DeepSeek API 响应通常需要 3~10 秒，3 秒内无法完成就被强制中断

**解决方案**：

1. **调高云函数超时时间**（必须！）
   ```
   微信开发者工具 → 云开发 → 云函数 → 点击 generateAnswer
   → 版本与配置 → 高级配置 → 超时时间
   ```
   将超时时间从 **3 秒** 改为 **20 秒**（最大支持 60 秒）

2. **确认 API Key 已配置**
   - 如果 `DEEPSEEK_API_KEY` 未配置，云函数会抛错但也会被 3 秒超时截断
   - 所以超时错误的背后，可能是"未配置 API Key"
   - 检查路径：`generateAnswer` → 高级配置 → 环境变量

3. **修改后无需重新部署代码**
   - 超时时间是运行时配置，修改后自动生效
   - 但如果之前没部署过，仍然需要先部署一次

**补充说明**：
- 代码中 axios 的 `timeout: 30000` 是内层 HTTP 请求超时
- 云函数的**外层超时限制**（默认 3 秒）会先于 axios 超时触发
- 因此必须同时满足：
  - 云函数外层超时 ≥ 20 秒
  - axios 内层超时 = 30 秒（已在代码中配置好）

---

### ❌ 问题 3：AI 生成结果为空或不显示评分/推荐问题

**现象**：结果页只显示标准回答，没有评分模块，或推荐问题为空。

**根本原因**：`generateAnswer` 云函数没有重新部署。

**解决方案**：

- v1.1 升级了 `generateAnswer` 的 Prompt，要求 AI 输出 `score` 和 `recommendQuestions`
- 如果部署的还是旧版本，AI 不会返回这两个字段
- **右键 `generateAnswer` → 创建并部署：云端安装依赖**

---

### ❌ 问题 4：次数未扣减 / 始终显示 3 次

**现象**：生成多次后，首页仍显示"今日剩余：3 次"。

**根本原因**：`quota` 集合权限问题，或 `quota` 云函数未部署。

**解决方案**：

1. 检查 `quota` 云函数是否已部署（看是否有 ☁️ 图标）
2. 检查 `quota` 集合权限是否为"所有用户可读，仅创建者可写"
3. 在控制台测试：
   ```javascript
   wx.cloud.callFunction({name: 'quota', data: {type: 'get'}}).then(res => console.log(res))
   ```

---

### ❌ 问题 5：Canvas 分享卡片空白或保存失败

**现象**：点击"生成分享卡片"后，弹窗内无内容，或保存图片报错。

**排查步骤**：

1. **等待绘制完成**
   - Canvas 绘制需要时间，弹出后等待 1~2 秒再点击保存
   - 如果立即点击"保存"，可能 `canvasToTempFilePath` 还没执行完

2. **检查是否有保存相册权限**
   - 首次保存会弹窗请求权限，如果用户点了拒绝
   - 需要引导用户去设置中开启：
   ```javascript
   wx.openSetting()
   ```
   - 代码中已包含权限拒绝的处理逻辑

3. **真机测试**
   - Canvas 在模拟器上可能渲染异常，建议在真机上测试分享卡片功能

---

### ❌ 问题 6：分享卡片显示乱码 / URL 编码字符 / 内容截断

**现象**：
- 分享卡片弹窗中显示 `%E5` `%BA` 等 URL 编码字符
- 文字内容被截断或重叠
- Canvas 显示异常

**根本原因**：
1. **URL 参数未解码**：小程序 `Page.onLoad(options)` 中的参数不会自动 URL decode，需要手动 `decodeURIComponent`
2. **旧版 Canvas `draw` 回调不可靠**：`ctx.draw(false, callback)` 的回调在某些基础库中不触发，导致 `canvasToTempFilePath` 在绘制完成前执行
3. **Canvas 与 Image 同时显示**：弹窗中 canvas 和 image 叠加，造成视觉混乱

**解决方案**：

1. **手动解码 URL 参数**
   ```javascript
   onLoad(options) {
     let { role, question } = options;
     role = role ? decodeURIComponent(role) : '';
     question = question ? decodeURIComponent(question) : '';
     this.setData({ role, question });
   }
   ```

2. **改用 setTimeout 替代 draw 回调**
   ```javascript
   // ❌ 不推荐（旧版 canvas 回调不可靠）
   ctx.draw(false, () => { ... });

   // ✅ 推荐
   ctx.draw();
   setTimeout(() => {
     wx.canvasToTempFilePath({ canvasId: 'shareCanvas', ... });
   }, 500);
   ```

3. **Canvas 与 Image 互斥显示**
   ```html
   <canvas style="display: {{shareImagePath ? 'none' : 'block'}}" />
   <image wx:if="{{shareImagePath}}" mode="widthFix" />
   ```

---

### ❌ 问题 7：历史记录显示 URL 编码 / 乱码

**现象**：历史记录列表中的岗位标签和面试问题显示为 `%E7%A8%8B%E5%BA%8F%E5%91%98` 等 URL 编码字符。

**根本原因**：
- 早期版本（未修复结果页 decode 前）生成的记录，`role` 和 `question` 以 URL 编码形式存入了数据库
- 历史记录页直接展示了数据库中的原始数据，没有 decode

**解决方案**：

在 `history/index.js` 中，从数据库获取数据后，对 `role`、`question`、`background` 统一做安全解码：

```javascript
function safeDecode(str) {
  if (!str || typeof str !== 'string') return str || '';
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

// 获取历史记录后
const decodedList = data.list.map(item => ({
  ...item,
  role: safeDecode(item.role),
  question: safeDecode(item.question),
  background: safeDecode(item.background),
}));
```

> `safeDecode` 的作用是：如果是 URL 编码就解码，如果已经是中文就原样返回，如果包含非法 `%` 字符也不报错。

---

### ❌ 问题 8：解锁状态丢失（重启后内容重新锁定）

**现象**：解锁了高级表达，退出小程序重新进入后又显示锁定。

**根本原因**：
- v1.2 解锁状态优先使用**本地缓存**（`wx.getStorageSync`）
- 本地缓存可能被微信清理，或用户清除了缓存
- 云数据库 `user_unlock` 已预留持久化能力，但前端默认走本地缓存

**解决方案**（如需持久化）：
- 在 `pages/result/index.js` 中，解锁成功后调用 `userStatus` 云函数写入云端
- 页面加载时优先从云端查询解锁状态，而非本地缓存
- 当前代码已预留了 `userStatus` 云函数接口，需要前端补充调用逻辑

---

## 三、各云函数职责速查

| 云函数 | 是否需要 API Key | 是否需要调超时时间 | 职责 |
|--------|-----------------|-------------------|------|
| `generateAnswer` | ✅ **必须配置** | ✅ **必须调大（≥20s）** | 调用 DeepSeek API 生成面试回答 |
| `quota` | ❌ 不需要 | ❌ 默认 3 秒足够 | 查询/扣减用户每日免费次数 |
| `getHistory` | ❌ 不需要 | ❌ 默认 3 秒足够 | 分页查询用户使用记录 |
| `userStatus` | ❌ 不需要 | ❌ 默认 3 秒足够 | 管理用户解锁/VIP 状态 |

---

## 四、DeepSeek API 相关

### API Key 获取
1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册账号 → 创建 API Key
3. 复制以 `sk-` 开头的密钥

### 费用说明
- 新用户有一定免费额度（约 500 万 tokens）
- 面试回答场景每次请求约 1000~2000 tokens
- 免费额度足够 MVP + v1.1 + v1.2 的全部测试使用

### API 可用性
- 如果 DeepSeek 服务繁忙，可能响应较慢（5~15 秒）
- 这是正常现象，不影响功能
- 如果长时间不可用，控制台会有具体报错

---

## 五、更新记录

| 日期 | 版本 | 新增内容 |
|------|------|----------|
| 2026-05-01 | v0.1 | 初始化问题库，记录部署检查清单和 6 个常见问题 |
