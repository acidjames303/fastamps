import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Lightweight contextual help. Opens as a popover — does not clear notes or
// interrupt an active call. Safe to use from the Dialer.
export default function ContextHelp({ title, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors text-xs">
          <HelpCircle className="w-3.5 h-3.5" />
          {title && <span>{title}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="bottom">
        <div className="space-y-2">
          {title && <p className="font-medium text-sm text-slate-900">{title}</p>}
          <div className="text-xs text-slate-600 leading-relaxed">{children}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}