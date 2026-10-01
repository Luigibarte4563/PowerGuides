import { Route, Routes } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import CompanyLayout from '@/layouts/CompanyLayout';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';
import RequireRole from './RequireRole';

import Landing from '@/pages/Landing';
import Login from '@/pages/Auth/Login';
import Register from '@/pages/Auth/Register';
import GoogleCallback from '@/pages/Auth/GoogleCallback';
import NotFound from '@/pages/NotFound';

import Overview from '@/pages/Dashboard/Overview';
import Outages from '@/pages/Dashboard/Outages';
import OutageDetail from '@/pages/Dashboard/OutageDetail';
import Maintenance from '@/pages/Dashboard/Maintenance';
import PowerStations from '@/pages/Dashboard/PowerStations';
import Notifications from '@/pages/Dashboard/Notifications';
import Location from '@/pages/Dashboard/Location';
import Battery from '@/pages/Dashboard/Battery';
import SafetyTimers from '@/pages/Dashboard/SafetyTimers';
import Floods from '@/pages/Dashboard/Floods';
import Hazards from '@/pages/Dashboard/Hazards';
import RiskAreas from '@/pages/Dashboard/RiskAreas';
import Heatmap from '@/pages/Dashboard/Heatmap';
import Profile from '@/pages/Dashboard/Profile';

import MyAssignments from '@/pages/Dashboard/MyAssignments';
import CompanyOverview from '@/pages/Company/Overview';
import CompanyOutages from '@/pages/Company/Outages';
import CompanyOutageDetail from '@/pages/Company/OutageDetail';
import CompanyMaintenance from '@/pages/Company/Maintenance';
import CompanyAssignments from '@/pages/Company/Assignments';
import CompanyMapRisk from '@/pages/Company/MapRisk';
import CompanyPowerStations from '@/pages/Company/PowerStations';
import CompanyNotifications from '@/pages/Company/Notifications';
import CompanyHazards from '@/pages/Company/Hazards';
import CompanyProfile from '@/pages/Company/Profile';

/**
 * Route map (Section 7 of the requirements).
 * `/`, `/login`, `/register` are public; everything under `/dashboard` is protected.
 *
 * `/company` is the Electric Company Dashboard. It has its own layout and nav, and is
 * wrapped in `RequireRole` (staff only) on top of `ProtectedRoute`, so a resident
 * following a company deep link lands on the access-denied page rather than in a
 * dashboard they cannot use.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        {/*
          Redirect target of api/auth/google_callback.php on success:
          /auth/google-callback?token=<jwt>
        */}
        <Route path="/auth/google-callback" element={<GoogleCallback />} />
      </Route>

      <Route element={<PublicOnlyRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="assignments" element={<MyAssignments />} />
          <Route path="outages" element={<Outages />} />
          <Route path="outages/:id" element={<OutageDetail />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="power-stations" element={<PowerStations />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="location" element={<Location />} />
          <Route path="battery" element={<Battery />} />
          <Route path="safety-timers" element={<SafetyTimers />} />
          <Route path="floods" element={<Floods />} />
          <Route path="hazards" element={<Hazards />} />
          <Route path="risk-areas" element={<RiskAreas />} />
          <Route path="heatmap" element={<Heatmap />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<RequireRole />}>
          <Route path="/company" element={<CompanyLayout />}>
            <Route index element={<CompanyOverview />} />
            <Route path="outages" element={<CompanyOutages />} />
            <Route path="outages/:id" element={<CompanyOutageDetail />} />
            <Route path="assignments" element={<CompanyAssignments />} />
            <Route path="maintenance" element={<CompanyMaintenance />} />
            <Route path="map" element={<CompanyMapRisk />} />
            <Route path="power-stations" element={<CompanyPowerStations />} />
            <Route path="notifications" element={<CompanyNotifications />} />
            <Route path="hazards" element={<CompanyHazards />} />
            <Route path="profile" element={<CompanyProfile />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
