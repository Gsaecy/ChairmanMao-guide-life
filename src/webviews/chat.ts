/**
 * 对话面板 Webview 入口 - Apple 风格简洁界面
 */
import './globals.css';
import { icon } from './lucideIcons';
// marked 是 ESM/CJS 双包：TS 解析到 ESM 类型报 TS1479，webpack 按 require 条件打包 CJS，忽略即可
// @ts-ignore TS1479: marked dual package, webpack resolves CJS via require condition
import { marked } from 'marked';
import DOMPurify from 'dompurify';

(function () {
  const vscode = acquireVsCodeApi();
  let streamingBuffer = '';
  let isStreaming = false;
  let currentPhase = 'understanding';
  let sessionLoaded = false;

  let currentStyle: string = 'balanced'; // 当前对话风格
  let defaultStyle: string = 'balanced'; // 设置页保存的默认风格（新建对话时预选）
  let webEnabled = true; // 联网搜索开关（默认与设置一致）

  // 流式渲染防抖——60ms节流+RAF合并，避免逐字跳动（修复逐字渲染问题）
  let rafPending = false;
  let rafId: number | null = null;
  let lastRenderTime = 0;
  const MIN_RENDER_INTERVAL = 60; // 最快60ms刷新一次

  function scheduleStreamRender() {
    if (rafPending) return;
    rafPending = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafPending = false;
      rafId = null;
      const now = performance.now();
      if (now - lastRenderTime < MIN_RENDER_INTERVAL) return;
      lastRenderTime = now;
      const bubble = document.querySelector('[data-is-stream="true"]') as HTMLElement;
      if (!bubble) return;
      const contentEl = bubble.querySelector('[data-stream-content]') as HTMLElement;
      if (!contentEl) return;
      const clean = filterGarbled(streamingBuffer);
      contentEl.innerHTML = formatContent(clean);
      const container = getEl('messagesContainer')!;
      container.scrollTop = container.scrollHeight;
    });
  }

  // 强制立即渲染（停止流式时使用）
  function forceStreamRender() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    rafPending = false;
    const bubble = document.querySelector('[data-is-stream="true"]') as HTMLElement;
    if (!bubble) return;
    const contentEl = bubble.querySelector('[data-stream-content]') as HTMLElement;
    if (!contentEl) return;
    lastRenderTime = performance.now();
    const clean = filterGarbled(streamingBuffer);
    contentEl.innerHTML = formatContent(clean);
    const container = getEl('messagesContainer')!;
    container.scrollTop = container.scrollHeight;
  }

  const app = document.getElementById('root')!;
  renderApp();

  function renderApp() {
    app.innerHTML = `
      <div class="flex flex-col h-screen font-sans" style="background: var(--vscode-editor-background); color: var(--vscode-editor-foreground);">
        <!-- Top Bar: New Chat + Actions -->
        <div class="app-topbar flex-shrink-0 px-4 py-2 flex items-center justify-between" style="background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-sideBar-border);">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold" style="color: var(--vscode-editor-foreground);">毛主席思想指导</span>
            <span id="styleLabel" class="text-[10px] px-2 py-0.5 rounded-full" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">平衡融合</span>
            <span id="phaseLabel" class="text-[10px] px-2 py-0.5 rounded-full" style="background: var(--vscode-inputValidation-infoBackground); color: var(--vscode-inputValidation-infoForeground);">就绪</span>
          </div>
          <div class="flex items-center gap-2">
            <button id="btnNewSession" class="ap-btn-pill text-xs px-3 py-1.5 font-medium inline-flex items-center gap-1" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">
              ${icon('plus', 12)} 新建对话
            </button>
            <button id="btnCloseSession" class="hidden ap-btn-pill text-xs px-3 py-1.5" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" title="关闭当前对话">关闭对话</button>
            <button id="btnHistory" class="ap-btn-pill text-xs px-3 py-1.5" style="background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); color: var(--vscode-descriptionForeground); border: 1px solid var(--line);">历史记录</button>
            <button id="btnSettings" class="ap-btn-pill text-xs px-3 py-1.5" style="background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); color: var(--vscode-descriptionForeground); border: 1px solid var(--line);">设置</button>
          </div>
        </div>

        <!-- Messages Area with Adaptive Width (max ~680px centered) -->
        <div id="messagesContainer" class="flex-1 overflow-y-auto py-3 space-y-3" style="background: var(--vscode-editor-background); padding-left: max(12px, calc((100% - 680px) / 2)); padding-right: max(12px, calc((100% - 680px) / 2));">
          <div id="placeholderMsg" class="text-center py-16">
            <p class="text-base font-semibold mb-1" style="color: var(--vscode-editor-foreground);">没有调查，就没有发言权</p>
            <p class="text-sm" style="color: var(--vscode-descriptionForeground);">告诉我你面临的问题，我们一起用实事求是的方法来分析</p>
          </div>
          <div id="loadingIndicator" class="hidden flex justify-start">
            <div class="border px-3 py-2 text-xs rounded" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border); color: var(--vscode-descriptionForeground);">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--vscode-button-background);"></span>
                思考中...
              </span>
            </div>
          </div>
        </div>

        <!-- Phase Nav + Export bar (hidden in sidebar mode) -->
        <div id="phaseNav" class="flex-shrink-0 border-t px-4 py-1.5 flex items-center justify-between" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border);">
          <div class="flex items-center gap-2 text-[11px]" style="color: var(--vscode-descriptionForeground);">
            <span id="phaseIndicator" class="px-2 py-0.5 rounded-full text-[10px] font-medium" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">全面了解</span>
          </div>
          <div class="flex items-center gap-1">
            <button id="btnAdvance" class="text-[10px] px-2 py-1 rounded transition-colors disabled:opacity-30" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">下一阶段 →</button>
            <button id="btnExport" class="text-[10px] px-2 py-1 rounded transition-colors" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);" title="导出分析报告">导出报告</button>
          </div>
        </div>

        <!-- Input Area (hidden in sidebar mode) -->
        <div id="inputArea" class="flex-shrink-0 border-t px-4 py-3" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border);">
          <div class="flex gap-2 items-end" style="max-width: 768px; margin: 0 auto;">
            <textarea id="inputBox" 
              class="ap-input flex-1 resize-y rounded-2xl px-4 py-2.5 text-sm"
              style="min-height:46px; max-height:200px;"
              rows="2"
              placeholder="同志，请说说你面临的具体情况..."
            ></textarea>
            <button id="btnWeb" class="ap-btn-pill flex-shrink-0 h-11 px-3 text-xs font-medium inline-flex items-center gap-1" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);" title="联网搜索：开启后回答前自动搜索网络并抓取链接内容">${icon('globe', 14)} 联网</button>
            <button id="btnSend" class="ap-btn-pill flex-shrink-0 w-11 h-11 flex items-center justify-center" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); box-shadow: 0 1px 3px rgba(0,0,0,0.1);" title="发送">
              ${icon('arrowUp', 20)}
            </button>
            <button id="btnAbort" class="hidden ap-btn-pill flex-shrink-0 px-4 py-2.5 text-xs font-medium" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" title="停止">停止</button>
          </div>
          <p class="text-[10px] mt-1.5 text-center opacity-40" style="color: var(--vscode-descriptionForeground);">Enter 发送 · Shift+Enter 换行</p>
        </div>

        <!-- Usage Guide (sidebar mode only) -->
        <div id="usageArea" class="hidden flex-shrink-0 border-t px-4 py-3" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border);">
          <div class="text-xs space-y-2" style="color: var(--vscode-descriptionForeground);">
            <p class="font-semibold text-sm mb-2" style="color: var(--vscode-editor-foreground);">📖 使用方法</p>
            <p class="text-[11px] mb-1" style="color: var(--vscode-button-background);"><strong>⚠️ 首次使用必须先配置 API</strong></p>
            <div class="flex items-start gap-2"><span class="font-bold flex-shrink-0" style="color: var(--vscode-button-background);">1.</span><span>点击上方 ⚙ 进入设置页面</span></div>
            <div class="flex items-start gap-2"><span class="font-bold flex-shrink-0" style="color: var(--vscode-button-background);">2.</span><span>填入 <span class="px-1 py-0.5 rounded text-[10px]" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">API Key</span>（从 platform.deepseek.com 获取）</span></div>
            <div class="flex items-start gap-2"><span class="font-bold flex-shrink-0" style="color: var(--vscode-button-background);">3.</span><span>保存后点击上方 <span class="px-1.5 py-0.5 rounded text-[10px]" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">＋ 新建对话</span> 开始</span></div>
            <div class="border-t pt-2 mt-2" style="border-color: var(--vscode-sideBar-border);"><p class="text-[11px] italic">&ldquo;没有调查，就没有发言权&rdquo;</p></div>
          </div>
        </div>
      </div>
    `;
    bindEvents();
    updateWebBtnState();
    loadIconImage();
  }

  function loadIconImage() {
    const img = document.getElementById('welcomeIcon') as HTMLImageElement;
    if (!img) return;
    img.src = '';
  }

  function bindEvents() {
    setEl('btnSend', 'click', handleSend);
    setEl('btnAbort', 'click', handleAbort);
    setEl('btnNewSession', 'click', promptNewSession);
    setEl('btnCloseSession', 'click', closeSession);
    setEl('btnWeb', 'click', handleWebToggle);
    setEl('btnSettings', 'click', () => vscode.postMessage({ command: 'openSettings' }));
    setEl('btnHistory', 'click', () => vscode.postMessage({ command: 'openHistory' }));
    setEl('btnAdvance', 'click', () => vscode.postMessage({ command: 'advancePhase' }));
    setEl('btnExport', 'click', () => vscode.postMessage({ command: 'prepareReport' }));
    
    const inputBox = getEl('inputBox') as HTMLTextAreaElement;
    if (inputBox) {
      inputBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Markdown 链接：拦截默认跳转，交给宿主打开外部浏览器
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a[href]');
      if (target) {
        const url = (target as HTMLAnchorElement).href;
        if (url && !url.startsWith('#')) {
          vscode.postMessage({ command: 'openExternal', payload: url });
          e.preventDefault();
        }
      }
    });
  }

  function setEl(id: string, event: string, handler: () => void) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function getEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function handleSend() {
    if (isStreaming) return;
    const inputBox = getEl('inputBox') as HTMLTextAreaElement;
    const content = inputBox.value.trim();
    if (!content) return;

    if (!sessionLoaded) {
      // 直接开始对话（弹窗已取消、未填标题）：标题默认用对话开始的日期和时间，风格用设置里的默认
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const title = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      currentStyle = defaultStyle;
      const styleLabel = getEl('styleLabel');
      if (styleLabel) styleLabel.textContent = title; // 顶栏显示日期时间标题
      vscode.postMessage({ command: 'createSession', payload: { title, style: currentStyle } });
      sessionLoaded = true;
    }

    addMessage('user', content);
    inputBox.value = '';

    vscode.postMessage({ command: 'sendMessage', payload: { content, webSearch: webEnabled } });
  }

  /** 联网搜索开关：切换状态与按钮视觉 */
  function handleWebToggle() {
    webEnabled = !webEnabled;
    updateWebBtnState();
  }

  function updateWebBtnState() {
    const btn = getEl('btnWeb');
    if (!btn) return;
    if (webEnabled) {
      btn.style.background = 'var(--vscode-button-background)';
      btn.style.color = 'var(--vscode-button-foreground)';
      btn.innerHTML = `${icon('globe', 14)} 联网`;
      btn.title = '联网搜索已开启：回答前自动搜索网络并抓取链接内容（点击关闭）';
    } else {
      btn.style.background = 'var(--glass)';
      btn.style.color = 'var(--vscode-descriptionForeground)';
      btn.innerHTML = `${icon('globe', 14)} 联网`;
      btn.title = '联网搜索已关闭（点击开启）';
    }
  }

  function handleAbort() {
    vscode.postMessage({ command: 'abort' });
    stopStreaming();
  }

  // 头像 HTML（GPT 风格）
  function avatarHtml(role: 'user' | 'assistant'): string {
    if (role === 'assistant') {
      return `<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background: var(--glass); border: 1px solid var(--line);">
        ${icon('star', 14, '#5AC8FA')}
      </div>`;
    }
    return `<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">我</div>`;
  }

  function addMessage(role: 'user' | 'assistant', content: string, phase?: string) {
    const container = getEl('messagesContainer')!;
    
    const placeholder = getEl('placeholderMsg');
    if (placeholder) placeholder.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' ? 'flex justify-end gap-2' : 'flex justify-start gap-2';
    msgDiv.style.cssText = 'align-items: flex-start;';
    
    const phaseLabel = (role === 'assistant' && phase) 
      ? `<div class="text-[10px] mb-1 opacity-50" style="color: var(--vscode-descriptionForeground);">${phase}</div>` 
      : '';
    
    const bubbleClass = role === 'user'
      ? 'rounded-2xl rounded-br-lg px-4 py-2.5 max-w-[85%] text-sm leading-relaxed'
      : 'md-body border rounded-2xl rounded-bl-lg px-4 py-2.5 max-w-[85%] text-sm leading-relaxed';
    
    const bubbleStyle = role === 'user'
      ? `background: var(--vscode-button-background); color: var(--vscode-button-foreground);`
      : `background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-color: var(--line); color: var(--vscode-editor-foreground);`;
    
    // GPT 风格：用户消息纯文本转义防注入，AI 消息完整 Markdown 渲染
    const rendered = role === 'user'
      ? escapeHtml(content).replace(/\n/g, '<br>')
      : formatMarkdown(content);
    
    const bubbleHtml = `<div class="${bubbleClass}" style="${bubbleStyle}">${phaseLabel}${rendered}</div>`;
    msgDiv.innerHTML = role === 'assistant'
      ? `${avatarHtml(role)}${bubbleHtml}`
      : `${bubbleHtml}${avatarHtml(role)}`;
    
    const loading = getEl('loadingIndicator');
    if (loading) {
      container.insertBefore(msgDiv, loading);
    } else {
      container.appendChild(msgDiv);
    }
    container.scrollTop = container.scrollHeight;
    return msgDiv;
  }

  function getOrCreateStreamBubble(): HTMLElement {
    const container = getEl('messagesContainer')!;
    // 修复：用 data-is-stream 属性查找现有流式气泡，而非不存在的 .bg-white 类
    const existing = container.querySelector('[data-is-stream="true"]') as HTMLElement;
    if (existing) {
      return existing;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex justify-start gap-2';
    msgDiv.style.cssText = 'align-items: flex-start;';
    const bubble = document.createElement('div');
    bubble.className = 'md-body border rounded-2xl rounded-bl-lg px-4 py-2.5 max-w-[80%] text-sm leading-relaxed';
    bubble.style.cssText = 'background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-color: var(--line); color: var(--vscode-editor-foreground);';
    bubble.setAttribute('data-is-stream', 'true');
    // 阶段标签与正文分离：流式渲染只更新正文区，标签不重建，避免闪烁
    const phaseEl = document.createElement('div');
    phaseEl.className = 'text-[10px] mb-1 opacity-50';
    phaseEl.setAttribute('data-stream-phase', '');
    phaseEl.style.cssText = 'color: var(--vscode-descriptionForeground);';
    const contentEl = document.createElement('div');
    contentEl.setAttribute('data-stream-content', '');
    bubble.appendChild(phaseEl);
    bubble.appendChild(contentEl);
    msgDiv.innerHTML = avatarHtml('assistant');
    msgDiv.appendChild(bubble);

    const loading = getEl('loadingIndicator');
    if (loading) {
      container.insertBefore(msgDiv, loading);
    } else {
      container.appendChild(msgDiv);
    }
    return bubble;
  }

  function formatContent(text: string): string {
    // 流式轻量渲染（Markdown 基础格式，避免不完整语法闪烁）
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm text-brand-700">$1</code>')
      .replace(/\n/g, '<br>');
  }

  // GPT 风格：完整 Markdown 渲染（流式结束/历史消息用），DOMPurify 防 XSS
  function formatMarkdown(text: string): string {
    try {
      const html = marked.parse(text, { async: false }) as string;
      return DOMPurify.sanitize(html);
    } catch {
      return formatContent(text);
    }
  }

  function startStreaming() {
    isStreaming = true;
    streamingBuffer = '';
    const btnSend = getEl('btnSend') as HTMLButtonElement;
    const btnAbort = getEl('btnAbort');
    if (btnSend) btnSend.disabled = true;
    if (btnAbort) btnAbort.classList.remove('hidden');
    
    const loading = getEl('loadingIndicator');
    if (loading) loading.classList.remove('hidden');
    const placeholder = getEl('placeholderMsg');
    if (placeholder) placeholder.remove();
  }

  // 过滤流式输出中可能泄漏的思考标记和乱码字符
  // 注意：流式输出过程中只做轻量过滤，避免截断不完整的内容
  function filterGarbled(text: string): string {
    return text
      // 去除 DeepSeek R1 完整思考链标记
      .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/g, '')
      // 去除反思标记
      .replace(/<\|reflection\|>[\s\S]*?<\|reflection_end\|>/g, '')
      // 去除残留的思考标记前缀
      .replace(/<\|begin_of_thought\|>/g, '')
      .replace(/<\|end_of_thought\|>/g, '')
      .replace(/<\|reflection\|>/g, '')
      .replace(/<\|reflection_end\|>/g, '')
      // 去除 <think> 系思考块（完整与未闭合）
      .replace(/<\s*(think|thinking|thought|analysis|reasoning)\s*>[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
      .replace(/<\s*\/?\s*(think|thinking|thought|analysis|reasoning)\s*>/gi, '')
      // 清理连续空行
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function stopStreaming() {
    isStreaming = false;
    streamingBuffer = '';
    const btnSend = getEl('btnSend') as HTMLButtonElement;
    const btnAbort = getEl('btnAbort');
    if (btnSend) btnSend.disabled = false;
    if (btnAbort) btnAbort.classList.add('hidden');
    
    const loading = getEl('loadingIndicator');
    if (loading) loading?.classList.add('hidden');
    
    const streamBubble = document.querySelector('[data-is-stream="true"]');
    if (streamBubble) {
      streamBubble.removeAttribute('data-is-stream');
    }
  }

  function updatePhase(phase: string, label: string) {
    currentPhase = phase;
    const phaseLabel = getEl('phaseLabel');
    const phaseIndicator = getEl('phaseIndicator');
    const phaseShort = label.split('·')[1]?.trim() || label;
    if (phaseLabel) phaseLabel.textContent = phaseShort || '就绪';
    if (phaseIndicator) phaseIndicator.textContent = phaseShort || '全面了解';
    // update phase label on current stream bubble if any
    const streamPhaseLabel = document.querySelector('[data-stream-phase]');
    if (streamPhaseLabel) {
      streamPhaseLabel.textContent = phaseShort || '';
    }
  }

  function updateStyleLabel(style: string) {
    currentStyle = style;
    const styleLabel = getEl('styleLabel');
    if (!styleLabel) return;
    const map: Record<string, string> = {
      maoxuan: '毛选风格',
      yedinying: '叶丁风格',
      balanced: '平衡融合',
    };
    styleLabel.textContent = map[style] || style;
    // session 创建后 styleLabel 显示标题，需要区分
    if (sessionLoaded) {
      styleLabel.textContent = map[style] || style;
    }
  }

  // ------------ Message Handling ------------
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.command) {
      case 'promptNewSession':
        defaultStyle = message.payload?.style || 'balanced';
        showNewSessionDialog(defaultStyle);
        break;

      case 'setDefaultStyle':
        defaultStyle = message.payload || 'balanced';
        break;

      case 'sessionCreated':
        sessionLoaded = true;
        currentStyle = message.payload.style || 'balanced';
        updateStyleLabel(currentStyle);
        vscode.setState({ sessionId: message.payload.id });
        {
          const closeBtn = getEl('btnCloseSession');
          if (closeBtn) closeBtn.classList.remove('hidden');
        }
        break;

      case 'loadSession':
        sessionLoaded = true;
        currentStyle = message.payload.style || 'balanced';
        updateStyleLabel(currentStyle);
        vscode.setState({ sessionId: message.payload.id });
        currentPhase = message.payload.currentPhase;
        updatePhase(currentPhase, '');
        renderHistoryMessages(message.payload.messages);
        {
          // 顶栏显示当前对话主题
          const title = message.payload.title || '';
          const styleLabel = getEl('styleLabel');
          if (styleLabel) {
            styleLabel.textContent = title ? (title.length > 16 ? title.substring(0, 16) + '…' : title) : '当前对话';
          }
        }
        {
          const closeBtn = getEl('btnCloseSession');
          if (closeBtn) closeBtn.classList.remove('hidden');
        }
        break;

      case 'showWelcome':
        // 侧边栏不再使用 chat webview，此消息不再处理
        break;

      case 'streamStart':
        startStreaming();
        break;

      case 'assistantMessage': {
        const { text, done } = message.payload;
        if (!text) break;
        if (!done) {
          // 自愈：阶段自动推进的引导流没有 streamStart 消息，这里自动进入流式状态
          if (!isStreaming) startStreaming();
          const bubble = getOrCreateStreamBubble();
          // 更新阶段标签（标签元素固定存在，不再反复重建）
          const phaseEl = bubble.querySelector('[data-stream-phase]') as HTMLElement;
          if (phaseEl) {
            const phaseShort = currentPhase === 'understanding' ? '全面了解' :
              currentPhase === 'contradiction' ? '矛盾分析' :
              currentPhase === 'condition' ? '条件评估' :
              currentPhase === 'strategy' ? '战略建议' :
              currentPhase === 'tactics' ? '战术行动' :
              currentPhase === 'reflection' ? '反思迭代' : '';
            phaseEl.textContent = phaseShort;
          }

          streamingBuffer += text;
          // 使用 requestAnimationFrame 防抖合并渲染，避免逐字更新
          scheduleStreamRender();
        } else {
          // done=true 携带完整文本：先渲染最终 Markdown，再收尾（避免 stopStreaming 清空缓冲/移除标记后找不到气泡）
          const fullText = filterGarbled(text);
          const streamBubble = document.querySelector('[data-is-stream="true"]') as HTMLElement;
          if (streamBubble) {
            const contentEl = streamBubble.querySelector('[data-stream-content]') as HTMLElement;
            if (contentEl) contentEl.innerHTML = formatMarkdown(fullText);
            streamBubble.removeAttribute('data-is-stream');
          }
          stopStreaming();
        }
        const container = getEl('messagesContainer')!;
        container.scrollTop = container.scrollHeight;
        break;
      }

      case 'streamEnd':
        stopStreaming();
        break;

      case 'phaseChange':
        updatePhase(message.payload.phase, message.payload.label);
        break;

      case 'reportReady':
        showReportDialog(message.payload);
        break;

      case 'reportSaved':
        showReportSaveStatus(message.payload);
        break;

      case 'error':
        stopStreaming();
        showError(message.payload);
        break;
    }
  });

  function showNewSessionDialog(defaultStyleValue: string) {
    const initialStyle = defaultStyleValue || 'balanced';
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[400px] p-6">
        <h3 class="text-base font-semibold mb-4" style="color: var(--vscode-editor-foreground);">新建对话</h3>
        <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">对话标题</label>
        <input id="newTitleInput" type="text" class="ap-input w-full border rounded px-3 py-2 text-sm mb-4" placeholder="输入对话标题..." />
        <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">对话风格（选择后仅本次对话生效，不影响设置）</label>
        <div class="flex gap-2 mb-4">
          <label class="flex-1 cursor-pointer" data-style-card>
            <input type="radio" name="newStyle" value="balanced" class="hidden" />
            <div data-style-box class="border rounded-lg px-3 py-2 text-center text-xs" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
              平衡融合<span class="block text-[10px] opacity-60">毛选+叶丁</span>
            </div>
          </label>
          <label class="flex-1 cursor-pointer" data-style-card>
            <input type="radio" name="newStyle" value="maoxuan" class="hidden" />
            <div data-style-box class="border rounded-lg px-3 py-2 text-center text-xs" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
              毛选风格<span class="block text-[10px] opacity-60">原教旨主义</span>
            </div>
          </label>
          <label class="flex-1 cursor-pointer" data-style-card>
            <input type="radio" name="newStyle" value="yedinying" class="hidden" />
            <div data-style-box class="border rounded-lg px-3 py-2 text-center text-xs" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
              叶丁风格<span class="block text-[10px] opacity-60">见路不走</span>
            </div>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button id="cancelNewSession" class="ap-btn-pill px-4 py-2 text-sm" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);">取消</button>
          <button id="confirmNewSession" class="ap-btn-pill px-4 py-2 text-sm font-medium" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">开始对话</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const input = overlay.querySelector('#newTitleInput') as HTMLInputElement;
    input.focus();

    // 风格卡片：JS 驱动选中状态（点击必生效，视觉反馈明确）
    const cards = overlay.querySelectorAll('[data-style-card]');
    const applyStyleSelection = () => {
      cards.forEach((card) => {
        const radio = card.querySelector('input[type="radio"]') as HTMLInputElement;
        const box = card.querySelector('[data-style-box]') as HTMLElement;
        if (!box) return;
        const active = !!(radio && radio.checked);
        box.style.borderWidth = active ? '2px' : '1px';
        box.style.borderColor = active ? 'var(--vscode-button-background)' : 'var(--vscode-input-border)';
        box.style.fontWeight = active ? '700' : '400';
        box.style.background = active ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-input-background)';
      });
    };
    // 默认预选：设置里保存的风格
    const defaultRadio = overlay.querySelector(`input[name="newStyle"][value="${initialStyle}"]`) as HTMLInputElement;
    if (defaultRadio) defaultRadio.checked = true;
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const radio = card.querySelector('input[type="radio"]') as HTMLInputElement;
        if (radio) radio.checked = true;
        applyStyleSelection();
      });
    });
    applyStyleSelection();

    overlay.querySelector('#cancelNewSession')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmNewSession')?.addEventListener('click', () => {
      const title = input.value.trim();
      if (title) {
        const styleRadio = overlay.querySelector('input[name="newStyle"]:checked') as HTMLInputElement;
        const selectedStyle = styleRadio?.value || initialStyle;
        currentStyle = selectedStyle;
        updateStyleLabel(selectedStyle);
        sessionLoaded = false;
        const styleLabel = getEl('styleLabel');
        if (styleLabel) styleLabel.textContent = title.length > 16 ? title.substring(0, 16) + '…' : title;
        const container = getEl('messagesContainer')!;
        container.innerHTML = `
          <div id="placeholderMsg" class="text-center py-14">
            <div class="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style="background: var(--vscode-sideBar-background);">
              <span class="text-xl">★</span>
            </div>
            <p class="text-sm font-semibold mb-1" style="color: var(--vscode-editor-foreground);">${escapeHtml(title)}</p>
            <p class="text-xs" style="color: var(--vscode-descriptionForeground);">请描述你面临的具体情况，让我们一起分析</p>
          </div>
          <div id="loadingIndicator" class="hidden flex justify-start">
            <div class="border px-3 py-2 text-xs rounded" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border); color: var(--vscode-descriptionForeground);">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--vscode-button-background);"></span>
                思考中...
              </span>
            </div>
          </div>
        `;
        updatePhase('understanding', '第一阶段 · 全面了解');
        vscode.postMessage({ command: 'createSession', payload: { title, style: selectedStyle } });
        overlay.remove();
        setTimeout(() => {
          const inputBox = getEl('inputBox') as HTMLTextAreaElement;
          if (inputBox) inputBox.focus();
        }, 100);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        (overlay.querySelector('#confirmNewSession') as HTMLButtonElement)?.click();
      }
    });
  }

  function showReportDialog(report: string) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[90%] max-w-[640px] max-h-[85%] flex flex-col">
        <div class="px-5 py-3 border-b flex justify-between items-center" style="border-color: var(--vscode-editorWidget-border);">
          <span class="font-semibold text-sm" style="color: var(--vscode-editor-foreground);">专业分析报告</span>
          <button class="text-xl leading-none transition-colors" style="color: var(--vscode-descriptionForeground);" id="closeReport">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 text-sm whitespace-pre-wrap leading-relaxed" style="max-height:52vh; color: var(--vscode-editor-foreground);">${formatContent(report)}</div>
        <div class="px-4 pt-2" style="color: var(--vscode-descriptionForeground); font-size: 11px;">导出格式：可直接复制到任何文档使用</div>
        <div class="p-4 border-t flex flex-wrap justify-end gap-2" style="border-color: var(--line);">
          <button id="copyReport" class="ap-btn-pill px-3 py-2 text-xs font-medium" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">复制全文</button>
          <button id="saveMdReport" class="ap-btn-pill px-3 py-2 text-xs" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);">保存 Markdown</button>
          <button id="saveTxtReport" class="ap-btn-pill px-3 py-2 text-xs" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);">保存 TXT</button>
          <button id="saveDocReport" class="ap-btn-pill px-3 py-2 text-xs" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);">保存 Word</button>
          <button id="savePdfReport" class="ap-btn-pill px-3 py-2 text-xs font-medium" style="background: var(--glass); border: 1px solid var(--accent); color: var(--accent);">保存 PDF</button>
          <button id="dismissReport" class="ap-btn-pill px-3 py-2 text-xs" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);">关闭</button>
        </div>
        <div id="reportSaveStatus" class="hidden px-5 pb-4 text-xs" style="color: var(--vscode-descriptionForeground);"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('closeReport')?.addEventListener('click', () => overlay.remove());
    document.getElementById('dismissReport')?.addEventListener('click', () => overlay.remove());
    document.getElementById('copyReport')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(report);
        showReportSaveStatus({ success: true, message: '已复制到剪贴板，可直接粘贴使用' });
      } catch {
        showReportSaveStatus({ success: false, message: '复制失败，请手动选择文本复制' });
      }
    });
    const bindSave = (id: string, format: string) => {
      document.getElementById(id)?.addEventListener('click', () => {
        const btn = document.getElementById(id) as HTMLButtonElement;
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.6';
        }
        showReportSaveStatus({ success: null, message: `正在生成 ${format} 文件...` });
        vscode.postMessage({ command: 'exportReport', payload: { format } });
      });
    };
    bindSave('saveMdReport', 'md');
    bindSave('saveTxtReport', 'txt');
    bindSave('saveDocReport', 'doc');
    bindSave('savePdfReport', 'pdf');
  }

  function showReportSaveStatus(payload: any) {
    const el = document.getElementById('reportSaveStatus');
    if (!el) return;
    if (payload.success === null) {
      el.classList.remove('hidden');
      el.textContent = payload.message || '';
      return;
    }
    el.classList.remove('hidden');
    if (payload.success) {
      el.style.color = '#34c759';
      el.textContent = `✓ 已保存：${payload.filePath || ''}（${(payload.format || '').toUpperCase()}）`;
    } else {
      el.style.color = '#ff3b30';
      el.textContent = `✗ ${payload.message || '保存失败'}`;
    }
  }

  function showError(message: string) {
    const container = getEl('messagesContainer')!;
    const placeholder = getEl('placeholderMsg');
    if (placeholder) placeholder.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'flex justify-center';
    errorDiv.innerHTML = `<div class="border rounded px-4 py-2.5 text-sm" style="background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border-color: var(--vscode-inputValidation-errorBorder);">${message}</div>`;
    container.appendChild(errorDiv);
    container.scrollTop = container.scrollHeight;
  }

  function renderHistoryMessages(messages: any[]) {
    const container = getEl('messagesContainer')!;
    container.innerHTML = `<div id="loadingIndicator" class="hidden flex justify-start">
      <div class="border px-3 py-2 text-xs rounded" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border); color: var(--vscode-descriptionForeground);">
        <span class="inline-flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--vscode-button-background);"></span>
          思考中...
        </span>
      </div>
    </div>`;
    
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const phaseMap: Record<string, string> = {
          understanding: '全面了解', contradiction: '矛盾分析', condition: '条件评估',
          strategy: '战略建议', tactics: '战术行动', reflection: '反思迭代',
        };
        const phaseLabel = msg.phase ? phaseMap[msg.phase] || '' : '';
        try {
          addMessage(msg.role, msg.content, phaseLabel);
        } catch {
          // 单条消息渲染失败不阻断其余历史
        }
      }
    }
  }

  function promptNewSession() {
    showNewSessionDialog(defaultStyle);
  }

  function closeSession() {
    // 重置状态，回到欢迎页面
    sessionLoaded = false;
    currentStyle = defaultStyle;
    updateStyleLabel(defaultStyle);
    const container = getEl('messagesContainer')!;
    container.innerHTML = `
      <div id="placeholderMsg" class="text-center py-16">
        <p class="text-base font-semibold mb-1" style="color: var(--vscode-editor-foreground);">没有调查，就没有发言权</p>
        <p class="text-sm" style="color: var(--vscode-descriptionForeground);">告诉我你面临的问题，我们一起用实事求是的方法来分析</p>
      </div>
      <div id="loadingIndicator" class="hidden flex justify-start">
        <div class="border px-3 py-2 text-xs rounded" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border); color: var(--vscode-descriptionForeground);">
          <span class="inline-flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--vscode-button-background);"></span>
            思考中...
          </span>
        </div>
      </div>
    `;
    const styleLabel = getEl('styleLabel');
    if (styleLabel) styleLabel.textContent = '平衡融合';
    const closeBtn = getEl('btnCloseSession');
    if (closeBtn) closeBtn.classList.add('hidden');
    const inputBox = getEl('inputBox') as HTMLTextAreaElement;
    if (inputBox) inputBox.value = '';
    vscode.setState({ sessionId: null });
    // 通知宿主清除当前会话（修复：否则导出报告仍导旧会话）
    vscode.postMessage({ command: 'closeSession' });
  }

  function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // 通知宿主 webview 已就绪：宿主将补发排队中的消息（如历史加载），避免过早发送丢失
  vscode.postMessage({ command: 'webviewReady' });
})();