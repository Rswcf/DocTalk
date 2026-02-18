import type { Metadata } from "next";
import CollectionsPageClient from "./CollectionsPageClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CollectionsPage() {
  return <CollectionsPageClient />;
}
