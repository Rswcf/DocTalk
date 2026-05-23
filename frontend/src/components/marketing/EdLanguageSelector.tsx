"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Check } from "lucide-react";
import { LOCALES, useLocale } from "../../i18n";

/**
 * Editorial-styled language selector for the marketing surface.
 *
 * Functionally identical to the app-UI `LanguageSelector` (reads/writes the
 * locale via `useLocale()`, lists all `LOCALES`), but styled with the editorial
 * tokens (`--ed-*`, IBM Plex Mono labels, terracotta signal) so it belongs in
 * the warm-paper `EditorialHeaderBase` instead of the zinc/blue app chrome.
 *
 * The menu is rendered through a portal to `document.body` with `position:
 * fixed` and a high z-index, so it escapes the sticky header's stacking
 * context — otherwise the hero collage (whose rotated cards create their own
 * stacking contexts) paints over the dropdown and swallows its clicks. The
 * portaled menu is wrapped in `.dt-editorial` so the `--ed-*` tokens still
 * resolve outside the page's editorial root.
 */
export default function EdLanguageSelector() {
  const { locale, setLocale, tOr } = useLocale();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0, maxHeight: 420 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const top = r.bottom + 10;
    setPos({
      top,
      right: Math.max(12, window.innerWidth - r.right),
      maxHeight: Math.max(180, Math.min(440, window.innerHeight - top - 16)),
    });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, updatePos]);

  const current = LOCALES.find((l) => l.code === locale);
  const label = tOr("header.language", "Language");

  const menu = (
    <div
      ref={menuRef}
      className="dt-editorial"
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 10000,
        minWidth: "200px",
        maxHeight: pos.maxHeight,
        overflowY: "auto",
        background: "var(--ed-paper)",
        border: "1px solid var(--ed-rule)",
        boxShadow: "0 14px 36px rgba(40, 33, 24, 0.20)",
      }}
    >
      <ul role="listbox" aria-label={label} style={{ margin: 0, padding: "6px", listStyle: "none" }}>
        {LOCALES.map((l) => {
          const selected = l.code === locale;
          return (
            <li key={l.code} role="none">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2"
                style={{
                  fontFamily: "var(--dt-body)",
                  fontSize: "13px",
                  textAlign: "left",
                  color: selected ? "var(--ed-signal)" : "var(--ed-ink)",
                  background: "transparent",
                  border: "none",
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--ed-paper-2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span aria-hidden="true" style={{ width: "14px", display: "inline-flex" }}>
                  {selected ? <Check size={13} /> : null}
                </span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span
                  style={{
                    fontFamily: "var(--dt-mono)",
                    fontSize: "10.5px",
                    letterSpacing: "0.06em",
                    color: "var(--ed-ink-3)",
                  }}
                >
                  {l.code.toUpperCase()}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${(current?.code || "en").toUpperCase()} — ${label}`}
        className="inline-flex items-center gap-1.5"
        style={{
          fontFamily: "var(--dt-mono)",
          fontSize: "12px",
          letterSpacing: "0.06em",
          color: open ? "var(--ed-signal)" : "var(--ed-ink-2)",
          background: "transparent",
          border: "none",
          padding: "4px 2px",
          cursor: "pointer",
          transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ed-signal)";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.color = "var(--ed-ink-2)";
        }}
      >
        <Globe aria-hidden="true" size={15} />
        <span>{(current?.code || "en").toUpperCase()}</span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}
