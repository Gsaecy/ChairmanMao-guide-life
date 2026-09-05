# 毛主席思想指导 · Chairman Mao's Thought Guidance

**以《毛泽东选集》核心思想为根基的 AI 决策指导——用实事求是的方法论，层层深入分析职场、创业、关系与人生方向难题。**

**AI guidance powered by Mao's Selected Works - analyze problems with pragmatic, clear-headed methodology.**

| 功能 | 说明 |
|------|------|
| 💬 **六阶段递进提问** | 认清形势 → 调查优先 → 抓主要矛盾 → 战略战术 → 群众路线 → 实践检验，层层深入不轻易下结论 |
| 🎨 **三种分析风格** | 毛选风格 / 叶丁风格 / 平衡融合（推荐），按会话绑定 |
| 🖥️ **主题自适应** | 深/浅色自动跟随 VS Code，全部输入框带细腻阴影 |
| 📝 **报告导出** | 一键导出 Markdown 分析报告 |
| 🕘 **历史管理** | 自动保存全部对话（含时间戳），查看/搜索/删除 |
| ⚙️ **灵活配置** | 默认 DeepSeek，兼容所有 OpenAI 格式 API；可选联网搜索、温度、模型 |

---

👨‍💻 **开发者个人主页**：<https://hongyuguo.com>
⭐ **GitHub 项目与赞赏**：<https://github.com/Gsaecy/ChairmanMao-guide-life>

---

## What's New in v0.2.8

- 🖼️ **恢复原始图标** —— 活动栏/扩展/欢迎图标全部还原为原始设计（书法风），移除线条五角星

---

## What's New in v0.2.7

- 🤖 **AI 供应商设置（参考扩展选择助手）** —— 供应商下拉框（DeepSeek / OpenAI / 阿里云百炼 / Kimi / 智谱 GLM / 硅基流动 / 自定义），选品牌自动填充 API 地址与模型，模型支持下拉选择
- 💬 **ChatGPT 风格对话页** —— 消息带头像（AI 线条星 / 用户「我」）、居中消息区、底部大圆角输入框 + 圆形发送按钮

---

## What's New in v0.2.6

- 💬 **GPT 风格聊天渲染** —— AI 回复完整 Markdown 渲染（标题/列表/代码块/引用/表格，DOMPurify 防注入）；用户消息纯文本转义；流式结束用完整渲染覆盖；消息内链接点击用浏览器打开
- 📋 **GPT 风格历史记录** —— 相对时间显示（刚刚/x 分钟前/昨天）、每条对话显示首条消息预览摘要
- 🚫 移除主页与聊天欢迎区的图标展示

---

## What's New in v0.2.5

- 🧠 **AI 沙盒质检** —— 请求源头关闭思考模式（DeepSeek `thinking: {type: "disabled"}`）；输出经质检关卡清洗（`<think>` 思考块、R1 思考标记、寒暄前缀）后才回传界面；`finish_reason=length` 截断残留同样清洗
- 🔐 **API Key 安全存储** —— 迁移到系统密钥库（SecretStorage），不再落 VS Code 全局状态；旧配置自动迁移，清空即删除
- 🖼️ **简约线条图标** —— 扩展图标/欢迎图标换为红色线条五角星，活动栏矢量 SVG 随主题自适应
- 🎨 **完全 Apple 风格** —— 参考扩展选择助手：半透明毛玻璃卡片（`blur(24px) saturate(180%)`）、胶囊按钮、hover 微交互；主页重排为「副标题 → 功能介绍 → 使用说明 → 赞助与开发链接」

---

## What's New in v0.2.4

- 🖼️ **恢复原始图标** —— 扩展图标、欢迎图标、活动栏图标全部还原为原始设计，不再使用自绘线条图形
- 🐛 保留 v0.2.2 全部 bug 修复（阶段推进竞态、引导提示、关闭对话、API 路径、消息计数）

---

## What's New in v0.2.3

- 🐛 **修复阶段自动推进竞态** —— 此前 AI 回复完成后触发新引导流时，控制器被误置空导致流无法中止、并发混流；现改为回复完整渲染释放后再判断推进，并发时自动中止旧流
- 🐛 **修复引导提示失效** —— 阶段过渡提示此前存为 system 角色后被过滤，AI 根本没收到；现改为用户角色正确发送，历史记录同步修正
- 🐛 **修复关闭对话失效** —— 「关闭对话」按钮此前永不显示；现会话创建后显示，关闭后同步清除宿主当前会话（导出报告不再指向旧会话）
- 🐛 **修复 API 地址拼接** —— 支持填入 `/v1` 结尾或完整 chat/completions 端点，不再重复拼接路径
- 🐛 **修复历史消息计数** —— 消息数不再包含内部 system 记录
- 🎨 **Apple 风格细节** —— 设置页卡片化（圆角+毛玻璃阴影+hover 微交互），顶栏轻阴影

---

## What's New in v0.2.1

- 🏷️ **扩展更名为「毛主席思想指导」** —— 面板标题、活动栏、设置页、系统提示词全部同步更新，侧边栏展示中英文名称
- 👨‍💻 **主页完善** —— 侧边栏新增开发者个人主页与 GitHub 项目链接，一键直达

---

## What's New in v0.2.0

- ✨ **Redesigned Sidebar Navigation** - Clean status display (extension name + style mode + API readiness) with three action buttons (New Chat / History / Settings), welcome icon, and step-by-step usage guide
- 🎨 **Full Theme Adaptation** - History & Settings panels now use VSCode CSS variables; no more hardcoded red/white colors; all input fields have subtle shadows `0 1px 3px rgba()`
- ⚡ **Independent Chat Panel** - New sessions open directly in editor panel; no more sidebar UI flickering or lost session titles
- 🔧 **Streaming Performance** - 100ms RAF debounce prevents character-by-character rendering, giving smooth text flow
- 📋 **Improved History Panel** - Enhanced color contrast, card hover shadows, Delete button with confirmation dialog
- 🧹 **Code Cleanup** - Removed sidebar-specific logic from chat panel; sidebar now uses dedicated `sidebar.ts` webview

---

## Introduction

毛主席思想指导（Mao's Thought Guidance）是一款以《毛泽东选集》核心思想为根基的 VS Code 扩展。无论你面临职场困境、创业抉择、关系困扰还是人生方向问题，它都用简洁犀利的洞察引导你层层分析。

Mao's Thought Guidance is a VS Code extension that uses Mao's Selected Works core principles as its foundation. Whether you face career dilemmas, startup decisions, relationship challenges, or life direction questions, it guides you through layered analysis with concise, sharp insights.

---

## Ten Core Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | Know the situation | Distinguish friend from foe |
| 2 | No investigation, no right to speak | Facts first, no empty talk |
| 3 | Grasp the principal contradiction | Find the key leverage point |
| 4 | Strategy + tactics combined | Bold direction, solid execution |
| 5 | Mass line | Align goals with everyone's interests |
| 6 | Guerrilla tactics | Avoid strength, strike weakness |
| 7 | Learn through practice | Act and reflect, unite knowing and doing |
| 8 | Seek truth from facts | Start from actual conditions |
| 9 | United front | Unite the many, isolate the few |
| 10 | Self-renewal | Constant reflection and growth |

---

## Features

### Intelligent Conversation
- Six-phase progressive questioning: Understanding → Contradiction → Conditions → Strategy → Tactics → Reflection
- Multi-turn dialogue, going deeper without rushing to conclusions
- Concise, powerful replies that hit the core

### Intuitive Sidebar Navigation
- **Status Bar**: Extension name + current style mode + API readiness indicator
- **Quick Actions**: New Chat | History | Settings (3 buttons)
- **Welcome Guide**: Problem statement and step-by-step usage instructions
- **Independent Editor Panels**: Each chat session opens in its own panel for clarity

### Theme-adaptive UI
- Clean design that follows VS Code system theme (dark/light)
- All input fields include subtle shadows (`0 1px 3px rgba(0,0,0,0.08)`)
- Activity bar sidebar with streamlined navigation
- Settings & History panels automatically styled

### Three Style Modes
- **Mao Originalist** - Focus on Mao's classic texts
- **Ye Zinong / Ding Yuanying** - Focus on methodology and logic  
- **Balanced Fusion** - Best of both (recommended)

### Flexible Configuration
- Default support for **DeepSeek** API, compatible with all OpenAI-format APIs
- Optional web search (SerpAPI / Bing / AnySearch)
- Configurable temperature, max tokens, and model selection

### Report Export
- One-click export of analysis reports as **Markdown**

### History Management
- Auto-saves all conversations with timestamps
- View, search, and delete history records with smooth UI
- Phase tracking for each conversation

---

## Quick Start

### 1. Install
```bash
code --install-extension ChairmanMao-guide-life-0.2.8.vsix
```

### 2. Configure API
1. Look for 「毛主席思想指导」(Mao's Thought) in the VS Code Activity Bar (sidebar)
2. Click the ⚙ **Settings** button
3. Fill in your API Key from [platform.deepseek.com](https://platform.deepseek.com)
4. Click **Save Settings** and you're ready to start

### 3. Start Chatting
1. Click **+ New Chat** in the sidebar
2. Enter your situation/problem (this becomes the chat title)
3. Press Enter and describe your situation in detail
4. The AI will guide you through six analytical phases

---

## Configuration

| Key | Description | Default |
|-----|-------------|---------|
| API Base URL | API endpoint | https://api.deepseek.com |
| API Key | Authentication token | - |
| Model | Model name | deepseek-chat |
| Temperature | Creativity (0-2) | 0.7 |
| Max Tokens | Response length | 4096 |
| Style | Analysis mode | balanced |
| Web Search | Enable web queries | disabled |

---

## Development

```bash
git clone https://github.com/Gsaecy/ChairmanMao-guide-life.git
cd extension
npm install
npm run compile
npm run package
```

---

## Support

- 📖 [GitHub Issues](https://github.com/Gsaecy/ChairmanMao-guide-life/issues)
- 💬 Feedback welcomed

---

## License

MIT

---

## Changelog

### v0.2.8
- 恢复原始图标（活动栏/扩展/欢迎图标还原为原始设计）

### v0.2.7
- AI 供应商下拉框（6 家预设 + 自定义），选品牌自动填 API 地址与模型
- ChatGPT 风格对话页：头像、居中布局、圆形发送按钮

### v0.2.6
- GPT 风格聊天渲染：AI 消息完整 Markdown + DOMPurify，用户消息转义，流式结束完整重渲染
- 历史记录：相对时间显示 + 首条消息预览摘要
- 移除主页与聊天欢迎区图标

### v0.2.5
- AI 沙盒质检：源头关思考模式 + 输出清洗（思考块/寒暄前缀/截断残留）
- API Key 迁移系统密钥库（SecretStorage），旧配置自动迁移
- 简约线条图标（活动栏 SVG 主题自适应）
- 完全 Apple 风格：半透明毛玻璃卡片 + 胶囊按钮，主页重排（副标题→功能介绍→使用说明→赞助与开发链接）

### v0.2.4
- 恢复原始图标（扩展图标/欢迎图标/活动栏图标还原为原始设计）

### v0.2.3
- 重新发布版（与 v0.2.2 内容一致，版本号推进以强制商店端更新）

### v0.2.2
- 修复阶段自动推进竞态（控制器误置空、并发混流）与引导提示被过滤失效
- 修复关闭对话按钮不显示、宿主会话未清除；历史消息计数排除内部记录
- API 地址智能拼接（支持 /v1 或完整端点）
- Apple 风格设置卡片

### v0.2.1
- 扩展更名为「毛主席思想指导」，面板/活动栏/设置标题与系统提示词同步更新
- 侧边栏主页新增开发者主页与 GitHub 项目链接

### v0.2.0
- Redesigned sidebar navigation, theme-adaptive UI, independent chat panel, improved streaming performance

### v0.1.9
- Style binding: select style (Mao/Ye/Balanced) when creating session, persists per session
- Sidebar close button: return to welcome page with one click
- History buttons: text buttons replacing icons for consistency
- Welcome page: custom image support (media/welcome-icon.png)

### v0.1.8
- Auto-focus input box after creating new session, display session title in header
- All dialogs follow VS Code theme colors (editorWidget variables)
- Enter key submits session title
- Click backdrop to close dialogs

### v0.1.7
- Fix streaming output character-by-character jitter (RAF debounce + data-is-stream selector fix)
- Sidebar now shows usage guide, input hidden
- Simplify filterGarbled to prevent content loss during streaming
- Fix history page phase name mapping for all 7 phases
- Fix history page message count display

### v0.1.6
- Fix ServiceWorker load error: CSS extraction via MiniCssExtractPlugin

### v0.1.5
- New layout: responsive message area, auto phase labeling
- English description to fix encoding issues
- Sidebar phase navigation removed

### v0.1.4
- Input box enlarged, vertical resize supported
- Full VS Code theme adaptation
- History page: View Conversation button, Clear Record button
- Fixed missing panel icon and streaming output issues

### v0.1.3
- New Apple-style clean UI
- Sidebar shows guidance content

---

## License

MIT License (c) 2025 Gsaecy

---

> ⚠️ **版本铁律**：每轮修复必须升版本号再上传商店。同版本号重传 Marketplace，客户端不会重新拉取更新。
