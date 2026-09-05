import * as vscode from 'vscode';
import { StorageManager } from '../../backend/storage';

export class HistoryPanel {
  public static readonly viewType = 'maoxuanHistory';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: StorageManager;
  private readonly _onSelect: (sessionId: string) => void;
  private _disposables: vscode.Disposable[] = [];
  private _onDispose: (() => void) | null = null;

  constructor(
    extensionUri: vscode.Uri,
    storage: StorageManager,
    onSelect: (sessionId: string) => void
  ) {
    this._extensionUri = extensionUri;
    this._storage = storage;
    this._onSelect = onSelect;

    this._panel = vscode.window.createWebviewPanel(
      HistoryPanel.viewType,
      '毛主席思想指导 - 对话历史',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    this._panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'icon.svg');
    this._panel.webview.html = this._getHtmlContent();
    this._setWebviewMessageListener();

    // 发送历史列表
    const sessions = this._storage.listSessions();
    this._panel.webview.postMessage({
      command: 'loadHistory',
      payload: sessions,
    });

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public reveal(): void {
    this._panel.reveal(vscode.ViewColumn.One);
    // 刷新列表
    const sessions = this._storage.listSessions();
    this._panel.webview.postMessage({
      command: 'loadHistory',
      payload: sessions,
    });
  }

  public dispose(): void {
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
    if (this._onDispose) this._onDispose();
  }

  public onDispose(callback: () => void): void {
    this._onDispose = callback;
  }

  private _setWebviewMessageListener(): void {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'selectSession':
            this._onSelect(message.payload.sessionId);
            this._panel.dispose();
            break;

          case 'deleteSession':
            try {
              this._storage.deleteSession(message.payload.sessionId);
              const sessions = this._storage.listSessions();
              this._panel.webview.postMessage({
                command: 'loadHistory',
                payload: sessions,
              });
            } catch (err) {
              vscode.window.showErrorMessage(`删除对话失败: ${err}`);
            }
            break;

          case 'refresh':
            const sessions = this._storage.listSessions();
            this._panel.webview.postMessage({
              command: 'loadHistory',
              payload: sessions,
            });
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private _getHtmlContent(): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'history.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'history.css')
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>毛主席思想指导 - 对话历史</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}