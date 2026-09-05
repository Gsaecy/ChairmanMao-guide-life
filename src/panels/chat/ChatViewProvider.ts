import * as vscode from 'vscode';
import { StorageManager } from '../../backend/storage';
import { DialogueManager } from '../../backend/dialogue';

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
    private readonly _dialogue: DialogueManager
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

    // 刷新 API 状态
    const config = this._storage.getConfig();
    webviewView.webview.postMessage({
      command: 'updateApiStatus',
      payload: { configured: !!(config.apiKey && config.apiKey.trim()) },
    });
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
      }
    });

    // 当配置变化时，更新侧边栏状态
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) {
        const config = this._storage.getConfig();
        this._view.webview.postMessage({
          command: 'updateApiStatus',
          payload: { configured: !!(config.apiKey && config.apiKey.trim()) },
        });
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
        command: 'updateApiStatus',
        payload: { configured: !!(config.apiKey && config.apiKey.trim()) },
      });
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
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