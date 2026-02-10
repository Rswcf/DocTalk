"use client";

import React, { useState, useEffect } from "react";

interface TaskbarItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface Win98TaskbarProps {
  items?: TaskbarItem[];
}

function WindowsLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" fill="#FF0000" />
      <rect x="9" y="1" width="6" height="6" fill="#00FF00" />
      <rect x="1" y="9" width="6" height="6" fill="#0000FF" />
      <rect x="9" y="9" width="6" height="6" fill="#FFFF00" />
    </svg>
  );
}

function Clock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="text-[11px]">{time}</span>;
}

export function Win98Taskbar({ items = [] }: Win98TaskbarProps) {
  return (
    <div className="win98-taskbar fixed bottom-0 left-0 right-0 z-50">
      {/* Start Button */}
      <button type="button" className="win98-button flex items-center gap-1 font-bold h-[22px] px-1">
        <WindowsLogo />
        <span className="text-[11px]">Start</span>
      </button>

      {/* Groove separator */}
      <div className="win98-groove-v h-[22px] mx-[2px]" />

      {/* Quick Launch */}
      <div className="flex items-center gap-[2px] px-1">
        <button type="button" className="w-[20px] h-[20px] flex items-center justify-center hover:bg-[var(--win98-light-gray)]" aria-label="Show Desktop">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="9" fill="#000080" stroke="#000" strokeWidth="1"/>
            <rect x="5" y="10" width="4" height="1" fill="#808080"/>
            <rect x="3" y="11" width="8" height="1" fill="#808080"/>
          </svg>
        </button>
      </div>

      <div className="win98-groove-v h-[22px] mx-[2px]" />

      {/* Taskbar Items */}
      <div className="flex-1 flex items-center gap-[2px] overflow-hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`h-[22px] flex items-center gap-1 px-2 text-[11px] min-w-[120px] max-w-[160px] truncate ${
              item.active
                ? "bg-[var(--win98-button-face)] border-2 border-t-[var(--win98-button-dark-shadow)] border-l-[var(--win98-button-dark-shadow)] border-b-[var(--win98-button-highlight)] border-r-[var(--win98-button-highlight)]"
                : "win98-button"
            }`}
          >
            {item.icon}
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="win98-groove-v h-[22px] mx-[2px]" />
      <div className="win98-inset flex items-center gap-2 px-2 h-[22px]">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 4h2l3-3v10l-3-3H1V4z" fill="#000"/>
          <path d="M8 3c1 1 1 5 0 6" stroke="#000" strokeWidth="1" fill="none"/>
          <path d="M9 1c2 2 2 8 0 10" stroke="#000" strokeWidth="1" fill="none"/>
        </svg>
        <Clock />
      </div>
    </div>
  );
}
