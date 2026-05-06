"use client";

import React, { ReactNode } from 'react';

interface FeatureItem {
  icon?: ReactNode;
  title: string;
  description: string;
}

interface FeatureListProps {
  items: FeatureItem[];
}

export default function FeatureList({ items }: FeatureListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
        >
          {item.icon && (
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 transition-colors duration-200 group-hover:border-accent/30 group-hover:bg-accent-light dark:border-zinc-800 dark:bg-zinc-950">
              <span className="text-zinc-600 transition-colors duration-200 group-hover:text-accent dark:text-zinc-300">
                {item.icon}
              </span>
            </div>
          )}
          <h3 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
