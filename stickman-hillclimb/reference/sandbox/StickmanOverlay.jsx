import { useEffect, useState } from "react";
import StickmanFigure from "@/components/stickman/StickmanFigure";
import PlayControls from "@/components/stickman/PlayControls";
import useStickmanJourney from "@/hooks/useStickmanJourney";

// The invitation appears early enough to be noticed, then steps aside.
const HINT_AT_MS = 3600;
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

  // One quiet invitation on arrival, never repeated while he is being played.
  useEffect(() => {
    if (!ready) return undefined;
    const show = window.setTimeout(() => setTryHint(true), HINT_AT_MS);
    const hide = window.setTimeout(() => setTryHint(false), HINT_AT_MS + HINT_LIFE_MS);
    const dismiss = () => setTryHint(false);
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismiss);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
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