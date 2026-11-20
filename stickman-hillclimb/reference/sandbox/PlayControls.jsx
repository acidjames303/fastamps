import { ArrowUp, ChevronLeft, ChevronRight, Gamepad2, Pause, Play } from "lucide-react";

const PAD = [
  { action: "left", label: "Step left", Icon: ChevronLeft },
  { action: "jump", label: "Jump, press twice to fly", Icon: ArrowUp },
  { action: "right", label: "Step right", Icon: ChevronRight },
];

const LEGEND = "← → move · ↑ jump · ↑↑ fly · Esc exit";

/**
 * The small play HUD: it stays out of the page's way, but it never hides what
 * play mode is doing. The pad is present for as long as he is being played,
 * which is what makes him usable with a thumb.
 */
export default function PlayControls({
  playing,
  paused,
  returning,
  notice,
  jumpTip,
  togglePaused,
  togglePlay,
  press,
}) {
  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2">
      {playing && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sm-chip">playing</span>
          <span className="sm-legend">{LEGEND}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={togglePaused}
          aria-label={paused ? "Resume the diagram character" : "Pause the diagram character"}
          title={paused ? "Resume the character" : "Pause the character"}
          className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-border bg-background/70 text-muted-foreground/70 backdrop-blur transition-colors hover:text-foreground"
        >
          {paused ? <Play className="h-4 w-4" strokeWidth={1.8} /> : <Pause className="h-4 w-4" strokeWidth={1.8} />}
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          aria-label={playing ? "Let the character follow the page again" : "Play with the diagram character"}
          title="Arrow keys to move, jump twice in quick succession to fly"
          className={`flex h-9 w-9 items-center justify-center rounded-[4px] border bg-background/70 backdrop-blur transition-colors ${
            playing
              ? "border-electric bg-electric text-white"
              : "border-border text-muted-foreground/70 hover:text-foreground hover:border-electric/50"
          }`}
        >
          <Gamepad2 className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {playing && (
          <div className="flex items-center gap-1 rounded-[4px] border border-electric/40 bg-background/80 p-0.5 backdrop-blur">
            {PAD.map(({ action, label, Icon }) => (
              <button
                key={action}
                type="button"
                aria-label={label}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  press(action, true);
                }}
                onPointerUp={() => press(action, false)}
                onPointerCancel={() => press(action, false)}
                onPointerLeave={() => press(action, false)}
                className="flex h-8 w-8 items-center justify-center rounded-[3px] text-electric transition-colors hover:bg-electric/10 active:bg-electric/20"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </div>

      {playing && returning && <span className="sm-cue">returning…</span>}
      {playing && jumpTip && !returning && <span className="sm-cue">Tap jump again to fly</span>}
      {!playing && notice && <span className="sm-cue">{notice}</span>}
    </div>
  );
}