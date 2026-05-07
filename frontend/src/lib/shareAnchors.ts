export function messageShareAnchorFromId(messageId: string): string {
  const compact = messageId.replace(/-/g, '').toLowerCase();
  return `msg-${compact.slice(0, 16)}`;
}

export function withShareAnchor(url: string, anchor: string): string {
  return `${url.split('#')[0]}#${anchor.replace(/^#/, '')}`;
}
