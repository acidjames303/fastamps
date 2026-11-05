import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import NewDecision from '@/pages/NewDecision';
import History from '@/pages/History';

const queryClient = new QueryClient();

function RequireAuth({ children }) {
  const { isAuthenticated, isLoadingAuth, login } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading Cadence…
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to Cadence</h1>
        <p className="max-w-md text-slate-600">
          Cadence helps leaders choose the right communication method — meeting, email, or async — and drafts the content for you.
        </p>
        <button
          type="button"
          onClick={login}
          className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Sign in to continue
        </button>
      </div>
    );
  }
  return children;
}

function AppRoutes() {
  return (
    <RequireAuth>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Home" element={<Navigate to="/" replace />} />
          <Route path="/NewDecision" element={<NewDecision />} />
          <Route path="/History" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors position="top-center" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
