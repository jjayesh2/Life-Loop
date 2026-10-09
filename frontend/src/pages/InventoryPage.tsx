import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  QrCode,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import { InventoryItem, Facility } from '../types';
import { fetchInventory, createInventoryItem, recordMovementEvent } from '../services/api';
import { BagLabelModal } from '../components/BagLabelModal';

interface InventoryPageProps {
  facilities: Facility[];
  onOpenTraceability: (trackingId: string) => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ facilities, onOpenTraceability }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [facilityFilter, setFacilityFilter] = useState<number | ''>('');
  
  // Modals & Drawers
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPrintLabel, setShowPrintLabel] = useState(false);
  const [printItem, setPrintItem] = useState<InventoryItem | null>(null);

  // Form State for Adding Item
  const [formData, setFormData] = useState({
    facility_id: 1,
    blood_group: 'O-',
    component_type: 'Red Blood Cells',
    quantity: 1,
    batch_ref: '',
    storage_temp_c: 4.0,
    expiry_days: 35
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInventory({
        facility_id: facilityFilter || undefined,
        blood_group: groupFilter || undefined,
        component_type: componentFilter || undefined,
        status: statusFilter || undefined
      });
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupFilter, componentFilter, statusFilter, facilityFilter]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const exp = new Date(now.getTime() + formData.expiry_days * 24 * 60 * 60 * 1000);
      const batch = formData.batch_ref || `B-${formData.blood_group.replace('+', 'P').replace('-', 'N')}-${Math.floor(100 + Math.random() * 900)}`;

      await createInventoryItem({
        facility_id: Number(formData.facility_id),
        blood_group: formData.blood_group,
        component_type: formData.component_type,
        quantity: Number(formData.quantity),
        batch_ref: batch,
        collection_date: now.toISOString(),
        expiry_date: exp.toISOString(),
        storage_temp_c: Number(formData.storage_temp_c),
        status: 'available'
      });

      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      alert(`Error creating item: ${err.message}`);
    }
  };

  const handleExportCSV = () => {
    window.open('/api/inventory/export', '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/inventory/import', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      alert(`Imported ${data.imported} items. Errors: ${data.errors.length}`);
      setShowImportModal(false);
      loadData();
    } catch (err: any) {
      alert(`CSV Import failed: ${err.message}`);
    }
  };

  // Filter items by search query
  const filteredItems = items.filter(it => {
    const q = search.toLowerCase();
    return (
      it.tracking_id.toLowerCase().includes(q) ||
      it.batch_ref.toLowerCase().includes(q) ||
      it.blood_group.toLowerCase().includes(q) ||
      it.component_type.toLowerCase().includes(q) ||
      (it.facility_name && it.facility_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Blood Inventory Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual tracked units, batch references, cold-chain parameters, and status tracking.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-1 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Register Blood Unit</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, batch, blood group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        {/* Blood Group */}
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
        >
          <option value="">All Blood Groups</option>
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Component */}
        <select
          value={componentFilter}
          onChange={(e) => setComponentFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
        >
          <option value="">All Components</option>
          <option value="Red Blood Cells">Red Blood Cells</option>
          <option value="Platelets">Platelets</option>
          <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
          <option value="Cryoprecipitate">Cryoprecipitate</option>
          <option value="Whole Blood">Whole Blood</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="in_transit">In Transit</option>
          <option value="quarantined">Quarantined</option>
          <option value="expired">Expired</option>
        </select>

        {/* Facility */}
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
        >
          <option value="">All Facilities</option>
          {facilities.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Tracking ID</th>
                <th className="p-3.5">Facility Location</th>
                <th className="p-3.5">Group & Component</th>
                <th className="p-3.5 text-center">Qty</th>
                <th className="p-3.5">Batch Ref</th>
                <th className="p-3.5">Expiration</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Loading inventory records...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">No matching inventory units found.</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const now = new Date();
                  const exp = new Date(item.expiry_date);
                  const hrsLeft = Math.round((exp.getTime() - now.getTime()) / (1000 * 3600));
                  const isExpiringSoon = hrsLeft <= 72 && hrsLeft > 0;
                  const isExpired = hrsLeft <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      {/* Tracking ID with Mini QR Trigger */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setPrintItem(item);
                              setShowPrintLabel(true);
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-700 transition"
                            title="View/Print QR label"
                          >
                            <QrCode className="w-4 h-4 text-slate-600" />
                          </button>
                          <span
                            onClick={() => setSelectedItem(item)}
                            className="font-mono font-bold text-slate-900 hover:text-teal-600 cursor-pointer"
                          >
                            {item.tracking_id}
                          </span>
                        </div>
                      </td>

                      {/* Facility */}
                      <td className="p-3.5 text-slate-700 font-medium">
                        {item.facility_name || `Facility #${item.facility_id}`}
                      </td>

                      {/* Blood Group & Component */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 font-black flex items-center justify-center text-xs flex-shrink-0">
                            {item.blood_group}
                          </span>
                          <span className="font-semibold text-slate-800">{item.component_type}</span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="p-3.5 text-center font-bold text-slate-900">{item.quantity}</td>

                      {/* Batch Ref */}
                      <td className="p-3.5 font-mono text-slate-500">{item.batch_ref}</td>

                      {/* Expiration with badge */}
                      <td className="p-3.5">
                        <div>
                          <span className="text-slate-700 font-medium">{new Date(item.expiry_date).toLocaleDateString()}</span>
                          {isExpired ? (
                            <span className="block text-[10px] text-red-600 font-bold">Expired</span>
                          ) : isExpiringSoon ? (
                            <span className="block text-[10px] text-amber-600 font-bold flex items-center space-x-0.5">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {hrsLeft}h left
                            </span>
                          ) : (
                            <span className="block text-[10px] text-slate-400">{Math.round(hrsLeft / 24)}d left</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'available'
                            ? 'bg-teal-100 text-teal-800'
                            : item.status === 'reserved'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'in_transit'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setPrintItem(item);
                            setShowPrintLabel(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                        >
                          Label
                        </button>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-teal-50 hover:bg-teal-100 text-teal-800 rounded transition"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Detail Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-950/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-teal-600 block">Traceability Unit Record</span>
                  <h3 className="font-mono font-bold text-lg text-slate-900">{selectedItem.tracking_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* QR and Group Hero */}
              <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {selectedItem.qr_code_svg ? (
                  <img src={selectedItem.qr_code_svg} alt="QR" className="w-20 h-20 bg-white p-1 rounded border border-slate-200" />
                ) : (
                  <div className="w-20 h-20 bg-slate-200 rounded flex items-center justify-center text-xs">QR</div>
                )}
                <div>
                  <span className="w-9 h-9 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center">
                    {selectedItem.blood_group}
                  </span>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">{selectedItem.component_type}</h4>
                  <span className="text-xs text-slate-500">Batch {selectedItem.batch_ref}</span>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Current Facility</span>
                  <span className="font-bold text-slate-800">{selectedItem.facility_name}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Units in Stock</span>
                  <span className="font-bold text-slate-800">{selectedItem.quantity} Units</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Collection Date</span>
                  <span className="font-medium text-slate-700">{new Date(selectedItem.collection_date).toLocaleDateString()}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Expiration</span>
                  <span className="font-bold text-red-600">{new Date(selectedItem.expiry_date).toLocaleString()}</span>
                </div>
              </div>

              {/* Traceability Events Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Chain of Custody Events</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedItem.traceability_events && selectedItem.traceability_events.length > 0 ? (
                    selectedItem.traceability_events.map(ev => (
                      <div key={ev.id} className="p-2.5 rounded bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                          <span className="font-bold uppercase text-teal-700">{ev.event_type}</span>
                          <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-800 font-medium">{ev.details}</p>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">{ev.facility_name} • {ev.operator}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400">No events logged yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex space-x-2">
              <button
                onClick={() => {
                  setPrintItem(selectedItem);
                  setShowPrintLabel(true);
                }}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-850 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print QR Sticker</span>
              </button>
              <button
                onClick={() => onOpenTraceability(selectedItem.tracking_id)}
                className="py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Full Audit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Unit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Register New Blood Unit Batch</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Facility</label>
                <select
                  value={formData.facility_id}
                  onChange={(e) => setFormData({ ...formData, facility_id: Number(e.target.value) })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Component</label>
                  <select
                    value={formData.component_type}
                    onChange={(e) => setFormData({ ...formData, component_type: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Red Blood Cells">Red Blood Cells</option>
                    <option value="Platelets">Platelets</option>
                    <option value="Fresh Frozen Plasma">Fresh Frozen Plasma</option>
                    <option value="Cryoprecipitate">Cryoprecipitate</option>
                    <option value="Whole Blood">Whole Blood</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Units (Quantity)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Shelf Life (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="42"
                    value={formData.expiry_days}
                    onChange={(e) => setFormData({ ...formData, expiry_days: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Batch Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={formData.batch_ref}
                  onChange={(e) => setFormData({ ...formData, batch_ref: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Save & Generate QR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Upload Inventory CSV</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              CSV file must contain columns: Blood Group, Component, Quantity, Batch Ref, Facility ID.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Bag Label Print Modal */}
      <BagLabelModal
        item={printItem}
        isOpen={showPrintLabel}
        onClose={() => {
          setShowPrintLabel(false);
          setPrintItem(null);
        }}
      />
    </div>
  );
};
