import React from 'react';
import { ShieldX } from 'lucide-react';

export default function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldX className="w-12 h-12 text-slate-300 mb-4" />
      <h1 className="font-display text-2xl font-semibold text-slate-900">Access denied</h1>
      <p className="text-slate-500 mt-2 max-w-sm">
        You don&apos;t have permission to view this page. If you believe this is an error, contact your administrator.
      </p>
    </div>
  );
}