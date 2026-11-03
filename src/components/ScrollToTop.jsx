import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { useInstaller } from "@/hooks/useInstaller";
import { isPrimaryTabPath, restoreTabScroll, tabKeyForPath } from "@/lib/tabScrollMemory";

const getHashId = (hash) => {
  const rawId = hash.slice(1);
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

/**
 * Scroll policy:
 * - Browser back/forward (POP): never force scroll; tab memory restores when needed.
 * - Switching between primary mobile tabs: restore saved tab scroll (handled in panes).
 * - Entering a non-tab (More) destination: scroll to top (or hash target).
 * - Desktop: keep prior behaviour (scroll to top on pathname change, skip on POP).
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const { data } = useInstaller();
  const isAdmin = data?.user?.role === "admin";
  const prevPath = useRef(pathname);

  useEffect(() => {
    const previous = prevPath.current;
    prevPath.current = pathname;

    if (navigationType === "POP") return undefined;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    const toTab = tabKeyForPath(pathname, isAdmin);
    const fromTab = tabKeyForPath(previous, isAdmin);
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

    if (mobile && toTab && fromTab && toTab !== fromTab) {
      // Tab switch: panes restore scroll; do not jump to top.
      restoreTabScroll(toTab);
      return undefined;
    }

    if (mobile && toTab && isPrimaryTabPath(pathname, isAdmin) && fromTab === toTab) {
      return undefined;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return undefined;
  }, [pathname, hash, navigationType, isAdmin]);

  return null;
}
