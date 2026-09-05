/**
 * 侧边栏专属 Webview 入口
 * —— 仅显示导航信息，不包含对话模块
 */
import './globals.css';

(function () {
  const vscode = acquireVsCodeApi();

  const app = document.getElementById('root')!;
  renderApp();

  function renderApp() {
    app.innerHTML = `
      <div class="flex flex-col h-full" style="background: var(--vscode-sideBar-background); color: var(--vscode-editor-foreground);">
        <!-- 第一行：扩展名 + 风格模式 + API就绪状态 -->
        <div class="flex-shrink-0 px-3 py-2 flex items-center gap-2" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <span class="flex flex-col leading-tight">
            <span class="text-sm font-semibold">毛主席思想指导</span>
            <span class="text-[9px]" style="color: var(--vscode-descriptionForeground);">Chairman Mao's Thought Guidance</span>
          </span>
          <span id="styleBadge" class="text-[10px] px-1.5 py-0.5 rounded-full" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">平衡融合</span>
          <span id="apiStatusBadge" class="text-[10px] px-1.5 py-0.5 rounded-full" style="background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground);">未配置API</span>
        </div>

        <!-- 第二行：三个按钮 -->
        <div class="flex-shrink-0 px-3 py-2 flex items-center gap-2" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <button id="btnNewChat" class="flex-1 text-xs px-3 py-1.5 rounded font-medium transition-colors" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
            ＋ 新建对话
          </button>
          <button id="btnHistory" class="flex-1 text-xs px-3 py-1.5 rounded transition-colors" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">
            历史记录
          </button>
          <button id="btnSettings" class="flex-1 text-xs px-3 py-1.5 rounded transition-colors" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">
            设置
          </button>
        </div>

        <!-- 间隔 & 图标 -->
        <div class="flex-1 flex flex-col items-center justify-center px-3 text-center" style="min-height: 0;">
          <div class="mt-2 mb-3 flex-shrink-0">
            <img id="welcomeIcon" src="" alt="★" style="width:52px; height:52px; object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"/>
            <span id="welcomeStarFallback" style="display:none; font-size:36px; color: var(--vscode-editor-foreground);">★</span>
          </div>
          <p class="text-sm font-semibold mb-1" style="color: var(--vscode-editor-foreground);">没有调查，就没有发言权</p>
          <p class="text-xs mb-4" style="color: var(--vscode-descriptionForeground);">告诉我你面临的问题，我们一起用实事求是的方法来分析</p>

          <!-- 使用说明 -->
          <div class="text-left w-full mt-3 pt-3" style="border-top: 1px solid var(--vscode-sideBar-border);">
            <p class="text-xs font-semibold mb-2" style="color: var(--vscode-editor-foreground);">📖 使用方法</p>
            <p class="text-[10px] mb-1" style="color: var(--vscode-textLink-foreground);"><strong>⚠️ 首次使用必须先配置 API</strong></p>
            <div class="flex items-start gap-1.5 text-[10px] mb-0.5" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">1.</span><span>点击 ⚙ 设置 进入设置页面</span></div>
            <div class="flex items-start gap-1.5 text-[10px] mb-0.5" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">2.</span><span>填入 API Key（从 platform.deepseek.com 获取）</span></div>
            <div class="flex items-start gap-1.5 text-[10px] mb-0.5" style="color: var(--vscode-descriptionForeground);"><span class="flex-shrink-0 font-bold">3.</span><span>保存后点击 ＋新建对话 开始</span></div>
            <div class="mt-2 pt-2 text-[10px] italic opacity-60" style="border-top: 1px solid var(--vscode-sideBar-border); color: var(--vscode-descriptionForeground);">&ldquo;读书是学习，使用也是学习，而且是更重要的学习。&rdquo;</div>
            <!-- 开发者主页 / GitHub 项目 -->
            <div class="mt-2 flex items-center justify-center gap-4 text-[10px]">
              <a data-external href="https://hongyuguo.com" style="color: var(--vscode-textLink-foreground); text-decoration: none;">👨‍💻 开发者主页</a>
              <a data-external href="https://github.com/Gsaecy/ChairmanMao-guide-life" style="color: var(--vscode-textLink-foreground); text-decoration: none;">⭐ GitHub 项目</a>
            </div>
          </div>
        </div>
      </div>
    `;
    bindEvents();
    loadIcon();
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
    document.getElementById('btnHistory')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openHistory' });
    });
    document.getElementById('btnSettings')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openSettings' });
    });

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

  // ------------ Message Handling ------------
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
      case 'updateStyle':
        const styleBadge = document.getElementById('styleBadge');
        if (styleBadge) {
          const map: Record<string, string> = {
            maoxuan: '毛选风格',
            yedinying: '叶丁风格',
            balanced: '平衡融合',
          };
          styleBadge.textContent = map[message.payload] || message.payload;
        }
        break;

      case 'updateApiStatus':
        const apiBadge = document.getElementById('apiStatusBadge');
        if (apiBadge) {
          if (message.payload.configured) {
            apiBadge.textContent = 'API就绪 ✓';
            apiBadge.style.background = 'var(--vscode-inputValidation-infoBackground)';
            apiBadge.style.color = 'var(--vscode-inputValidation-infoForeground)';
          } else {
            apiBadge.textContent = '未配置API';
            apiBadge.style.background = 'var(--vscode-inputValidation-warningBackground)';
            apiBadge.style.color = 'var(--vscode-inputValidation-warningForeground)';
          }
        }
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
    }
  });
})();
