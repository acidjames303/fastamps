import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workspaceAccess, setWorkspaceAccess] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            // private_with_login: anonymous visitors are expected. Do not treat this
            // as a hard authError — that used to call redirectToLogin during render
            // and return null (blank white screen) before Cadence's own /login
            // could mount. With a token, certify the session; otherwise
            // stay anonymous so public routes and custom login work.
            if (appParams.token) {
              await checkUserAuth();
            } else {
              setAuthError(null);
              setUser(null);
              setIsAuthenticated(false);
              setAuthChecked(true);
              setIsLoadingAuth(false);
            }
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
            setIsLoadingAuth(false);
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
            setIsLoadingAuth(false);
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
          setIsLoadingAuth(false);
        }
        setIsLoadingPublicSettings(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      let currentUser = await base44.auth.me();
      // Auto-provision invited users on first login (links org + role for RLS).
      if (!currentUser.organisation_id) {
        await base44.functions.invoke('provisionUser', {});
        currentUser = await base44.auth.me();
      }

      // Fail closed: do not render any company page until the authoritative
      // membership, display profile and production organisation are certified.
      const verificationResponse = await base44.functions.invoke('verifySessionTenant', {});
      const verification = verificationResponse.data || verificationResponse;
      const accessResponse = await base44.functions.invoke('getWorkspaceAccess', {});
      const access = accessResponse.data || accessResponse;
      setWorkspaceAccess(access);
      setAuthError(null);
      // The built-in User role is a legacy mirror and can lag behind a secured
      // membership change. Permission-aware UI must use the server-certified role.
      setUser({
        ...currentUser,
        app_role: verification.app_role || access.app_role,
        capabilities: verification.capabilities || access.capabilities || [],
        membership_id: verification.membership_id || access.membership_id,
        membership_version: verification.membership_version || access.membership_version,
      });
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      const status = error.status || error.response?.status;
      const payload = error.data || error.response?.data || {};
      const code = payload.code || payload.error?.code;
      if (status === 401) {
        // Expired / missing session — stay anonymous so /login can render.
        // A blocking auth_required error prevented that route from
        // mounting and produced a blank screen during SDK redirect.
        setAuthError(null);
        setUser(null);
        setWorkspaceAccess(null);
      } else if (status === 403 || status === 409) {
        setAuthError({
          type: code || 'tenant_assignment_error',
          message: payload.error || error.message || 'Your organisation assignment could not be verified.'
        });
      } else {
        setAuthError({ type: 'unknown', message: error.message || 'Could not verify your account.' });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setWorkspaceAccess(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  // Keep local auth user in sync after profile saves (MyProfile / CallerProfile).
  const updateUser = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      workspaceAccess,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};