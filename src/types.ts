export interface MaoxuanConfig {
  provider: string; // AI 供应商: deepseek/openai/dashscope/moonshot/glm/siliconflow/custom
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  storagePath: string;
  webSearchEnabled: boolean;
  searchApiKey: string;
  searchEngine: 'serpapi' | 'bing';
  temperature: number;
  maxTokens: number;
  style: 'maoxuan' | 'yedinying' | 'balanced';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  phase?: DialoguePhase;
}

export type DialoguePhase =
  | 'understanding'   // 第一阶段：全面了解
  | 'contradiction'   // 第二阶段：矛盾分析
  | 'condition'       // 第三阶段：条件评估
  | 'strategy'        // 第四阶段：战略建议
  | 'tactics'         // 第五阶段：战术行动
  | 'reflection'      // 第六阶段：反思迭代
  | 'complete';       // 对话完成

export interface SessionData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  currentPhase: DialoguePhase;
  style?: 'maoxuan' | 'yedinying' | 'balanced';
  summary?: string;
}

export interface ReportContent {
  sessionTitle: string;
  date: string;
  userProblem: string;
  coreContradiction: string;
  principlesUsed: string[];
  conditionAssessment: string;
  strategy: string;
  tacticalActions: string[];
  selfReflection: string;
}

export interface WebviewMessage {
  command: string;
  payload?: unknown;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * VS Code Webview API 类型声明
 * acquireVsCodeApi 函数由 VS Code 在 webview 运行时注入到全局作用域
 */
declare global {
  function acquireVsCodeApi(): {
    postMessage(message: WebviewMessage): void;
    getState(): unknown;
    setState(state: unknown): void;
  };
}
