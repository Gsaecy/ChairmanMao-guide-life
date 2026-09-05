import * as vscode from 'vscode';
import { StorageManager } from './storage';
import { streamChat } from './api';
import { MaoxuanConfig, SessionData, ChatMessage, DialoguePhase } from '../types';
import { PHASE_LABELS } from '../constants';

/**
 * 对话管理器——控制六阶段对话流程
 */

export class DialogueManager {
  private storage: StorageManager;
  private currentSession: SessionData | null = null;
  private abortController: { abort: () => void } | null = null;
  private onMessageCallback: ((text: string, done: boolean) => void) | null = null;
  private onPhaseChangeCallback: ((phase: DialoguePhase, label: string) => void) | null = null;
  private userMessageQueue: string[] = [];

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  /**
   * 设置消息回调
   */
  onMessage(cb: (text: string, done: boolean) => void): void {
    this.onMessageCallback = cb;
  }

  /**
   * 设置阶段变更回调
   */
  onPhaseChange(cb: (phase: DialoguePhase, label: string) => void): void {
    this.onPhaseChangeCallback = cb;
  }

  /**
   * 开始新对话
   */
  startNewSession(title: string, style?: 'maoxuan' | 'yedinying' | 'balanced'): SessionData {
    this.currentSession = this.storage.createSession(title, style);
    this.userMessageQueue = [];
    this.notifyPhaseChange('understanding');
    return this.currentSession;
  }

  /**
   * 加载已有对话
   */
  loadSession(sessionId: string): SessionData | null {
    const session = this.storage.loadSession(sessionId);
    if (session) {
      this.currentSession = session;
      this.notifyPhaseChange(session.currentPhase);
    }
    return session;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * 发送用户消息
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('没有活跃的对话会话');
    }

    // 中止正在进行的流（如阶段自动推进的引导流），避免并发混流
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const config = this.storage.getConfig();
    if (!config.apiKey) {
      throw new Error('请先在设置中配置 API Key');
    }

    // 使用对话绑定的风格（而非全局设置），若未绑定则用全局设置
    const effectiveConfig = { ...config, style: this.currentSession.style || config.style };

    // 添加用户消息到会话
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      phase: this.currentSession.currentPhase,
    };
    this.currentSession = this.storage.addMessage(
      this.currentSession.id,
      userMessage
    );
    if (!this.currentSession) throw new Error('保存消息失败');

    // 收集用户在多轮中的输入，用于判断是否进入下一阶段
    this.userMessageQueue.push(content);

    // 发送到 AI
    const messages = [...this.currentSession.messages];
    // 不把刚加入的最后一条用户消息算入历史（它在 messages 末尾）——实际上 DeepSeek 需要它，所以保留
    const currentPhase = this.currentSession.currentPhase;

    return new Promise((resolve, reject) => {
      let fullResponse = '';

      this.abortController = streamChat(
        effectiveConfig,
        messages.filter(m => m.role !== 'system'), // system prompt 由 api.ts 注入
        currentPhase,
        (chunk: string) => {
          fullResponse += chunk;
          this.onMessageCallback?.(chunk, false);
        },
        (completeText: string) => {
          // 保存 AI 回复
          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            role: 'assistant',
            content: completeText,
            timestamp: Date.now(),
            phase: this.currentSession!.currentPhase,
          };
          this.currentSession = this.storage.addMessage(
            this.currentSession!.id,
            assistantMessage
          );

          // 先渲染完成消息，再释放控制器（修复：此前 analyzePhaseProgression 在 onMessageCallback
          // 之前触发新流，随后 abortController 被置 null 把新流控制器抹掉，导致自动流无法中止）
          this.onMessageCallback?.(completeText, true);
          this.abortController = null;
          resolve();

          // 流完全结束后再判断是否推进阶段，避免与新流竞态
          this.analyzePhaseProgression(completeText);
        },
        (error: Error) => {
          this.abortController = null;
          reject(error);
        }
      );
    });
  }

  /**
   * 中止当前请求
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 手动推进阶段
   */
  advancePhase(): void {
    if (!this.currentSession) return;
    const phases: DialoguePhase[] = [
      'understanding', 'contradiction', 'condition', 'strategy', 'tactics', 'reflection', 'complete'
    ];
    const currentIdx = phases.indexOf(this.currentSession.currentPhase);
    if (currentIdx < phases.length - 1) {
      const nextPhase = phases[currentIdx + 1];
      this.currentSession = this.storage.updatePhase(this.currentSession.id, nextPhase);
      this.notifyPhaseChange(nextPhase);

      // 推进阶段时，自动发送一条引导消息
      if (nextPhase !== 'complete') {
        this.sendPhaseTransitionMessage(nextPhase);
      }
    }
  }

  /**
   * 分析是否需要自动推进阶段
   * 简单策略：当用户响应达到一定轮数或 AI 回复中包含特定信号时推进
   */
  private analyzePhaseProgression(aiResponse: string): void {
    if (!this.currentSession) return;
    
    const phase = this.currentSession.currentPhase;
    const messageCount = this.currentSession.messages.filter(m => m.role === 'user').length;

    // 基于对话轮数的简单推进策略
    const progressionMap: Record<string, { minMessages: number; keywords: string[] }> = {
      understanding: { minMessages: 3, keywords: ['了解了', '基本情况', '综合来看', '梳理一下'] },
      contradiction: { minMessages: 5, keywords: ['主要矛盾', '核心问题', '关键冲突', '根本原因'] },
      condition: { minMessages: 7, keywords: ['条件评估', '你目前的条件', '实事求是', '你的条件'] },
      strategy: { minMessages: 9, keywords: ['战略', '方向', '整体策略', '大局'] },
      tactics: { minMessages: 11, keywords: ['具体步骤', '行动方案', '第一步', '你可以这样'] },
      reflection: { minMessages: 13, keywords: ['反思', '盲区', '自省', '局限性'] },
    };

    const rule = progressionMap[phase];
    if (!rule) return;

    if (messageCount >= rule.minMessages) {
      const hasKeyword = rule.keywords.some(kw => aiResponse.includes(kw));
      if (hasKeyword) {
        this.advancePhase();
      }
    }
  }

  /**
   * 发送阶段过渡消息
   */
  private async sendPhaseTransitionMessage(phase: DialoguePhase): Promise<void> {
    const config = this.storage.getConfig();
    // 使用温和的提示推动对话进入新阶段
    const transitionPrompts: Record<string, string> = {
      contradiction: '基于以上了解，请你帮我分析一下，这个问题的核心矛盾是什么？各方力量的对比如何？',
      condition: '我们现在来分析一下我实际拥有的条件和资源。按照"见路不走"的思路，不看别人的路，只看我自己的条件。',
      strategy: '基于前面的分析，请你帮我梳理一下整体的战略方向。在战略上应该怎么看这个问题？',
      tactics: '请你帮我列出具体的、可以立刻执行的行动步骤。在战术上应该怎么做？',
      reflection: '请你帮我审视一下，在处理这个问题的过程中，我自己可能存在哪些盲区或局限？有哪些需要自我革新的地方？',
    };

    const prompt = transitionPrompts[phase];
    if (!prompt) return;

    // 作为用户消息自动推进（修复：此前存为 system 角色后被 filter 排除，
    // 引导提示根本没发给 AI，还污染历史记录）
    const sysMessage: ChatMessage = {
      id: `msg_${Date.now()}_sys`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      phase,
    };
    this.currentSession = this.storage.addMessage(
      this.currentSession!.id,
      sysMessage
    );

    if (!this.currentSession) return;

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      const messages = [...this.currentSession!.messages];
      
      this.abortController = streamChat(
        config,
        messages.filter(m => m.role !== 'system'),
        this.currentSession!.currentPhase,
        (chunk: string) => {
          fullResponse += chunk;
          this.onMessageCallback?.(chunk, false);
        },
        (completeText: string) => {
          const assistantMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            role: 'assistant',
            content: completeText,
            timestamp: Date.now(),
            phase: this.currentSession!.currentPhase,
          };
          this.currentSession = this.storage.addMessage(
            this.currentSession!.id,
            assistantMessage
          );
          this.onMessageCallback?.(completeText, true);
          this.abortController = null;
          resolve();
        },
        (error: Error) => {
          this.abortController = null;
          reject(error);
        }
      );
    });
  }

  /**
   * 关闭当前会话（面板关闭对话时调用）
   */
  closeSession(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.currentSession = null;
    this.userMessageQueue = [];
  }

  /**
   * 通知阶段变更
   */
  private notifyPhaseChange(phase: DialoguePhase): void {
    const label = PHASE_LABELS[phase] || phase;
    this.onPhaseChangeCallback?.(phase, label);
  }

  /**
   * 生成对话总结报告
   */
  generateReport(): string {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return '暂无对话内容，无法生成报告。';
    }

    const session = this.currentSession;
    const date = new Date(session.createdAt).toLocaleString('zh-CN');
    const assistantMessages = session.messages.filter(m => m.role === 'assistant');
    
    let report = `# ${session.title}\n\n`;
    report += `> 生成时间：${new Date().toLocaleString('zh-CN')}\n`;
    report += `> 对话创建：${date}\n`;
    report += `> 消息总数：${session.messages.length} 条\n`;
    report += `> 当前阶段：${PHASE_LABELS[session.currentPhase] || session.currentPhase}\n\n`;
    report += `---\n\n`;

    // 按阶段整理内容
    const phases: DialoguePhase[] = ['understanding', 'contradiction', 'condition', 'strategy', 'tactics', 'reflection'];
    
    for (const phase of phases) {
      const phaseMessages = assistantMessages.filter(m => m.phase === phase);
      if (phaseMessages.length === 0) continue;

      report += `## ${PHASE_LABELS[phase] || phase}\n\n`;
      for (const msg of phaseMessages) {
        report += `${msg.content}\n\n`;
      }
      report += `---\n\n`;
    }

    return report;
  }
}