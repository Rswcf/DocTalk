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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
        >
          {item.icon && (
            <div className="mb-3 text-zinc-700 dark:text-zinc-300">
              {item.icon}
            </div>
          )}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {item.title}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
