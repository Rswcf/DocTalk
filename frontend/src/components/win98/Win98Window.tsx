"use client";

import type { ReactNode } from "react";

interface Win98WindowProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  active?: boolean;
  menuItems?: string[];
  statusBar?: ReactNode;
  toolbar?: ReactNode;
}

export function Win98Window({
  title,
  icon,
  children,
  className = "",
  onMinimize,
  onMaximize,
  onClose,
  active = true,
  menuItems,
  statusBar,
  toolbar,
}: Win98WindowProps) {
  return (
    <div
      className={`flex flex-col bg-[var(--win98-button-face)] win98-outset ${className}`}
    >
      {/* Title Bar */}
      <div
        className={`flex items-center gap-[3px] px-[3px] py-[2px] h-[18px] shrink-0 ${
          active
            ? "bg-gradient-to-r from-[#000080] to-[#1084d0]"
            : "bg-gradient-to-r from-[#808080] to-[#b0b0b0]"
        }`}
      >
        {icon && <span className="flex items-center w-[14px] h-[14px] shrink-0">{icon}</span>}
        <span
          className={`text-[11px] font-bold flex-1 truncate leading-none ${
            active ? "text-white" : "text-[#d4d0c8]"
          }`}
        >
          {title}
        </span>
        <div className="flex gap-[2px] shrink-0">
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="win98-titlebar-btn"
              aria-label="Minimize"
            >
              <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                <rect x="0" y="5" width="6" height="2" fill="black" />
              </svg>
            </button>
          )}
          {onMaximize && (
            <button
              type="button"
              onClick={onMaximize}
              className="win98-titlebar-btn"
              aria-label="Maximize"
            >
              <svg width="8" height="7" viewBox="0 0 9 8" fill="none">
                <rect x="0" y="0" width="9" height="8" fill="none" stroke="black" strokeWidth="1" />
                <rect x="0" y="0" width="9" height="2" fill="black" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="win98-titlebar-btn"
              aria-label="Close"
            >
              <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                <line x1="0" y1="0" x2="8" y2="7" stroke="black" strokeWidth="1.5" />
                <line x1="8" y1="0" x2="0" y2="7" stroke="black" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Menu Bar */}
      {menuItems && menuItems.length > 0 && (
        <div className="win98-menubar shrink-0">
          {menuItems.map((item) => (
            <span key={item} className="px-2 py-[2px] cursor-default hover:bg-[var(--win98-navy)] hover:text-white">
              <span className="underline">{item[0]}</span>
              {item.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Toolbar */}
      {toolbar && (
        <div className="bg-[var(--win98-button-face)] border-b border-b-[var(--win98-button-shadow)] px-1 py-[2px] shrink-0">
          {toolbar}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      {/* Status Bar */}
      {statusBar && (
        <div className="win98-statusbar shrink-0">{statusBar}</div>
      )}
    </div>
  );
}
