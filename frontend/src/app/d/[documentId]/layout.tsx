import React from 'react';

export default function DocLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full">{children}</div>
  );
}

