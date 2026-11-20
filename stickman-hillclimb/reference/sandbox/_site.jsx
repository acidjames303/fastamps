import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import StickmanOverlay from "@/components/stickman/StickmanOverlay";
import { listServices } from "@/lib/server-fns";

// The character only appears on the pages he has a route through.
const STICKMAN_PAGES = new Set(["/", "/work"]);

export const Route = createFileRoute("/_site")({
  loader: () => listServices(),
  component: SiteLayout,
});

function SiteLayout() {
  const services = Route.useLoaderData();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter services={services} />
      {STICKMAN_PAGES.has(pathname) && <StickmanOverlay key={pathname} page={pathname} />}
    </div>
  );
}