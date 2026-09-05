import * as https from 'https';
import * as http from 'http';

/**
 * 联网能力模块：抓取网页内容 + 联网搜索
 * 所有网络失败均优雅降级，不影响对话主流程
 */

const FETCH_TIMEOUT = 8000;
const MAX_PAGE_CHARS = 4000;

/** 提取消息中的 http(s) 链接 */
export function extractUrls(text: string): string[] {
  // 在中文标点/括号/感叹号处截断，避免把标点后面的文字吞进链接（ASCII 点号是 URL 一部分，不能排除）
  const re = /https?:\/\/[^\s<>"'）)】，。；、!？！]+/gi;
  const urls = text.match(re) || [];
  // 去重并去尾部残余标点
  const clean = [...new Set(urls)]
    .map((u) => u.replace(/[，。；、,.!?？！）】]+$/g, ''))
    .slice(0, 3);
  return clean;
}

/** 简单 GET（自动跟随重定向，最多 3 层） */
function httpGet(urlStr: string, timeout: number, depth = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, urlStr).toString();
          if (next.startsWith('http') && depth < 3) {
            resolve(httpGet(next, timeout, depth + 1));
          } else {
            reject(new Error('重定向无效'));
          }
          return;
        }
        if ((res.statusCode || 0) >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          if (data.length < 2_000_000) data += c;
        });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('请求超时')));
    req.end();
  });
}

/** 去 HTML 标签与脚本样式 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 120) : '';
}

/** 抓取网页内容（标题 + 正文摘要） */
export async function fetchPageContent(rawUrl: string): Promise<{ url: string; title: string; content: string }> {
  try {
    const html = await httpGet(rawUrl, FETCH_TIMEOUT);
    const title = extractTitle(html);
    const text = stripHtml(html);
    return { url: rawUrl, title, content: text.slice(0, MAX_PAGE_CHARS) };
  } catch (e) {
    return {
      url: rawUrl,
      title: '',
      content: `（网页抓取失败：${e instanceof Error ? e.message : '未知错误'}）`,
    };
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 必应网页搜索（免 Key，走 cn.bing.com） */
async function searchBing(query: string): Promise<SearchResult[]> {
  const html = await httpGet(
    'https://cn.bing.com/search?q=' + encodeURIComponent(query) + '&count=8',
    FETCH_TIMEOUT
  );
  const results: SearchResult[] = [];
  const blocks = html.split('<li class="b_algo"');
  for (let i = 1; i < blocks.length && results.length < 5; i++) {
    const b = blocks[i];
    const title = (b.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || '';
    const url = (b.match(/<a[^>]*href="(https?:\/\/[^"]+)"/i) || [])[1] || '';
    const snippet = (b.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
    if (!title || !url) continue;
    results.push({ title: stripHtml(title), url, snippet: stripHtml(snippet).slice(0, 300) });
  }
  return results;
}

/** SerpAPI 搜索（需 Key） */
async function searchSerpApi(query: string, key: string): Promise<SearchResult[]> {
  const html = await httpGet(
    'https://serpapi.com/search.json?engine=google&q=' +
      encodeURIComponent(query) +
      '&api_key=' +
      encodeURIComponent(key),
    FETCH_TIMEOUT
  );
  const j = JSON.parse(html);
  return ((j.organic_results || []) as any[])
    .slice(0, 5)
    .map((r) => ({ title: r.title || '', url: r.link || '', snippet: (r.snippet || '').slice(0, 300) }));
}

/** 联网搜索（按引擎选择，失败返回空数组不抛错） */
export async function searchWeb(query: string, engine: string, apiKey: string): Promise<SearchResult[]> {
  try {
    if (engine === 'serpapi' && apiKey) {
      return await searchSerpApi(query, apiKey);
    }
    return await searchBing(query);
  } catch {
    return [];
  }
}

/**
 * 构建联网上下文：
 * 1. 消息中的链接 → 抓取网页正文摘要
 * 2. 开启联网搜索时 → 检索关键词的搜索结果
 */
export async function buildWebContext(
  userContent: string,
  engine: string,
  apiKey: string,
  doSearch: boolean
): Promise<string> {
  const parts: string[] = [];

  const urls = extractUrls(userContent);
  if (urls.length) {
    const pages = await Promise.all(urls.map((u) => fetchPageContent(u)));
    for (const p of pages) {
      if (!p.content) continue;
      parts.push(
        `【网页内容】标题：${p.title || '（无标题）'}\n网址：${p.url}\n正文摘要：\n${p.content}`
      );
    }
  }

  if (doSearch) {
    const q = userContent.replace(/https?:\/\/[^\s]+/gi, '').trim().slice(0, 200);
    if (q) {
      const results = await searchWeb(q, engine, apiKey);
      if (results.length) {
        const list = results
          .map((r, i) => `${i + 1}. ${r.title}\n   来源：${r.url}\n   摘要：${r.snippet}`)
          .join('\n');
        parts.push(`【联网搜索结果】关键词："${q}"\n${list}`);
      }
    }
  }

  if (!parts.length) return '';
  return (
    '\n\n===== 联网资料（供参考，请基于其中事实分析，引用时注明来源网址；资料不足时如实说明，不要编造）=====\n' +
    parts.join('\n\n') +
    '\n===== 联网资料结束 ====='
  );
}
