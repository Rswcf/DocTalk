"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { LOCALES, useLocale } from "../../i18n";
import {
  MARKETING_LOCALES,
  localizedHref,
  splitLocaleFromPath,
  isLocalizedPath,
} from "../../i18n/routing";

/**
 * Editorial-styled language selector for the marketing surface.
 *
 * Two modes, decided per page:
 * - **Localized page** (the path has server-rendered locale variants): the menu
 *   renders real `<a href="/de/...">` anchors for every marketing locale. This is
 *   what makes the alternate-language URLs *crawlable* — search engines follow
 *   the links and discover each language version.
 * - **English-only page** (not yet localized): falls back to the original
 *   client-side `setLocale()` toggle across all `LOCALES`, so the in-app locale
 *   switch still works everywhere.
 *
 * The menu is rendered through a portal to `document.body` with `position:
 * fixed` so it escapes the sticky header's stacking context.
 */
export default function EdLanguageSelector() {
  const { locale, setLocale, tOr } = useLocale();
  const pathname = usePathname() || "/";
  const { locale: urlLocale, path: agnosticPath } = splitLocaleFromPath(pathname);
  const localized = isLocalizedPath(agnosticPath);
  // On a localized URL the active language is the one in the URL; otherwise the
  // client-detected/selected locale.
  const activeLocale = localized ? urlLocale : locale;

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

  const current = LOCALES.find((l) => l.code === activeLocale);
  const label = tOr("header.language", "Language");

  // On localized pages, only offer the locales that actually have a URL for this
  // page (en + URL_LOCALES). Elsewhere, the full client-toggle list.
  const options = localized
    ? LOCALES.filter((l) => (MARKETING_LOCALES as readonly string[]).includes(l.code))
    : LOCALES;

  const optionStyle = (selected: boolean): React.CSSProperties => ({
    fontFamily: "var(--dt-body)",
    fontSize: "13px",
    textAlign: "left",
    color: selected ? "var(--ed-signal)" : "var(--ed-ink)",
    background: "transparent",
    border: "none",
    padding: "8px 10px",
    cursor: "pointer",
    textDecoration: "none",
    width: "100%",
  });
  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--ed-paper-2)";
  };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
  };

  const codeBadge = (code: string) => (
    <span
      style={{
        fontFamily: "var(--dt-mono)",
        fontSize: "10.5px",
        letterSpacing: "0.06em",
        color: "var(--ed-ink-3)",
      }}
    >
      {code.toUpperCase()}
    </span>
  );

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
        {options.map((l) => {
          const selected = l.code === activeLocale;
          const inner = (
            <>
              <span aria-hidden="true" style={{ width: "14px", display: "inline-flex" }}>
                {selected ? <Check size={13} /> : null}
              </span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {codeBadge(l.code)}
            </>
          );
          return (
            <li key={l.code} role="none">
              {localized ? (
                <a
                  role="option"
                  aria-selected={selected}
                  href={localizedHref(l.code, agnosticPath)}
                  hrefLang={l.code}
                  onClick={() => {
                    setLocale(l.code);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                  style={optionStyle(selected)}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                >
                  {inner}
                </a>
              ) : (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setLocale(l.code);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                  style={optionStyle(selected)}
                  onMouseEnter={onEnter}
                  onMouseLeave={onLeave}
                >
                  {inner}
                </button>
              )}
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
