import { Outlet } from 'react-router-dom';
import { useInstaller } from '@/hooks/useInstaller';

export default function AdminRoute() {
  const { data, isLoading } = useInstaller();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (data?.user?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-border bg-muted/60 p-8">
        <h1 className="text-xl font-semibold">FastAmps team access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to open administration tools.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
