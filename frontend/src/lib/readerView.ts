/** The reader's two views of a document that has a converted PDF (DOCX, PPTX). */
export type ReaderView = 'slide' | 'text';

/** A view the reader picked with the toggle, for one document. */
export interface ReaderViewChoice { documentId: string; view: ReaderView }

/**
 * The view a document opens in (owner decision 2026-10-11). DOCX opens in the
 * text view: citations are located in the extractor's own pages there, while
 * the slide view's page N is a LibreOffice PDF page, not extractor page N.
 * PPTX (one slide per extractor page) and every other type open in the slide
 * view. The reader can still switch.
 */
export function defaultReaderView(fileType: string | null | undefined): ReaderView {
  return fileType?.toLowerCase() === 'docx' ? 'text' : 'slide';
}

/** The view shown for `documentId`: the reader's choice for this document,
 * else the default for its type. A choice made on another document does not
 * carry over, so every entry path (a chat citation, a `?highlight=` link, the
 * collection reader, a Quote Finder jump) opens a DOCX in the text view. */
export function readerView(choice: ReaderViewChoice | null, documentId: string, fileType: string | null | undefined): ReaderView {
  return choice && choice.documentId === documentId ? choice.view : defaultReaderView(fileType);
}
