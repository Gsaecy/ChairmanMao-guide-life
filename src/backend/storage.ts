import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MaoxuanConfig, SessionData, ChatMessage, DialoguePhase } from '../types';
import { DEFAULT_CONFIG, DEFAULT_STORAGE_DIR, CONVERSATIONS_DIR, REPORTS_DIR } from '../constants';

/**
 * 存储管理器——管理配置、对话记录、报告
 */

export class StorageManager {
  private configKey = 'maoxuanConfig';
  private apiKeySecretName = 'maoxuanApiKey';
  private globalState: vscode.Memento;
  private secrets: vscode.SecretStorage;
  private cachedApiKey = ''; // SecretStorage 缓存，保证 getConfig 同步可用

  constructor(context: vscode.ExtensionContext) {
    this.globalState = context.globalState;
    this.secrets = context.secrets;
  }

  /**
   * 初始化：迁移旧 globalState 中的 API Key 到系统密钥库，并加载到缓存
   */
  async init(): Promise<void> {
    const saved = this.globalState.get<MaoxuanConfig>(this.configKey);
    const legacyKey = saved?.apiKey;
    if (legacyKey) {
      // 旧版 Key 存 globalState，迁移到 SecretStorage（系统密钥库）
      await this.secrets.store(this.apiKeySecretName, legacyKey);
      const { apiKey: _legacy, ...rest } = saved!;
      await this.globalState.update(this.configKey, rest);
    }
    this.cachedApiKey = (await this.secrets.get(this.apiKeySecretName)) || '';
  }

  // ============ 配置管理 ============

  getConfig(): MaoxuanConfig {
    const saved = this.globalState.get<MaoxuanConfig>(this.configKey);
    return { ...DEFAULT_CONFIG, ...(saved || {}), apiKey: this.cachedApiKey };
  }

  async saveConfig(config: Partial<MaoxuanConfig>): Promise<void> {
    // API Key 只存系统密钥库（SecretStorage），不落 globalState
    if (typeof config.apiKey === 'string') {
      if (config.apiKey) {
        await this.secrets.store(this.apiKeySecretName, config.apiKey);
      } else {
        await this.secrets.delete(this.apiKeySecretName);
      }
      this.cachedApiKey = config.apiKey;
      const { apiKey: _key, ...rest } = config;
      config = rest;
    }
    const current = this.globalState.get<MaoxuanConfig>(this.configKey) || {};
    const merged = { ...current, ...config };
    await this.globalState.update(this.configKey, merged);
  }

  // ============ 对话记录管理 ============

  getStorageDir(): string {
    const config = this.getConfig();
    if (config.storagePath && fs.existsSync(config.storagePath)) {
      return config.storagePath;
    }
    // 默认存储在工作区.maoxuan-guidance
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, DEFAULT_STORAGE_DIR);
    }
    // 无工作区，用用户目录
    return path.join(require('os').homedir(), DEFAULT_STORAGE_DIR);
  }

  private getConversationsDir(): string {
    return path.join(this.getStorageDir(), CONVERSATIONS_DIR);
  }

  private getReportsDir(): string {
    return path.join(this.getStorageDir(), REPORTS_DIR);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 创建新对话会话
   */
  createSession(title: string, style?: 'maoxuan' | 'yedinying' | 'balanced'): SessionData {
    const session: SessionData = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      currentPhase: 'understanding',
      style: style || this.getConfig().style,
    };
    this.saveSession(session);
    return session;
  }

  /**
   * 保存会话数据
   */
  saveSession(session: SessionData): void {
    const dir = this.getConversationsDir();
    this.ensureDir(dir);
    session.updatedAt = Date.now();
    const filePath = path.join(dir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * 加载会话
   */
  loadSession(sessionId: string): SessionData | null {
    const filePath = path.join(this.getConversationsDir(), `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * 获取所有会话列表
   */
  listSessions(): { id: string; title: string; createdAt: number; updatedAt: number; currentPhase: string; messageCount: number }[] {
    const dir = this.getConversationsDir();
    if (!fs.existsSync(dir)) return [];
    
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = fs.readFileSync(path.join(dir, f), 'utf-8');
      const session: SessionData = JSON.parse(data);
      return {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        currentPhase: session.currentPhase,
        messageCount: session.messages.filter(m => m.role !== 'system').length,
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    const filePath = path.join(this.getConversationsDir(), `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 添加消息到会话
   */
  addMessage(sessionId: string, message: ChatMessage): SessionData | null {
    const session = this.loadSession(sessionId);
    if (!session) return null;
    session.messages.push(message);
    session.updatedAt = Date.now();
    this.saveSession(session);
    return session;
  }

  /**
   * 更新会话阶段
   */
  updatePhase(sessionId: string, phase: DialoguePhase): SessionData | null {
    const session = this.loadSession(sessionId);
    if (!session) return null;
    session.currentPhase = phase;
    session.updatedAt = Date.now();
    this.saveSession(session);
    return session;
  }

  // ============ 报告管理 ============

  /**
   * 保存导出报告
   */
  saveReport(sessionId: string, reportContent: string, format: 'md' | 'html' | 'txt'): string {
    const dir = this.getReportsDir();
    this.ensureDir(dir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = format === 'html' ? '.html' : '.md';
    const fileName = `report_${sessionId}_${timestamp}${ext}`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, reportContent, 'utf-8');
    return filePath;
  }

  getReportsDirPath(): string {
    return this.getReportsDir();
  }
}