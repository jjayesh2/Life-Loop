import React, { useState } from 'react';
import {
  X,
  AlertOctagon,
  Building2,
  Clock,
  Phone,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ShieldCheck
} from 'lucide-react';
import { Facility } from '../types';
import { createEmergencyRequest } from '../services/api';
import { soundService } from '../services/soundService';

interface EmergencyRequestModalProps {
  facilities: Facility[];
  currentFacilityId: number | null;
  onClose: () => void;
  onRequestCreated: () => void;
}

const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const COMPONENT_TYPES = ['Red Blood Cells', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate', 'Whole Blood'];

export const EmergencyRequestModal: React.FC<EmergencyRequestModalProps> = ({
  facilities,
  currentFacilityId,
  onClose,
  onRequestCreated
}) => {
  const [selectedFacility, setSelectedFacility] = useState<number>(
    currentFacilityId || (facilities.find(f => f.facility_type.includes('Hospital'))?.id || facilities[0]?.id || 1)
  );
  const [bloodGroup, setBloodGroup] = useState<string>('O-');
  const [componentType, setComponentType] = useState<string>('Red Blood Cells');
  const [quantity, setQuantity] = useState<number>(6);
  const [urgency, setUrgency] = useState<string>('critical');
  const [requiredByHours, setRequiredByHours] = useState<number>(3.0);
  const [phone, setPhone] = useState<string>('+91 253 257 2038');
  const [notes, setNotes] = useState<string>('Trauma ICU admission following Nashik Highway collision. STAT request.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resultCandidates, setResultCandidates] = useState<any[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    soundService.playEmergencySiren();

    try {
      const res = await createEmergencyRequest({
        requesting_facility_id: selectedFacility,
        blood_group: bloodGroup,
        component_type: componentType,
        quantity_needed: quantity,
        urgency,
        required_by_hours: requiredByHours,
        contact_phone: phone,
        notes
      });

      soundService.speak(`Emergency requisition broadcasted across Nashik network for ${quantity} units of ${bloodGroup} ${componentType}.`);
      setResultCandidates(res.candidates || []);
      onRequestCreated();
    } catch (err: any) {
      alert(`Error submitting request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-2xl w-full overflow-hidden animate-in fade-in duration-200 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Flame className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold">STAT Emergency Blood Requisition</h2>
              <p className="text-xs text-red-100">Coordinated Multi-Source Dispatch across Nashik District</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!resultCandidates ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-xs text-red-800">
              <AlertOctagon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Hospital Authorization Safeguard</span>
                Requisitions are broadcast to authorized regional blood banks (Arpan, Jankalyan, Civil Hospital).
                Blood release occurs strictly upon supplying facility's manual confirmation.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Requesting Facility */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requesting Hospital / Center</label>
                <select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
                >
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Urgency Level</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
                >
                  <option value="critical">🚨 Critical / Mass Casualty (Immediate Dispatch)</option>
                  <option value="urgent">⚠️ Urgent / Surgical STAT (&lt; 4 Hours)</option>
                  <option value="routine">Routine Operational Reserve (&lt; 12 Hours)</option>
                </select>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Requested Blood Group</label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setBloodGroup(bg)}
                      className={`py-2 text-xs font-black rounded-lg border transition ${
                        bloodGroup === bg
                          ? 'bg-red-600 text-white border-red-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Component */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Component Type</label>
                <select
                  value={componentType}
                  onChange={(e) => setComponentType(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-medium"
                >
                  {COMPONENT_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Units Required (Bags)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-bold text-slate-800"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Required Within (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={requiredByHours}
                  onChange={(e) => setRequiredByHours(Number(e.target.value))}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 font-bold text-slate-800"
                />
              </div>
            </div>

            {/* Contact Phone & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Authorized Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Scenario / Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Transmitting STAT Broadcast...' : 'Submit STAT Requisition'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">STAT Requisition Transmitted Successfully!</h3>
                <p className="text-xs text-emerald-700">
                  {quantity} units of {bloodGroup} {componentType} requested. Searching eligible Nashik repositories.
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Eligible Candidate Facilities Discovered ({resultCandidates.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {resultCandidates.length > 0 ? (
                  resultCandidates.map((cand, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <Building2 className="w-4 h-4 text-teal-600" />
                        <div>
                          <span className="font-bold text-slate-800">{cand.facility_name}</span>
                          <span className="text-slate-400 block text-[11px]">Batch: {cand.batch_ref}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-700 block">{cand.available_units} units available</span>
                        <span className="text-slate-500 text-[11px]">{cand.travel_time_minutes} min road transit</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-amber-700 p-3 bg-amber-50 rounded-lg">
                    No immediate surplus stock in connected centers. Administrator notified for regional mobilization.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition"
              >
                Close & Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
