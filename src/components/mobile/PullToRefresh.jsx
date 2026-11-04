import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

const THRESHOLD = 72;

/**
 * Document-level pull-to-refresh for iOS-style lists.
 * Only arms when the window scroll container is at the top.
 */
export default function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  className = "",
}) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const updateOffset = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const runRefresh = useCallback(async () => {
    if (busy.current || disabled) return;
    busy.current = true;
    setRefreshing(true);
    setError("");
    try {
      await onRefresh();
    } catch (err) {
      setError(err?.message || "Could not refresh. Pull again to retry.");
    } finally {
      setRefreshing(false);
      updateOffset(0);
      busy.current = false;
      pulling.current = false;
    }
  }, [disabled, onRefresh]);

  useEffect(() => {
    if (disabled) return undefined;

    const atTop = () => (window.scrollY || window.pageYOffset || 0) <= 0;

    const onTouchStart = (event) => {
      if (refreshing || busy.current) return;
      if (!atTop()) {
        pulling.current = false;
        return;
      }
      // Ignore pulls that begin on drawer/sheet chrome
      if (event.target?.closest?.('[data-vaul-drawer], [role="dialog"]')) return;
      startY.current = event.touches[0].clientY;
      pulling.current = true;
      setError("");
    };

    const onTouchMove = (event) => {
      if (!pulling.current || refreshing || busy.current) return;
      if (!atTop()) {
        pulling.current = false;
        updateOffset(0);
        return;
      }
      const dy = event.touches[0].clientY - startY.current;
      if (dy <= 0) {
        updateOffset(0);
        return;
      }
      const next = Math.min(dy * 0.45, 112);
      updateOffset(next);
      if (next > 8 && event.cancelable) event.preventDefault();
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (offsetRef.current >= THRESHOLD && !refreshing) {
        updateOffset(56);
        runRefresh();
      } else if (!refreshing) {
        updateOffset(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, refreshing, runRefresh]);

  const armed = offset >= THRESHOLD;

  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none sticky top-0 z-30 flex justify-center overflow-hidden transition-[height] duration-150 ease-out"
        style={{ height: refreshing ? 56 : offset }}
        aria-hidden={!refreshing && offset === 0}
      >
        <div className="flex items-center gap-2 pt-3 text-xs font-medium text-muted-foreground">
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Refreshing…</span>
            </>
          ) : (
            <>
              <RotateCw
                className={`h-4 w-4 ${armed ? "text-primary" : ""}`}
                style={{ transform: `rotate(${Math.min(offset * 2, 180)}deg)` }}
              />
              <span>{armed ? "Release to refresh" : "Pull to refresh"}</span>
            </>
          )}
        </div>
      </div>
      {error ? (
        <div
          className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div
        style={{
          transform:
            offset && !refreshing ? `translateY(${Math.min(offset * 0.15, 12)}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
