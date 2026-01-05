
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProductionList from './pages/ProductionList';
import EntryForm from './pages/EntryForm';
import FastEntryPage from './pages/FastEntryPage';
import ProductionPlanPage from './pages/ProductionPlanPage';
import InventoryPage from './pages/InventoryPage';
import PurchasePage from './pages/PurchasePage';
import LogisticsPage from './pages/LogisticsPage';
import LegacyImportPage from './pages/LegacyImportPage';
import SettingsPage from './pages/SettingsPage';
import FinancialPage from './pages/FinancialPage';
import SalesSummaryPage from './pages/SalesSummaryPage';
import LoginPage from './pages/LoginPage';
import SuperAdminPage from './pages/SuperAdminPage';
import InventoryAuditPage from './pages/InventoryAuditPage';
import InventoryKardexPage from './pages/InventoryKardexPage';
import ProductTargetsPage from './pages/ProductTargetsPage';
import BOMPage from './pages/BOMPage';
import AlertsPage from './pages/AlertsPage';
import EngineeringRegistrations from './pages/EngineeringRegistrations';
import { OrganizationSettings } from './pages/OrganizationSettings';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
// TODO: Add other routes back incrementally if needed, or all at once if confident

function App() {
  // console.log("App: Rendering Full Version");
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
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
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
