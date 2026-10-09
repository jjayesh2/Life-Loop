import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export const Banner: React.FC = () => {
  return (
    <div className="bg-navy-950 text-slate-300 px-4 py-1.5 text-xs flex items-center justify-between border-b border-navy-800">
      <div className="flex items-center space-x-2">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
        </span>
        <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">Demo Environment</span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-400">Synthetic clinical logistics data; strictly not for patient diagnostic or transfusion decisions.</span>
      </div>
      <div className="hidden md:flex items-center space-x-3 text-slate-400">
        <span className="flex items-center gap-1 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          MILP HiGHS Verified
        </span>
        <span>•</span>
        <span className="text-slate-400 text-[11px]">System Status: Operational</span>
      </div>
    </div>
  );
};
