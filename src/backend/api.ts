import * as https from 'https';
import * as http from 'http';
import { MaoxuanConfig, ChatMessage } from '../types';
import { buildSystemPrompt, getPhaseInstruction } from './prompt';

/**
 * DeepSeek / OpenAI 兼容 API 调用层
 * 支持流式(streaming)输出
 */

interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface ChatCompletionChunk {
  choices: {
    delta: {
      content?: string;
      reasoning_content?: string; // DeepSeek R1 的思考链——需要过滤掉
    };
    index: number;
    finish_reason: string | null;
  }[];
}

/**
 * 发送流式对话请求
 * @param config 用户配置
 * @param messages 对话历史
 * @param currentPhase 当前对话阶段
 * @param onChunk 每收到一个文本块时的回调
 * @param onComplete 完成时的回调
 * @param onError 出错时的回调
 */
export function streamChat(
  config: MaoxuanConfig,
  messages: ChatMessage[],
  currentPhase: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): { abort: () => void } {
  const systemPrompt = buildSystemPrompt(config);
  const phaseInstruction = getPhaseInstruction(currentPhase as any);
  const fullSystemPrompt = systemPrompt + '\n\n' + phaseInstruction;

  // 构建消息列表
  const apiMessages: { role: string; content: string }[] = [
    { role: 'system', content: fullSystemPrompt },
    ...messages.map(m => ({
      role: m.role as string,
      content: m.content,
    })),
  ];

  const requestBody: ChatCompletionRequest = {
    model: config.model,
    messages: apiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  };

  const bodyString = JSON.stringify(requestBody);

  const url = new URL(config.apiBaseUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  // 智能拼接 chat completions 端点（修复：用户填 /v1 或完整端点时路径重复）
  let apiPath = (url.pathname || '/').replace(/\/+$/, '');
  if (apiPath.endsWith('/chat/completions')) {
    // 用户已填完整端点
  } else if (apiPath.endsWith('/v1')) {
    apiPath += '/chat/completions';
  } else if (apiPath === '') {
    apiPath = '/v1/chat/completions';
  } else {
    apiPath += '/v1/chat/completions';
  }

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: apiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'Accept': 'text/event-stream',
    },
  };

  const req = httpModule.request(options, (res) => {
    if (res.statusCode !== 200) {
      let errorData = '';
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString(); });
      res.on('end', () => {
        let errorMsg = `API 返回错误状态码 ${res.statusCode}`;
        try {
          const errJson = JSON.parse(errorData);
          errorMsg = errJson.error?.message || errorMsg;
        } catch {}
        onError(new Error(errorMsg));
      });
      return;
    }

    let fullText = '';
    let buffer = '';

    res.on('data', (chunk: Buffer) => {
      // 将 Buffer 转为字符串，用 TextDecoder 确保 UTF-8 多字节字符不被截断
      buffer += chunk.toString('utf-8');
      // 按 "\n\n" 分割 SSE 事件（而非单行），避免在 UTF-8 多字节边界切开
      const events = buffer.split('\n\n');
      // 最后一个可能不完整，保留到下次
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed: ChatCompletionChunk = JSON.parse(data);
            // 只取 content，忽略 reasoning_content（思考过程）—— 避免乱码和超长回复
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch {}
        }
      }
    });
     
    res.on('end', () => {
      // 处理剩余的 SSE 事件
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
          const data = trimmed.slice(6);
          try {
            const parsed: ChatCompletionChunk = JSON.parse(data);
            // 只取 content，忽略 reasoning_content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch {}
        }
      }
      onComplete(fullText);
    });

    res.on('error', (err: Error) => {
      onError(err);
    });
  });

  req.on('error', (err: Error) => {
    onError(err);
  });

  req.write(bodyString);
  req.end();

  return {
    abort: () => {
      req.destroy();
    },
  };
}

/**
 * 执行联网搜索（预留接口）
 * 当模型标记需要查证时调用
 */
export async function webSearch(
  query: string,
  config: MaoxuanConfig
): Promise<string> {
  if (!config.webSearchEnabled || !config.searchApiKey) {
    return '联网搜索功能未启用或未配置API Key。请在设置中配置搜索引擎API。';
  }

  try {
    if (config.searchEngine === 'serpapi') {
      return await searchSerpApi(query, config.searchApiKey);
    } else if (config.searchEngine === 'bing') {
      return await searchBing(query, config.searchApiKey);
    }
    return '未识别的搜索引擎。';
  } catch (err) {
    return `搜索请求失败：${err instanceof Error ? err.message : '未知错误'}`;
  }
}

/**
 * SerpAPI 搜索
 */
async function searchSerpApi(query: string, apiKey: string): Promise<string> {
  const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&hl=zh-CN&gl=cn`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.organic_results && result.organic_results.length > 0) {
            const snippets = result.organic_results.slice(0, 5).map(
              (r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.link}`
            ).join('\n\n');
            resolve(snippets);
          } else {
            resolve('未找到相关搜索结果。');
          }
        } catch {
          reject(new Error('解析搜索结果失败'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Bing Search API
 */
async function searchBing(query: string, apiKey: string): Promise<string> {
  const options = {
    hostname: 'api.bing.microsoft.com',
    path: `/v7.0/search?q=${encodeURIComponent(query)}&mkt=zh-CN&count=5`,
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
    },
  };

  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.webPages?.value) {
            const snippets = result.webPages.value.map(
              (r: any, i: number) => `${i + 1}. ${r.name}\n   ${r.snippet}\n   ${r.url}`
            ).join('\n\n');
            resolve(snippets);
          } else {
            resolve('未找到相关搜索结果。');
          }
        } catch {
          reject(new Error('解析搜索结果失败'));
        }
      });
    }).on('error', reject);
  });
}