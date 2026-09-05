import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { StorageManager } from '../../backend/storage';
import { DialogueManager } from '../../backend/dialogue';

/** 根据 baseUrl 生成候选 models 路径（自动兼容 /v1/models 与 /models 两种写法） */
function buildModelPaths(baseUrl: string): string[] {
  const url = new URL(baseUrl);
  let p = (url.pathname || '/').replace(/\/+$/, '');
  if (p.endsWith('/models')) {
    return [p];
  }
  if (p.endsWith('/v1')) {
    return [p + '/models', p.replace(/\/v1$/, '') + '/models'];
  }
  if (p === '' || p === '/') {
    return ['/v1/models', '/models'];
  }
  return [p + '/v1/models', p + '/models'];
}

/** 对单个路径发起 GET 请求，返回 { status, body } */
function requestPath(
  baseUrl: string,
  apiKey: string,
  path: string
): Promise<{ status: number; body: string }> {
  const url = new URL(baseUrl);
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path,
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('请求超时（请检查 API 地址与网络）'));
    });
    req.end();
  });
}

/** 调用 OpenAI 兼容 /models 接口获取真实模型列表，带鉴权错误友好提示与路径回退 */
async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('API Key 为空');
  const base = (baseUrl || '').trim();
  if (!base) throw new Error('API 地址为空');
  const paths = buildModelPaths(base);
  let lastErr: Error | null = null;
  for (const path of paths) {
    let res: { status: number; body: string };
    try {
      res = await requestPath(base, key, path);
    } catch (e) {
      throw e; // 网络/超时类错误直接抛出
    }
    if (res.status === 200) {
      let j: any;
      try {
        j = JSON.parse(res.body);
      } catch {
        j = null;
      }
      const list = (j?.data || []).map((m: any) => m.id).filter(Boolean);
      if (list.length) return list;
      lastErr = new Error('未获取到模型列表');
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      // 鉴权失败：已确认是该地址拒绝了 Key，无需再试其他路径
      let serverMsg = '';
      try {
        const j = JSON.parse(res.body);
        serverMsg = j?.error?.message || '';
      } catch {
        serverMsg = '';
      }
      const tail = key.length > 4 ? `****${key.slice(-4)}` : key;
      const detail = serverMsg ? `（服务端提示：${serverMsg}）` : '';
      throw new Error(
        `API Key 无效或无权访问（HTTP ${res.status}）：${new URL(base).host} 拒绝了结尾为 ${tail} 的 Key${detail}。请检查：① Key 是否复制完整、无多余空格/换行；② 所选供应商地址是否与该 Key 匹配——第三方中转请选「自定义」并填写中转站地址。`
      );
    }
    // 404/405 → 路径可能不对，尝试下一个候选；其他状态记住错误
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(res.body);
      errMsg = j?.error?.message || errMsg;
    } catch {
      /* ignore */
    }
    lastErr = new Error(`${errMsg}（路径 ${path}）`);
  }
  throw lastErr || new Error('模型检测失败');
}

/**
 * 侧边栏 Webview View Provider
 * 在侧边栏中显示导航信息（不再承载对话功能）
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'maoxuan.chatPanel';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storage: StorageManager,
    private readonly _dialogue: DialogueManager,
    private readonly _onLoadSession?: (sessionId: string) => void
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);
    this._setMessageListener(webviewView);

    // 发送图标 URI
    const welcomeIconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'welcome-icon.png')
    );
    webviewView.webview.postMessage({
      command: 'setIcon',
      payload: welcomeIconUri.toString(),
    });

    // 推送当前风格
    const config = this._storage.getConfig();
    webviewView.webview.postMessage({
      command: 'updateStyle',
      payload: config.style || 'balanced',
    });
  }

  private _setMessageListener(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'newChatSession':
          // 打开独立的对话面板（新建对话）
          vscode.commands.executeCommand('maoxuan-guidance.newSession');
          break;

        case 'openSettings':
          vscode.commands.executeCommand('maoxuan-guidance.openSettings');
          break;

        case 'openHistory':
          vscode.commands.executeCommand('maoxuan-guidance.openHistory');
          break;

        case 'openExternal':
          if (message.payload && typeof message.payload === 'string') {
            vscode.env.openExternal(vscode.Uri.parse(message.payload));
          }
          break;

        case 'getConfig':
          webviewView.webview.postMessage({
            command: 'loadConfig',
            payload: this._storage.getConfig(),
          });
          break;

        case 'saveConfig':
          try {
            await this._storage.saveConfig(message.payload as any);
            const cfg = this._storage.getConfig();
            webviewView.webview.postMessage({ command: 'loadConfig', payload: cfg });
            webviewView.webview.postMessage({
              command: 'updateStyle',
              payload: cfg.style || 'balanced',
            });
          } catch (err) {
            vscode.window.showErrorMessage(`保存设置失败: ${err}`);
          }
          break;

        case 'detectModels':
          try {
            const cfg = message.payload as any;
            const list = await fetchModels(cfg.apiBaseUrl, cfg.apiKey);
            webviewView.webview.postMessage({
              command: 'modelsResult',
              payload: { success: true, models: list, silent: !!message.silent },
            });
          } catch (err) {
            webviewView.webview.postMessage({
              command: 'modelsResult',
              payload: {
                success: false,
                message: err instanceof Error ? err.message : '模型检测失败',
                silent: !!message.silent,
              },
            });
          }
          break;

        case 'refreshHistory':
          webviewView.webview.postMessage({
            command: 'loadHistory',
            payload: this._storage.listSessions(),
          });
          break;

        case 'deleteSession':
          try {
            this._storage.deleteSession(message.payload.sessionId);
            webviewView.webview.postMessage({
              command: 'loadHistory',
              payload: this._storage.listSessions(),
            });
          } catch (err) {
            vscode.window.showErrorMessage(`删除对话失败: ${err}`);
          }
          break;

        case 'selectSession':
          try {
            if (this._onLoadSession) {
              this._onLoadSession(message.payload.sessionId);
            }
          } catch (err) {
            vscode.window.showErrorMessage(`打开历史对话失败: ${err}`);
          }
          break;
      }
    });

    // 当配置变化时，更新侧边栏状态
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) {
        const config = this._storage.getConfig();
        this._view.webview.postMessage({
          command: 'updateStyle',
          payload: config.style || 'balanced',
        });
      }
    });
  }

  public refreshStatus(): void {
    if (this._view) {
      const config = this._storage.getConfig();
      this._view.webview.postMessage({
        command: 'updateStyle',
        payload: config.style || 'balanced',
      });
    }
  }

  public reveal(): void {
    if (this._view) {
      this._view.show(true);
    }
  }

  /** 从侧边栏外（命令）切换内部视图 */
  public showView(view: 'settings' | 'history'): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'showView', payload: view });
    }
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'sidebar.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'sidebar.css')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>毛主席思想指导</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}