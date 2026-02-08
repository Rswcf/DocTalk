import type { Message, Citation } from '../types';

export function exportConversationAsMarkdown(messages: Message[], documentName: string): void {
  const lines: string[] = [];
  lines.push(`# ${documentName || 'Document'} — Chat Export`);
  lines.push('');
  lines.push(`*Exported from DocTalk on ${new Date().toLocaleDateString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const footnotes: Map<string, { page: number; text: string }> = new Map();
  let footnoteCounter = 0;

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`**You:**`);
      lines.push('');
      lines.push(msg.text);
    } else {
      lines.push(`**DocTalk:**`);
      lines.push('');
      let text = msg.text;

      // Process citations into footnotes
      if (msg.citations && msg.citations.length > 0) {
        // Build a map of refIndex to citation
        const citationMap = new Map<number, Citation>();
        for (const c of msg.citations) {
          if (!citationMap.has(c.refIndex)) {
            citationMap.set(c.refIndex, c);
          }
        }

        // Replace [n] with markdown footnote references
        text = text.replace(/\[(\d+)\]/g, (_match, num) => {
          const refIdx = parseInt(num, 10);
          const citation = citationMap.get(refIdx);
          if (citation) {
            footnoteCounter++;
            const key = `fn-${footnoteCounter}`;
            footnotes.set(key, {
              page: citation.page,
              text: citation.textSnippet || '',
            });
            return `[^${footnoteCounter}]`;
          }
          return `[${num}]`;
        });
      }

      lines.push(text);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Add footnotes
  if (footnotes.size > 0) {
    lines.push('## References');
    lines.push('');
    const entries = Array.from(footnotes.values());
    entries.forEach((fn, idx) => {
      const snippet = fn.text ? ` — "${fn.text}"` : '';
      lines.push(`[^${idx + 1}]: Page ${fn.page}${snippet}`);
    });
    lines.push('');
  }

  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (documentName || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${safeName}_chat_export.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
