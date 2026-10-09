import React, { useState, useEffect } from 'react';
import { Banner } from './components/Banner';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { CopilotModal } from './components/CopilotModal';
import { EmergencyRequestModal } from './components/EmergencyRequestModal';

// Pages
import { CommandCenter } from './pages/CommandCenter';
import { HospitalPortal } from './pages/HospitalPortal';
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
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
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
    const interval = setInterval(reloadData, 15000); // 15s polling for background updates
    return () => clearInterval(interval);
  }, []);

  // When role changes via Demo Role Switcher, jump to corresponding view
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'driver') {
      setCurrentTab('driver_portal');
    } else if (currentUser.role === 'hospital_staff') {
      setCurrentTab('hospital_portal');
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
      setCurrentTab('traceability');
    } else {
      setCurrentTab('inventory');
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
            setCurrentTab(tab);
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
            onNavigateToAlerts={() => setCurrentTab('alerts')}
            onOpenEmergencyModal={() => setShowEmergencyModal(true)}
            alerts={alerts}
            onSearch={handleGlobalSearch}
          />

          {/* Page Body */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            {currentTab === 'dashboard' && (
              <CommandCenter
                data={dashboardData}
                facilities={facilities}
                transfers={transfers}
                onNavigate={(tab) => setCurrentTab(tab)}
                onSelectFacility={(fac) => {
                  setSelectedFacilityId(fac.id);
                  setSelectedFacilityObj(fac);
                  setCurrentTab('map');
                }}
                selectedFacility={selectedFacilityObj}
              />
            )}

            {currentTab === 'hospital_portal' && (
              <HospitalPortal facilities={facilities} />
            )}

            {currentTab === 'driver_portal' && (
              <DriverPortal />
            )}

            {currentTab === 'inventory' && (
              <InventoryPage
                facilities={facilities}
                onOpenTraceability={(tid) => {
                  setTraceTrackingId(tid);
                  setCurrentTab('traceability');
                }}
              />
            )}

            {currentTab === 'traceability' && (
              <TraceabilityPage initialTrackingId={traceTrackingId} />
            )}

            {currentTab === 'alerts' && (
              <ExpiryAlertsPage
                facilities={facilities}
                onNavigateToInventory={(bg) => setCurrentTab('inventory')}
              />
            )}

            {currentTab === 'forecasts' && (
              <ForecastsPage facilities={facilities} />
            )}

            {currentTab === 'map' && (
              <NetworkMapPage facilities={facilities} transfers={transfers} />
            )}

            {currentTab === 'optimizer' && (
              <OptimizerPage
                onNavigateToTransfers={() => {
                  reloadData();
                  setCurrentTab('transfers');
                }}
              />
            )}

            {currentTab === 'simulator' && (
              <EmergencySimulatorPage
                facilities={facilities}
                onNavigateToOptimizer={() => setCurrentTab('optimizer')}
              />
            )}

            {currentTab === 'transfers' && (
              <TransfersPage />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsPage />
            )}

            {currentTab === 'audit' && (
              <AuditTrailPage />
            )}

            {currentTab === 'settings' && (
              <SettingsPage
                facilities={facilities}
                onReloadAll={reloadData}
              />
            )}
          </main>
        </div>
      </div>

      {/* AI Operations Copilot Modal */}
      <CopilotModal
        isOpen={showCopilot}
        onClose={() => setShowCopilot(false)}
      />

      {/* Global Emergency Blood Request Modal */}
      <EmergencyRequestModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        facilities={facilities}
        onRequestCreated={reloadData}
      />
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
