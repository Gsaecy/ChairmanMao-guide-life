import { MaoxuanConfig } from './types';

export const EXTENSION_ID = 'maoxuan-guidance';
export const EXTENSION_NAME = '毛主席思想指导';

export const DEFAULT_STORAGE_DIR = '.maoxuan-guidance';
export const CONVERSATIONS_DIR = 'conversations';
export const REPORTS_DIR = 'reports';

export const DEFAULT_CONFIG: MaoxuanConfig = {
  provider: 'deepseek',
  apiKey: '',
  apiBaseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  storagePath: '',
  webSearchEnabled: true,
  searchApiKey: '',
  searchEngine: 'serpapi',
  temperature: 0.7,
  maxTokens: 4096,
  style: 'balanced',
};

export const PHASE_LABELS: Record<string, string> = {
  understanding: '第一阶段 · 全面了解',
  contradiction: '第二阶段 · 矛盾分析',
  condition: '第三阶段 · 条件评估',
  strategy: '第四阶段 · 战略建议',
  tactics: '第五阶段 · 战术行动',
  reflection: '第六阶段 · 反思迭代',
  complete: '对话完成',
};