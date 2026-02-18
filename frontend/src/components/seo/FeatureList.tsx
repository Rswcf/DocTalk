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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((item, i) => (
        <div
          key={i}
          className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200"
        >
          {item.icon && (
            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30 transition-colors duration-200">
              <span className="text-zinc-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                {item.icon}
              </span>
            </div>
          )}
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {item.title}
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
