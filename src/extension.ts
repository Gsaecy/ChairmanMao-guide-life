import * as vscode from 'vscode';
import { StorageManager } from './backend/storage';
import { DialogueManager } from './backend/dialogue';
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

  // 注册侧边栏 WebviewView Provider —— 解决侧边栏空白问题
  chatViewProvider = new ChatViewProvider(context.extensionUri, storageManager, dialogueManager);
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
    if (settingsPanel) {
      settingsPanel.reveal();
    } else {
      settingsPanel = new SettingsPanel(context.extensionUri, storageManager);
      settingsPanel.onDispose(() => { settingsPanel = undefined; });
    }
  });

  const openHistoryCmd = vscode.commands.registerCommand('maoxuan-guidance.openHistory', () => {
    if (historyPanel) {
      historyPanel.reveal();
    } else {
      historyPanel = new HistoryPanel(context.extensionUri, storageManager, (sessionId) => {
        loadSession(context, sessionId);
      });
      historyPanel.onDispose(() => { historyPanel = undefined; });
    }
  });

  const exportReportCmd = vscode.commands.registerCommand('maoxuan-guidance.exportReport', async () => {
    if (!dialogueManager.getCurrentSession()) {
      vscode.window.showWarningMessage('没有活跃的对话会话，请先开始对话。');
      return;
    }
    const report = dialogueManager.generateReport();
    const filePath = storageManager.saveReport(
      dialogueManager.getCurrentSession()!.id,
      report,
      'md'
    );
    vscode.window.showInformationMessage(`报告已导出至：${filePath}`);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
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