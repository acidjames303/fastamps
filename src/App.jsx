import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import SubmitInstall from '@/pages/SubmitInstall';
import ChargerClaimEntry from '@/pages/ChargerClaimEntry';
import Installs from '@/pages/Installs';
import AdminInstalls from '@/pages/AdminInstalls';
import AdminInstallers from '@/pages/AdminInstallers';
import AdminChargers from '@/pages/AdminChargers';
import AdminReports from '@/pages/AdminReports';
import AdminVouchers from '@/pages/AdminVouchers';
import AdminBetaTest from '@/pages/AdminBetaTest';
import Opportunities from '@/pages/Opportunities';
import Earnings from '@/pages/Earnings';
import Academy from '@/pages/Academy';
import Leaderboard from '@/pages/Leaderboard';
import Profile from '@/pages/Profile';
import ProgrammeTerms from '@/pages/ProgrammeTerms';
import AdminFraudReview from '@/pages/AdminFraudReview';
import AdminQaChecklist from '@/pages/AdminQaChecklist';
import Coach from '@/pages/Coach';
import { rememberPendingClaimPath } from '@/lib/authReturnTo';

const LoginRedirect = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.delete('demo');
  const qs = params.toString();
  const returnTo = `${location.pathname}${qs ? `?${qs}` : ''}`;
  if (location.pathname.startsWith('/claim/')) {
    rememberPendingClaimPath(returnTo);
  }
  return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#061b2e] px-6 text-white" role="status" aria-label="Loading FastAmps Connect">
        <img
          src="https://media.base44.com/images/public/6adf6de7ebdb4cb382e8779f/a739e9792_DARK_MODE_FASTAMPS_LOGO.png"
          alt="FastAmps — Simply Reliable"
          className="w-48 max-w-full h-auto object-contain"
        />
        <p className="mt-5 text-[11px] font-bold tracking-[0.23em] text-[#1680ff]">FASTAMPS CONNECT</p>
        <div className="mt-7 h-7 w-7 rounded-full border-2 border-[#294760] border-t-[#086bff] animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  // Keep our branded public login, registration and password-recovery routes
  // accessible when an anonymous request receives auth_required from Base44.
  // ProtectedRoute handles sending signed-out visitors to /login.
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/claim/:claimToken" element={<ChargerClaimEntry />}>
        <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
          <Route element={<Layout />}>
            <Route index element={<SubmitInstall />} />
          </Route>
        </Route>
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/register-install" element={<SubmitInstall />} />
          <Route path="/installs" element={<Installs />} />
          <Route path="/admin/installs" element={<AdminInstalls />} />
          <Route path="/admin/installers" element={<AdminInstallers />} />
          <Route path="/admin/chargers" element={<AdminChargers />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/vouchers" element={<AdminVouchers />} />
          <Route path="/admin/fraud-review" element={<AdminFraudReview />} />
          <Route path="/admin/beta-test" element={<AdminBetaTest />} />
          <Route path="/admin/qa" element={<AdminQaChecklist />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/academy" element={<Academy />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/programme-terms" element={<ProgrammeTerms />} />
          <Route path="/coach" element={<Coach />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App