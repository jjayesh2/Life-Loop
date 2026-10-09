import React, { useState, useEffect } from 'react';
import { Banner } from './components/Banner';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { CopilotModal } from './components/CopilotModal';
import { EmergencyRequestModal } from './components/EmergencyRequestModal';

// Pages
import { CommandCenter } from './pages/CommandCenter';
import { HospitalPortal } from './pages/HospitalPortal';
import { BloodBankPortal } from './pages/BloodBankPortal';
import { DriverPortal } from './pages/DriverPortal';
import { InventoryPage } from './pages/InventoryPage';
import { TraceabilityPage } from './pages/TraceabilityPage';
import { ExpiryAlertsPage } from './pages/ExpiryAlertsPage';
import { ForecastsPage } from './pages/ForecastsPage';
import { NetworkMapPage } from './pages/NetworkMapPage';
import { OptimizerPage } from './pages/OptimizerPage';
import { EmergencySimulatorPage } from './pages/EmergencySimulatorPage';
import { TransfersPage } from './pages/TransfersPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { SettingsPage } from './pages/SettingsPage';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Types and API
import { DashboardSummary, Facility, Transfer, Alert } from './types';
import { fetchDashboard, fetchFacilities, fetchTransfers, fetchAlerts } from './services/api';

function AppContent() {
  const { currentUser } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('admin_command');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [showCopilot, setShowCopilot] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);

  // Core Data
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [selectedFacilityObj, setSelectedFacilityObj] = useState<Facility | null>(null);

  // Jump to specific item in Traceability
  const [traceTrackingId, setTraceTrackingId] = useState<string | undefined>(undefined);

  const reloadData = async () => {
    try {
      const [dash, facs, txs, alts] = await Promise.all([
        fetchDashboard(),
        fetchFacilities(),
        fetchTransfers(),
        fetchAlerts()
      ]);
      setDashboardData(dash);
      setFacilities(facs);
      setTransfers(txs);
      setAlerts(alts);
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  };

  useEffect(() => {
    reloadData();
    const interval = setInterval(reloadData, 12000); // 12s polling for background updates
    return () => clearInterval(interval);
  }, []);

  // When role changes via Demo Role Switcher, jump to corresponding default view
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'driver') {
      setCurrentTab('driver_overview');
    } else if (currentUser.role === 'hospital_staff') {
      setCurrentTab('hospital_overview');
    } else if (currentUser.role === 'blood_bank_officer') {
      setCurrentTab('bb_overview');
    } else {
      setCurrentTab('admin_command');
    }
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (selectedFacilityId) {
      const f = facilities.find(fac => fac.id === selectedFacilityId) || null;
      setSelectedFacilityObj(f);
    } else {
      setSelectedFacilityObj(facilities[0] || null);
    }
  }, [selectedFacilityId, facilities]);

  const handleGlobalSearch = (query: string) => {
    if (query.toUpperCase().startsWith('LL-') || query.toUpperCase().startsWith('B-')) {
      setTraceTrackingId(query);
      setCurrentTab('admin_inventory');
    } else {
      setCurrentTab('admin_inventory');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 1. Persistent Compliance Banner */}
      <Banner />

      {/* 2. Main Shell Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            if (tab === 'hospital_create_req') {
              setShowEmergencyModal(true);
            } else {
              setCurrentTab(tab);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          alertCount={dashboardData?.active_alerts_count || 0}
        />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Navbar */}
          <Navbar
            facilities={facilities}
            selectedFacility={selectedFacilityId}
            setSelectedFacility={setSelectedFacilityId}
            onOpenCopilot={() => setShowCopilot(true)}
            onNavigateToAlerts={() => {
              if (currentUser?.role === 'hospital_staff') setCurrentTab('hospital_alerts');
              else if (currentUser?.role === 'blood_bank_officer') setCurrentTab('bb_expiry');
              else setCurrentTab('admin_expiry');
            }}
            onOpenEmergencyModal={() => setShowEmergencyModal(true)}
            alerts={alerts}
            onSearch={handleGlobalSearch}
          />

          {/* Page Body */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {/* ----------------- ADMIN ROUTES ----------------- */}
            {(currentTab === 'admin_command' || currentTab === 'dashboard') && (
              <CommandCenter
                data={dashboardData}
                facilities={facilities}
                transfers={transfers}
                onNavigate={(tab) => setCurrentTab(tab)}
                onSelectFacility={(fac) => {
                  setSelectedFacilityId(fac.id);
                  setSelectedFacilityObj(fac);
                  setCurrentTab('admin_map');
                }}
                selectedFacility={selectedFacilityObj}
              />
            )}

            {currentTab === 'admin_facilities' && (
              <NetworkMapPage facilities={facilities} transfers={transfers} />
            )}

            {(currentTab === 'admin_requests' || currentTab === 'hospital') && (
              <HospitalPortal
                facilities={facilities}
                onOpenEmergencyModal={() => setShowEmergencyModal(true)}
              />
            )}

            {(currentTab === 'admin_inventory' || currentTab === 'inventory') && (
              <InventoryPage
                facilities={facilities}
                onOpenTraceability={(tid) => {
                  setTraceTrackingId(tid);
                  setCurrentTab(currentUser?.role === 'blood_bank_officer' ? 'bb_traceability' : 'admin_inventory');
                }}
              />
            )}

            {(currentTab === 'admin_transfers' || currentTab === 'transfers') && (
              <TransfersPage />
            )}

            {(currentTab === 'admin_optimizer' || currentTab === 'optimizer') && (
              <OptimizerPage
                onNavigateToTransfers={() => {
                  reloadData();
                  setCurrentTab('admin_transfers');
                }}
              />
            )}

            {(currentTab === 'admin_map' || currentTab === 'map') && (
              <NetworkMapPage facilities={facilities} transfers={transfers} />
            )}

            {(currentTab === 'admin_expiry' || currentTab === 'alerts') && (
              <ExpiryAlertsPage
                facilities={facilities}
                onNavigateToInventory={() => setCurrentTab('admin_inventory')}
              />
            )}

            {(currentTab === 'admin_analytics' || currentTab === 'analytics') && (
              <AnalyticsPage />
            )}

            {(currentTab === 'admin_audit' || currentTab === 'audit') && (
              <AuditTrailPage />
            )}

            {(currentTab === 'admin_settings' || currentTab === 'settings') && (
              <SettingsPage
                facilities={facilities}
                onReloadAll={reloadData}
              />
            )}

            {currentTab === 'simulator' && (
              <EmergencySimulatorPage
                facilities={facilities}
                onNavigateToOptimizer={() => setCurrentTab('admin_optimizer')}
              />
            )}

            {currentTab === 'forecasts' && (
              <ForecastsPage facilities={facilities} />
            )}

            {currentTab === 'traceability' && (
              <TraceabilityPage initialTrackingId={traceTrackingId} />
            )}

            {/* ----------------- HOSPITAL ROLE ROUTES ----------------- */}
            {(currentTab === 'hospital_overview' || currentTab === 'hospital_requests' || currentTab === 'hospital_create_req' || currentTab === 'hospital_history') && (
              <HospitalPortal
                facilities={facilities}
                onOpenEmergencyModal={() => setShowEmergencyModal(true)}
              />
            )}

            {currentTab === 'hospital_incoming' && (
              <TransfersPage initialFilterTab="in_transit" />
            )}

            {currentTab === 'hospital_inventory' && (
              <InventoryPage
                facilities={facilities}
                onOpenTraceability={(tid) => {
                  setTraceTrackingId(tid);
                  setCurrentTab('hospital_inventory');
                }}
              />
            )}

            {currentTab === 'hospital_alerts' && (
              <ExpiryAlertsPage
                facilities={facilities}
                onNavigateToInventory={() => setCurrentTab('hospital_inventory')}
              />
            )}

            {currentTab === 'hospital_profile' && (
              <NetworkMapPage facilities={facilities} transfers={transfers} />
            )}

            {/* ----------------- BLOOD BANK ROLE ROUTES ----------------- */}
            {(currentTab === 'bb_overview' || currentTab === 'bb_requests' || currentTab === 'bb_approvals') && (
              <BloodBankPortal
                facilities={facilities}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                onOpenTraceability={(tid) => {
                  setTraceTrackingId(tid);
                  setCurrentTab('bb_traceability');
                }}
              />
            )}

            {currentTab === 'bb_inventory' && (
              <InventoryPage
                facilities={facilities}
                onOpenTraceability={(tid) => {
                  setTraceTrackingId(tid);
                  setCurrentTab('bb_traceability');
                }}
              />
            )}

            {(currentTab === 'bb_outgoing' || currentTab === 'bb_history') && (
              <TransfersPage initialFilterTab="approved" />
            )}

            {currentTab === 'bb_expiry' && (
              <ExpiryAlertsPage
                facilities={facilities}
                onNavigateToInventory={() => setCurrentTab('bb_inventory')}
              />
            )}

            {currentTab === 'bb_traceability' && (
              <TraceabilityPage initialTrackingId={traceTrackingId} />
            )}

            {currentTab === 'bb_profile' && (
              <NetworkMapPage facilities={facilities} transfers={transfers} />
            )}

            {/* ----------------- DRIVER ROLE ROUTES ----------------- */}
            {(currentTab.startsWith('driver_') || currentTab === 'driver' || currentTab === 'driver_portal') && (
              currentTab === 'driver_route' ? (
                <NetworkMapPage facilities={facilities} transfers={transfers} />
              ) : (
                <DriverPortal />
              )
            )}
          </main>
        </div>
      </div>

      {/* AI Operations Copilot Modal */}
      <CopilotModal
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
      />

      {/* STAT Emergency Request Modal */}
      {showEmergencyModal && (
        <EmergencyRequestModal
          facilities={facilities}
          currentFacilityId={currentUser?.facility_id || selectedFacilityId}
          onClose={() => setShowEmergencyModal(false)}
          onRequestCreated={() => {
            reloadData();
            if (currentUser?.role === 'hospital_staff') {
              setCurrentTab('hospital_requests');
            } else {
              setCurrentTab('admin_requests');
            }
          }}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
