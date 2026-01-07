
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import { lazy } from './lazy';
import Loader2 from './components/Loader2'; // Ensure this component exists or use a generic div

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductionList = lazy(() => import('./pages/ProductionList'));
const EntryForm = lazy(() => import('./pages/EntryForm'));
const FastEntryPage = lazy(() => import('./pages/FastEntryPage'));
const ProductionPlanPage = lazy(() => import('./pages/ProductionPlanPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const PurchasePage = lazy(() => import('./pages/PurchasePage'));
const LogisticsPage = lazy(() => import('./pages/LogisticsPage'));
const LegacyImportPage = lazy(() => import('./pages/LegacyImportPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const SalesSummaryPage = lazy(() => import('./pages/SalesSummaryPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const InventoryAuditPage = lazy(() => import('./pages/InventoryAuditPage'));
const InventoryKardexPage = lazy(() => import('./pages/InventoryKardexPage'));
const ProductTargetsPage = lazy(() => import('./pages/ProductTargetsPage'));
const BOMPage = lazy(() => import('./pages/BOMPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const EngineeringRegistrations = lazy(() => import('./pages/EngineeringRegistrations'));

// Named export handling for OrganizationSettings
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings').then(module => ({ default: module.OrganizationSettings })));

import GlobalErrorBoundary from './components/GlobalErrorBoundary';
// TODO: Add other routes back incrementally if needed, or all at once if confident

function App() {
  // console.log("App: Rendering Full Version");
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <React.Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={48} /></div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/list" element={<ProductionList />} />
                <Route path="/entry" element={<EntryForm />} />
                <Route path="/fast-entry" element={<FastEntryPage />} />
                <Route path="/production-plan" element={<ProductionPlanPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/inventory/audit" element={<InventoryAuditPage />} />
                <Route path="/inventory/kardex" element={<InventoryKardexPage />} />
                <Route path="/purchase" element={<PurchasePage />} />
                <Route path="/logistics" element={<LogisticsPage />} />
                <Route path="/logistics/import" element={<LegacyImportPage />} />
                <Route path="/financial" element={<FinancialPage />} />
                <Route path="/financial/sales" element={<SalesSummaryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/engineering/bom" element={<BOMPage />} />
                <Route path="/engineering/targets" element={<ProductTargetsPage />} />
                <Route path="/engineering/targets" element={<ProductTargetsPage />} />
                <Route path="/settings/users" element={<SuperAdminPage />} />
                <Route path="/super-admin" element={<SuperAdminPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/engineering/products" element={<EngineeringRegistrations />} />
                <Route path="/organization" element={<OrganizationSettings />} />
              </Routes>
            </React.Suspense>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
