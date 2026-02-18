import type { Metadata } from "next";
import DemoRedirectPageClient from "./DemoRedirectPageClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DemoRedirectPage() {
  return <DemoRedirectPageClient />;
}
