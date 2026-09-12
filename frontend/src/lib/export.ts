import type { Message, Citation } from '../types';
import { sanitizeFilename } from './utils';
import { citationSourceKey, insertCitationMarkers } from './citationText';

export function renderConversationAsMarkdown(messages: Message[], documentName: string): string {
  const lines: string[] = [];
  lines.push(`# ${documentName || 'Document'} — Chat Export`);
  lines.push('');
  lines.push(`*Exported from DocTalk on ${new Date().toLocaleDateString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const footnotes: Citation[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`**You:**`);
      lines.push('');
      lines.push(msg.text);
    } else {
      lines.push(`**DocTalk:**`);
      lines.push('');
      // Ref numbers restart for each answer; retain its source identity as well
      // because a continued answer may reuse a number for a different source.
      const sourceIds = new Map<string, number>();
      const text = insertCitationMarkers(msg.text, msg.citations || [], (citation) => {
        const key = citationSourceKey(citation);
        if (!sourceIds.has(key)) {
          footnotes.push(citation);
          sourceIds.set(key, footnotes.length);
        }
        return `[^${sourceIds.get(key)}]`;
      });
      lines.push(text);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Add footnotes
  if (footnotes.length > 0) {
    lines.push('## References');
    lines.push('');
    footnotes.forEach((fn, idx) => {
      const snippet = fn.textSnippet ? ` — "${fn.textSnippet}"` : '';
      const location = fn.pageEnd && fn.pageEnd > fn.page ? `Pages ${fn.page}–${fn.pageEnd}` : `Page ${fn.page}`;
      const document = fn.documentFilename ? `, ${fn.documentFilename}` : '';
      lines.push(`[^${idx + 1}]: ${location}${document}${snippet}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export function exportConversationAsMarkdown(messages: Message[], documentName: string): void {
  const content = renderConversationAsMarkdown(messages, documentName);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = sanitizeFilename(documentName || 'chat').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  a.download = `${safeName}_chat_export.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
