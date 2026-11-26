import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleGuard from '@/components/RoleGuard';
// Add page imports here
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import OAuthConsent from '@/pages/OAuthConsent';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Today from '@/pages/Today';
import Dialer from '@/pages/Dialer';
import Contacts from '@/pages/Contacts';
import Campaigns from '@/pages/Campaigns';
import TargetListDetail from '@/pages/TargetListDetail';
import Team from '@/pages/Team';
import CallerAccount from '@/pages/CallerAccount';
import Settings from '@/pages/Settings';
import OrganisationAdmin from '@/pages/OrganisationAdmin';
import Results from '@/pages/Results';
import CampaignDelivery from '@/pages/CampaignDelivery';
import CampaignAccounts from '@/pages/CampaignAccounts';
import OpportunityDetail from '@/pages/OpportunityDetail';
import ReviewQueue from '@/pages/ReviewQueue';
import IntegrationSettings from '@/pages/IntegrationSettings';
import MeetingPrep from '@/pages/MeetingPrep';
import UsageBilling from '@/pages/UsageBilling';
import SaaSOps from '@/pages/SaaSOps';
import ComplianceDashboard from '@/pages/ComplianceDashboard';
import PilotReadiness from '@/pages/PilotReadiness';
import HealthDashboard from '@/pages/HealthDashboard';
import CapacityReport from '@/pages/CapacityReport';
import PilotConsole from '@/pages/PilotConsole';
import Onboarding from '@/pages/Onboarding';
import SupportCenter from '@/pages/SupportCenter';
import FeedbackReview from '@/pages/FeedbackReview';
import FeatureFlags from '@/pages/FeatureFlags';
import Incidents from '@/pages/Incidents';
import MyProfile from '@/pages/MyProfile';
import TenantIsolationReport from '@/pages/TenantIsolationReport';
// Pricing Review page removed — plans/subscriptions are not managed in-app.
import TrialExpired from '@/pages/TrialExpired';
// Marketing landing page is intentionally retained in src/pages/Landing.jsx
// as a dormant white-label template; the internal Cadence app does not route to it.
import IntegrationHub from '@/pages/IntegrationHub';
import CallerProfile from '@/pages/CallerProfile';
import PublicSupport from '@/pages/PublicSupport';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import DataProcessingTerms from '@/pages/DataProcessingTerms';
import EmailConnectCallback from '@/pages/EmailConnectCallback';
import ManagerInbox from '@/pages/ManagerInbox';
import Outreach from '@/pages/Outreach';
import LeadSheets from '@/pages/LeadSheets';

const CALLER = ['platform_owner', 'organisation_admin', 'sales_manager', 'bdm', 'reporting_user'];
const CAMPAIGN_VIEW = ['platform_owner', 'organisation_admin', 'sales_manager', 'bdm'];
const DIALER_ROLES = ['platform_owner', 'organisation_admin', 'sales_manager', 'bdm'];
const MANAGER = ['platform_owner', 'organisation_admin', 'sales_manager'];
const ADMIN = ['platform_owner', 'organisation_admin'];
const PLATFORM = ['platform_owner'];
const OUTREACH_USERS = ['platform_owner', 'organisation_admin', 'sales_manager', 'internal_bd', 'bdm'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, workspaceAccess } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // auth_required is handled in AuthContext as anonymous (no blocking error)
    // so /login can mount. Remaining authErrors are tenant/account issues.
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-3xl bg-white border border-red-200 p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-slate-900">Account access paused</h1>
          <p className="text-slate-600 mt-3">{authError.message || 'Your organisation assignment could not be verified.'}</p>
          <p className="text-sm text-slate-500 mt-3">No customer data has been loaded. Ask the Cadence platform owner to correct your organisation, then sign in again.</p>
          <button onClick={() => navigateToLogin()} className="mt-6 rounded-full bg-slate-900 text-white px-5 py-2.5 text-sm font-medium">Return to sign in</button>
        </div>
      </div>
    );
  }

  if (workspaceAccess?.read_only) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/support-info" element={<PublicSupport />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/data-processing" element={<DataProcessingTerms />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/expired" element={<TrialExpired />} />
            <Route path="/support" element={<SupportCenter />} />
            <Route path="/usage-billing" element={<RoleGuard roles={ADMIN}><UsageBilling /></RoleGuard>} />
            <Route path="*" element={<Navigate to="/expired" replace />} />
          </Route>
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/support-info" element={<PublicSupport />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/data-processing" element={<DataProcessingTerms />} />
      <Route path="/oauth/consent" element={<OAuthConsent />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          {/* Caller routes */}
          <Route path="/app" element={<Today />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/results" element={<Results />} />
          <Route path="/dialer" element={<RoleGuard roles={DIALER_ROLES}><Dialer /></RoleGuard>} />
          <Route path="/my-profile" element={<MyProfile />} />
          <Route path="/profile" element={<CallerProfile />} />
          <Route path="/email-connect/callback" element={<EmailConnectCallback />} />
          <Route path="/performance-insights" element={<Navigate to="/results" replace />} />
          <Route path="/support" element={<SupportCenter />} />
          {/* Manager routes */}
          <Route path="/overview" element={<RoleGuard roles={MANAGER}><Dashboard /></RoleGuard>} />
          <Route path="/campaigns" element={<RoleGuard roles={CAMPAIGN_VIEW}><Campaigns /></RoleGuard>} />
          <Route path="/target-lists/:id" element={<RoleGuard roles={MANAGER}><TargetListDetail /></RoleGuard>} />
          <Route path="/team" element={<RoleGuard roles={MANAGER}><Team /></RoleGuard>} />
          <Route path="/team/:userId" element={<RoleGuard roles={MANAGER}><CallerAccount /></RoleGuard>} />
          <Route path="/manager-inbox" element={<RoleGuard roles={ADMIN}><ManagerInbox /></RoleGuard>} />
          {/* Branch-only: personal Outreach for authorised sales users; production stays unchanged until QA release. */}
          <Route path="/outreach" element={<RoleGuard roles={OUTREACH_USERS}><Outreach /></RoleGuard>} />
          <Route path="/lead-sheets" element={<RoleGuard roles={[...CALLER, 'internal_bd']}><LeadSheets /></RoleGuard>} />
          {/* Legacy campaign routes → consolidated Campaigns hub */}
          <Route path="/campaign-setup" element={<Navigate to="/campaigns?new=1" replace />} />
          <Route path="/campaign-management" element={<Navigate to="/campaigns" replace />} />
          <Route path="/prospecting" element={<Navigate to="/campaigns?tab=prospect" replace />} />
          <Route path="/import" element={<Navigate to="/campaigns?tab=import" replace />} />
          <Route path="/campaign-delivery/:id" element={<RoleGuard roles={MANAGER}><CampaignDelivery /></RoleGuard>} />
          <Route path="/campaigns/:id/accounts" element={<RoleGuard roles={CAMPAIGN_VIEW}><CampaignAccounts /></RoleGuard>} />
          <Route path="/review-queue" element={<RoleGuard roles={MANAGER}><ReviewQueue /></RoleGuard>} />
          <Route path="/opportunities/:id" element={<RoleGuard roles={MANAGER}><OpportunityDetail /></RoleGuard>} />
          <Route path="/meetings/:id/prep" element={<RoleGuard roles={MANAGER}><MeetingPrep /></RoleGuard>} />
          {/* Org admin routes */}
          <Route path="/onboarding" element={<RoleGuard roles={CALLER}><Onboarding /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard roles={ADMIN}><Settings /></RoleGuard>} />
          <Route path="/usage-billing" element={<RoleGuard roles={ADMIN}><UsageBilling /></RoleGuard>} />
          <Route path="/compliance" element={<RoleGuard roles={ADMIN}><ComplianceDashboard /></RoleGuard>} />
          <Route path="/integration-settings" element={<RoleGuard roles={ADMIN}><IntegrationSettings /></RoleGuard>} />
          <Route path="/integrations" element={<RoleGuard roles={ADMIN}><IntegrationHub /></RoleGuard>} />
          {/* Platform owner routes */}
          <Route path="/pilot-console" element={<RoleGuard roles={PLATFORM}><PilotConsole /></RoleGuard>} />
          <Route path="/feedback-review" element={<RoleGuard roles={PLATFORM}><FeedbackReview /></RoleGuard>} />
          <Route path="/feature-flags" element={<RoleGuard roles={PLATFORM}><FeatureFlags /></RoleGuard>} />
          <Route path="/incidents" element={<RoleGuard roles={PLATFORM}><Incidents /></RoleGuard>} />
          <Route path="/pilot-readiness" element={<RoleGuard roles={PLATFORM}><PilotReadiness /></RoleGuard>} />
          <Route path="/health" element={<RoleGuard roles={PLATFORM}><HealthDashboard /></RoleGuard>} />
          <Route path="/capacity" element={<RoleGuard roles={PLATFORM}><CapacityReport /></RoleGuard>} />
          <Route path="/saas-ops" element={<RoleGuard roles={PLATFORM}><SaaSOps /></RoleGuard>} />
          <Route path="/org-admin" element={<RoleGuard roles={PLATFORM}><OrganisationAdmin /></RoleGuard>} />
          <Route path="/tenant-isolation" element={<RoleGuard roles={PLATFORM}><TenantIsolationReport /></RoleGuard>} />
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