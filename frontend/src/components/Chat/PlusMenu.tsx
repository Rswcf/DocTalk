"use client";

import React from 'react';
import { Download, FileText, Lock, Plus, Settings2 } from 'lucide-react';

interface PlusMenuProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement>;
  buttonRef: React.RefObject<HTMLButtonElement>;
  onMenuKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  showCustomInstructions: boolean;
  showExportInMenu: boolean;
  canUseCustomInstructions: boolean;
  hasCustomInstructions?: boolean;
  canUseExport: boolean;
  onOpenSettings?: () => void;
  onExport: () => void;
  onExportPdf?: () => void;
  onExportDocx?: () => void;
  onBillingRedirect: () => void;
  t: (key: string) => string;
  tOr: (key: string, fallback: string) => string;
}

export default function PlusMenu({
  isOpen,
  setIsOpen,
  menuRef,
  buttonRef,
  onMenuKeyDown,
  showCustomInstructions,
  showExportInMenu,
  canUseCustomInstructions,
  hasCustomInstructions,
  canUseExport,
  onOpenSettings,
  onExport,
  onExportPdf,
  onExportDocx,
  onBillingRedirect,
  t,
  tOr,
}: PlusMenuProps) {
  if (!showCustomInstructions && !showExportInMenu) {
    return null;
  }

  return (
    <div className="relative shrink-0" data-plus-menu data-tour="plus-menu">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        aria-label={tOr('chat.moreOptions', 'More options')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Plus size={20} />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-20 py-1 animate-fade-in motion-reduce:animate-none"
          role="menu"
          onKeyDown={onMenuKeyDown}
        >
          {showCustomInstructions && (
            <button
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => {
                if (canUseCustomInstructions) {
                  onOpenSettings?.();
                  setIsOpen(false);
                  return;
                }
                onBillingRedirect();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            >
              {canUseCustomInstructions ? <Settings2 size={16} /> : <Lock size={16} />}
              <span>{tOr('chat.customInstructions', 'Custom Instructions')}</span>
              {!canUseCustomInstructions && (
                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  Pro
                </span>
              )}
              {canUseCustomInstructions && hasCustomInstructions && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          )}

          {showCustomInstructions && showExportInMenu && (
            <div className="border-t border-zinc-100 dark:border-zinc-700" />
          )}

          {/* Markdown export — always available */}
          {showExportInMenu && (
            <button
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => {
                onExport();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            >
              <FileText size={16} />
              <span>{tOr('chat.exportMarkdown', 'Export Markdown')}</span>
            </button>
          )}

          {/* PDF export — Plus+ gated */}
          {showExportInMenu && (
            <button
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => {
                if (canUseExport && onExportPdf) {
                  onExportPdf();
                  setIsOpen(false);
                  return;
                }
                onBillingRedirect();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            >
              {canUseExport ? <Download size={16} /> : <Lock size={16} />}
              <span>{tOr('chat.exportPdf', 'Export PDF')}</span>
              {!canUseExport && (
                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  Plus
                </span>
              )}
            </button>
          )}

          {/* DOCX export — Plus+ gated */}
          {showExportInMenu && (
            <button
              role="menuitem"
              tabIndex={-1}
              type="button"
              onClick={() => {
                if (canUseExport && onExportDocx) {
                  onExportDocx();
                  setIsOpen(false);
                  return;
                }
                onBillingRedirect();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            >
              {canUseExport ? <Download size={16} /> : <Lock size={16} />}
              <span>{tOr('chat.exportDocx', 'Export DOCX')}</span>
              {!canUseExport && (
                <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  Plus
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
