/**
 * 历史记录面板 Webview 入口
 */
import './globals.css';

(function () {
  const vscode = acquireVsCodeApi();

  const app = document.getElementById('root')!;
  renderApp();

  function renderApp() {
    app.innerHTML = `
      <div class="p-4 max-w-3xl mx-auto">
        <div class="flex items-center justify-between mb-4 pb-3" style="border-bottom: 1px solid var(--vscode-sideBar-border);">
          <h1 class="text-lg font-bold" style="color: var(--vscode-editor-foreground);">📋 历史对话记录</h1>
          <button id="btnRefresh" class="text-xs px-3 py-1.5 rounded font-medium transition-colors" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            🔄 刷新
          </button>
        </div>
        <div id="sessionsList" class="space-y-2">
          <p class="text-sm text-center py-8" style="color: var(--vscode-descriptionForeground);">加载中...</p>
        </div>
      </div>
    `;

    document.getElementById('btnRefresh')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
  }

  function renderSessions(sessions: any[]) {
    const container = document.getElementById('sessionsList');
    if (!container) return;

    if (!sessions || sessions.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <div class="text-3xl mb-2">📭</div>
          <p class="text-sm" style="color: var(--vscode-descriptionForeground);">暂无历史对话</p>
          <p class="text-xs mt-1" style="color: var(--vscode-descriptionForeground); opacity: 0.7;">开始一个新的对话吧</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sessions
      .map(
        (session) => `
      <div class="ap-card ap-card-hover p-3 session-card"
           data-session-id="${escapeHtml(session.id)}">
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold mb-1 truncate" style="color: var(--vscode-editor-foreground);">${escapeHtml(session.title || '未命名对话')}</h3>
            <p class="text-xs" style="color: var(--vscode-descriptionForeground);">
              创建：${escapeHtml(formatDate(session.createdAt))} 
              ${session.updatedAt ? `· 更新：${escapeHtml(formatDate(session.updatedAt))}` : ''}
            </p>
            <p class="text-xs mt-1" style="color: var(--vscode-descriptionForeground); opacity: 0.8;">
              阶段：${escapeHtml(getPhaseName(session.currentPhase))} · ${session.messageCount || 0} 条消息
            </p>
          </div>
          <div class="flex flex-col gap-1.5 flex-shrink-0 ml-2">
            <button class="view-btn text-xs px-3 py-1.5 rounded font-medium transition-colors whitespace-nowrap" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); box-shadow: 0 1px 3px rgba(0,0,0,0.12);"
                    data-session-id="${escapeHtml(session.id)}">
              查看对话
            </button>
            <button class="delete-btn text-xs px-2 py-1 rounded transition-colors whitespace-nowrap" style="background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-sideBar-border);"
                    data-session-id="${escapeHtml(session.id)}"
                    title="删除该记录">
              🗑 删除
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // 绑定查看对话按钮事件
    container.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).getAttribute('data-session-id');
        if (sessionId) {
          vscode.postMessage({ command: 'selectSession', payload: { sessionId } });
        }
      });
    });

    // 绑定清除记录按钮事件
    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).getAttribute('data-session-id');
        if (sessionId) {
          showDeleteConfirm(sessionId);
        }
      });
    });
  }

  function showDeleteConfirm(sessionId: string) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 flex items-center justify-center z-50';
    overlay.style.cssText = 'background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);';
    overlay.innerHTML = `
      <div class="ap-dialog w-[340px] p-6">
        <h3 class="text-base font-semibold mb-3" style="color: var(--vscode-editor-foreground);">确认删除</h3>
        <p class="text-sm mb-5" style="color: var(--vscode-descriptionForeground);">确定要删除这个对话吗？此操作不可恢复。</p>
        <div class="flex justify-end gap-2">
          <button id="cancelDelete" class="px-4 py-2 text-sm rounded transition-colors" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">取消</button>
          <button id="confirmDelete" class="px-4 py-2 text-sm rounded font-medium transition-colors" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground);">确认删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#cancelDelete')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#confirmDelete')?.addEventListener('click', () => {
      overlay.remove();
      vscode.postMessage({ command: 'deleteSession', payload: { sessionId } });
    });
  }

  function formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }

  function getPhaseName(phase: string): string {
    const map: Record<string, string> = {
      understanding: '全面了解',
      contradiction: '矛盾分析',
      condition: '条件评估',
      strategy: '战略建议',
      tactics: '战术行动',
      reflection: '反思迭代',
      complete: '对话完成',
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
      case 'loadHistory':
        renderSessions(message.payload);
        break;
    }
  });
})();