import * as vscode from 'vscode';
import { StorageManager } from '../../backend/storage';
import { MaoxuanConfig } from '../../types';

export class SettingsPanel {
  public static readonly viewType = 'maoxuanSettings';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: StorageManager;
  private _disposables: vscode.Disposable[] = [];
  private _onDispose: (() => void) | null = null;

  constructor(extensionUri: vscode.Uri, storage: StorageManager) {
    this._extensionUri = extensionUri;
    this._storage = storage;

    this._panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      '毛主席思想指导 - 设置',
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

    // 发送当前配置
    const config = this._storage.getConfig();
    this._panel.webview.postMessage({
      command: 'loadConfig',
      payload: config,
    });

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public reveal(): void {
    this._panel.reveal(vscode.ViewColumn.One);
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
        }
      },
      null,
      this._disposables
    );
  }

  private _getHtmlContent(): string {
    const webview = this._panel.webview;
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