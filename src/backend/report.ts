import * as fs from 'fs';
import * as path from 'path';
import { SessionData } from '../types';
import { PHASE_LABELS } from '../constants';

/** 报告导出格式 */
export type ReportFormat = 'md' | 'txt' | 'doc' | 'pdf';

const STYLE_NAMES: Record<string, string> = {
  maoxuan: '毛选风格',
  yedinying: '叶丁风格',
  balanced: '平衡融合',
};

function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 转义文件名中的非法字符 */
function safeFileName(name: string): string {
  return (name || '分析报告').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

/**
 * 生成专业分析报告（Markdown 母版，其他格式由此转换）
 * 结构：问题概述 → 多维度分析（实事求是）→ 结论与行动建议 → 执行检验标准
 */
export function buildReportMarkdown(session: SessionData): string {
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  const assistantMsgs = session.messages.filter((m) => m.role === 'assistant');
  const styleKey = (session.style as string) || 'balanced';
  const styleName = STYLE_NAMES[styleKey] || styleKey;

  let md = '';
  md += `# ${session.title || '分析报告'}\n\n`;
  md += `> **回答风格**：${styleName}　|　**对话创建**：${fmtDateTime(session.createdAt)}　|　**报告生成**：${fmtDateTime(Date.now())}\n`;
  md += `> **问答轮次**：${userMsgs.length} 轮　·　共 ${session.messages.length} 条消息\n\n`;
  md += `---\n\n`;

  // 一、问题概述
  const firstUser = userMsgs[0];
  md += `## 一、问题概述\n\n`;
  md += firstUser ? `> ${firstUser.content.replace(/\n/g, '\n> ')}\n\n` : `> （未记录到明确的提问内容）\n\n`;

  // 二、多维度分析（实事求是）
  md += `## 二、多维度分析（实事求是）\n\n`;
  md += `> 按照“实事求是”的原则，从事实、矛盾、条件、战略、战术、风险六个维度逐步分析，不脱离实际、不臆断结论。\n\n`;
  const dimensions: { phase: string; label: string; title: string }[] = [
    { phase: 'understanding', label: PHASE_LABELS.understanding, title: '维度一 · 事实与背景梳理' },
    { phase: 'contradiction', label: PHASE_LABELS.contradiction, title: '维度二 · 主要矛盾分析' },
    { phase: 'condition', label: PHASE_LABELS.condition, title: '维度三 · 条件与资源评估' },
    { phase: 'strategy', label: PHASE_LABELS.strategy, title: '维度四 · 战略方向' },
    { phase: 'tactics', label: PHASE_LABELS.tactics, title: '维度五 · 具体行动方案' },
    { phase: 'reflection', label: PHASE_LABELS.reflection, title: '维度六 · 风险与反思' },
  ];
  let hasAnalysis = false;
  for (const dim of dimensions) {
    const items = session.messages.filter((m) => m.phase === dim.phase);
    if (!items.length) continue;
    hasAnalysis = true;
    md += `### ${dim.title}\n\n`;
    for (const m of items) {
      const role = m.role === 'user' ? '提问' : '分析';
      md += `- **${role}**：${m.content.replace(/\n/g, '\n  ')}\n`;
    }
    md += `\n`;
  }
  if (!hasAnalysis) {
    md += `（本次对话内容较少，尚无分阶段分析记录）\n\n`;
  }

  // 三、结论与行动建议
  const lastAsst = assistantMsgs[assistantMsgs.length - 1];
  md += `---\n\n## 三、结论与行动建议\n\n`;
  md += lastAsst ? `${lastAsst.content}\n\n` : `（暂无结论）\n\n`;

  // 四、执行检验标准（实事求是）
  md += `### 执行检验标准\n\n`;
  md += `- **可量化**：把目标拆成可度量的指标，定期对照检查实际结果；\n`;
  md += `- **可证伪**：为关键判断设定验证时间点，实际与预期不符时及时修正；\n`;
  md += `- **从实际出发**：条件发生变化时，以新的调查研究结果为准，不固守旧结论。\n\n`;

  md += `---\n\n*本报告由「毛主席思想指导」扩展基于对话记录自动生成，仅供复盘与决策参考。*\n`;
  return md;
}

/** Markdown → 纯文本（保留结构，可直接复制粘贴） */
function markdownToText(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '\n【$1】')
    .replace(/^## (.+)$/gm, '\n\n【$1】')
    .replace(/^# (.+)$/gm, '$1')
    .replace(/^> /gm, '　')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^- /gm, '• ')
    .replace(/^---$/gm, '————————————————————')
    .trim();
}

/** Word 文档（HTML 版 .doc，Word / WPS 可直接打开并编辑复制） */
function buildWordHtml(md: string, title: string): string {
  const body = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.*)$/gm, '<p class="quote">$1</p>')
    .replace(/^- (.*)$/gm, '<p class="li">• $1</p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;font-size:12pt;line-height:1.8;color:#222;max-width:720px;margin:24px auto;}
h1{font-size:20pt;border-bottom:2px solid #333;padding-bottom:8px;}
h2{font-size:15pt;border-left:4px solid #b91c1c;padding-left:8px;margin-top:22px;}
h3{font-size:13pt;color:#b91c1c;margin-top:14px;}
.quote{border-left:3px solid #ccc;padding:8px 10px;color:#555;background:#f7f7f7;}
.li{margin:2px 0 2px 18px;}
hr{border:none;border-top:1px dashed #999;margin:16px 0;}
</style></head><body>${body}</body></html>`;
}

/** 候选中文字体路径（PDF 嵌入用，按优先级排列） */
function findCjkFontPaths(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/Library/Fonts/Arial Unicode.ttf',
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
      '/System/Library/Fonts/Supplemental/Songti.ttc',
    ];
  }
  if (process.platform === 'win32') {
    return [
      'C:\\Windows\\Fonts\\msyh.ttc',
      'C:\\Windows\\Fonts\\simhei.ttf',
      'C:\\Windows\\Fonts\\simsun.ttc',
    ];
  }
  return [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  ];
}

/** 生成 PDF（pdf-lib + 系统中文字体嵌入） */
async function writePdf(filePath: string, md: string, title: string): Promise<void> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const fontkitModule = await import('@pdf-lib/fontkit');
  const fontkit = (fontkitModule as any).default || fontkitModule;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // 逐候选嵌入字体，成功即用
  let font: any = null;
  for (const p of findCjkFontPaths()) {
    try {
      if (!fs.existsSync(p)) continue;
      font = await doc.embedFont(fs.readFileSync(p), { subset: true });
      break;
    } catch {
      /* 该字体无法嵌入，尝试下一个 */
    }
  }
  if (!font) {
    throw new Error('未找到可用的中文字体，无法生成 PDF。请改用 Word 或 Markdown 格式导出。');
  }

  const pageW = 595;
  const pageH = 842;
  const margin = 56;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;
  const baseLineH = 20;

  const ensureSpace = (h: number) => {
    if (y - h < margin) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const drawLine = (text: string, size: number, color: any, indent = 0, gapAfter = 4) => {
    const maxW = pageW - margin * 2 - indent;
    let line = '';
    const flush = () => {
      if (!line) return;
      ensureSpace(baseLineH);
      page.drawText(line, { x: margin + indent, y, size, font, color });
      y -= baseLineH;
      line = '';
    };
    for (const ch of text) {
      if (font.widthOfTextAtSize(line + ch, size) > maxW) flush();
      line += ch;
    }
    flush();
    y -= gapAfter;
  };

  // 清理标记并分行渲染
  const lines = md.replace(/\*\*/g, '').split('\n');
  for (const raw of lines) {
    const lineText = raw.trimEnd();
    if (!lineText.trim()) {
      y -= 8;
      continue;
    }
    if (lineText.startsWith('# ')) {
      ensureSpace(30);
      drawLine(lineText.slice(2), 20, rgb(0.72, 0.11, 0.11), 0, 8);
    } else if (lineText.startsWith('## ')) {
      ensureSpace(26);
      drawLine(lineText.slice(3), 15, rgb(0.15, 0.15, 0.15), 0, 6);
    } else if (lineText.startsWith('### ')) {
      ensureSpace(24);
      drawLine(lineText.slice(4), 12.5, rgb(0.72, 0.11, 0.11), 0, 5);
    } else if (lineText.startsWith('> ')) {
      drawLine('　' + lineText.slice(2), 10, rgb(0.35, 0.35, 0.35), 10, 3);
    } else if (lineText.startsWith('- ')) {
      drawLine('• ' + lineText.slice(2), 10.5, rgb(0.2, 0.2, 0.2), 14, 3);
    } else if (lineText.trim() === '---') {
      ensureSpace(12);
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageW - margin, y },
        thickness: 1,
        color: rgb(0.6, 0.6, 0.6),
      });
      y -= 14;
    } else {
      drawLine(lineText, 10.5, rgb(0.2, 0.2, 0.2), 0, 3);
    }
  }

  // 页脚
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = doc.getPage(i);
    p.drawText(`${title} · 第 ${i + 1} / ${pageCount} 页`, {
      x: margin,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  fs.writeFileSync(filePath, await doc.save());
}

/** 导出报告文件，返回生成的文件路径 */
export async function exportReportFile(
  markdown: string,
  session: SessionData,
  format: ReportFormat,
  outDir: string
): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const title = session.title || '分析报告';
  const ext = format === 'doc' ? 'doc' : format;
  const filePath = path.join(outDir, `${safeFileName(title)}.${ext}`);

  if (format === 'md') {
    fs.writeFileSync(filePath, markdown, 'utf-8');
  } else if (format === 'txt') {
    fs.writeFileSync(filePath, markdownToText(markdown), 'utf-8');
  } else if (format === 'doc') {
    fs.writeFileSync(filePath, buildWordHtml(markdown, title), 'utf-8');
  } else if (format === 'pdf') {
    await writePdf(filePath, markdown, title);
  }
  return filePath;
}
