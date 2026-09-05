import * as vscode from 'vscode';
import { StorageManager } from '../../backend/storage';
import { DialogueManager } from '../../backend/dialogue';
import { exportReportFile } from '../../backend/report';
import { SessionData } from '../../types';

export class ChatPanel {
  public static readonly viewType = 'maoxuanChat';
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _storage: StorageManager;
  private readonly _dialogue: DialogueManager;
  private _disposables: vscode.Disposable[] = [];
  private _onDispose: (() => void) | null = null;
  /** webview 是否已就绪；未就绪时消息入队，就绪后统一补发 */
  private _webviewReady = false;
  private _pendingMessages: { command: string; payload?: any }[] = [];

  constructor(
    extensionUri: vscode.Uri,
    storage: StorageManager,
    dialogue: DialogueManager
  ) {
    this._extensionUri = extensionUri;
    this._storage = storage;
    this._dialogue = dialogue;

    this._panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      '毛主席思想指导',
      vscode.ViewColumn.Two,
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

    // 下发设置里保存的默认风格（就绪后送达）
    this._post({
      command: 'setDefaultStyle',
      payload: this._storage.getConfig().style || 'balanced',
    });
    
    // 监听对话事件
    this._dialogue.onMessage((text, done) => {
      this._panel.webview.postMessage({
        command: 'assistantMessage',
        payload: { text, done },
      });
    });

    this._dialogue.onPhaseChange((phase, label) => {
      this._panel.webview.postMessage({
        command: 'phaseChange',
        payload: { phase, label },
      });
    });

    this._panel.onDidDispose(() => {
      this.dispose();
    }, null, this._disposables);
  }

  public reveal(): void {
    this._panel.reveal(vscode.ViewColumn.Two);
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

  public newSession(): void {
    // 弹出新建会话对话框：默认预选设置里保存的风格（不影响设置）
    this._post({
      command: 'promptNewSession',
      payload: { style: this._storage.getConfig().style || 'balanced' },
    });
  }

  public loadSession(session: SessionData): void {
    this._post({
      command: 'loadSession',
      payload: session,
    });
  }

  /** 就绪感知的消息发送：未就绪先入队，就绪后补发 */
  private _post(msg: { command: string; payload?: any }): void {
    if (!this._webviewReady) {
      this._pendingMessages.push(msg);
      return;
    }
    this._panel.webview.postMessage(msg).then((ok) => {
      if (!ok) this._pendingMessages.push(msg);
    });
  }

  private _flushPending(): void {
    const msgs = this._pendingMessages;
    this._pendingMessages = [];
    for (const m of msgs) {
      this._panel.webview.postMessage(m).then((ok) => {
        if (!ok) this._pendingMessages.push(m);
      });
    }
  }

  private _setWebviewMessageListener(): void {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'webviewReady':
            this._webviewReady = true;
            this._flushPending();
            break;

          case 'createSession':
            try {
              const session = this._dialogue.startNewSession(message.payload.title, message.payload.style);
              this._panel.webview.postMessage({
                command: 'sessionCreated',
                payload: session,
              });
            } catch (err) {
              vscode.window.showErrorMessage(`创建对话失败: ${err}`);
            }
            break;

          case 'sendMessage':
            try {
              this._panel.webview.postMessage({ command: 'streamStart' });
              await this._dialogue.sendMessage(message.payload.content, {
                webSearch: !!message.payload.webSearch,
              });
              this._panel.webview.postMessage({ command: 'streamEnd' });
            } catch (err) {
              this._panel.webview.postMessage({
                command: 'error',
                payload: err instanceof Error ? err.message : '发送消息失败',
              });
            }
            break;

          case 'abort':
            this._dialogue.abort();
            this._panel.webview.postMessage({ command: 'streamEnd' });
            break;

          case 'closeSession':
            this._dialogue.closeSession();
            break;

          case 'openExternal':
            if (message.payload && typeof message.payload === 'string') {
              vscode.env.openExternal(vscode.Uri.parse(message.payload));
            }
            break;

          case 'advancePhase':
            this._dialogue.advancePhase();
            break;

          case 'prepareReport':
            try {
              const report = this._dialogue.generateReport();
              this._panel.webview.postMessage({
                command: 'reportReady',
                payload: report,
              });
            } catch (err) {
              this._panel.webview.postMessage({
                command: 'reportSaved',
                payload: { success: false, message: `生成报告失败: ${err}` },
              });
            }
            break;

          case 'exportReport':
            try {
              const session = this._dialogue.getCurrentSession();
              const report = this._dialogue.generateReport();
              if (!session) {
                this._panel.webview.postMessage({
                  command: 'reportSaved',
                  payload: { success: false, message: '没有活跃的对话会话' },
                });
                break;
              }
              const fmt = (message.payload?.format || 'md') as 'md' | 'txt' | 'doc' | 'pdf';
              const filePath = await exportReportFile(
                report,
                session,
                fmt,
                this._storage.getReportsDirPath()
              );
              this._panel.webview.postMessage({
                command: 'reportSaved',
                payload: { success: true, format: fmt, filePath },
              });
              // md/txt 在编辑器打开；doc/pdf 用系统默认应用打开
              if (fmt === 'md' || fmt === 'txt') {
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
              } else {
                await vscode.env.openExternal(vscode.Uri.file(filePath));
              }
            } catch (err) {
              this._panel.webview.postMessage({
                command: 'reportSaved',
                payload: {
                  success: false,
                  message: err instanceof Error ? err.message : '生成报告失败',
                },
              });
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
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'chat.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'chat.css')
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