export function shouldRenderDocumentBriefEmptyState(
  messageCount: number,
  questions: readonly string[],
  summary: string | null | undefined,
  briefPolling: boolean,
): boolean {
  return messageCount === 0 && (
    questions.length > 0
    || Boolean(summary)
    || briefPolling
  );
}

export function truncateDocumentBriefSummary(
  summary: string | null | undefined,
  maxWords = 60,
): string | null {
  const normalized = summary?.trim();
  if (!normalized) return null;
  const words = normalized.split(/\s+/);
  if (words.length <= maxWords) return normalized;
  return `${words.slice(0, maxWords).join(' ')}…`;
}
