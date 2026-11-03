const memory = new Map();

export function saveTabScroll(key) {
  if (!key || typeof window === "undefined") return;
  memory.set(key, window.scrollY || window.pageYOffset || 0);
}

export function restoreTabScroll(key) {
  if (!key || typeof window === "undefined") return;
  const y = memory.has(key) ? memory.get(key) : 0;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  });
}

export function clearTabScroll(key) {
  memory.delete(key);
}

/** Installer primary destinations that keep independent stacks. */
export const INSTALLER_TAB_PATHS = ["/", "/register-install", "/installs", "/earnings"];

/** Admin primary destinations (More drawer holds the rest). */
export const ADMIN_TAB_PATHS = ["/", "/admin/installs", "/admin/installers", "/admin/vouchers"];

export function tabKeyForPath(pathname, isAdmin) {
  if (pathname.startsWith("/claim/")) return isAdmin ? null : "/register-install";
  const roots = isAdmin ? ADMIN_TAB_PATHS : INSTALLER_TAB_PATHS;
  if (roots.includes(pathname)) return pathname;
  if (!isAdmin && pathname === "/register-install") return pathname;
  return null;
}

export function isPrimaryTabPath(pathname, isAdmin) {
  return Boolean(tabKeyForPath(pathname, isAdmin));
}