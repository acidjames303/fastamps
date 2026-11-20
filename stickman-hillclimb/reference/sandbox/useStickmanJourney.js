import { useCallback, useEffect, useRef, useState } from "react";
import { buildJourney, sampleJourney } from "@/lib/stickman-journey";
import { landingAt, readSurfaces, supportAt, wallAt } from "@/lib/stickman-surfaces";
import { attachGrab, attachPointerLife } from "@/hooks/stickman-pointer";
import {
  capStep,
  damp,
  easeInOut,
  gaitAmplitude,
  gaitCycle,
  gaitFor,
  glanceAngle,
  leanFor,
  smootherStep,
  squashPulse,
} from "@/lib/stickman-motion";

// A gentle, weighted pursuit of scroll progress. He takes time to catch up,
// rather than racing instantly down the entire page when the visitor scrolls.
const HALF_LIFE = 175;
const WORK_HALF_LIFE = 118;
const WORK_CATCHUP_PX = 80;
const MAX_SPEED = 1350;
// Gravity: he drops into a surface quickly and climbs out of one with effort.
const FALL_HALF_LIFE = 112;
const CLIMB_HALF_LIFE = 212;
const WORK_FALL_HALF_LIFE = 90;
const WORK_CLIMB_HALF_LIFE = 150;

const ANTICIPATE_MS = 90;
const PRESS_MS = 260;
const RETURN_MS = 380;
const SQUASH_MS = 260;
const POSE_DWELL = 110;
const PAUSE_KEY = "sm-journey-paused";

// Easter egg: keyboard control. The keys only ever win while he is being
// played; once the visitor stops, the scroll path takes him back.
const PLAY_IDLE_MS = 9000;
const RETURN_CUE_MS = 2000;
const FLY_IDLE_MS = 9000;
const PLAY_SPEED = 300;
const PLAY_FLY_SPEED = 440;
const PLAY_ACCEL_HALF_LIFE = 90;
const PLAY_JUMP_V = 500;
const PLAY_BIG_JUMP_V = 830;
const PLAY_GRAVITY = 1700;
const PLAY_FLY_GRAVITY = 620;
const PLAY_THRUST = 1560;
const DOUBLE_TAP_MS = 420;
const DANCE_TAP_MS = 280;
const DANCE_MS = 1900;
const SLIDE_SPEED = 210;
const CLIMB_SPEED = 96;
// In play he steps forward a little, so he still reads near a viewport edge.
const PLAY_SCALE = 1.16;
const FLY_SCALE = 1.26;
// A held jump during a long fall opens the canopy: a calm, visitor-led descent.
const CHUTE_FALL = 120;
const CHUTE_AFTER_MS = 600;

const toDocRect = (rect) => ({
  left: rect.left + window.scrollX,
  top: rect.top + window.scrollY,
  width: rect.width,
  height: rect.height,
});

/**
 * Central journey controller.
 * Measures real elements once (and again when the layout really changes),
 * then drives the character with a single transform write per frame.
 */
export default function useStickmanJourney({ page = "" } = {}) {
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState(56);
  const [pose, setPose] = useState("idle");
  const [pulses, setPulses] = useState([]);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [returning, setReturning] = useState(false);
  const [notice, setNotice] = useState("");
  const [jumpTip, setJumpTip] = useState(false);

  const figureRef = useRef(null);
  const pulseLayerRef = useRef(null);
  const pausedRef = useRef(false);
  const lastScrollRef = useRef(0);
  const ascendRef = useRef(false);
  const modelRef = useRef({ stops: [], vh: 0, size: 56 });
  const motionRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, init: false });
  const leanRef = useRef(0);
  const gaitRef = useRef({ at: 0, cycle: 620, amp: 1 });
  const reactionRef = useRef(null);
  const dragRef = useRef(null);
  const throwRef = useRef(null);
  const suppressClickRef = useRef({ pointerId: null, until: 0 });
  const hoverRef = useRef(null);
  const tickleRef = useRef({ until: 0, lastTrigger: -10000 });
  const lastPointerRef = useRef({ x: 0, y: 0, inside: false });
  const firedRef = useRef(new Set());
  const poseRef = useRef("idle");
  const candidateRef = useRef({ pose: "idle", at: 0 });
  const indexRef = useRef(-1);
  const squashRef = useRef(0);
  const squashDepthRef = useRef(1);
  const touchRef = useRef({ key: null, index: -1, next: 0, done: false });
  const glanceRef = useRef(0);
  const facingRef = useRef(1);
  const playRef = useRef({
    active: false,
    phase: "ground",
    x: 0,
    y: 0,
    groundY: 0,
    vx: 0,
    vy: 0,
    alt: 0,
    box: null,
    support: null,
    perch: null,
    perchFree: 0,
    surfaces: { panels: [], perches: [] },
    surfacedAt: 0,
    bigJump: false,
    noAttachUntil: 0,
    lastInput: 0,
    lastJumpAt: 0,
    lastTap: null,
    danceUntil: 0,
    chute: false,
    fellAt: 0,
    keys: { left: false, right: false, jump: false },
  });
  const shadowRef = useRef(null);
  const lastPressRef = useRef(0);
  const lastTapRef = useRef({ at: 0, x: 0, y: 0 });
  const pageRef = useRef(page);
  const scaleRef = useRef(1);
  const returningRef = useRef(false);
  const jumpTipRef = useRef(false);
  pageRef.current = page;

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // The pause control is remembered between visits.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PAUSE_KEY) === "1") setPaused(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReady(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const addPulse = useCallback((target) => {
    if (!target) return;
    // Measure live, at the instant of contact: an element may have moved or
    // resized since the journey was built, and a cached box would sit offset.
    const source = target.getBoundingClientRect ? target : target.el;
    let rect = target;
    if (source?.isConnected) {
      const box = source.getBoundingClientRect();
      rect = {
        left: box.left + window.scrollX,
        top: box.top + window.scrollY,
        width: box.width,
        height: box.height,
      };
    }
    if (!rect || rect.width < 4 || rect.height < 4) return;
    const id = `${Math.round(performance.now())}-${Math.round(Math.random() * 1e5)}`;
    // Pulses live in document coordinates and their overlay layer tracks
    // scrolling, so contact highlights stay attached to the actual surface.
    setPulses((previous) => {
      // One outline per surface. A second box drawn over the first reads as a
      // ghost, so the newer highlight simply replaces the older one.
      const sameSurface = (pulse) => {
        const overlapW = Math.min(pulse.left + pulse.width, rect.left + rect.width) -
          Math.max(pulse.left, rect.left);
        const overlapH = Math.min(pulse.top + pulse.height, rect.top + rect.height) -
          Math.max(pulse.top, rect.top);
        if (overlapW <= 0 || overlapH <= 0) return false;
        const shared = overlapW * overlapH;
        return shared > Math.min(pulse.width * pulse.height, rect.width * rect.height) * 0.5;
      };
      return [
        ...previous.filter((pulse) => !sameSurface(pulse)).slice(-1),
        { id, left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      ];
    });
    window.setTimeout(() => {
      setPulses((previous) => previous.filter((pulse) => pulse.id !== id));
    }, 620);
  }, []);

  // Hand him to the visitor: from here the keys lead and the path waits.
  const startPlay = useCallback(() => {
    const node = figureRef.current;
    const motion = motionRef.current;
    const play = playRef.current;
    if (!node || play.active || !Number.isFinite(motion.x)) return;
    play.active = true;
    play.phase = "ground";
    play.x = Number.isFinite(node._x) ? node._x : motion.x;
    play.y = Number.isFinite(node._y) ? node._y : motion.y;
    play.groundY = play.y;
    play.vx = 0;
    play.vy = 0;
    play.alt = 0;
    play.box = null;
    play.support = null;
    play.perch = null;
    play.perchFree = 0;
    play.surfacedAt = 0;
    play.surfaces = { panels: [], perches: [] };
    play.bigJump = false;
    play.noAttachUntil = 0;
    play.lastTap = null;
    play.danceUntil = 0;
    play.chute = false;
    play.fellAt = 0;
    play.lastInput = performance.now();
    returningRef.current = false;
    setReturning(false);
    setNotice("");
    play.keys.left = false;
    play.keys.right = false;
    play.keys.jump = false;
    reactionRef.current = null;
    throwRef.current = null;
    hoverRef.current = null;
    tickleRef.current.until = 0;
    motion.x = play.x;
    motion.y = play.y;
    motion.init = true;
    setPlaying(true);
  }, []);

  const endPlay = useCallback((message = "") => {
    const play = playRef.current;
    if (!play.active) return;
    play.active = false;
    play.keys.left = false;
    play.keys.right = false;
    play.keys.jump = false;
    play.box = null;
    play.support = null;
    play.perch = null;
    play.surfaces = { panels: [], perches: [] };
    play.bigJump = false;
    if (shadowRef.current) shadowRef.current.style.opacity = "0";
    returningRef.current = false;
    setReturning(false);
    setPlaying(false);
    if (message) {
      setNotice(message);
      window.setTimeout(() => {
        setNotice((current) => (current === message ? "" : current));
      }, 2400);
    }
  }, []);

  /**
   * One input surface for the keys and the on-screen pad.
   * A quick double press of jump makes the bigger leap; landing from it opens
   * free flight. Quick alternating left/right taps break into a dance.
   */
  const press = useCallback((action, down) => {
    const play = playRef.current;
    if (!play.active) return;
    const at = performance.now();

    if (action === "left" || action === "right") {
      play.keys[action] = down;
      if (!down) return;
      play.lastInput = at;
      const last = play.lastTap;
      if (play.phase === "ground" && last && last.dir !== action && at - last.at < DANCE_TAP_MS) {
        play.danceUntil = at + DANCE_MS;
      }
      play.lastTap = { dir: action, at };
      return;
    }

    if (action !== "jump") return;
    play.keys.jump = down;
    if (!down) return;
    play.lastInput = at;

    // One tip, the first time he leaves the ground: the second press flies.
    if (!jumpTipRef.current) {
      jumpTipRef.current = true;
      setJumpTip(true);
      window.setTimeout(() => setJumpTip(false), 3600);
    }

    // Hanging off a panel: jump is the climbing key, so holding it hauls him
    // back up the wall instead of pushing him off it.
    if (play.phase === "slide") return;

    // In the air, each press beats the wings and furls the canopy.
    if (play.phase === "fly") {
      play.vy = Math.min(play.vy, -320);
      play.chute = false;
      play.fellAt = 0;
      return;
    }

    const doubled = at - play.lastJumpAt < DOUBLE_TAP_MS;
    play.lastJumpAt = at;
    play.danceUntil = 0;

    // A second quick press turns the first hop into the bigger, expressiver leap.
    if (play.alt > 1) {
      if (doubled && play.vy < 0) {
        play.bigJump = true;
        play.vy = -PLAY_BIG_JUMP_V;
        squashRef.current = at;
      }
      return;
    }

    play.bigJump = doubled;
    play.vy = doubled ? -PLAY_BIG_JUMP_V : -PLAY_JUMP_V;
    if (doubled) squashRef.current = at;
  }, []);

  const togglePlay = useCallback(() => {
    if (playRef.current.active) endPlay("Back to the page tour");
    else startPlay();
  }, [startPlay, endPlay]);

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nextSize = vw < 640 ? 40 : vw < 1024 ? 48 : 56;
    const stops = buildJourney({ vw, vh, size: nextSize, page: pageRef.current });
    modelRef.current = { stops, vh, size: nextSize };
    setSize((previous) => (previous === nextSize ? previous : nextSize));

  }, []);

  // A visitor pressing a real control: he turns, travels and presses it himself.
  useEffect(() => {
    if (!ready) return undefined;

    const onClick = (event) => {
      const target = event.target;
      const control = target instanceof Element ? target.closest("[data-sm-press]") : null;
      if (!control || pausedRef.current || dragRef.current || throwRef.current || playRef.current.active) return;
      const rect = control.getBoundingClientRect();
      if (!rect.width || rect.top > window.innerHeight || rect.bottom < 0) return;
      hoverRef.current = null;
      tickleRef.current.until = 0;
      const docRect = toDocRect(rect);
      const size = modelRef.current.size;
      const selected = sampleJourney(modelRef.current.stops, window.scrollY, ascendRef.current);
      const targetX = docRect.left + docRect.width / 2 - size * 0.435;
      const targetY = docRect.top - size * 0.935 - 3;
      const distance = Math.hypot(targetX - selected.x, targetY - selected.y);
      const travelMs = Math.min(600, Math.max(230, 210 + distance * 0.42));
      // The highlight answers the click straight away, on the box that was
      // actually clicked, so nothing appears late or out of place.
      addPulse(control);
      lastPressRef.current = performance.now();
      reactionRef.current = {
        rect: docRect,
        start: performance.now(),
        travelMs,
        pulsed: true,
      };
      // The selected content may have changed height after the interaction.
      window.setTimeout(measure, 350);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [ready, measure]);

  // Pointer life: a brush over him tickles, and hovering a diagram node or a
  // control turns him toward it. The page itself keeps every gesture.
  useEffect(() => {
    if (!ready) return undefined;
    return attachPointerLife({
      figureRef,
      modelRef,
      pausedRef,
      reactionRef,
      dragRef,
      throwRef,
      playRef,
      hoverRef,
      tickleRef,
      lastPointerRef,
    });
  }, [ready]);

  // Pick him up, carry him and fling him without making the overlay block the
  // page. Global hit-testing only claims a press directly over his silhouette.
  useEffect(() => {
    if (!ready) return undefined;
    return attachGrab({
      figureRef,
      modelRef,
      pausedRef,
      reactionRef,
      dragRef,
      throwRef,
      playRef,
      tickleRef,
      lastTapRef,
      suppressClickRef,
      motionRef,
      startPlay,
    });
  }, [ready, startPlay]);

  // Easter egg keys. They only ever act while he is being played, so the page
  // keeps its normal keyboard behaviour (scrolling, forms, links) otherwise.
  useEffect(() => {
    if (!ready) return undefined;

    const isLeft = (key) => key === "ArrowLeft" || key === "a" || key === "A";
    const isRight = (key) => key === "ArrowRight" || key === "d" || key === "D";
    const isJump = (key) =>
      key === " " || key === "Spacebar" || key === "ArrowUp" || key === "w" || key === "W";

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const play = playRef.current;

      if (event.key === "Escape") {
        if (play.active) endPlay("Back to the page tour");
        return;
      }
      if (!play.active || pausedRef.current) return;
      const target = event.target;
      if (target instanceof Element &&
          target.closest("input, textarea, select, [contenteditable], [role='textbox']")) return;

      const left = isLeft(event.key);
      const right = isRight(event.key);
      if (left || right) {
        press(left ? "left" : "right", true);
        event.preventDefault();
        return;
      }
      if (isJump(event.key)) {
        if (!event.repeat) press("jump", true);
        event.preventDefault();
      }
    };

    const onKeyUp = (event) => {
      if (isLeft(event.key)) press("left", false);
      if (isRight(event.key)) press("right", false);
      if (isJump(event.key)) press("jump", false);
    };

    const releaseKeys = () => {
      const play = playRef.current;
      play.keys.left = false;
      play.keys.right = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseKeys);
      releaseKeys();
    };
  }, [ready, endPlay, press]);

  // The scroll-driven journey.
  useEffect(() => {
    if (!ready) return undefined;

    measure();
    let resizeTimer = 0;

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 150);
    };
    const onFonts = () => {
      if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("load", measure);
    onFonts();

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(document.body);
    }

    let frame = 0;
    let previous = 0;

    const loop = (now) => {
      frame = window.requestAnimationFrame(loop);
      const node = figureRef.current;
      const { stops, size: charSize } = modelRef.current;
      if (!node || !stops.length) return;

      const dt = previous ? Math.min(64, Math.max(4, now - previous)) : 16;
      previous = now;

      const scrollY = window.scrollY;

      const layer = pulseLayerRef.current;
      if (layer && layer._scrollY !== scrollY) {
        layer.style.transform = `translate3d(0, ${-scrollY}px, 0)`;
        layer._scrollY = scrollY;
      }

      if (pausedRef.current || document.hidden) return;

      const delta = scrollY - lastScrollRef.current;
      lastScrollRef.current = scrollY;
      const movingBackwards = delta < -1;
      const activelyScrolling = Math.abs(delta) > 1.5;
      // The direction he is travelling in outlives the scroll itself, so a pose
      // never snaps back to its descent version the moment the visitor pauses.
      if (movingBackwards) ascendRef.current = true;
      else if (delta > 1) ascendRef.current = false;
      const sample = sampleJourney(stops, scrollY, ascendRef.current);
      if (movingBackwards) firedRef.current.clear();
      if (activelyScrolling) {
        tickleRef.current.until = 0;
        hoverRef.current = null;
        lastPointerRef.current.inside = false;
        if (!dragRef.current && throwRef.current) {
          const thrown = throwRef.current;
          motionRef.current.x = thrown.x;
          motionRef.current.y = thrown.y;
          throwRef.current = null;
        }
      }

      // ---- weighted chase of the scroll-derived target ---------------------
      const motion = motionRef.current;
      const hovering = hoverRef.current;
      const stageWalk = hovering?.walk && !reactionRef.current && !dragRef.current && !throwRef.current &&
        !playRef.current.active
        ? hovering
        : null;
      let targetX = sample.x;
      let targetY = sample.y - scrollY;
      if (stageWalk) {
        targetX = Math.max(5, stageWalk.docX - charSize * 0.435);
        targetY = stageWalk.docY - scrollY - charSize * 0.935 - 5;
      }
      if (!motion.init) {
        motion.x = targetX;
        motion.y = targetY;
        motion.init = true;
      }
      const fromX = motion.x;
      const fromY = motion.y;
      // Work cards are spaced farther apart: chase a touch faster there so
      // mid-page samples still read as travel, not gait-idle catch-up.
      const onWork = pageRef.current === "/work";
      const chaseHalf = onWork ? WORK_HALF_LIFE : HALF_LIFE;
      motion.x = capStep(fromX, damp(fromX, targetX, chaseHalf, dt), MAX_SPEED, dt);
      // Gravity: he falls into a surface faster than he climbs away from one,
      // so every arc reads as weight rather than a slide along a curve.
      const yHalfLife = targetY > fromY + 0.5
        ? (onWork ? WORK_FALL_HALF_LIFE : FALL_HALF_LIFE)
        : (onWork ? WORK_CLIMB_HALF_LIFE : CLIMB_HALF_LIFE);
      motion.y = capStep(fromY, damp(fromY, targetY, yHalfLife, dt), MAX_SPEED, dt);
      motion.vx = ((motion.x - fromX) * 1000) / dt;
      motion.vy = ((motion.y - fromY) * 1000) / dt;

      let speed = Math.hypot(motion.vx, motion.vy);
      let x = motion.x;
      let y = motion.y;
      let nextPose = sample.pose;
      let immediate = false;

      // On the ground, the gait comes from how fast he is actually moving.
      // Work authored `run` hops must not collapse to idle while standing on a card.
      if (nextPose === "walk" || nextPose === "run") {
        if (onWork && sample.pose === "run") nextPose = "run";
        else nextPose = gaitFor(speed, poseRef.current);
      }
      // Work: prefer the journey sample pose over gait-idle for travel beats.
      if (onWork && !playRef.current.active) {
        const travel = new Set(["run", "walk", "jump", "style-jump", "land", "slide", "hang", "swing", "climb"]);
        const catchUp = Math.hypot(targetX - fromX, targetY - fromY);
        if (travel.has(sample.pose) && (catchUp > WORK_CATCHUP_PX || sample.pose !== "walk")) {
          nextPose = sample.pose === "hang" ? "swing" : sample.pose;
          immediate = true;
        }
      }

      // Walking to a hovered stage: stride while travelling, press on arrival.
      if (stageWalk) {
        nextPose = speed > 30 ? gaitFor(speed, poseRef.current) : "press";
      }

      // ---- the Easter egg: the keys lead, the pathway waits ----------------
      // Nothing about the page is touched. While play is active the scroll
      // sample is ignored; the moment he is released the damped chase above
      // carries him back onto the path he would have been on anyway.
      const play = playRef.current;
      if (play.active) {
        const direction = (play.keys.right ? 1 : 0) - (play.keys.left ? 1 : 0);
        const width = charSize * 0.87;
        const limitX = Math.max(5, window.innerWidth - width - 5);
        const viewportFloor = Math.max(6, window.innerHeight - charSize - 6);
        const floor = Math.max(6, Math.min(play.groundY, viewportFloor));

        // Panels and outlines on the page are solid while he is being played.
        // Measured a few times a second, so scrolling and layout shifts hold.
        if (now > play.surfacedAt) {
          play.surfaces = readSurfaces(window.innerHeight);
          play.surfacedAt = now + 160;
        }

        // Standing beside a panel edge, up takes hold of the outline and hauls
        // him up its side. The panels are ladders as well as floors: holding up
        // climbs, a direction slides him down, and no input climbs him down.
        if (play.phase === "ground" && play.keys.jump && !play.support) {
          const ladder = wallAt(
            play.surfaces.panels,
            play.x,
            width,
            play.y,
            play.y + charSize * 0.935,
          );
          if (ladder) {
            play.phase = "slide";
            play.box = { el: ladder.panel.el, side: ladder.side };
            play.x = ladder.side > 0 ? ladder.panel.left - width : ladder.panel.right;
            play.vx = 0;
            play.vy = 0;
            play.support = null;
            play.groundY = viewportFloor;
            addPulse(ladder.panel.el);
          }
        }

        // Hanging off a panel: he slides while the visitor holds a direction,
        // and settles into a calm climb-down the moment input stops.
        if (play.phase === "slide") {
          const box = play.box?.el?.isConnected ? play.box.el.getBoundingClientRect() : null;
          if (!box) {
            play.phase = "fly";
            play.box = null;
          } else {
            const panelEl = play.box.el;
            // Down the side he slides; holding jump hauls him back up it.
            const climbing = play.keys.jump;
            const sliding = direction !== 0 && !climbing;
            const rate = climbing ? -CLIMB_SPEED * 1.6 : sliding ? SLIDE_SPEED : CLIMB_SPEED;
            play.vx = 0;
            play.vy = rate;
            play.y += (rate * dt) / 1000;
            play.x = play.box.side > 0 ? box.left - width : box.right;
            play.support = null;
            play.groundY = viewportFloor;
            facingRef.current = play.box.side;

            if (climbing && play.y + charSize * 0.935 <= box.top + 3) {
              // Over the top edge: he hauls himself up and stands on it.
              play.y = box.top - charSize * 0.935;
              play.vy = 0;
              play.phase = "ground";
              play.support = {
                el: panelEl,
                left: box.left,
                right: box.right,
                top: box.top,
                bottom: box.bottom,
              };
              play.groundY = play.y;
              play.box = null;
              squashRef.current = now;
              addPulse(panelEl);
            } else if (play.y + charSize * 0.935 >= box.bottom - 2 ||
                play.y > window.innerHeight - charSize - 6) {
              // Off the bottom of the panel: let go and glide away from it.
              play.phase = "fly";
              play.vy = 165;
              play.vx = play.box.side < 0 ? 165 : -165;
              play.noAttachUntil = now + 900;
              play.box = null;
              squashRef.current = now;
            }
          }
        }

        if (play.phase === "fly") {
          // Hold jump through a long fall and the canopy opens: a descent the
          // visitor asks for, rather than only the scripted one.
          if (play.vy > 0 && play.keys.jump) {
            if (!play.fellAt) play.fellAt = now;
            if (now - play.fellAt > CHUTE_AFTER_MS) play.chute = true;
          } else if (play.vy <= 0) {
            play.fellAt = 0;
          }

          const drift = play.chute ? PLAY_SPEED * 0.75 : PLAY_FLY_SPEED;
          play.vx = damp(play.vx, direction * drift, PLAY_ACCEL_HALF_LIFE, dt);
          play.vx = Math.max(-PLAY_FLY_SPEED, Math.min(PLAY_FLY_SPEED, play.vx));
          play.x += (play.vx * dt) / 1000;
          if (play.chute) {
            play.vy = damp(play.vy, CHUTE_FALL, 240, dt);
          } else {
            const climb = play.keys.jump ? -PLAY_THRUST : PLAY_FLY_GRAVITY;
            play.vy = Math.max(-620, Math.min(430, play.vy + (climb * dt) / 1000));
          }
          const previousY = play.y;
          play.y += (play.vy * dt) / 1000;
          const dropSpeed = play.vy > 0 ? play.vy : 0;

          if (play.y <= 6) {
            play.y = 6;
            play.vy = Math.max(play.vy, 70);
          }
          // A card top he has just crossed on the way down is a real floor.
          if (play.vy > 0 && now > play.noAttachUntil) {
            const panel = landingAt(
              play.surfaces.panels,
              play.x,
              width,
              previousY + charSize * 0.935,
              play.y + charSize * 0.935,
              floor,
            );
            if (panel) {
              squashDepthRef.current = Math.min(1.9, 0.7 + dropSpeed / 520);
              play.y = panel.top - charSize * 0.935;
              play.vy = 0;
              play.vx *= 0.6;
              play.phase = "ground";
              play.support = panel;
              play.groundY = play.y;
              play.bigJump = false;
              play.chute = false;
              play.fellAt = 0;
              squashRef.current = now;
              addPulse(panel.el);
            }
          }

          if (play.phase === "fly" && play.y >= floor) {
            // Feet find the floor: weight, then he is walking again.
            squashDepthRef.current = Math.min(1.9, 0.7 + dropSpeed / 520);
            play.y = floor;
            play.vy = 0;
            play.vx *= 0.5;
            play.chute = false;
            play.fellAt = 0;
            play.phase = "ground";
            play.support = null;
            play.groundY = viewportFloor;
            play.bigJump = false;
            squashRef.current = now;
          }

          // A nearby outline is a wall: he takes hold and rides its side.
          if (play.phase === "fly" && now > play.noAttachUntil && play.vy > -70) {
            const wall = wallAt(
              play.surfaces.panels,
              play.x,
              width,
              play.y,
              play.y + charSize * 0.935,
            );
            if (wall) {
              play.phase = "slide";
              play.box = { el: wall.panel.el, side: wall.side };
              play.x = wall.side > 0 ? wall.panel.left - width : wall.panel.right;
              play.vx = 0;
              play.vy = 0;
              play.support = null;
              play.groundY = viewportFloor;
              addPulse(wall.panel.el);
            }
          }
        } else if (play.phase === "ground") {
          // Riding a panel: it stays solid under him and carries him with it.
          if (play.support) {
            const box = play.support.el?.isConnected
              ? play.support.el.getBoundingClientRect()
              : null;
            const centre = play.x + width * 0.5;
            if (!box || centre < box.left + 2 || centre > box.right - 4) {
              // Stepped off the edge: the drop belongs to gravity now.
              play.support = null;
              play.groundY = viewportFloor;
            } else {
              play.groundY = box.top - charSize * 0.935;
            }
          }

          play.vx = damp(play.vx, direction * PLAY_SPEED, PLAY_ACCEL_HALF_LIFE, dt);
          if (!direction && Math.abs(play.vx) < 8) play.vx = 0;
          play.x += (play.vx * dt) / 1000;

          // A jump leaves the surface behind; standing still rides it.
          if (play.vy < 0) play.support = null;

          // Landing back on a card he was jumping from holds him on its edge.
          if (!play.support && play.vy >= 0) {
            const panel = supportAt(
              play.surfaces.panels,
              play.x,
              width,
              play.y + charSize * 0.935,
            );
            if (panel) {
              play.support = panel;
              play.groundY = panel.top - charSize * 0.935;
            }
          }

          if (play.support && Math.abs(play.y - floor) > 0.6) {
            play.y = floor;
          } else if (play.y < floor || play.vy < 0) {
            play.vy += (PLAY_GRAVITY * dt) / 1000;
            play.y = Math.min(floor, play.y + (play.vy * dt) / 1000);
            if (play.y >= floor) {
              play.y = floor;
              play.vy = 0;
              squashRef.current = now;
              // The big double-tap leap lands him straight into free flight.
              if (play.bigJump) {
                play.bigJump = false;
                play.phase = "fly";
                play.vy = -290;
                play.noAttachUntil = now + 500;
              }
            }
          }
        }

        // Hard bounds: he never leaves the visible window.
        if (play.x <= 5 || play.x >= limitX) {
          play.x = Math.max(5, Math.min(limitX, play.x));
          play.vx = 0;
        }
        play.x = Math.max(5, Math.min(limitX, play.x));
        play.y = Math.max(5, Math.min(window.innerHeight - charSize - 5, play.y));

        // A prominent label is a handhold: he catches it and swings for a beat,
        // then lets go and drops back onto the page.
        if (play.perch) {
          const box = play.perch.el?.isConnected ? play.perch.el.getBoundingClientRect() : null;
          if (!box || now > play.perch.until) {
            play.perch = null;
            play.perchFree = now + 1600;
            play.phase = "fly";
            play.vy = 90;
            play.vx = 0;
            play.noAttachUntil = now + 220;
          } else {
            const target = box.left + box.width / 2 - width / 2;
            play.x = Math.max(5, Math.min(limitX, play.x + (target - play.x) * 0.16));
            play.y = box.top - charSize * 0.05;
            play.vx = 0;
            play.vy = 0;
            play.phase = "ground";
            play.support = null;
            play.groundY = viewportFloor;
          }
        } else if (play.phase !== "slide" && now > play.perchFree) {
          const centre = play.x + width / 2;
          for (const label of play.surfaces.perches) {
            if (centre < label.left + 2 || centre > label.right - 2) continue;
            if (Math.abs(play.y - label.top) > 34) continue;
            if (Math.abs(play.vy) > 340) continue;
            play.perch = { el: label.el, until: now + 1500 };
            addPulse(label.el);
            squashRef.current = now;
            break;
          }
        }

        play.alt = Math.max(0, floor - play.y);

        x = play.x;
        y = play.y;
        motion.x = x;
        motion.y = y;
        motion.vx = play.vx;
        motion.vy = play.vy;
        speed = Math.abs(play.vx);
        immediate = true;

        if (play.phase === "slide") {
          facingRef.current = play.box?.side || facingRef.current;
          nextPose = direction !== 0 && !play.keys.jump ? "slide" : "climb";
        } else {
          if (play.vx > 25) facingRef.current = 1;
          else if (play.vx < -25) facingRef.current = -1;
          if (play.perch) nextPose = "swing";
          else if (play.phase === "fly") nextPose = play.chute ? "parachute" : "fly";
          else if (play.alt > 1) nextPose = play.bigJump ? "style-jump" : "jump";
          else if (now < play.danceUntil && speed < 45) nextPose = "dance";
          else nextPose = speed > 24 ? "walk" : "idle";
        }

        // His shadow on the floor tells the visitor how high he really is.
        const shadow = shadowRef.current;
        if (shadow) {
          const height = Math.min(1, play.alt / 300);
          // A soft shadow always says where the surface is, in the air or not.
          shadow.style.opacity = play.alt > 3
            ? (0.36 - height * 0.2).toFixed(2)
            : "0.22";
          shadow.style.transform = `translate3d(${(x + width * 0.06).toFixed(1)}px, ${(floor + charSize * 0.94).toFixed(1)}px, 0) scaleX(${(1 - height * 0.42).toFixed(3)})`;
        }

        // Standing still on the ground: he waits patiently, warns that he is
        // about to go, and only then rejoins the journey.
        const idleMs = play.phase === "fly" ? FLY_IDLE_MS : PLAY_IDLE_MS;
        const stillIdle = play.phase === "ground" && play.alt < 1 && speed < 26 &&
          direction === 0 && !play.keys.jump;
        const idleFor = now - play.lastInput;
        const cue = stillIdle && idleFor > idleMs - RETURN_CUE_MS;
        if (cue !== returningRef.current) {
          returningRef.current = cue;
          setReturning(cue);
        }
        if (stillIdle && idleFor > idleMs) endPlay("Back to the page tour");
      }

      // Facing follows smoothed horizontal travel, with a dead zone.
      if (!play.active && motion.vx > 45) facingRef.current = 1;
      else if (!play.active && motion.vx < -45) facingRef.current = -1;

      // ---- a click: one continuous move, with weight ----------------------
      const reaction = reactionRef.current;
      if (reaction) {
        const elapsed = now - reaction.start;
        const travelStart = ANTICIPATE_MS;
        const travelEnd = travelStart + reaction.travelMs;
        const pressEnd = travelEnd + PRESS_MS;
        const end = pressEnd + RETURN_MS;

        if (elapsed > end) {
          reactionRef.current = null;
          squashRef.current = now;
        } else {
          const rx = reaction.rect.left + reaction.rect.width / 2 - charSize * 0.435;
          const ry = reaction.rect.top - charSize * 0.935 - 3 - scrollY;
          facingRef.current = rx < x - 2 ? -1 : 1;
          immediate = true;

          let blend = 0;
          if (elapsed < travelStart) {
            // anticipation: coiled, not yet moving
            nextPose = "run";
          } else if (elapsed < travelEnd) {
            blend = smootherStep((elapsed - travelStart) / Math.max(1, reaction.travelMs));
            nextPose = "run";
          } else if (elapsed < pressEnd) {
            blend = 1;
            nextPose = "press";
            if (!reaction.pulsed) {
              reaction.pulsed = true;
              squashRef.current = now;
            }
          } else {
            blend = 1 - easeInOut((elapsed - pressEnd) / RETURN_MS);
            nextPose = "walk";
          }

          x += (rx - x) * blend;
          y += (ry - y) * blend;
        }
      }

      // Visitors can lift him, carry him anywhere in the viewport and fling
      // him. The overlay itself remains pointer-events:none; no controls move.
      const drag = dragRef.current;
      const tossed = throwRef.current;
      if (drag) {
        x = drag.x; y = drag.y;
        motion.x = x; motion.y = y;
        if (play.active) {
          // Carrying him does not end the game: he keeps the controls in hand.
          play.x = x;
          play.y = y;
          play.phase = "ground";
          play.support = null;
          play.vx = 0;
          play.vy = 0;
          play.chute = false;
          play.groundY = Math.max(6, window.innerHeight - charSize - 6);
          play.lastInput = now;
        }
        facingRef.current = drag.vx < -80 ? -1 : drag.vx > 80 ? 1 : facingRef.current;
        nextPose = "grab";
        immediate = true;
      } else if (tossed) {
        const seconds = Math.min(0.05, Math.max(0.001, (now - tossed.lastAt) / 1000));
        tossed.lastAt = now;
        tossed.vy += 980 * seconds;
        tossed.vx *= Math.pow(0.975, seconds * 60);
        tossed.vy *= Math.pow(0.991, seconds * 60);
        const previousFeet = tossed.y + charSize * 0.935;
        tossed.x += tossed.vx * seconds;
        tossed.y += tossed.vy * seconds;

        // A landing can be on a real illustrated panel, not only the edge
        // of the browser window. Read the cached measured rectangles; do not
        // query or change layout on each animation frame.
        if (tossed.vy > 75 && now - tossed.collisionAt > 160) {
          for (const stop of stops) {
            if (!stop.pulseRect) continue;
            const surface = stop.pulseRect;
            const top = surface.top - scrollY;
            const foot = tossed.y + charSize * 0.935;
            const centre = tossed.x + charSize * 0.435;
            if (top > 10 && top < window.innerHeight - 10 &&
                centre > surface.left + 3 && centre < surface.left + surface.width - 3 &&
                previousFeet <= top && foot >= top) {
              tossed.y = top - charSize * 0.935;
              tossed.vy *= -0.48;
              tossed.vx *= 0.84;
              tossed.collisionAt = now;
              squashRef.current = now;
              addPulse(surface);
              break;
            }
          }
        }

        const width = charSize * 0.87;
        const limitX = Math.max(5, window.innerWidth - width - 5);
        const limitY = Math.max(5, window.innerHeight - charSize - 5);
        let hit = false;
        if (tossed.x < 5 || tossed.x > limitX) {
          tossed.x = Math.max(5, Math.min(limitX, tossed.x));
          tossed.vx *= -0.52;
          hit = true;
        }
        if (tossed.y < 5 || tossed.y > limitY) {
          tossed.y = Math.max(5, Math.min(limitY, tossed.y));
          tossed.vy *= -0.48;
          hit = true;
        }
        if (hit && now - tossed.collisionAt > 150) {
          squashRef.current = now;
          tossed.collisionAt = now;
        }

        x = tossed.x; y = tossed.y;
        motion.x = x; motion.y = y;
        if (play.active) {
          // A toss keeps him in play: he lands from it and carries on.
          play.x = x;
          play.y = y;
          play.phase = "fly";
          play.support = null;
          play.perch = null;
          play.chute = false;
          play.fellAt = 0;
          play.vx = tossed.vx * 0.5;
          play.vy = tossed.vy * 0.5;
          play.groundY = Math.max(6, window.innerHeight - charSize - 6);
          play.lastInput = now;
        }
        if (Math.abs(tossed.vx) > 80) facingRef.current = tossed.vx < 0 ? -1 : 1;
        nextPose = "toss";
        immediate = true;

        // After a satisfying, bounded flight, rejoin the *current* journey.
        // The regular damped chase moves him back without an abrupt teleport.
        if (now - tossed.at > 1100 ||
            (now - tossed.at > 540 && Math.hypot(tossed.vx, tossed.vy) < 100)) {
          throwRef.current = null;
          squashRef.current = now;
        }
      } else if (!reactionRef.current && now < tickleRef.current.until) {
        nextPose = "tickle";
        immediate = true;
      }

      // ---- resting on something real: he reaches out and touches it --------
      // Diagrams, cards and buttons are physical to him: while he is parked on
      // one, he taps its parts in turn, and each part answers with a highlight.
      if (!play.active && !reactionRef.current && !dragRef.current && !throwRef.current &&
          !movingBackwards && speed < 90) {
        const stop = stops[sample.index];
        const touch = touchRef.current;
        if (stop && touch.key !== stop.key) {
          touch.key = stop.key;
          touch.index = -1;
          touch.next = now + 420;
          touch.done = false;
        }
        if (stop?.touches?.length && !touch.done) {
          if (now >= touch.next) {
            touch.index += 1;
            if (touch.index < stop.touches.length) {
              const target = stop.touches[touch.index];
              const box = target?.isConnected ? target.getBoundingClientRect() : null;
              if (box && box.width && box.bottom > 0 && box.top < window.innerHeight) {
                facingRef.current = box.left + box.width / 2 < x + charSize * 0.435 ? -1 : 1;
                addPulse(target);
                squashRef.current = now;
                squashDepthRef.current = 0.9;
              }
              touch.next = now + 760;
            } else {
              touch.done = true;
            }
            nextPose = "tap";
            immediate = true;
          } else if (now > touch.next - 320) {
            nextPose = "tap";
            immediate = true;
          }
        }
      }

      // Pointer resting on a control: he turns to it, then settles back.
      // Only while standing still and not being tickled.
      const hover = hoverRef.current;
      if (hover && !hover.walk && !reactionRef.current && nextPose !== "tickle" && speed < 60 && !play.active) {
        facingRef.current = hover.x < x ? -1 : 1;
      }

      // ---- presence ------------------------------------------------------
      // While he is being played he steps forward a little, so he still reads
      // as a character near the edge of the window.
      const scaleTarget = play.active ? (play.phase === "fly" ? FLY_SCALE : PLAY_SCALE) : 1;
      scaleRef.current = damp(scaleRef.current, scaleTarget, 190, dt);
      const scaleNow = Math.abs(scaleRef.current - scaleTarget) < 0.002
        ? scaleTarget : scaleRef.current;

      // ---- lean ----------------------------------------------------------
      const leanTarget = dragRef.current ? leanFor(dragRef.current.vx) :
        throwRef.current ? leanFor(throwRef.current.vx) : leanFor(reactionRef.current ? 0 : motion.vx);
      leanRef.current = damp(leanRef.current, leanTarget, 140, dt);
      if (play.active && play.phase === "fly") {
        // In the air he pitches with his climb or dive, not his stride.
        leanRef.current = damp(leanRef.current, Math.max(-22, Math.min(26, play.vy / 18)), 120, dt);
      }
      const lean = Math.abs(leanRef.current) < 0.05 ? 0 : leanRef.current;

      // ---- pose, behind a short dwell so nothing flickers -----------------
      if (nextPose !== poseRef.current) {
        if (immediate) {
          poseRef.current = nextPose;
          candidateRef.current = { pose: nextPose, at: now };
          setPose(nextPose);
        } else if (candidateRef.current.pose !== nextPose) {
          candidateRef.current = { pose: nextPose, at: now };
        } else if (now - candidateRef.current.at >= POSE_DWELL) {
          poseRef.current = nextPose;
          setPose(nextPose);
        }
      } else {
        candidateRef.current = { pose: nextPose, at: now };
      }

      // ---- contact on arrival at a stop -----------------------------------
      if (!play.active && sample.index !== indexRef.current) {
        const stop = stops[sample.index];
        if (!movingBackwards && !reactionRef.current && now - lastPressRef.current > 1200 &&
            stop?.pulse && stop.pulseRect && !firedRef.current.has(stop.key)) {
          firedRef.current.add(stop.key);
          addPulse(stop.pulseRect);
          squashRef.current = now;
          // The bigger the hop, the deeper he lands: the arc is what he feels.
          squashDepthRef.current = stop.impact || 1;
        }
        indexRef.current = sample.index;
      }

      // ---- landing weight -------------------------------------------------
      let squash = 1;
      if (squashRef.current) {
        const since = now - squashRef.current;
        const depth = squashDepthRef.current;
        const duration = SQUASH_MS * (0.88 + depth * 0.26);
        if (since < duration) squash = squashPulse(since, duration, 0.048 * depth);
        else squashRef.current = 0;
      }
      if (reactionRef.current && now - reactionRef.current.start < ANTICIPATE_MS) {
        squash = 0.966;
      }
      if (Math.abs(squash - (node._squash ?? 1)) > 0.002) {
        node.style.setProperty("--sm-sqy", squash.toFixed(3));
        node.style.setProperty("--sm-sqx", (1 + (1 - squash) * 0.8).toFixed(3));
        node._squash = squash;
      }

      // ---- quiet life while standing --------------------------------------
      const upcoming = stops[Math.min(stops.length - 1, sample.index + 1)];
      const direction = upcoming && upcoming.x < x ? -1 : 1;
      const glance = poseRef.current === "idle" ? glanceAngle(now, direction) : 0;
      if (Math.abs(glance - glanceRef.current) > 0.4) {
        node.style.setProperty("--sm-glance", `${glance.toFixed(1)}deg`);
        glanceRef.current = glance;
      }

      // ---- stride pace follows ground speed -------------------------------
      const cycle = gaitCycle(speed);
      const amplitude = gaitAmplitude(speed);
      const gait = gaitRef.current;
      if (
        now - gait.at > 140 &&
        (Math.abs(cycle - gait.cycle) > 20 || Math.abs(amplitude - gait.amp) > 0.05)
      ) {
        node.style.setProperty("--sm-cycle", `${Math.round(cycle)}ms`);
        node.style.setProperty("--sm-amp", amplitude.toFixed(2));
        gaitRef.current = { at: now, cycle, amp: amplitude };
      }

      // ---- one sub-pixel transform write ----------------------------------
      const facing = facingRef.current;
      if (facing !== node._facing) node.style.setProperty("--sm-face", String(facing));
      if (
        Math.abs(x - (node._x ?? Number.NaN)) > 0.02 ||
        Math.abs(y - (node._y ?? Number.NaN)) > 0.02 ||
        Math.abs(lean - (node._lean ?? Number.NaN)) > 0.05 ||
        Math.abs(scaleNow - (node._scale ?? Number.NaN)) > 0.01 ||
        facing !== node._facing ||
        node._x === undefined
      ) {
        node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${lean.toFixed(2)}deg) scale(${scaleNow.toFixed(3)}) scaleX(${facing})`;
        node._x = x;
        node._y = y;
        node._lean = lean;
        node._scale = scaleNow;
        node._facing = facing;
      }
    };

    frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", measure);
      if (observer) observer.disconnect();
    };
  }, [ready, measure, addPulse, endPlay]);

  const togglePaused = useCallback(() => {
    setPaused((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return {
    ready, size, pose, pulses, paused, playing, returning, notice, jumpTip,
    togglePaused, togglePlay, press, figureRef, pulseLayerRef, shadowRef,
  };
}