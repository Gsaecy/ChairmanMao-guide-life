/**
 * 对话面板 Webview 入口 - Apple 风格简洁界面
 */
import './globals.css';

(function () {
  const vscode = acquireVsCodeApi();
  let streamingBuffer = '';
  let isStreaming = false;
  let currentPhase = 'understanding';
  let sessionLoaded = false;

  let currentStyle: string = 'balanced'; // 当前对话风格

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
      const clean = filterGarbled(streamingBuffer);
      bubble.innerHTML = formatContent(clean);
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
    lastRenderTime = performance.now();
    const clean = filterGarbled(streamingBuffer);
    bubble.innerHTML = formatContent(clean);
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
            <button id="btnNewSession" class="ap-btn-pill text-xs px-3 py-1.5 font-medium" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">
              ＋ 新建对话
            </button>
            <button id="btnCloseSession" class="hidden ap-btn-pill text-xs px-3 py-1.5" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" title="关闭当前对话">关闭对话</button>
            <button id="btnHistory" class="ap-btn-pill text-xs px-3 py-1.5" style="background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); color: var(--vscode-descriptionForeground); border: 1px solid var(--line);">历史记录</button>
            <button id="btnSettings" class="ap-btn-pill text-xs px-3 py-1.5" style="background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); color: var(--vscode-descriptionForeground); border: 1px solid var(--line);">设置</button>
          </div>
        </div>

        <!-- Messages Area with Adaptive Width (max ~680px centered) -->
        <div id="messagesContainer" class="flex-1 overflow-y-auto py-3 space-y-3" style="background: var(--vscode-editor-background); padding-left: max(12px, calc((100% - 680px) / 2)); padding-right: max(12px, calc((100% - 680px) / 2));">
          <div id="placeholderMsg" class="text-center py-16">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 overflow-hidden" style="background: var(--vscode-sideBar-background);">
              <img id="welcomeIcon" src="" alt="★" style="width:36px; height:36px; object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"/>
              <span id="welcomeStarFallback" style="display:none; font-size:28px;">★</span>
            </div>
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
        <div id="inputArea" class="flex-shrink-0 border-t px-4 py-2" style="background: var(--vscode-sideBar-background); border-color: var(--vscode-sideBar-border);">
          <div class="flex gap-2 items-end" style="padding-left: max(0px, calc((100% - 680px) / 2)); padding-right: max(0px, calc((100% - 680px) / 2));">
            <textarea id="inputBox" 
              class="ap-input flex-1 resize-y border rounded px-3 py-2 text-sm"
              style="min-height:48px;"
              rows="3"
              placeholder="同志，请说说你面临的具体情况..."
            ></textarea>
            <button id="btnSend" class="ap-btn-pill flex-shrink-0 px-5 py-2.5 text-sm font-semibold" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              发送
            </button>
            <button id="btnAbort" class="hidden ap-btn-pill flex-shrink-0 px-4 py-2.5 text-xs font-medium" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" title="停止">停止</button>
          </div>
          <p class="text-[10px] mt-1 opacity-40" style="padding-left: max(0px, calc((100% - 680px) / 2)); color: var(--vscode-descriptionForeground);">Enter 发送 · Shift+Enter 换行</p>
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
    setEl('btnSettings', 'click', () => vscode.postMessage({ command: 'openSettings' }));
    setEl('btnHistory', 'click', () => vscode.postMessage({ command: 'openHistory' }));
    setEl('btnAdvance', 'click', () => vscode.postMessage({ command: 'advancePhase' }));
    setEl('btnExport', 'click', () => vscode.postMessage({ command: 'exportReport' }));
    
    const inputBox = getEl('inputBox') as HTMLTextAreaElement;
    if (inputBox) {
      inputBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
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
      const title = content.length > 30 ? content.substring(0, 30) + '...' : content;
      currentStyle = 'balanced';
      updateStyleLabel(currentStyle);
      vscode.postMessage({ command: 'createSession', payload: { title, style: currentStyle } });
      sessionLoaded = true;
    }

    addMessage('user', content);
    inputBox.value = '';
    
    vscode.postMessage({ command: 'sendMessage', payload: { content } });
  }

  function handleAbort() {
    vscode.postMessage({ command: 'abort' });
    stopStreaming();
  }

  function addMessage(role: 'user' | 'assistant', content: string, phase?: string) {
    const container = getEl('messagesContainer')!;
    
    const placeholder = getEl('placeholderMsg');
    if (placeholder) placeholder.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
    
    const phaseLabel = (role === 'assistant' && phase) 
      ? `<div class="text-[10px] mb-1 opacity-50" style="color: var(--vscode-descriptionForeground);">${phase}</div>` 
      : '';
    
    const bubbleClass = role === 'user'
      ? 'rounded-2xl rounded-br-lg px-4 py-2.5 max-w-[85%] text-sm leading-relaxed'
      : 'border rounded-2xl rounded-bl-lg px-4 py-2.5 max-w-[85%] text-sm leading-relaxed';
    
    const bubbleStyle = role === 'user'
      ? `background: var(--vscode-button-background); color: var(--vscode-button-foreground);`
      : `background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-color: var(--line); color: var(--vscode-editor-foreground);`;
    
    msgDiv.innerHTML = `<div class="${bubbleClass}" style="${bubbleStyle}">${phaseLabel}${formatContent(content)}</div>`;
    
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
    let streamBubble = container.querySelector('[data-is-stream="true"]') as HTMLElement;
    if (streamBubble) {
      return streamBubble;
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex justify-start';
    const bubble = document.createElement('div');
    bubble.className = 'border rounded-2xl rounded-bl-lg px-4 py-2.5 max-w-[80%] text-sm leading-relaxed';
    bubble.style.cssText = 'background: var(--glass); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border-color: var(--line); color: var(--vscode-editor-foreground);';
    bubble.setAttribute('data-is-stream', 'true');
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
    // 渲染 Markdown 基本格式
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm text-brand-700">$1</code>')
      .replace(/\n/g, '<br>');
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
        showNewSessionDialog();
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
          // ensure phase label on stream bubble
          let phaseLabel = bubble.querySelector('[data-stream-phase]') as HTMLElement;
          if (!phaseLabel) {
            phaseLabel = document.createElement('div');
            phaseLabel.className = 'text-[10px] mb-1 opacity-50';
            phaseLabel.setAttribute('data-stream-phase', '');
            phaseLabel.style.cssText = 'color: var(--vscode-descriptionForeground);';
            // insert after any existing phase label, or at beginning
            const existing = bubble.querySelector('[data-stream-phase]');
            if (!existing) bubble.insertBefore(phaseLabel, bubble.firstChild);
          }
          const phaseShort = currentPhase === 'understanding' ? '全面了解' : 
            currentPhase === 'contradiction' ? '矛盾分析' : 
            currentPhase === 'condition' ? '条件评估' : 
            currentPhase === 'strategy' ? '战略建议' : 
            currentPhase === 'tactics' ? '战术行动' : 
            currentPhase === 'reflection' ? '反思迭代' : '';
          phaseLabel.textContent = phaseShort;
          
          streamingBuffer += text;
          // 使用 requestAnimationFrame 防抖合并渲染，避免逐字更新
          scheduleStreamRender();
        } else {
          stopStreaming();
          const streamBubble = document.querySelector('[data-is-stream="true"]');
          if (streamBubble) {
            streamBubble.removeAttribute('data-is-stream');
            // 使用累积的 streamingBuffer 而非 text，确保内容完整
            const fullText = streamingBuffer || text;
            const clean = filterGarbled(fullText);
            streamBubble.innerHTML = formatContent(clean);
          }
          streamingBuffer = '';
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

      case 'error':
        stopStreaming();
        showError(message.payload);
        break;
    }
  });

  function showNewSessionDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[400px] p-6">
        <h3 class="text-base font-semibold mb-4" style="color: var(--vscode-editor-foreground);">新建对话</h3>
        <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">对话标题</label>
        <input id="newTitleInput" type="text" class="ap-input w-full border rounded px-3 py-2 text-sm mb-4" placeholder="输入对话标题..." />
        <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">对话风格（选择后本次对话不可更改）</label>
        <div class="flex gap-2 mb-4">
          <label class="flex-1">
            <input type="radio" name="newStyle" value="balanced" checked class="hidden peer" />
            <div class="border rounded-lg px-3 py-2 text-center text-xs cursor-pointer transition-colors peer-checked:border-2 peer-checked:font-bold" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
              平衡融合<span class="block text-[10px] opacity-60">毛选+叶丁</span>
            </div>
          </label>
          <label class="flex-1">
            <input type="radio" name="newStyle" value="maoxuan" class="hidden peer" />
            <div class="border rounded-lg px-3 py-2 text-center text-xs cursor-pointer transition-colors peer-checked:border-2 peer-checked:font-bold" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
              毛选风格<span class="block text-[10px] opacity-60">原教旨主义</span>
            </div>
          </label>
          <label class="flex-1">
            <input type="radio" name="newStyle" value="yedinying" class="hidden peer" />
            <div class="border rounded-lg px-3 py-2 text-center text-xs cursor-pointer transition-colors peer-checked:border-2 peer-checked:font-bold" style="border-color: var(--vscode-input-border); color: var(--vscode-editor-foreground); background: var(--vscode-input-background);">
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
    
    overlay.querySelector('#cancelNewSession')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmNewSession')?.addEventListener('click', () => {
      const title = input.value.trim();
      if (title) {
        const styleRadio = overlay.querySelector('input[name="newStyle"]:checked') as HTMLInputElement;
        const selectedStyle = styleRadio?.value || 'balanced';
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
      <div class="ap-dialog w-[90%] max-w-[600px] max-h-[80%] flex flex-col">
        <div class="px-5 py-3 border-b flex justify-between items-center" style="border-color: var(--vscode-editorWidget-border);">
          <span class="font-semibold text-sm" style="color: var(--vscode-editor-foreground);">对话总结报告</span>
          <button class="text-xl leading-none transition-colors" style="color: var(--vscode-descriptionForeground);" id="closeReport">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 text-sm whitespace-pre-wrap leading-relaxed" style="max-height:55vh; color: var(--vscode-editor-foreground);">${formatContent(report)}</div>
        <div class="p-4 border-t flex justify-end gap-2" style="border-color: var(--line);">
          <button id="copyReport" class="ap-btn-pill px-4 py-2 text-sm font-medium" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">复制</button>
          <button id="dismissReport" class="ap-btn-pill px-4 py-2 text-sm" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    
    document.getElementById('closeReport')?.addEventListener('click', () => overlay.remove());
    document.getElementById('dismissReport')?.addEventListener('click', () => overlay.remove());
    document.getElementById('copyReport')?.addEventListener('click', () => {
      navigator.clipboard.writeText(report);
    });
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
        addMessage(msg.role, msg.content, phaseLabel);
      }
    }
  }

  function promptNewSession() {
    showNewSessionDialog();
  }

  function closeSession() {
    // 重置状态，回到欢迎页面
    sessionLoaded = false;
    currentStyle = 'balanced';
    updateStyleLabel('balanced');
    const container = getEl('messagesContainer')!;
    container.innerHTML = `
      <div id="placeholderMsg" class="text-center py-16">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 overflow-hidden" style="background: var(--vscode-sideBar-background);">
          <img id="welcomeIcon" src="" alt="★" style="width:36px; height:36px; object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"/>
          <span id="welcomeStarFallback" style="display:none; font-size:28px;">★</span>
        </div>
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
})();