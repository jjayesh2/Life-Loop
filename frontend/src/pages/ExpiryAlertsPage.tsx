import React, { useState, useEffect } from 'react';
import {
  BellRing,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Mail,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Alert, Facility } from '../types';
import { fetchAlerts, triggerExpiryCheck, acknowledgeAlert } from '../services/api';

interface ExpiryAlertsPageProps {
  facilities: Facility[];
  onNavigateToInventory: (bloodGroup?: string) => void;
}

export const ExpiryAlertsPage: React.FC<ExpiryAlertsPageProps> = ({ facilities, onNavigateToInventory }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>('active');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchAlerts(filterStatus || undefined);
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filterStatus]);

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      const res = await triggerExpiryCheck();
      setCheckResult(res);
      await loadAlerts();
    } catch (err: any) {
      alert(`Expiry check failed: ${err.message}`);
    } finally {
      setRunningCheck(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeAlert(id);
      loadAlerts();
    } catch (err: any) {
      alert(`Could not acknowledge alert: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Live Demo Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider">
              Innovation B
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500">Automated Expiry Surveillance</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">Expiry-Date Notification Center</h1>
          <p className="text-xs text-slate-500">
            Real-time multi-tier shelf life surveillance alerting facilities before units spoil without clinical utilization.
          </p>
        </div>

        <button
          onClick={handleRunCheck}
          disabled={runningCheck}
          className="flex items-center space-x-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runningCheck ? 'animate-spin' : ''}`} />
          <span>{runningCheck ? 'Evaluating Shelf Life...' : 'Run Expiry Check Now'}</span>
        </button>
      </div>

      {/* Instant Result Banner */}
      {checkResult && (
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>
              <strong>Expiry Check Complete:</strong> {checkResult.new_alerts_created} new alert(s) generated. {checkResult.items_auto_expired} expired unit(s) quarantined.
            </span>
          </div>
          <button onClick={() => setCheckResult(null)} className="text-teal-700 font-bold">Dismiss</button>
        </div>
      )}

      {/* Threshold Information Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start space-x-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">Expired (&le; 0 Hours)</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Units automatically flagged as expired and excluded from optimization matching.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start space-x-3">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg">
            <Clock className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">Urgent Expiry (&le; 24 Hours)</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              High priority for immediate emergency reallocation to nearby deficit hospitals.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start space-x-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">Approaching Expiry (&le; 72 Hours)</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Warning sent to hospital bank operator for proactive redistribution planning.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterStatus('active')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterStatus === 'active'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active Unacknowledged Alerts
        </button>
        <button
          onClick={() => setFilterStatus('acknowledged')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterStatus === 'acknowledged'
              ? 'bg-slate-200 text-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Acknowledged History
        </button>
        <button
          onClick={() => setFilterStatus('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterStatus === ''
              ? 'bg-slate-200 text-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Alert Records
        </button>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-xl border">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">No Active Expiry Alerts</h4>
            <p className="text-xs text-slate-400">All current units are safely outside the critical expiry thresholds.</p>
          </div>
        ) : (
          alerts.map((al) => {
            const isCritical = al.severity === 'critical';
            const isUrgent = al.severity === 'urgent';

            return (
              <div
                key={al.id}
                className={`p-4 bg-white rounded-xl border shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isCritical
                    ? 'border-red-300 bg-red-50/20'
                    : isUrgent
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    isCritical ? 'bg-red-100 text-red-700' : isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        isCritical
                          ? 'bg-red-600 text-white'
                          : isUrgent
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {al.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{al.facility_name}</span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] text-slate-500 font-mono">{al.tracking_id || 'Batch'}</span>
                    </div>

                    <p className="text-xs text-slate-800 font-medium">{al.message}</p>

                    <div className="flex items-center space-x-4 text-[11px] text-slate-400">
                      <span>Logged: {new Date(al.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>SMTP Dispatch: {al.email_delivery_status}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {al.blood_group && (
                    <button
                      onClick={() => onNavigateToInventory(al.blood_group)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      Locate in Inventory
                    </button>
                  )}
                  {al.status === 'active' ? (
                    <button
                      onClick={() => handleAcknowledge(al.id)}
                      className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      Acknowledge Alert
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400 px-3 py-1 bg-slate-100 rounded-md">
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
