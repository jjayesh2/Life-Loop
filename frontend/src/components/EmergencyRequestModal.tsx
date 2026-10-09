import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Flame,
  Clock,
  MapPin,
  CheckCircle2,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';
import { Facility, EmergencyBloodRequest, SourceRecommendationItem } from '../types';
import { submitEmergencyRequest, approveEmergencyRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface EmergencyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: Facility[];
  onRequestCreated: () => void;
}

export const EmergencyRequestModal: React.FC<EmergencyRequestModalProps> = ({
  isOpen,
  onClose,
  facilities,
  onRequestCreated
}) => {
  const { currentUser, playAlarm, playSuccess, speak } = useAuth();

  const [hospitalId, setHospitalId] = useState<number>(
    currentUser?.facility_id || (facilities.find(f => f.facility_type.toLowerCase().includes('hospital'))?.id || facilities[0]?.id || 1)
  );
  const [bloodGroup, setBloodGroup] = useState<string>('O-');
  const [componentType, setComponentType] = useState<string>('Packed Red Blood Cells');
  const [quantity, setQuantity] = useState<number>(2);
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'routine'>('critical');
  const [clinicalNotes, setClinicalNotes] = useState<string>('Emergency trauma patient in resuscitation bay. Active hemorrhage.');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createdRequest, setCreatedRequest] = useState<EmergencyBloodRequest | null>(null);
  const [approving, setApproving] = useState<boolean>(false);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const connectedHospitals = facilities.filter(f => f.facility_type.toLowerCase().includes('hospital') || f.is_connected);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setApprovalSuccess(null);

    try {
      playAlarm();
      speak(`Emergency blood request initiated for ${quantity} units of ${bloodGroup} ${componentType}`, 'urgent');

      const req = await submitEmergencyRequest({
        hospital_id: hospitalId,
        blood_group: bloodGroup,
        component_type: componentType,
        quantity_needed: quantity,
        urgency: urgency,
        clinical_notes: clinicalNotes
      });

      setCreatedRequest(req);
      onRequestCreated();
    } catch (err: any) {
      alert(`Error submitting request: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSource = async (rec: SourceRecommendationItem) => {
    if (!createdRequest) return;
    setApproving(true);
    try {
      playSuccess();
      speak(`Dispatch approved from ${rec.facility_name}. Courier driver dispatched with estimated arrival in ${rec.travel_time_minutes} minutes.`);

      const res = await approveEmergencyRequest(createdRequest.request_id, {
        source_facility_id: rec.facility_id,
        quantity: Math.min(quantity, rec.available_units),
        approver_name: currentUser?.name || 'Emergency Logistics Officer'
      });

      setApprovalSuccess(`Transfer ${res.transfer_id} created! Courier driver automatically assigned.`);
      onRequestCreated();
    } catch (err: any) {
      alert(`Error approving source: ${err.message}`);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Flame className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight flex items-center space-x-2">
                <span>Emergency Blood Request</span>
                <span className="px-2 py-0.5 rounded-full bg-red-800 text-[11px] font-semibold tracking-wider uppercase border border-red-400/30">
                  STAT Protocol
                </span>
              </h2>
              <p className="text-xs text-red-100">
                Nashik Inter-Hospital & Blood Bank Emergency Redistribution System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!createdRequest ? (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              {/* Requesting Hospital */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Requesting Hospital (Nashik)
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={hospitalId}
                    onChange={(e) => setHospitalId(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    {connectedHospitals.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.district || 'Nashik'}) {h.is_connected ? '• Live Connected' : '• Directory'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Blood Group & Component Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Blood Group Required
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="O-">O Negative (Universal Donor RBC)</option>
                    <option value="O+">O Positive</option>
                    <option value="A-">A Negative</option>
                    <option value="A+">A Positive</option>
                    <option value="B-">B Negative</option>
                    <option value="B+">B Positive</option>
                    <option value="AB-">AB Negative</option>
                    <option value="AB+">AB Positive (Universal Donor FFP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Component Type
                  </label>
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Packed Red Blood Cells">Packed Red Blood Cells (PRBC)</option>
                    <option value="Fresh Frozen Plasma">Fresh Frozen Plasma (FFP)</option>
                    <option value="Platelet Concentrate">Platelet Concentrate (RDP/SDP)</option>
                    <option value="Cryoprecipitate">Cryoprecipitate</option>
                    <option value="Whole Blood">Whole Blood</option>
                  </select>
                </div>
              </div>

              {/* Quantity & Urgency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Units Needed
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">Bags</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Urgency Level
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['routine', 'urgent', 'critical'] as const).map(lvl => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setUrgency(lvl)}
                        className={`py-2 text-xs font-bold uppercase rounded-lg border transition ${
                          urgency === lvl
                            ? lvl === 'critical'
                              ? 'bg-red-600 text-white border-red-600 shadow-sm'
                              : lvl === 'urgent'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clinical Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clinical Diagnosis & Incident Context
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Severe trauma, acute hemorrhage, obstetric emergency..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-500/25 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>{submitting ? 'Searching Nashik Network...' : 'Broadcast Emergency Blood Request'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Recommendations & Source Approval View */
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-red-900">Request #{createdRequest.request_id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px] font-bold uppercase">
                      {createdRequest.urgency}
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mt-0.5">
                    {createdRequest.quantity_needed} Units of <strong>{createdRequest.blood_group}</strong> ({createdRequest.component_type})
                  </p>
                </div>
                <button
                  onClick={() => setCreatedRequest(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                >
                  New Request
                </button>
              </div>

              {approvalSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-sm">Transfer Dispatched Successfully!</h4>
                  <p className="text-xs text-emerald-700">{approvalSuccess}</p>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    View in Transfer Management
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span>Recommended Nashik Blood Banks (Ranked by ETA & Stock)</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      {createdRequest.source_recommendations.length} sources found
                    </span>
                  </div>

                  {createdRequest.source_recommendations.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      No matching compatible units currently available in connected facilities. Consider broader regional broadcast or group O- universal fallback.
                    </div>
                  ) : (
                    createdRequest.source_recommendations.map((rec, idx) => (
                      <div
                        key={rec.facility_id}
                        className={`p-4 rounded-xl border transition ${
                          idx === 0
                            ? 'bg-teal-50/50 border-teal-300 ring-1 ring-teal-400/30'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              {idx === 0 && (
                                <span className="px-2 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded-full">
                                  Top Recommendation
                                </span>
                              )}
                              <h4 className="font-bold text-sm text-slate-900">{rec.facility_name}</h4>
                              <span className="text-[11px] text-slate-400">({rec.facility_type})</span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-slate-600">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <strong>{rec.travel_time_minutes} min ETA</strong>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Navigation className="w-3.5 h-3.5 text-slate-400" />
                                <span>{rec.distance_km} km</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                                <span className="text-teal-700 font-bold">{rec.available_units} units in stock</span>
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 italic mt-1 bg-white/60 p-1.5 rounded border border-slate-100">
                              "{rec.rationale}"
                            </p>
                          </div>

                          <button
                            onClick={() => handleApproveSource(rec)}
                            disabled={approving || !rec.is_connected}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 flex-shrink-0 ml-3 ${
                              rec.is_connected
                                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{rec.is_connected ? 'Approve & Dispatch' : 'Public Directory'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Strict immunohematology ABO/Rh rules enforced before stock reservation.</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
