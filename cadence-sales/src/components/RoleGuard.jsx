import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AccessDenied from '@/components/AccessDenied';

// Reusable frontend route guard. Checks the trusted user.app_role (mirrored
// server-side from UserProfile via provisionUser). If the user doesn't have
// one of the allowed roles, shows Access Denied and does not load protected data.
export default function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.app_role)) {
    return <AccessDenied />;
  }
  return children;
}