import * as vscode from 'vscode';
import { StorageManager } from '../../backend/storage';
import { MaoxuanConfig } from '../../types';

/**
 * 侧边栏设置视图（WebviewView）—— 设置页显示在侧边栏而非编辑器标签页
 */
export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'maoxuan.settingsPanel';
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storage: StorageManager
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
    this._setWebviewMessageListener(webviewView);

    // 发送当前配置
    const config = this._storage.getConfig();
    webviewView.webview.postMessage({
      command: 'loadConfig',
      payload: config,
    });
  }

  /** 配置变化后刷新侧边栏设置页 */
  public refreshConfig(): void {
    if (this._view) {
      const config = this._storage.getConfig();
      this._view.webview.postMessage({
        command: 'loadConfig',
        payload: config,
      });
    }
  }

  private _setWebviewMessageListener(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'saveConfig':
            try {
              await this._storage.saveConfig(
                message.payload as Partial<MaoxuanConfig>
              );
              vscode.window.showInformationMessage('设置已保存');
            } catch (err) {
              vscode.window.showErrorMessage(`保存设置失败: ${err}`);
            }
            break;

          case 'closeSettings':
            // 返回侧边栏主页（聚焦聊天视图）
            vscode.commands.executeCommand('maoxuan.chatPanel.focus');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'settings.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'settings.css')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>毛主席思想指导 - 设置</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
