import { useEffect, useState } from "react";
import StickmanFigure from "@/components/stickman/StickmanFigure";
import PlayControls from "@/components/stickman/PlayControls";
import useStickmanJourney from "@/hooks/useStickmanJourney";

// Invitation waits for the first real scroll, then steps aside.
const HINT_SCROLL_PX = 40;
const HINT_LIFE_MS = 7000;

/**
 * Purely decorative overlay: it sits above the page, never participates in
 * layout, and takes no pointer events apart from its own small controls.
 */
export default function StickmanOverlay({ page = "" }) {
  const {
    ready, size, pose, pulses, paused, playing, returning, notice, jumpTip,
    togglePaused, togglePlay, press, figureRef, pulseLayerRef, shadowRef,
  } = useStickmanJourney({ page });

  const [tryHint, setTryHint] = useState(false);

  // One quiet invitation after the first scroll stop — not on first paint.
  useEffect(() => {
    if (!ready) return undefined;
    let hide = 0;
    let shown = false;
    const dismiss = () => {
      shown = true;
      setTryHint(false);
      window.clearTimeout(hide);
    };
    const onScroll = () => {
      if (shown || window.scrollY < HINT_SCROLL_PX) return;
      shown = true;
      setTryHint(true);
      hide = window.setTimeout(() => setTryHint(false), HINT_LIFE_MS);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.clearTimeout(hide);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        <div ref={pulseLayerRef} className="pointer-events-none absolute inset-x-0 top-0">
          {pulses.map((pulse) => (
            <span
              key={pulse.id}
              aria-hidden="true"
              className="sm-pulse"
              style={{
                left: `${pulse.left}px`,
                top: `${pulse.top}px`,
                width: `${pulse.width}px`,
                height: `${pulse.height}px`,
              }}
            />
          ))}
        </div>

        <span ref={shadowRef} aria-hidden="true" className="sm-ground-shadow" />

        <div
          ref={figureRef}
          aria-hidden="true"
          className={`sm-figure${paused ? " sm-paused" : ""}${playing ? " sm-playing" : ""}`}
          style={{ width: `${size * 0.87}px`, height: `${size}px` }}
        >
          <StickmanFigure pose={pose} size={size} />
          {tryHint && !playing && (
            <span className="sm-try-hint">Try me · gamepad or double-click</span>
          )}
          <span className="sm-grab-hint">pick me up</span>
        </div>
      </div>

      <PlayControls
        playing={playing}
        paused={paused}
        returning={returning}
        notice={notice}
        jumpTip={jumpTip}
        togglePaused={togglePaused}
        togglePlay={togglePlay}
        press={press}
      />
    </>
  );
}