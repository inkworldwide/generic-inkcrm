import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layout shell
import Layout from './components/Layout';

// Page components
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import RecordForm from './pages/RecordForm';
import Settings from './pages/Settings';
import AccessPrivilege from './pages/AccessPrivilege';
import LeadTransfer from './pages/LeadTransfer';
import UsersManagement from './pages/UsersManagement';
import WorkflowsList from './pages/WorkflowsList';
import ReportsList from './pages/ReportsList';
import ReportDetails from './pages/ReportDetails';
import LeadReportsPage from './pages/LeadReportsPage';
import TelecallerReportsPage from './pages/TelecallerReportsPage';
import TelecallerMonthlyPage from './pages/TelecallerMonthlyPage';
import Status from './pages/Status';
import MyCampaign from './pages/MyCampaign';

// Route Guard for authenticated workspaces
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Initializing Workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Tenant Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/status"
          element={
            <ProtectedRoute>
              <Status />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/:apiPath"
          element={
            <ProtectedRoute>
              <ModuleView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/:apiPath/new"
          element={
            <ProtectedRoute>
              <RecordForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/:apiPath/:id"
          element={
            <ProtectedRoute>
              <RecordForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflows"
          element={
            <ProtectedRoute>
              <WorkflowsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/lead-reports"
          element={
            <ProtectedRoute>
              <LeadReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/telecaller-reports"
          element={
            <ProtectedRoute>
              <TelecallerReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/telecaller-monthly"
          element={
            <ProtectedRoute>
              <TelecallerMonthlyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/:id"
          element={
            <ProtectedRoute>
              <ReportDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/access-privilege"
          element={
            <ProtectedRoute>
              <AccessPrivilege />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lead-transfer"
          element={
            <ProtectedRoute>
              <LeadTransfer />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users-management"
          element={
            <ProtectedRoute>
              <UsersManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-campaign"
          element={
            <ProtectedRoute>
              <MyCampaign />
            </ProtectedRoute>
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
