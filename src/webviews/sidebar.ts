/**
 * 侧边栏专属 Webview 入口
 * —— 仅显示导航信息，不包含对话模块
 */
import './globals.css';
import { icon } from './lucideIcons';

(function () {
  const vscode = acquireVsCodeApi();

  // --------- 全局状态：必须在任何调用之前声明，避免 TDZ 运行时错误 ---------
  let currentView = 'home';
  let modelOptions: string[] = [];
  let modelDropdownOpen = false;
  /** 官方模型缓存：同一「供应商+地址+Key」只请求一次 */
  let detectedModelsCache: { sig: string; models: string[] } | null = null;
  let modelDetectPending = false;
  let detectReqSig = '';
  /** 已保存到宿主侧的 Key（与输入框比对，判断已应用/待保存） */
  let savedApiKey = '';
  let settingsDirty = false;
  /** 最近一次静默自动检测的失败原因（用于展示为什么还是预设列表） */
  let silentDetectError = '';

  const app = document.getElementById('root')!;
  renderApp();

  function renderApp() {
    app.innerHTML = `
      <div class="flex flex-col h-full" style="background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground);">
        <!-- 第一行：扩展名 + 当前回答风格徽章 -->
        <div class="app-topbar flex-shrink-0 px-3 py-2 flex items-center gap-2" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <span class="flex flex-col leading-tight">
            <span class="text-sm font-semibold">毛主席思想指导</span>
            <span class="text-[9px]" style="color: var(--vscode-descriptionForeground);">Chairman Mao's Thought Guidance</span>
          </span>
          <span id="styleBadge" class="text-[10px] px-1.5 py-0.5 rounded-full" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">平衡融合</span>
        </div>

        <!-- 导航行：新建对话 / 主页 / 设置 / 历史（等宽水平居中，图标+文字） -->
        <div class="flex-shrink-0 px-2 py-1.5 flex items-center gap-1.5" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <button id="btnNewChat" class="ap-btn-pill flex-1 h-8 text-xs font-medium inline-flex items-center justify-center gap-1" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);">
            ${icon('plus', 12)} 新建对话
          </button>
          <button id="navHome" class="nav-btn ap-btn-pill flex-1 h-8 text-[11px] inline-flex items-center justify-center gap-1" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);" title="主页">
            ${icon('home', 12)} 主页
          </button>
          <button id="navSettings" class="nav-btn ap-btn-pill flex-1 h-8 text-[11px] inline-flex items-center justify-center gap-1" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);" title="设置">
            ${icon('settings', 12)} 设置
          </button>
          <button id="navHistory" class="nav-btn ap-btn-pill flex-1 h-8 text-[11px] inline-flex items-center justify-center gap-1" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);" title="历史记录">
            ${icon('clock', 12)} 历史
          </button>
        </div>

        <!-- 主页视图 -->
        <div id="viewHome" class="flex-1 overflow-y-auto flex flex-col items-center px-3 pb-3 text-center" style="min-height: 0;">
          <p class="text-xl font-bold mt-3 mb-0.5" style="color: var(--vscode-editor-foreground);">毛主席思想指导</p>
          <p class="text-base font-semibold mb-1" style="color: var(--vscode-editor-foreground);">调用毛主席的思想，为你指导解决问题</p>
          <p class="text-xs italic mb-3" style="color: var(--vscode-descriptionForeground);">没有调查，就没有发言权——面对职场困惑、创业抉择、关系难题、人生方向，用实事求是的方法论，把问题一层层想明白。</p>

          <!-- 功能介绍：这些功能为什么服务 -->
          <div class="ap-card w-full text-left p-3 mb-2">
            <p class="text-sm font-semibold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('sparkles', 14)} 它能帮你做什么</p>
            <div class="grid grid-cols-2 gap-2">
              <div class="rounded-xl p-2.5" style="background: var(--chip-bg, rgba(127,127,127,0.08)); border: 1px solid var(--line);">
                <div class="flex items-center gap-1.5 mb-1 text-[13px] font-semibold" style="color: var(--vscode-editor-foreground);">${icon('message', 14, '#5AC8FA')} 把问题想透</div>
                <p class="text-xs leading-snug" style="color: var(--vscode-descriptionForeground);">六阶段递进提问：了解→矛盾→条件→战略→战术→反思，不急着下结论</p>
              </div>
              <div class="rounded-xl p-2.5" style="background: var(--chip-bg, rgba(127,127,127,0.08)); border: 1px solid var(--line);">
                <div class="flex items-center gap-1.5 mb-1 text-[13px] font-semibold" style="color: var(--vscode-editor-foreground);">${icon('palette', 14, '#5AC8FA')} 用顺耳的方式</div>
                <p class="text-xs leading-snug" style="color: var(--vscode-descriptionForeground);">毛选 / 叶丁 / 平衡融合三种风格，按会话选你最听得进去的分析口吻</p>
              </div>
              <div class="rounded-xl p-2.5" style="background: var(--chip-bg, rgba(127,127,127,0.08)); border: 1px solid var(--line);">
                <div class="flex items-center gap-1.5 mb-1 text-[13px] font-semibold" style="color: var(--vscode-editor-foreground);">${icon('fileDown', 14, '#5AC8FA')} 把思路沉淀</div>
                <p class="text-xs leading-snug" style="color: var(--vscode-descriptionForeground);">一键导出 Markdown 分析报告：可执行、可复盘、可分享</p>
              </div>
              <div class="rounded-xl p-2.5" style="background: var(--chip-bg, rgba(127,127,127,0.08)); border: 1px solid var(--line);">
                <div class="flex items-center gap-1.5 mb-1 text-[13px] font-semibold" style="color: var(--vscode-editor-foreground);">${icon('clock', 14, '#5AC8FA')} 每次都有迹可循</div>
                <p class="text-xs leading-snug" style="color: var(--vscode-descriptionForeground);">历史自动保存，随时回看之前的分析，对照变化、反思成长</p>
              </div>
            </div>
          </div>

          <!-- 使用说明 -->
          <div class="ap-card w-full text-left p-3 mb-2">
            <p class="text-sm font-semibold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('book', 14)} 使用方法</p>
            <div class="flex items-start gap-1.5 text-xs mb-1.5">
              <span class="flex-shrink-0 flex items-center">${icon('menu', 12, '#5AC8FA')}</span>
              <strong style="color: #B42318;">首次使用必须先配置 API</strong>
            </div>
            <div class="flex items-start gap-1.5 text-xs mb-1" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">1.</span><span>点击 ⚙ 设置 进入设置页面</span></div>
            <div class="flex items-start gap-1.5 text-xs mb-1" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">2.</span><span>填入 API Key（从 platform.deepseek.com 获取）</span></div>
            <div class="flex items-start gap-1.5 text-xs mb-1" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">3.</span><span>保存后点击 ＋新建对话 开始</span></div>
            <div class="mt-2 pt-2 text-xs italic opacity-60" style="border-top: 1px solid var(--line); color: var(--vscode-descriptionForeground);">&ldquo;读书是学习，使用也是学习，而且是更重要的学习。&rdquo;</div>
          </div>

          <!-- 赞助与开发链接 -->
          <div class="ap-card w-full p-3">
            <p class="text-sm font-semibold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('heart', 14)} 赞助与支持</p>
            <div class="space-y-1.5 text-left">
              <a data-external href="https://hongyuguo.com" class="flex items-center gap-2 text-xs transition-opacity hover:opacity-70" style="color: #B42318; text-decoration: none;">
                <span class="flex items-center">${icon('user', 13, '#5AC8FA')}</span><span>开发者个人主页 · hongyuguo.com</span>
              </a>
              <a data-external href="https://github.com/Gsaecy/ChairmanMao-guide-life" class="flex items-center gap-2 text-xs transition-opacity hover:opacity-70" style="color: #B42318; text-decoration: none;">
                <span class="flex items-center">${icon('star', 13, '#5AC8FA')}</span><span>GitHub 项目与赞赏</span>
              </a>
            </div>
          </div>
        </div>

        <!-- 设置视图 -->
        <div id="viewSettings" class="hidden flex-1 overflow-y-auto" style="min-height: 0;">
          <div class="p-3">
            <h2 class="text-base font-bold mb-3 inline-flex items-center gap-2" style="color: var(--vscode-editor-foreground);">${icon('settings', 16)} 设置</h2>

            <div class="ap-card p-3 mb-2" style="margin-bottom: 10px;">
              <p class="text-sm font-semibold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('bot', 14)} AI 供应商</p>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">Agent 供应商</label>
              <select id="provider" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-2">
                <option value="deepseek">DeepSeek 官方</option>
                <option value="openai">OpenAI 官方</option>
                <option value="dashscope">阿里云百炼 DashScope</option>
                <option value="moonshot">月之暗面 Kimi</option>
                <option value="glm">智谱 GLM</option>
                <option value="siliconflow">硅基流动 SiliconFlow</option>
                <option value="custom">自定义（OpenAI 兼容）</option>
              </select>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">API 地址（选品牌自动填充；仅「自定义」需手动填）</label>
              <input id="apiBaseUrl" type="text" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-2" placeholder="https://api.deepseek.com" />
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">API Key</label>
              <div class="flex items-center gap-2 mb-1">
                <input id="apiKey" type="password" class="ap-input flex-1 min-w-0 border rounded px-3 py-1.5 text-sm" placeholder="sk-..." autocomplete="off" />
                <button id="btnEye" type="button" class="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground); cursor: pointer;" title="显示/隐藏 Key">${icon('eye', 14)}</button>
                <span id="apiKeyStatus" class="flex-shrink-0 text-[10px] px-2 py-1 rounded-full" style="background: rgba(127,127,127,0.12); color: var(--vscode-descriptionForeground);">未填写</span>
              </div>
              <button id="btnApplyKey" class="ap-btn-pill w-full px-4 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1 mb-2" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--line);">${icon('zap', 12)} 应用 Key 并自动检测模型</button>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">模型名称（可下拉选择，也可自定义输入）</label>
              <div class="flex items-center gap-2 mb-1">
                <div class="relative flex-1 min-w-0" id="modelDropWrap">
                  <input id="model" type="text" class="ap-input w-full border rounded pl-3 pr-8 py-1.5 text-sm" placeholder="官网检测后自动填充" autocomplete="off" />
                  <button id="btnModelDrop" type="button" class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg" style="background: transparent; border: none; color: var(--vscode-descriptionForeground); cursor: pointer;" title="下拉选择模型">${icon('chevronDown', 14)}</button>
                </div>
                <button id="btnDetect" class="ap-btn-pill flex-shrink-0 px-3 py-1.5 text-xs" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-editor-foreground);">检测模型</button>
              </div>
              <!-- 展开时占用文档流空间：所属卡片自动增高，后面的卡片下移，不会被遮住 -->
              <div id="modelDropdown" class="hidden mt-1 mb-1 w-full max-h-56 overflow-y-auto rounded-xl py-1" style="background: var(--vscode-editor-background, #1e1e1e); border: 1px solid var(--line-strong); box-shadow: 0 8px 24px rgba(0,0,0,0.25);"></div>
              <div id="modelResult" class="hidden text-xs mt-1 px-2 py-1 rounded inline-flex items-center gap-1"></div>
            </div>

            <div class="ap-card p-3 mb-2" style="margin-bottom: 10px;">
              <p class="text-sm font-semibold mb-2 inline-flex items-center gap-1.5" style="color: var(--vscode-editor-foreground);">${icon('message', 14)} 对话与风格设置</p>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">温度（0=严谨稳定，2=发散多变，建议 0.7）</label>
              <input id="temperature" type="range" class="w-full mb-1" min="0" max="2" step="0.1" value="0.7" />
              <p class="text-xs mb-2" style="color: var(--vscode-descriptionForeground);">当前值：<span id="tempValue">0.7</span></p>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">单次回答最大 Token 数（1 个汉字 ≈ 1 Token，超出截断）</label>
              <input id="maxTokens" type="number" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-2" placeholder="4096" />
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">回答风格</label>
              <select id="style" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-1">
                <option value="balanced">平衡融合（推荐）</option>
                <option value="maoxuan">偏重毛选原教旨主义</option>
                <option value="yedinying">偏重叶子农/丁元英方法论</option>
              </select>
              <p id="styleDesc" class="text-xs" style="color: var(--vscode-descriptionForeground);"></p>
              <label class="block text-[11px] mt-2 mb-1" style="color: var(--vscode-descriptionForeground);">联网搜索</label>
              <label class="flex items-center gap-2 mb-2">
                <input id="webSearchEnabled" type="checkbox" class="rounded" />
                <span class="text-xs" style="color: var(--vscode-descriptionForeground);">回答前自动搜索网络，并抓取消息中的链接内容</span>
              </label>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">搜索引擎</label>
              <select id="searchEngine" class="ap-input w-full border rounded px-3 py-1.5 text-sm mb-2">
                <option value="bing">必应 Bing（免费，无需 Key）</option>
                <option value="serpapi">SerpAPI（结果更全，需填 Key）</option>
              </select>
              <label class="block text-[11px] mb-1" style="color: var(--vscode-descriptionForeground);">搜索 API Key（仅 SerpAPI 需要，选必应留空）</label>
              <input id="searchApiKey" type="password" class="ap-input w-full border rounded px-3 py-1.5 text-sm" placeholder="选必应无需填写" />
            </div>

            <div class="flex gap-2">
              <button id="btnSave" class="flex-1 px-4 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-all" style="background: var(--glass); color: var(--accent); border: 1px solid var(--accent); border-radius: 980px;">${icon('check', 14)} 保存设置</button>
              <button id="btnReset" class="px-4 py-2 text-sm inline-flex items-center gap-1.5 transition-all" style="background: var(--glass); color: var(--vscode-editor-foreground); border: 1px solid var(--line-strong); border-radius: 980px;">${icon('refresh', 14)} 恢复默认</button>
            </div>
            <div id="statusBar" class="hidden mt-2 px-3 py-2 rounded-xl text-xs inline-flex items-center gap-1.5" style="background: rgba(52,199,89,0.12); color: #34c759;">${icon('check', 12)} 设置正常，请尽情使用</div>
            <div id="formIssues" class="hidden mt-2 space-y-1 rounded-xl p-2" style="background: rgba(255,59,48,0.08);"></div>
          </div>
        </div>

        <!-- 历史视图 -->
        <div id="viewHistory" class="hidden flex-1 overflow-y-auto" style="min-height: 0;">
          <div class="p-3">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-bold inline-flex items-center gap-2" style="color: var(--vscode-editor-foreground); margin: 0;">${icon('list', 16)} 历史对话</h2>
              <button id="btnRefresh" class="ap-btn-pill text-xs px-3 py-1.5 font-medium inline-flex items-center gap-1" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">${icon('refresh', 12)} 刷新</button>
            </div>
            <div id="sessionsList" class="space-y-2">
              <p class="text-sm text-center py-8" style="color: var(--vscode-descriptionForeground);">加载中...</p>
            </div>
          </div>
        </div>
      </div>
    `;
    bindEvents();
    updateNavState();
    loadIcon();
  }

  // --------- 视图路由 ---------
  function switchView(view: 'home' | 'settings' | 'history') {
    getEl('viewHome')?.classList.toggle('hidden', view !== 'home');
    getEl('viewSettings')?.classList.toggle('hidden', view !== 'settings');
    getEl('viewHistory')?.classList.toggle('hidden', view !== 'history');
    currentView = view;
    updateNavState();
    if (view === 'settings') {
      // 每次打开设置都重新同步官网最新模型（清缓存强制刷新）
      detectedModelsCache = null;
      silentDetectError = '';
      vscode.postMessage({ command: 'getConfig' });
    } else if (view === 'history') {
      vscode.postMessage({ command: 'refreshHistory' });
    }
  }

  /** 导航高亮跟随当前视图：仅当前视图按钮蓝底，其余玻璃底 */
  function updateNavState() {
    const applyNav = (id: string, active: boolean) => {
      const b = getEl(id);
      if (!b) return;
      if (active) {
        b.style.background = 'var(--vscode-button-background)';
        b.style.color = 'var(--vscode-button-foreground)';
        b.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
      } else {
        b.style.background = 'var(--glass)';
        b.style.color = 'var(--vscode-editor-foreground)';
        b.style.boxShadow = 'none';
      }
    };
    // 新建对话是操作按钮，不参与高亮；只有导航按钮跟随当前视图
    applyNav('navHome', currentView === 'home');
    applyNav('navSettings', currentView === 'settings');
    applyNav('navHistory', currentView === 'history');
  }

  function getEl(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  function setEl(id: string, event: string, handler: (e?: any) => void) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler as EventListener);
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

  function loadIcon() {
    const img = document.getElementById('welcomeIcon') as HTMLImageElement;
    if (!img) return;
    img.src = ''; // 由后端 postMessage 注入
  }

  function bindEvents() {
    document.getElementById('btnNewChat')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'newChatSession' });
    });
    getEl('navHome')?.addEventListener('click', () => switchView('home'));
    getEl('navSettings')?.addEventListener('click', () => switchView('settings'));
    getEl('navHistory')?.addEventListener('click', () => switchView('history'));

    // 设置表单
    setEl('btnSave', 'click', handleSave);
    setEl('btnReset', 'click', handleReset);
    setEl('btnDetect', 'click', handleDetect);
    setEl('btnEye', 'click', handleEyeToggle);
    setEl('btnApplyKey', 'click', handleApplyKey);
    setEl('temperature', 'input', handleTempChange);
    setEl('style', 'change', handleStyleChange);
    setEl('provider', 'change', handleProviderChange);
    setEl('apiBaseUrl', 'input', markDirty);
    setEl('maxTokens', 'input', markDirty);
    setEl('webSearchEnabled', 'change', markDirty);
    setEl('searchEngine', 'change', markDirty);
    setEl('searchApiKey', 'input', markDirty);
    const apiKeyInput = getEl('apiKey');
    if (apiKeyInput) apiKeyInput.addEventListener('input', () => { updateKeyStatus(); markDirty(); });

    // 模型下拉框（自定义，点击即展开/收起）
    setEl('btnModelDrop', 'click', (e) => {
      e.stopPropagation();
      if (modelDropdownOpen) {
        closeModelDropdown();
      } else {
        openModelDropdown();
        const input = getEl('model');
        if (input) input.focus();
      }
    });
    const modelInput = getEl('model');
    if (modelInput) {
      modelInput.addEventListener('focus', openModelDropdown);
      modelInput.addEventListener('input', () => {
        if (!modelDropdownOpen) openModelDropdown();
        renderModelDropdown(); // 输入时按当前值高亮
        markDirty();
      });
    }
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (modelDropdownOpen && !target.closest('#modelDropWrap') && !target.closest('#modelDropdown')) closeModelDropdown();
    });

    // 历史
    setEl('btnRefresh', 'click', () => vscode.postMessage({ command: 'refreshHistory' }));

    // 开发者主页 / GitHub 项目链接：拦截默认跳转，交给宿主打开外部浏览器
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a[data-external]');
      if (target) {
        const url = (target as HTMLAnchorElement).href;
        if (url) {
          vscode.postMessage({ command: 'openExternal', payload: url });
          e.preventDefault();
        }
      }
    });
  }

  // --------- 设置逻辑 ---------
  const PROVIDERS: Record<string, { endpoint: string; models: string[] }> = {
    deepseek: { endpoint: 'https://api.deepseek.com', models: [] },
    openai: { endpoint: 'https://api.openai.com', models: [] },
    dashscope: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode', models: [] },
    moonshot: { endpoint: 'https://api.moonshot.cn', models: [] },
    glm: { endpoint: 'https://open.bigmodel.cn/api/paas', models: [] },
    siliconflow: { endpoint: 'https://api.siliconflow.cn', models: [] },
    custom: { endpoint: '', models: [] },
  };

  // --------- 模型下拉框（自定义组件，点击必展开，比原生 datalist 可靠） ---------

  function detectSig(cfg: any): string {
    return `${cfg.provider}|${cfg.apiBaseUrl}|${cfg.apiKey}`;
  }

  function setModelOptions(options: string[]) {
    modelOptions = Array.isArray(options) ? options.filter(Boolean) : [];
    if (modelDropdownOpen) renderModelDropdown();
  }

  function renderModelDropdown() {
    const dd = getEl('modelDropdown');
    if (!dd) return;
    if (modelDetectPending) {
      dd.innerHTML = `<div class="px-3 py-2 text-xs" style="color: var(--vscode-descriptionForeground);">正在从官方接口获取最新模型列表...</div>`;
      return;
    }
    if (!modelOptions.length) {
      if (silentDetectError) {
        dd.innerHTML = `<div class="px-3 py-2 text-xs" style="color: var(--vscode-descriptionForeground);">官网模型获取失败，点「检测模型」重试</div>`;
      } else if (!getVal('apiKey')) {
        dd.innerHTML = `<div class="px-3 py-2 text-xs" style="color: var(--vscode-descriptionForeground);">配置 API Key 并保存后，自动获取官网最新模型</div>`;
      } else {
        dd.innerHTML = `<div class="px-3 py-2 text-xs" style="color: var(--vscode-descriptionForeground);">暂无候选模型，点「检测模型」自动获取</div>`;
      }
      return;
    }
    const current = getVal('model');
    dd.innerHTML = modelOptions
      .map((m) => {
        const active = m === current;
        return `<button type="button" class="model-option w-full text-left px-3 py-1.5 text-sm" data-value="${escapeHtml(m)}" style="background: ${active ? 'var(--vscode-list-hoverBackground)' : 'transparent'}; color: var(--vscode-editor-foreground); border: none; cursor: pointer;">${escapeHtml(m)}</button>`;
      })
      .join('');
    dd.querySelectorAll('.model-option').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const v = (btn as HTMLElement).getAttribute('data-value');
        if (v) setVal('model', v);
        closeModelDropdown();
      });
    });
  }

  function openModelDropdown() {
    const dd = getEl('modelDropdown');
    if (!dd) return;
    modelDropdownOpen = true;
    dd.classList.remove('hidden');
    renderModelDropdown();
    // 双保险：打开下拉时若无官方列表且无失败记录，再触发一次静默同步
    if (!detectedModelsCache && !modelDetectPending && !silentDetectError) {
      autoDetectModels();
    }
  }

  function closeModelDropdown() {
    const dd = getEl('modelDropdown');
    if (!dd) return;
    modelDropdownOpen = false;
    dd.classList.add('hidden');
  }

  function renderModelList(provider: string) {
    setModelOptions(PROVIDERS[provider]?.models || []);
  }

  /** 静默自动检测：打开设置/切换供应商时，用已配置的 Key 从官方接口拉取真实模型列表 */
  function autoDetectModels() {
    if (modelDetectPending) return; // 已有请求在途中，避免重复
    const config = collectConfig();
    config.apiKey = (config.apiKey || '').trim();
    config.apiBaseUrl = (config.apiBaseUrl || '').trim();
    if (!config.apiKey || !config.apiBaseUrl) {
      // 未配置 Key：无法调用官方接口，先显示预设
      modelDetectPending = false;
      silentDetectError = '';
      detectedModelsCache = null;
      renderModelList(config.provider);
      return;
    }
    const sig = detectSig(config);
    if (detectedModelsCache && detectedModelsCache.sig === sig) {
      modelDetectPending = false;
      setModelOptions(detectedModelsCache.models);
      return;
    }
    modelDetectPending = true;
    silentDetectError = '';
    detectReqSig = sig;
    if (modelDropdownOpen) renderModelDropdown();
    vscode.postMessage({ command: 'detectModels', payload: config, silent: true });
  }

  function handleProviderChange() {
    const p = getVal('provider');
    const info = PROVIDERS[p];
    if (!info) return;
    if (info.endpoint) setVal('apiBaseUrl', info.endpoint);
    setVal('model', ''); // 不再用预设名称，官方模型检测后自动填充
    renderModelList(p);
    autoDetectModels();
    markDirty();
  }

  function loadConfig(config: any) {
    const provider = config.provider || 'deepseek';
    setVal('provider', provider);
    setVal('apiBaseUrl', config.apiBaseUrl || PROVIDERS[provider]?.endpoint || 'https://api.deepseek.com');
    setVal('apiKey', config.apiKey || '');
    setVal('model', config.model || '');
    setVal('maxTokens', String(config.maxTokens || 4096));
    setVal('temperature', String(config.temperature || 0.7));
    setVal('style', config.style || 'balanced');
    setChecked('webSearchEnabled', config.webSearchEnabled !== false);
    setVal('searchEngine', config.searchEngine || 'bing');
    setVal('searchApiKey', config.searchApiKey || '');
    const tv = getEl('tempValue');
    if (tv) tv.textContent = String(config.temperature || 0.7);
    updateStyleDesc(config.style || 'balanced');
    renderModelList(provider);
    savedApiKey = config.apiKey || '';
    updateKeyStatus();
    autoDetectModels();
    markClean();
    updateStyleBadge(config.style || 'balanced');
  }

  /** 眼睛按钮：显示/隐藏 Key */
  function handleEyeToggle() {
    const input = getEl('apiKey') as HTMLInputElement;
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    const btn = getEl('btnEye');
    if (btn) btn.innerHTML = icon(showing ? 'eye' : 'eyeOff', 14);
  }

  /** 「应用 Key 并自动检测模型」：单独保存 Key 并立即验证（与扩展选择助手一致） */
  function handleApplyKey() {
    const key = getVal('apiKey');
    const result = getEl('modelResult');
    const showErr = (msg: string) => {
      if (result) {
        result.classList.remove('hidden');
        result.style.background = 'rgba(255,59,48,0.12)';
        result.style.color = '#ff3b30';
        result.innerHTML = `${icon('x', 12)} ${escapeHtml(msg)}`;
      }
    };
    if (!key) {
      showErr('请先粘贴 API Key');
      return;
    }
    if (/[•\*]/.test(key)) {
      showErr('Key 含打码字符（• 或 *）：请粘贴完整的原始 Key，不要从已打码的界面上复制');
      return;
    }
    vscode.postMessage({ command: 'saveConfig', payload: collectConfig() });
    savedApiKey = key;
    updateKeyStatus();
    markClean();
    const btn = getEl('btnApplyKey');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `${icon('check', 12)} 已应用，正在检测模型...`;
      setTimeout(() => { btn.innerHTML = orig; }, 2500);
    }
    handleDetect();
  }

  /** API Key 状态徽章 + 底部状态条（比对输入框与已保存 Key） */
  function updateKeyStatus() {
    const field = getVal('apiKey');
    const badge = getEl('apiKeyStatus');
    if (badge) {
      if (!field) {
        badge.textContent = '未填写';
        badge.style.background = 'rgba(127,127,127,0.12)';
        badge.style.color = 'var(--vscode-descriptionForeground)';
      } else if (savedApiKey && field === savedApiKey) {
        badge.textContent = '已应用 ✓';
        badge.style.background = 'rgba(52,199,89,0.16)';
        badge.style.color = '#34c759';
      } else {
        badge.textContent = '待保存';
        badge.style.background = 'rgba(255,149,0,0.16)';
        badge.style.color = '#ff9500';
      }
    }
    const bar = getEl('statusBar');
    if (bar) {
      // 只有 Key 已保存且官网模型同步成功时才显示「设置正常」
      const ok = !!field && !!savedApiKey && field === savedApiKey && !!detectedModelsCache;
      bar.classList.toggle('hidden', !ok);
    }
  }

  /** 检测模型按钮：调用宿主请求真实 /models 列表 */
  function handleDetect() {
    const result = getEl('modelResult');
    const btn = getEl('btnDetect');
    if (result && btn) {
      result.classList.remove('hidden');
      result.style.background = 'rgba(255,255,255,0.06)';
      result.style.color = 'var(--vscode-descriptionForeground)';
      result.innerHTML = `${icon('refresh', 12)} 检测中...`;
      result.setAttribute('data-loading', '1');
      btn.textContent = '检测中...';
    }
    const config = collectConfig();
    // 去掉粘贴可能带入的多余空格/换行，避免“Key 无效”误报
    config.apiKey = (config.apiKey || '').trim();
    config.apiBaseUrl = (config.apiBaseUrl || '').trim();
    if (/[•\*]/.test(config.apiKey)) {
      vscode.postMessage({
        command: 'modelsResult',
        payload: {
          success: false,
          message: 'API Key 含打码字符（• 或 *）：请粘贴完整的原始 Key（可点右侧 👁 按钮核对输入框内容）',
        },
      });
      return;
    }
    if (!config.apiKey || !config.apiBaseUrl) {
      vscode.postMessage({
        command: 'modelsResult',
        payload: { success: false, message: '请先配置 API 地址与 API Key' },
      });
      return;
    }
    detectReqSig = detectSig(config);
    modelDetectPending = true;
    vscode.postMessage({ command: 'detectModels', payload: config });
  }

  /** 模型检测结果：填充下拉列表 + 状态标签（silent=打开设置时的静默拉取，不弹标签） */
  function handleModelsResult(payload: any) {
    const btn = getEl('btnDetect');
    if (btn) btn.textContent = '检测模型';
    modelDetectPending = false;
    const silent = !!payload.silent;

    if (payload.success && payload.models?.length) {
      detectedModelsCache = { sig: detectReqSig, models: payload.models };
      setModelOptions(payload.models);
      // 官方列表为准：输入框为空或不在官方列表中的旧名称，自动换成第一个官方模型
      const input = getEl('model') as HTMLInputElement;
      if (input && (!input.value || !payload.models.includes(input.value))) {
        input.value = payload.models[0];
        markDirty(); // 官方模型替换了旧值，提示可保存
      }
      updateKeyStatus(); // 同步成功后底部状态条才显示「设置正常」
    }

    const result = getEl('modelResult');
    if (silent) {
      // 后台静默同步：不显示状态标签，仅更新下拉框；失败仅记录原因（下拉框占位提示）
      if (payload.success && payload.models?.length) {
        silentDetectError = '';
      } else {
        silentDetectError = payload.message || '检测失败';
      }
      return;
    }
    if (!result) return;
    result.removeAttribute('data-loading');
    result.classList.remove('hidden');
    if (payload.success && payload.models?.length) {
      result.style.background = 'rgba(52,199,89,0.12)';
      result.style.color = '#34c759';
      result.innerHTML = `${icon('check', 12)} 检测到 ${payload.models.length} 个模型，点输入框右侧箭头可选择`;
    } else {
      let msg = payload.message || '检测失败';
      if (msg.includes('API Key 无效')) {
        msg += ' 若确认 Key 无误，请点 API Key 右侧 👁 按钮核对输入框内容（可能是旧 Key 残留），重新粘贴完整 Key 后再点「应用」。';
      }
      result.style.background = 'rgba(255,59,48,0.12)';
      result.style.color = '#ff3b30';
      result.innerHTML = `${icon('x', 12)} ${escapeHtml(msg)}`;
    }
  }

  function collectConfig(): any {
    return {
      provider: getVal('provider'),
      apiBaseUrl: (getVal('apiBaseUrl') || '').trim(),
      apiKey: (getVal('apiKey') || '').trim(),
      model: (getVal('model') || '').trim(),
      temperature: parseFloat(getVal('temperature')),
      maxTokens: parseInt(getVal('maxTokens'), 10),
      style: getVal('style'),
      webSearchEnabled: getChecked('webSearchEnabled'),
      searchEngine: getVal('searchEngine') || 'bing',
      searchApiKey: (getVal('searchApiKey') || '').trim(),
    };
  }

  // --------- 保存按钮状态机：绿色锁定「已保存 ✓」直到设置被修改 ---------
  function updateSaveBtnState() {
    const btn = getEl('btnSave') as HTMLButtonElement;
    if (!btn) return;
    if (!settingsDirty) {
      btn.disabled = true;
      btn.style.opacity = '1';
      btn.style.background = 'rgba(52,199,89,0.14)';
      btn.style.borderColor = '#34c759';
      btn.style.color = '#34c759';
      btn.innerHTML = `${icon('check', 14)} 已保存`;
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.background = 'var(--glass)';
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
      btn.innerHTML = `${icon('check', 14)} 保存设置`;
    }
  }

  function markDirty() {
    settingsDirty = true;
    updateSaveBtnState();
  }

  function markClean() {
    settingsDirty = false;
    updateSaveBtnState();
  }

  /** 保存前校验：error 阻断保存并聚焦，warn 仅提示不阻断（仿扩展选择助手分级） */
  function validateConfig(): { field: string; level: 'error' | 'warn'; text: string }[] {
    const issues: { field: string; level: 'error' | 'warn'; text: string }[] = [];
    const baseUrl = getVal('apiBaseUrl');
    const key = getVal('apiKey');
    const model = getVal('model');
    if (!baseUrl) {
      issues.push({ field: 'apiBaseUrl', level: 'error', text: 'API 地址不能为空（选择供应商可自动填充）' });
    } else if (!/^https?:\/\//i.test(baseUrl)) {
      issues.push({ field: 'apiBaseUrl', level: 'error', text: 'API 地址格式不正确：需以 http:// 或 https:// 开头' });
    }
    if (/[•\*]/.test(key)) {
      issues.push({ field: 'apiKey', level: 'error', text: 'API Key 含打码字符（• 或 *）：请粘贴完整的原始 Key' });
    }
    if (!key) {
      issues.push({ field: 'apiKey', level: 'warn', text: '尚未填写 API Key，暂时无法对话（可稍后补填再保存）' });
    }
    if (!model) {
      issues.push({ field: 'model', level: 'warn', text: '模型名称为空：点「检测模型」或从下拉框选择' });
    }
    return issues;
  }

  function showFormIssues(issues: { field: string; level: 'error' | 'warn'; text: string }[]) {
    const box = getEl('formIssues');
    if (!box) return;
    if (!issues.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = issues
      .map((it) => {
        const color = it.level === 'error' ? '#ff3b30' : '#ff9500';
        const tag = it.level === 'error' ? '错误' : '提醒';
        return `<div class="flex items-start gap-1 text-xs" style="color: ${color};"><span class="flex-shrink-0 font-bold">${tag}</span><span>${escapeHtml(it.text)}</span></div>`;
      })
      .join('');
  }

  function handleSave() {
    const issues = validateConfig();
    showFormIssues(issues);
    const firstError = issues.find((i) => i.level === 'error');
    if (firstError) {
      const el = getEl(firstError.field) as HTMLElement;
      if (el && typeof el.focus === 'function') el.focus();
      markDirty();
      return;
    }
    const btn = getEl('btnSave') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = `${icon('refresh', 14)} 保存中...`;
    }
    vscode.postMessage({ command: 'saveConfig', payload: collectConfig() });
    savedApiKey = getVal('apiKey');
    updateKeyStatus();
    // 保存后自动检测模型：粘贴 Key → 保存 → 立刻验证，无需任何额外操作
    if (getVal('apiKey')) handleDetect();
    // 保存完成 → 绿色「已保存 ✓」锁定，直到设置被修改
    setTimeout(() => {
      markClean();
    }, 350);
  }

  function handleReset() {
    showResetConfirm();
  }

  function showResetConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[300px] p-5">
        <h3 class="text-base font-semibold mb-2" style="color: var(--vscode-editor-foreground);">恢复默认设置</h3>
        <p class="text-sm mb-4" style="color: var(--vscode-descriptionForeground);">将清空 API Key 并恢复全部默认值，此操作不可撤销。确定继续吗？</p>
        <div class="flex justify-end gap-2">
          <button id="cancelReset" class="ap-btn-pill px-4 py-1.5 text-sm" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);">取消</button>
          <button id="confirmReset" class="ap-btn-pill px-4 py-1.5 text-sm font-medium" style="background: #ff3b30; border: 1px solid #ff3b30; color: #fff;">确认恢复</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#cancelReset')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmReset')?.addEventListener('click', () => {
      overlay.remove();
      applyReset();
    });
  }

  function applyReset() {
    loadConfig({ provider: 'deepseek', apiBaseUrl: 'https://api.deepseek.com', apiKey: '', model: '', temperature: 0.7, maxTokens: 4096, style: 'balanced' });
    vscode.postMessage({ command: 'saveConfig', payload: collectConfig() });
    savedApiKey = '';
    updateKeyStatus();
    markClean();
    // 按钮状态反馈：已恢复 ✓（保持带边框样式，仅变绿色）
    const btn = getEl('btnReset');
    if (btn) {
      const orig = btn.innerHTML;
      btn.style.borderColor = '#34c759';
      btn.style.color = '#34c759';
      btn.innerHTML = `${icon('check', 14)} 已恢复`;
      setTimeout(() => {
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.innerHTML = orig;
      }, 1800);
    }
  }

  function handleTempChange(e: any) {
    const val = e.target?.value || 0.7;
    const el = getEl('tempValue');
    if (el) el.textContent = val;
    markDirty();
  }

  function handleStyleChange() {
    updateStyleDesc(getVal('style'));
    markDirty();
  }

  function updateStyleDesc(style: string) {
    const desc = getEl('styleDesc');
    if (!desc) return;
    const descriptions: Record<string, string> = {
      balanced: '自然地融合毛选思想与叶子农/丁元英方法论。分析矛盾时用毛选框架；分析个人条件时用“见路不走”框架。',
      maoxuan: '更多直接引用毛泽东选集原文，使用毛选中常见的表达方式，语言风格更偏革命年代的政治论述风。',
      yedinying: '更多使用“见路不走”和“文化属性”的概念框架，少用政治术语，多谈因果、条件、实事求是。',
    };
    desc.textContent = descriptions[style] || descriptions.balanced;
  }

  /** 顶栏风格徽章：显示当前真实回答风格 */
  function updateStyleBadge(style: string) {
    const badge = getEl('styleBadge');
    if (!badge) return;
    const map: Record<string, string> = {
      maoxuan: '毛选风格',
      yedinying: '叶丁风格',
      balanced: '平衡融合',
    };
    badge.textContent = map[style] || style || '平衡融合';
  }

  // --------- 历史逻辑 ---------
  function renderSessions(sessions: any[]) {
    const container = getEl('sessionsList');
    if (!container) return;
    if (!sessions || sessions.length === 0) {
      container.innerHTML = `<div class="text-center py-12">
          <div class="flex justify-center mb-2" style="color: var(--vscode-descriptionForeground);">${icon('inbox', 36)}</div>
          <p class="text-sm" style="color: var(--vscode-descriptionForeground);">暂无历史对话</p>
          <p class="text-xs mt-1" style="color: var(--vscode-descriptionForeground); opacity: 0.7;">开始一个新的对话吧</p>
        </div>`;
      return;
    }
    container.innerHTML = sessions.map((session) => {
      const title = session.title || '未命名对话';
      return `
      <div class="ap-card p-3" data-session-id="${escapeHtml(session.id)}">
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0 cursor-pointer" data-open-session="${escapeHtml(session.id)}">
            <h3 class="text-sm font-semibold mb-1 truncate" style="color: var(--vscode-editor-foreground);">${escapeHtml(title)}</h3>
            <p class="text-xs truncate" style="color: var(--vscode-descriptionForeground); opacity: 0.9;">${escapeHtml(session.preview || '')}${session.preview ? '…' : ''}</p>
            <p class="text-[10px] mt-1" style="color: var(--vscode-descriptionForeground); opacity: 0.75;">${escapeHtml(formatRelativeTime(session.updatedAt || session.createdAt))} · ${getPhaseName(session.currentPhase)} · ${session.messageCount || 0} 条</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="open-btn text-xs px-2 py-1 rounded inline-flex items-center gap-1" style="background: var(--glass); color: var(--vscode-editor-foreground); border: 1px solid var(--line);" data-session-id="${escapeHtml(session.id)}" title="查看对话内容">${icon('message', 11)} 查看</button>
            <button class="delete-btn text-xs px-2 py-1 rounded inline-flex items-center gap-1" style="background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--line);" data-session-id="${escapeHtml(session.id)}" title="删除该记录">${icon('trash', 11)}</button>
          </div>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.open-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).getAttribute('data-session-id');
        if (sessionId) vscode.postMessage({ command: 'selectSession', payload: { sessionId } });
      });
    });
    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).getAttribute('data-session-id');
        if (sessionId) showDeleteConfirm(sessionId);
      });
    });
    container.querySelectorAll('[data-open-session]').forEach((area) => {
      area.addEventListener('click', () => {
        const sessionId = (area as HTMLElement).getAttribute('data-open-session');
        if (sessionId) vscode.postMessage({ command: 'selectSession', payload: { sessionId } });
      });
    });
  }

  function showDeleteConfirm(sessionId: string) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[300px] p-5">
        <h3 class="text-base font-semibold mb-2" style="color: var(--vscode-editor-foreground);">确认删除</h3>
        <p class="text-sm mb-4" style="color: var(--vscode-descriptionForeground);">删除后不可恢复，确定删除这个对话吗？</p>
        <div class="flex justify-end gap-2">
          <button id="cancelDelete" class="ap-btn-pill px-4 py-1.5 text-sm" style="background: var(--glass); border: 1px solid var(--line); color: var(--vscode-descriptionForeground);">取消</button>
          <button id="confirmDelete" class="ap-btn-pill px-4 py-1.5 text-sm font-medium" style="background: #ff3b30; color: #fff;">确认删除</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#cancelDelete')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmDelete')?.addEventListener('click', () => {
      overlay.remove();
      vscode.postMessage({ command: 'deleteSession', payload: { sessionId } });
    });
  }

  function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 48 * 3600 * 1000) return '昨天';
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getPhaseName(phase: string): string {
    const map: Record<string, string> = {
      understanding: '全面了解', contradiction: '矛盾分析', condition: '条件评估',
      strategy: '战略建议', tactics: '战术行动', reflection: '反思迭代', complete: '对话完成',
    };
    return map[phase] || phase;
  }

  function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ------------ Message Handling ------------
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
      case 'updateStyle':
        updateStyleBadge(message.payload);
        break;

      case 'setIcon':
        const iconImg = document.getElementById('welcomeIcon') as HTMLImageElement;
        const fallback = document.getElementById('welcomeStarFallback');
        if (iconImg && message.payload) {
          iconImg.src = message.payload;
          iconImg.style.display = 'block';
          if (fallback) fallback.style.display = 'none';
        }
        break;

      case 'loadConfig':
        loadConfig(message.payload);
        break;

      case 'loadHistory':
        renderSessions(message.payload);
        break;

      case 'modelsResult':
        handleModelsResult(message.payload);
        break;

      case 'showView':
        if (message.payload === 'settings' || message.payload === 'history') {
          switchView(message.payload);
        }
        break;
    }
  });
})();
