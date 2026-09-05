/**
 * 设置面板 Webview 入口
 */
import './globals.css';
import { icon } from './lucideIcons';

(function () {
  const vscode = acquireVsCodeApi();
  let currentConfig: any = {};

  const app = document.getElementById('root')!;
  renderApp();

  function renderApp() {
    app.innerHTML = `
      <div class="p-4 max-w-lg mx-auto">
        <div class="flex items-center gap-2 mb-4 pb-2" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <button id="btnBack" class="ap-btn-pill px-3 py-1 text-xs inline-flex items-center gap-1" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);" title="返回侧边栏主页">
            ${icon('x', 12)} 返回
          </button>
          <h1 class="text-lg font-bold inline-flex items-center gap-2" style="color: var(--vscode-editor-foreground); margin: 0;">${icon('settings', 18)} 设置</h1>
        </div>

        <!-- AI 供应商 -->
        <section class="mb-6">
          <h2 class="text-sm font-bold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('bot', 14)} AI 供应商</h2>

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">供应商</label>
          <select id="provider" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-3">
            <option value="deepseek">DeepSeek 官方</option>
            <option value="openai">OpenAI 官方</option>
            <option value="dashscope">阿里云百炼 DashScope</option>
            <option value="moonshot">月之暗面 Kimi</option>
            <option value="glm">智谱 GLM</option>
            <option value="siliconflow">硅基流动 SiliconFlow</option>
            <option value="custom">自定义（OpenAI 兼容）</option>
          </select>

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">API 地址（选品牌自动填充；仅「自定义」需手动填）</label>
          <input id="apiBaseUrl" type="text" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-3" 
            placeholder="https://api.deepseek.com" />

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">API Key</label>
          <input id="apiKey" type="password" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-3" 
            placeholder="sk-..." />

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">模型名称（可下拉选择，也可自定义输入）</label>
          <input id="model" type="text" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-4" 
            placeholder="deepseek-chat" list="modelList" />
          <datalist id="modelList"></datalist>
        </section>

        <!-- 对话设置 -->
        <section class="mb-6">
          <h2 class="text-sm font-bold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('message', 14)} 对话设置</h2>

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">Temperature（0-2，建议 0.7）</label>
          <input id="temperature" type="range" class="w-full mb-3" min="0" max="2" step="0.1" value="0.7" />
          <div class="text-xs mb-3" style="color: var(--vscode-descriptionForeground);">
            当前值：<span id="tempValue">0.7</span>
          </div>

          <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">最大 Token 数</label>
          <input id="maxTokens" type="number" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-4" 
            placeholder="4096" />
        </section>

        <!-- 风格偏好 -->
        <section class="mb-6">
          <h2 class="text-sm font-bold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('palette', 14)} 风格偏好</h2>
          <select id="style" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-2">
            <option value="balanced">平衡融合（推荐）</option>
            <option value="maoxuan">偏重毛选原教旨主义</option>
            <option value="yedinying">偏重叶子农/丁元英方法论</option>
          </select>
          <p id="styleDesc" class="text-xs mb-3" style="color: var(--vscode-descriptionForeground);">
            自然地融合毛选思想与叶子农/丁元英方法论。在分析矛盾格局时多用毛选框架；在分析个人条件时多用"见路不走"框架。
          </p>
        </section>

        <!-- 联网搜索设置 -->
        <section class="mb-6">
          <h2 class="text-sm font-bold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('globe', 14)} 联网搜索（可选）</h2>

          <label class="flex items-center gap-2 mb-3">
            <input id="webSearchEnabled" type="checkbox" class="rounded" />
            <span class="text-xs" style="color: var(--vscode-descriptionForeground);">启用联网搜索功能</span>
          </label>

          <div id="searchSettings" class="hidden">
            <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">搜索引擎（可自定义输入）</label>
            <input id="searchEngine" type="text" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-3" 
              placeholder="serpapi / bing / anysearch / 自定义..." list="searchEngineList" />
            <datalist id="searchEngineList">
              <option value="serpapi">
              <option value="bing">
              <option value="anysearch">
            </datalist>

            <label class="block text-xs mb-1" style="color: var(--vscode-descriptionForeground);">搜索 API Key</label>
            <input id="searchApiKey" type="password" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-4" 
              placeholder="搜索 API Key" />
          </div>
        </section>

        <!-- 存储设置 -->
        <section class="mb-6">
          <h2 class="text-sm font-bold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('folder', 14)} 存储路径（可选）</h2>
          <input id="storagePath" type="text" class="ap-input w-full border rounded px-3 py-1.5 text-sm" 
            placeholder="留空使用默认路径" />
        </section>

        <!-- 操作按钮 -->
        <div class="flex gap-3 pt-4" style="border-top: 1px solid var(--vscode-sideBar-border);">
          <button id="btnSave" class="ap-btn-pill flex-1 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
            ${icon('check', 14)} 保存设置
          </button>
          <button id="btnReset" class="ap-btn-pill px-4 py-2 text-sm inline-flex items-center gap-1.5" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">
            ${icon('refresh', 14)} 恢复默认
          </button>
        </div>
      </div>
    `;
    bindEvents();
  }

  function bindEvents() {
    setEl('btnSave', 'click', handleSave);
    setEl('btnReset', 'click', handleReset);
    setEl('temperature', 'input', handleTempChange);
    setEl('webSearchEnabled', 'change', handleSearchToggle);
    setEl('style', 'change', handleStyleChange);
    setEl('provider', 'change', handleProviderChange);
    setEl('btnBack', 'click', () => vscode.postMessage({ command: 'closeSettings' }));
  }

  function setEl(id: string, event: string, handler: (e?: any) => void) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function getEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function getVal(id: string): string {
    return (getEl(id) as HTMLInputElement | HTMLSelectElement)?.value || '';
  }

  function setVal(id: string, value: string) {
    const el = getEl(id) as HTMLInputElement | HTMLSelectElement;
    if (el) el.value = value;
  }

  function getChecked(id: string): boolean {
    return (getEl(id) as HTMLInputElement)?.checked || false;
  }

  function setChecked(id: string, value: boolean) {
    const el = getEl(id) as HTMLInputElement;
    if (el) el.checked = value;
  }

  function loadConfig(config: any) {
    currentConfig = { ...config };
    const provider = config.provider || 'deepseek';
    setVal('provider', provider);
    setVal('apiBaseUrl', config.apiBaseUrl || PROVIDERS[provider]?.endpoint || 'https://api.deepseek.com');
    setVal('apiKey', config.apiKey || '');
    setVal('model', config.model || (PROVIDERS[provider]?.models?.[0]) || 'deepseek-chat');
    setVal('maxTokens', String(config.maxTokens || 4096));
    setVal('temperature', String(config.temperature || 0.7));
    setVal('style', config.style || 'balanced');
    setVal('storagePath', config.storagePath || '');
    setChecked('webSearchEnabled', config.webSearchEnabled || false);
    setVal('searchEngine', config.searchEngine || 'serpapi');
    setVal('searchApiKey', config.searchApiKey || '');
    
    (getEl('tempValue') as HTMLElement).textContent = String(config.temperature || 0.7);
    updateStyleDesc(config.style || 'balanced');
    toggleSearchSettings(config.webSearchEnabled);
    renderModelList(provider);
  }

  function collectConfig(): any {
    return {
      provider: getVal('provider'),
      apiBaseUrl: getVal('apiBaseUrl'),
      apiKey: getVal('apiKey'),
      model: getVal('model'),
      temperature: parseFloat(getVal('temperature')),
      maxTokens: parseInt(getVal('maxTokens'), 10),
      style: getVal('style'),
      storagePath: getVal('storagePath'),
      webSearchEnabled: getChecked('webSearchEnabled'),
      searchEngine: getVal('searchEngine'),
      searchApiKey: getVal('searchApiKey'),
    };
  }

  // AI 供应商预设（参考扩展选择助手）
  const PROVIDERS: Record<string, { endpoint: string; models: string[] }> = {
    deepseek: { endpoint: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
    openai: { endpoint: 'https://api.openai.com', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
    dashscope: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
    moonshot: { endpoint: 'https://api.moonshot.cn', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
    glm: { endpoint: 'https://open.bigmodel.cn/api/paas', models: ['glm-4-flash', 'glm-4-plus'] },
    siliconflow: { endpoint: 'https://api.siliconflow.cn', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct'] },
    custom: { endpoint: '', models: [] },
  };

  function renderModelList(provider: string) {
    const dl = getEl('modelList');
    if (!dl) return;
    dl.innerHTML = (PROVIDERS[provider]?.models || [])
      .map((m) => `<option value="${m}"></option>`)
      .join('');
  }

  function handleProviderChange() {
    const p = getVal('provider');
    const info = PROVIDERS[p];
    if (!info) return;
    if (info.endpoint) setVal('apiBaseUrl', info.endpoint);
    if (info.models.length) setVal('model', info.models[0]);
    renderModelList(p);
  }

  function handleSave() {
    const config = collectConfig();
    vscode.postMessage({ command: 'saveConfig', payload: config });
  }

  function handleReset() {
    loadConfig({
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4096,
      style: 'balanced',
      storagePath: '',
      webSearchEnabled: false,
      searchEngine: 'serpapi',
      searchApiKey: '',
    });
  }

  function handleTempChange(e: any) {
    const val = e.target?.value || 0.7;
    const el = getEl('tempValue') as HTMLElement;
    if (el) el.textContent = val;
  }

  function handleSearchToggle() {
    toggleSearchSettings(getChecked('webSearchEnabled'));
  }

  function toggleSearchSettings(enabled: boolean) {
    const el = getEl('searchSettings');
    if (el) {
      el.className = enabled ? '' : 'hidden';
    }
  }

  function handleStyleChange() {
    const style = getVal('style');
    updateStyleDesc(style);
  }

  function updateStyleDesc(style: string) {
    const desc = getEl('styleDesc');
    if (!desc) return;
    const descriptions: Record<string, string> = {
      balanced: '自然地融合毛选思想与叶子农/丁元英方法论。在分析矛盾格局时多用毛选框架；在分析个人条件时多用"见路不走"框架。',
      maoxuan: '更多直接引用毛泽东选集原文，使用毛选中常见的表达方式。语言风格更偏向革命年代的政治论述风。',
      yedinying: '更多使用叶子农"见路不走"和丁元英"文化属性"的概念框架。少用政治术语，多谈因果、条件、实事求是。',
    };
    desc.textContent = descriptions[style] || descriptions.balanced;
  }

  // ------------ Message Handling ------------
  window.addEventListener('message', (event) => {
    const message = event.data;
    
    switch (message.command) {
      case 'loadConfig':
        loadConfig(message.payload);
        break;
    }
  });
})();