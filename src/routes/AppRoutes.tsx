import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './ProtectedRoute';
import { AuthPage } from '../pages/AuthPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DialerPage } from '../pages/DialerPage';
import { CallLogsPage } from '../pages/CallLogsPage';
import { EventLogsPage } from '../pages/EventLogsPage';
import { VoiceWorkspacePage } from '../pages/VoiceWorkspacePage';
import { SettingsPage } from '../pages/SettingsPage';
import { AdvancedConfigPage } from '../pages/AdvancedConfigPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ContactPage } from '../pages/ContactPage';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthActionPage } from '../pages/AuthActionPage';
import { LandingRedirect } from './LandingRedirect';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/action" element={<AuthActionPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dialer" element={<DialerPage />} />
          <Route path="/call-logs" element={<CallLogsPage />} />
          <Route path="/event-logs" element={<EventLogsPage />} />
          <Route path="/voice-workspace" element={<VoiceWorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/advanced-config" element={<AdvancedConfigPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
