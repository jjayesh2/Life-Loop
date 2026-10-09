import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, Download } from 'lucide-react';
import { AuditLog } from '../types';
import { fetchAuditLogs } from '../services/api';

export const AuditTrailPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetchAuditLogs()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase();
    const matchesSearch =
      l.action.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(q)) ||
      (l.details && l.details.toLowerCase().includes(q));

    const matchesFilter = !actionFilter || l.action.includes(actionFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">System Audit Trail & Chain of Custody</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable transaction log of all inventory movements, solver runs, alerts, and dispatch approvals.
          </p>
        </div>

        <button
          onClick={() => {
            const csv = [
              ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Details'].join(','),
              ...filteredLogs.map(l => [
                `"${l.timestamp}"`,
                `"${l.actor}"`,
                `"${l.action}"`,
                `"${l.entity_type}"`,
                `"${l.entity_id || ''}"`,
                `"${(l.details || '').replace(/"/g, '""')}"`
              ].join(','))
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lifeloop_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by actor, action, tracking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
        >
          <option value="">All Action Types</option>
          <option value="OPTIMIZATION">Optimization Solves</option>
          <option value="TRANSFER">Transfers & Dispatches</option>
          <option value="ALERT">Alerts & Expiry</option>
          <option value="SIMULATION">Simulated Events</option>
          <option value="TRACEABILITY">Traceability Events</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Timestamp (UTC)</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Actor / System</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Details & Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Loading audit log records...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No matching audit events found.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800 uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-700">{log.actor}</td>
                    <td className="p-3.5 font-mono text-teal-800 font-semibold">{log.entity_id || log.entity_type}</td>
                    <td className="p-3.5 text-slate-600 max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
