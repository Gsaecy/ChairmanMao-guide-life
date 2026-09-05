import * as vscode from 'vscode';
import { StorageManager } from './backend/storage';
import { DialogueManager } from './backend/dialogue';
import { exportReportFile } from './backend/report';
import { ChatPanel, ChatViewProvider, SettingsPanel, HistoryPanel } from './panels';

let storageManager: StorageManager;
let dialogueManager: DialogueManager;
let chatPanel: ChatPanel | undefined;
let chatViewProvider: ChatViewProvider | undefined;
let settingsPanel: SettingsPanel | undefined;
let historyPanel: HistoryPanel | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // 初始化核心服务（先迁移/加载 SecretStorage 中的 API Key）
  storageManager = new StorageManager(context);
  await storageManager.init();
  dialogueManager = new DialogueManager(storageManager);

  // 注册侧边栏 WebviewView Provider
  chatViewProvider = new ChatViewProvider(context.extensionUri, storageManager, dialogueManager, (sessionId) => {
    try {
      const session = dialogueManager.loadSession(sessionId);
      if (session) {
        chatPanel = createOrShowChatPanel(context);
        chatPanel.loadSession(session);
      } else {
        vscode.window.showErrorMessage('加载对话失败，该对话可能已被删除。');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`加载对话失败: ${err}`);
    }
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider)
  );

  // 注册命令
  const newSessionCmd = vscode.commands.registerCommand('maoxuan-guidance.newSession', () => {
    chatPanel = createOrShowChatPanel(context);
    chatPanel.newSession();
  });

  const openChatCmd = vscode.commands.registerCommand('maoxuan-guidance.openChat', () => {
    chatPanel = createOrShowChatPanel(context);
  });

  const openSettingsCmd = vscode.commands.registerCommand('maoxuan-guidance.openSettings', () => {
    // 设置页显示在侧边栏（侧边栏内切换设置视图）
    vscode.commands.executeCommand('workbench.view.extension.maoxuan-sidebar');
    chatViewProvider?.showView('settings');
  });

  const openHistoryCmd = vscode.commands.registerCommand('maoxuan-guidance.openHistory', () => {
    // 历史记录显示在侧边栏（侧边栏内切换历史视图）
    vscode.commands.executeCommand('workbench.view.extension.maoxuan-sidebar');
    chatViewProvider?.showView('history');
  });

  const exportReportCmd = vscode.commands.registerCommand('maoxuan-guidance.exportReport', async () => {
    if (!dialogueManager.getCurrentSession()) {
      vscode.window.showWarningMessage('没有活跃的对话会话，请先开始对话。');
      return;
    }
    const formatPick = await vscode.window.showQuickPick(
      [
        { label: '$(markdown) Markdown', detail: '适合笔记 / 博客 / GitHub', value: 'md' },
        { label: '$(file-text) TXT 纯文本', detail: '可直接复制粘贴到任何文档', value: 'txt' },
        { label: '$(file) Word 文档', detail: 'Word / WPS 可直接打开编辑', value: 'doc' },
        { label: '$(pdf) PDF', detail: '排版正式，适合存档与打印', value: 'pdf' },
      ],
      { placeHolder: '选择报告导出格式' }
    );
    if (!formatPick) return;
    const session = dialogueManager.getCurrentSession()!;
    try {
      const report = dialogueManager.generateReport();
      const filePath = await exportReportFile(
        report,
        session,
        formatPick.value as 'md' | 'txt' | 'doc' | 'pdf',
        storageManager.getReportsDirPath()
      );
      if (formatPick.value === 'md' || formatPick.value === 'txt') {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`报告已导出：${filePath}`);
      } else {
        await vscode.env.openExternal(vscode.Uri.file(filePath));
        vscode.window.showInformationMessage(`报告已导出：${filePath}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`导出失败: ${err}`);
    }
  });

  context.subscriptions.push(
    newSessionCmd,
    openChatCmd,
    openSettingsCmd,
    openHistoryCmd,
    exportReportCmd
  );

  // 状态栏按钮
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(comment-discussion) 毛选指导';
  statusBarItem.tooltip = '毛主席思想指导 - 开始对话';
  statusBarItem.command = 'maoxuan-guidance.openChat';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log('毛主席思想指导扩展已激活');
}

export function deactivate() {
  if (chatPanel) chatPanel.dispose();
  if (settingsPanel) settingsPanel.dispose();
  if (historyPanel) historyPanel.dispose();
}

function createOrShowChatPanel(context: vscode.ExtensionContext): ChatPanel {
  if (chatPanel) {
    chatPanel.reveal();
    return chatPanel;
  }
  chatPanel = new ChatPanel(context.extensionUri, storageManager, dialogueManager);
  chatPanel.onDispose(() => { chatPanel = undefined; });
  return chatPanel;
}

function loadSession(context: vscode.ExtensionContext, sessionId: string) {
  const session = dialogueManager.loadSession(sessionId);
  if (session) {
    chatPanel = createOrShowChatPanel(context);
    chatPanel.loadSession(session);
    vscode.window.showInformationMessage(`已加载对话：${session.title}`);
  } else {
    vscode.window.showErrorMessage('加载对话失败，该对话可能已被删除。');
  }
}