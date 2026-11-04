import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import SubmitInstall from "@/pages/SubmitInstall";
import Installs from "@/pages/Installs";
import Earnings from "@/pages/Earnings";
import AdminInstalls from "@/pages/AdminInstalls";
import AdminInstallers from "@/pages/AdminInstallers";
import AdminVouchers from "@/pages/AdminVouchers";
import { restoreTabScroll, tabKeyForPath } from "@/lib/tabScrollMemory";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { useInstaller } from "@/hooks/useInstaller";

function Pane({ id, active, children }) {
  const [visited, setVisited] = useState(active);
  useEffect(() => {
    if (active) setVisited(true);
  }, [active]);
  if (!visited) return null;
  return (
    <div
      id={`tab-pane-${id}`}
      hidden={!active}
      aria-hidden={!active}
      className={active ? "block page-enter" : "hidden"}
    >
      {children}
    </div>
  );
}

function Refreshable({ queryKeys, children }) {
  const queryClient = useQueryClient();
  return (
    <PullToRefresh
      onRefresh={async () => {
        await Promise.all(
          queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey })),
        );
      }}
    >
      {children}
    </PullToRefresh>
  );
}

export function InstallerMobilePanes({ active }) {
  const location = useLocation();
  const { data } = useInstaller();
  const email = data?.user?.email;
  const key = tabKeyForPath(location.pathname, false);

  useEffect(() => {
    if (active && key) restoreTabScroll(key);
  }, [active, key, location.pathname]);

  if (!active) return null;

  return (
    <>
      <Pane id="home" active={key === "/"}>
        <Refreshable queryKeys={[["install-claims", email], ["installer"]]}>
          <Dashboard />
        </Refreshable>
      </Pane>
      <Pane id="register" active={key === "/register-install"}>
        <SubmitInstall />
      </Pane>
      <Pane id="installs" active={key === "/installs"}>
        <Refreshable queryKeys={[["install-claims", email]]}>
          <Installs />
        </Refreshable>
      </Pane>
      <Pane id="wallet" active={key === "/earnings"}>
        <Earnings />
      </Pane>
    </>
  );
}

export function AdminMobilePanes({ active }) {
  const location = useLocation();
  const key = tabKeyForPath(location.pathname, true);

  useEffect(() => {
    if (active && key) restoreTabScroll(key);
  }, [active, key, location.pathname]);

  if (!active) return null;

  return (
    <>
      <Pane id="admin-home" active={key === "/"}>
        <Refreshable
          queryKeys={[
            ["admin-installers-overview"],
            ["admin-claims-overview"],
            ["admin-chargers-overview"],
            ["admin-vouchers-overview"],
          ]}
        >
          <Dashboard />
        </Refreshable>
      </Pane>
      <Pane id="admin-installs" active={key === "/admin/installs"}>
        <Refreshable queryKeys={[["admin-install-claims"], ["admin-chargers"]]}>
          <AdminInstalls />
        </Refreshable>
      </Pane>
      <Pane id="admin-installers" active={key === "/admin/installers"}>
        <Refreshable
          queryKeys={[["admin-installer-directory"], ["admin-installer-directory-claims"]]}
        >
          <AdminInstallers />
        </Refreshable>
      </Pane>
      <Pane id="admin-vouchers" active={key === "/admin/vouchers"}>
        <AdminVouchers />
      </Pane>
    </>
  );
}
