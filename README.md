# 毛主席思想指导 · Chairman Mao's Thought Guidance

**以《毛泽东选集》核心思想为根基的 AI 决策指导——用实事求是的方法论，层层深入分析职场、创业、关系与人生方向难题。**

**AI guidance powered by Mao's Selected Works - analyze problems with pragmatic, clear-headed methodology.**

| 功能 | 说明 |
|------|------|
| 💬 **六阶段递进对话** | 全面了解 → 矛盾分析 → 条件评估 → 战略建议 → 战术行动 → 反思迭代，层层深入不轻易下结论 |
| 🎨 **三种分析风格** | 毛选风格 / 叶丁风格 / 平衡融合（推荐），按会话绑定，新建对话弹窗可选 |
| 🌐 **联网能力** | 消息含链接自动抓取网页正文；「联网」开关开启后回答前自动搜索网络（必应免费）并注明来源 |
| ⚙️ **多供应商设置** | DeepSeek / OpenAI / 百炼 / Kimi / GLM / 硅基流动 / 自定义；自动拉取官网真实模型列表 |
| 📝 **专业报告导出** | 六维度实事求是分析，一键导出 Markdown / TXT / Word / PDF |
| 🕘 **历史管理** | 自动保存全部对话，查看 / 删除，主题、阶段、相对时间一目了然 |

---

👨‍💻 **开发者个人主页**：<https://hongyuguo.com>
⭐ **GitHub 项目与赞赏**：<https://github.com/Gsaecy/ChairmanMao-guide-life>

---

## What's New in v0.3.0

- 🌐 **联网能力**：消息含链接自动抓取网页正文摘要；输入框旁「联网」开关，开启后回答前自动搜索网络（必应免费免 Key，可选 SerpAPI），联网资料注入上下文并要求注明来源，失败静默降级
- 📝 **专业分析报告**：问题概述 → 六维度实事求是分析（事实/矛盾/条件/战略/战术/风险）→ 结论与行动建议 → 执行检验标准；一键导出 Markdown / TXT（可直接复制）/ Word（.doc 可直接编辑）/ PDF（中文字体嵌入排版）
- ⚙️ **设置页全面升级**：多供应商预设自动填地址；打开设置自动从官网拉取真实模型列表（不再显示过时预设）；API Key 眼睛查看、三态徽章、「应用 Key 并自动检测模型」按钮；保存按钮绿色锁定状态机；恢复默认带确认弹窗；保存前校验与分级错误提示
- 💬 **对话体验升级**：新建对话弹窗（默认预选设置风格、卡片选择仅本次生效、取消后标题默认日期时间）；流式回复平滑无闪烁；历史对话点击或「查看」即可打开（就绪消息队列保证消息不丢）
- 🎨 **界面细节**：导航高亮跟随视图、顶栏风格徽章实时同步、模型自定义下拉、主题自适应毛玻璃卡片
- 🐛 **稳定性修复**：修复 webview CSP 内联样式被拦截、脚本初始化 TDZ 崩溃、保存消息丢失、流式最终渲染丢失等一系列问题

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
- Support for **DeepSeek** by default, compatible with all OpenAI-format APIs
- 7 provider presets + custom: auto-fills API base URL, auto-detects the official model list from the API
- Web search toggle (Bing free without key / SerpAPI optional), temperature, max tokens, model selection

### Report Export
- Professional six-dimension analysis report (seeking truth from facts)
- One-click export as **Markdown / TXT / Word (.doc) / PDF**

### History Management
- Auto-saves all conversations with timestamps
- View (click or「查看」button), and delete history records
- Phase tracking, relative time, title and preview for each conversation

---

## Quick Start

### 1. Install
```bash
code --install-extension ChairmanMao-guide-life-0.3.0.vsix
```

### 2. Configure API
1. Look for 「毛主席思想指导」(Mao's Thought) in the VS Code Activity Bar (sidebar)
2. Click the ⚙ **Settings** button
3. Pick an AI provider (DeepSeek / OpenAI / 百炼 / Kimi / GLM / 硅基流动 / 自定义) — address and official model list fill automatically
4. Paste your API Key (from [platform.deepseek.com](https://platform.deepseek.com) etc.) and click **Apply Key & Detect Models** — or **Save Settings**
5. The official model list loads automatically; the green bar shows「设置正常」when ready

### 3. Start Chatting
1. Click **新建对话** in the sidebar
2. Enter a title (or cancel and type directly — the title defaults to the start date/time), pick a style for this session if you like
3. Describe your situation; the AI guides you through six analytical phases
4. Toggle「联网」next to the input to search the web before answering

---

## Configuration

| Key | Description | Default |
|-----|-------------|---------|
| Provider | AI provider preset | deepseek |
| API Base URL | API endpoint | https://api.deepseek.com |
| API Key | Authentication token | - |
| Model | Auto-detected from official list | - |
| Temperature | Creativity (0=stable, 2=divergent) | 0.7 |
| Max Tokens | Single-response length | 4096 |
| Style | Analysis mode | balanced |
| Web Search | Search before answering | enabled (Bing) |

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

### v0.3.0

**联网能力**
- 消息含链接自动抓取网页标题与正文摘要注入上下文
- 输入框旁「联网」开关：开启后回答前自动搜索网络（必应免费免 Key，可选 SerpAPI），结果注明来源；联网失败静默降级
- 设置页新增联网搜索开关、搜索引擎与搜索 Key 配置

**专业分析报告**
- 结构：问题概述 → 六维度实事求是分析（事实/矛盾/条件/战略/战术/风险）→ 结论与行动建议 → 执行检验标准
- 一键导出 Markdown / TXT（可直接复制）/ Word（.doc 可直接编辑）/ PDF（中文字体嵌入排版，自动分页）

**设置页升级**
- 供应商预设自动填地址；打开设置自动从官网拉取真实模型列表；模型自定义下拉；API Key 眼睛查看、三态徽章、应用并检测按钮；保存绿色锁定状态机；恢复默认确认弹窗；保存前校验与分级错误提示；导航高亮跟随视图

**对话体验升级**
- 新建对话弹窗：默认预选设置风格、卡片选择仅本次生效、取消后标题默认日期时间；流式回复平滑无闪烁；历史对话点击/「查看」打开（就绪消息队列保消息不丢）；ChatGPT 风格界面与主题自适应

**稳定性修复**
- 修复 webview CSP 内联样式被拦截、脚本初始化 TDZ 崩溃、保存消息丢失、流式最终渲染丢失、模型检测鉴权误报等一系列问题

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
