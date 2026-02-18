import type { Metadata } from "next";
import DocumentReaderPageClient from "./DocumentReaderPageClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DocumentReaderPage() {
  return <DocumentReaderPageClient />;
}
