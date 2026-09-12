/** Browser-native word boundaries support scripts without spaces. The fallback
 * retains contiguous letter/number groups for older browsers. */
export function getWords(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text))
      .filter((part) => part.isWordLike).map((part) => part.segment);
  }
  return text.match(/[\p{L}\p{N}]+(?:[-']\p{L}+)*/gu) ?? [];
}

/** Linguistic estimates, not grammatical parsing. Protect decimals and common
 * non-terminal English titles before Unicode sentence segmentation. */
export function getSentences(text: string): number {
  const prepared = text
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs)\.(?=\s+\S)/gi, (value) => value.slice(0, -1))
    .replace(/(\d)\.(?=\d)/g, '$1')
    .replace(/\b(?:e\.g|i\.e)\./gi, (value) => value.replace(/\./g, ''));
  const parts = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(prepared), (part) => part.segment)
    : prepared.match(/[^.!?。！？؟।]+(?:[.!?。！？؟।]+|$)/gu) ?? [];
  return parts.filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
}
