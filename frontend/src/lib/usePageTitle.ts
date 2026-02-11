import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — DocTalk` : "DocTalk";
    return () => {
      document.title = "DocTalk";
    };
  }, [title]);
}
