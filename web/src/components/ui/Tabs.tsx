'use client';

import React from 'react';
import { clsx } from 'clsx';
import type { TabDef } from '../../types/common';

interface TabsProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={clsx('flex border-b border-slate-200', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && onTabChange(tab.key)}
            disabled={tab.disabled}
            className={clsx(
              'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'text-hii-600 border-b-2 border-hii-600'
                : 'text-slate-500 hover:text-slate-700 hover:border-b-2 hover:border-slate-300',
              tab.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-hii-100 text-hii-700">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
