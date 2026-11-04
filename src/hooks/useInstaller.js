import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useInstaller() {
  return useQuery({
    queryKey: ['installer'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const found = await base44.entities.Installer.filter({ user_email: user.email });
      return { user, installer: found[0] || null };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}