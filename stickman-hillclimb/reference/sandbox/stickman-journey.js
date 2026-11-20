/**
 * The stickman journey controller's geometry.
 *
 * Everything here is read-only measurement of the real page: the character is
 * positioned from the rendered boxes of existing homepage elements. Nothing in
 * this module writes layout, and no element is moved to make the animation fit.
 */

import { arcOffset, liftImpact } from "@/lib/stickman-motion";

export const FIGURE_ASPECT = 0.87; // width / height of the figure box
const FEET = 0.935; // where the feet sit inside the figure box (0–1)

// How much of the gap between two stops he actually leaves the surface for.
const LIFT_FACTOR = {
  walk: 0.85,
  run: 1,
  jump: 1.45,
  swing: 1.2,
  fall: 0.6,
  slide: 0.4,
  parachute: 0,
};

const readRect = (element) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    // The element travels with the rectangle so a contact highlight can be
    // measured live, at the moment it fires, instead of trusting a cached box.
    el: element,
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    right: rect.right + window.scrollX,
    bottom: rect.bottom + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
};

const anchor = (name) => readRect(document.querySelector(`[data-sm-anchor="${name}"]`));

const control = (name) =>
  readRect(
    document.querySelector(`[data-sm-press="${name}"][aria-selected="true"]`) ||
      document.querySelector(`[data-sm-press="${name}"][aria-pressed="true"]`) ||
      document.querySelector(`[data-sm-press="${name}"]`),
  );

/**
 * A short choreography for the supporting pages. Each entry is an anchor the
 * page really renders and the way he arrives at it, so nothing is invented and
 * no wrapper is added for the animation.
 */
const PAGE_STOPS = {
  "/services": [
    ["page-hero", "wave"],
    ["services-preview", "land"],
    ["service", "press"],
    ["diagnostic", "land"],
    ["engagement", "walk"],
    ["cta-action", "hold"],
  ],
  "/approach": [
    ["page-hero", "wave"],
    ["bottleneck", "land"],
    ["process-flow", "walk"],
    ["transformation", "land"],
    ["principles", "walk"],
    ["cta-action", "hold"],
  ],
  "/about": [
    ["page-hero", "wave"],
    ["about-principle", "read"],
    ["about-founder", "land"],
    ["about-experience", "walk"],
    ["cta-action", "hold"],
  ],
  "/playground": [
    ["page-hero", "wave"],
    ["playground-templates", "walk"],
    ["playground-canvas", "land"],
    ["make-smarter", "press"],
  ],
};

/**
 * Builds the ordered list of stops in document coordinates.
 * Each stop is where the character stands, what he is doing when he arrives,
 * which pose carries him there, and whether the surface should pulse.
 */
export function buildJourney({ vw, vh, size, page }) {
  const H = size;
  const W = size * FIGURE_ASPECT;
  const feet = H * FEET;
  const compact = vw < 640;
  const stops = [];

  const clampX = (x) => Math.min(Math.max(x, 6), Math.max(vw - W - 6, 6));

  const push = (key, x, y, pose, opts = {}) => {
    if (opts.compact === false && compact) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    stops.push({
      key,
      x: Math.round(clampX(x)),
      y: Math.round(y),
      pose,
      move: opts.move || "walk",
      pulse: Boolean(opts.pulse),
      pulseRect: opts.pulseRect || null,
      // The height of the hop that brings him here. Real travel is projectile
      // travel: he leaves the surface and gravity drops him onto the next one.
      lift: opts.lift,
      // Real elements he can reach out and touch while resting here.
      touches: opts.touches || null,
    });
  };

  // Anything marked as a node inside a diagram or card he can physically touch.
  const touchTargets = (element, limit = 5) =>
    element ? Array.from(element.querySelectorAll("[data-sm-node]")).slice(0, limit) : null;

  // The supporting pages follow the same language of stops, anchored to the
  // sections they actually render.
  const script = PAGE_STOPS[page];

  if (script) {
    script.forEach(([name, mode], index) => {
      const rect = anchor(name) || control(name);
      if (!rect) return;
      const key = `${page}-${index}-${name}`;

      // Beside a heading, never across its words.
      if (mode === "wave" || mode === "read" || mode === "hang") {
        const heading = rect.el?.querySelector?.("h1, h2, h3");
        const from = (heading && readRect(heading)) || rect;
        const sideX = from.right + W + 12 < vw ? from.right + 8 : from.left - W - 8;
        push(key, sideX, from.top + Math.min(from.height * 0.5, 42) - H * 0.3, mode, {
          move: index === 0 ? "walk" : "swing",
        });
        return;
      }

      if (mode === "press") {
        push(key, rect.left - W - 8, rect.top + rect.height / 2 - H * 0.55, "press", {
          move: "run",
          pulse: true,
          pulseRect: rect,
          touches: rect.el ? [rect.el] : null,
        });
        return;
      }

      if (mode === "hold") {
        push(key, rect.left - W - 10, rect.top + rect.height * 0.14, "hold", {
          move: "walk",
          pulse: true,
          pulseRect: rect,
          touches: rect.el ? [rect.el] : null,
        });
        return;
      }

      // Standing on a real section's top edge, then walking along it.
      const across = mode === "walk";
      push(
        key,
        across ? rect.right - W * 1.25 : rect.left + rect.width * 0.28,
        rect.top - feet - 5,
        across ? "walk" : "land",
        {
          move: index === 0 ? "walk" : "fall",
          pulse: !across,
          pulseRect: rect,
          touches: across ? touchTargets(rect.el) : null,
        },
      );
    });
  } else if (document.querySelector("[data-sm-work-page]")) {
    // Work: ride the left page rail, step onto left-column previews only, stay
    // clear of alternating copy columns and the end CTA.
    const hero = anchor("page-hero");
    const intro = anchor("work-intro");
    const cards = Array.from(document.querySelectorAll('[data-sm-anchor="work-card"]'));
    const contentLeft = intro?.left ?? hero?.left ?? 48;
    const railX = clampX(Math.max(16, contentLeft - W - 14));
    // Narrow Work is full-bleed copy — one tucked wave at the top (scrolls
    // away). No multi-stop chase, or he would lerp through paragraphs.
    if (compact) {
      // Sit in the band under the sticky header — intro copy on mobile is
      // full-bleed and starts lower; a single stop here scrolls cleanly away.
      const nav = readRect(document.querySelector("header") || document.querySelector("nav"));
      const parkY = Math.round((nav?.bottom ?? 56) + 8);
      push("work-hello", clampX(8), parkY, "wave", { move: "walk" });
    } else {
      if (intro) {
        push("work-hello", railX, intro.top - feet - 8, "wave", { move: "walk" });
      } else if (hero) {
        push("work-hero", railX, hero.bottom - feet - 10, "wave", { move: "walk" });
      }
      let leftStops = 0;
      cards.forEach((cardEl, i) => {
        const card = readRect(cardEl);
        const image = readRect(cardEl.querySelector('[data-sm-anchor="work-image"]'));
        if (!card || !image) return;
        // Skip right-column previews — their copy sits in the left lane.
        if (image.left > vw * 0.42) return;
        const leftPad = Math.min(image.width * 0.16, 80);
        const rightPad = Math.min(image.width * 0.42, image.width - W - 8);
        // Stand inside the preview chrome so the figure is not sitting in the
        // disclaimer / eyebrow band above the frame.
        const inset = Math.min(34, Math.max(18, image.height * 0.06));
        const standY = image.top + inset;
        push(`work-${i}-rail`, railX, standY, "run", { move: "run" });
        push(
          `work-${i}-land`,
          clampX(image.left + leftPad),
          standY,
          "land",
          { move: leftStops === 0 ? "jump" : "run", pulse: true, pulseRect: image },
        );
        push(
          `work-${i}-walk`,
          clampX(image.left + Math.max(leftPad + W, rightPad)),
          standY,
          "walk",
          { move: "run", compact: false },
        );
        push(`work-${i}-rail-out`, railX, standY, "walk", { move: "run" });
        leftStops += 1;
      });
      const endCta = anchor("cta-action");
      if (endCta) {
        push("work-cta-rail", railX, endCta.top - feet - 12, "walk", { move: "walk" });
        push(
          "work-cta",
          clampX(endCta.left - W - 100),
          endCta.top - feet - 12,
          "hold",
          { move: "walk", pulse: true, pulseRect: endCta },
        );
      }
    }
  } else {
  const hero = anchor("hero-map");
  const copyHeading = anchor("home-copy-heading");
  const flow = anchor("human-flow");
  const preview = anchor("services-preview");
  const serviceTab = control("service");
  const builder = anchor("builder-flow");
  const visual = anchor("work-visual");
  const workHeading = anchor("home-work-heading");
  const projectTab = control("project");
  const track = anchor("process-track");
  const stage = control("stage");
  const founder = anchor("founder");
  const cta = anchor("cta-action");

  if (hero) {
    push("hero-wave", hero.left + hero.width * 0.62, hero.top - feet - 8, "wave", {
      move: "walk",
      pulse: true,
      pulseRect: hero,
    });
    push("hero-edge", hero.left - W * 0.12, hero.top - feet - 8, "walk", { move: "walk" });
    push("hero-slide", hero.left - W * 0.12, hero.bottom - H * 0.55, "slide", { move: "slide" });
  }

  if (copyHeading && vw >= 640) {
    // On the headline itself: he leans in and reads across the line.
    push(
      "copy-read",
      copyHeading.right + W + 14 < vw ? copyHeading.right + 10 : copyHeading.left - W - 10,
      copyHeading.top - feet - 2,
      "read",
      { move: "walk", lift: 12 },
    );
  }

  if (flow) {
    push("flow-land", flow.left + W * 0.2, flow.top - feet - 4, "land", {
      move: "fall",
      pulse: true,
      pulseRect: flow,
    });
    push("flow-walk", flow.right - W * 1.2, flow.top - feet - 4, "walk", {
      move: "walk",
      touches: touchTargets(flow.el),
    });
    push("flow-swing", flow.right + W * 0.25, flow.bottom - H * 0.6, "swing", { move: "swing" });
  }

  if (preview) {
    push("preview-land", preview.left + W * 0.3, preview.top - feet - 4, "land", {
      move: "fall",
      pulse: true,
      pulseRect: preview,
      touches: touchTargets(preview.el),
    });
    push("preview-walk", preview.right - W * 1.25, preview.top - feet - 4, "walk", { move: "walk" });
  }

  if (serviceTab) {
    push(
      "service-press",
      serviceTab.left - W - 8,
      serviceTab.top + serviceTab.height / 2 - H * 0.55,
      "press",
      { move: "run", pulse: true, pulseRect: serviceTab, touches: serviceTab.el ? [serviceTab.el] : null },
    );
  }

  if (builder) {
    push("builder-swing", builder.left + W * 0.1, builder.top - feet - 4, "swing", {
      move: "swing",
      compact: false,
    });
    push("builder-watch", builder.left + builder.width * 0.55, builder.top - feet - 2, "idle", {
      move: "walk",
      pulse: true,
      pulseRect: builder,
      touches: touchTargets(builder.el),
    });
    push("builder-slide", builder.right + W * 0.2, builder.bottom - H * 0.6, "slide", { move: "slide" });
  }

  if (workHeading && vw >= 640) {
    const sideX = workHeading.right + W + 10 < vw
      ? workHeading.right + 8 : workHeading.left - W - 8;
    push("home-text-swing", sideX,
      workHeading.top + Math.min(workHeading.height * 0.48, 34) - H * 0.28,
      "hang", { move: "swing" });
  }

  if (visual) {
    push("work-run", visual.left + W * 0.2, visual.top - feet - 6, "run", {
      move: "run",
      pulse: true,
      pulseRect: visual,
    });
    push("work-edge", visual.right - W * 1.2, visual.top - feet - 6, "walk", { move: "run", compact: false });
    push("work-slide", visual.right + W * 0.2, visual.bottom - H * 0.55, "slide", {
      move: "slide",
      compact: false,
    });
    push("work-jump", visual.right + W * 0.6, visual.bottom + H * 0.35, "jump", {
      move: "jump",
      compact: false,
    });
  }

  if (projectTab) {
    push("project-press", projectTab.left + projectTab.width * 0.55, projectTab.top - feet - 6, "press", {
      move: "fall",
      pulse: true,
      pulseRect: projectTab,
    });
  }

  if (track) {
    push("stage-land", track.left + W * 0.2, track.top - feet - H * 0.25, "land", {
      move: "fall",
      pulse: true,
      pulseRect: track,
    });
  }

  if (track && stage) {
    push("stage-walk", stage.left + stage.width * 0.35, track.top - feet - H * 0.25, "walk", {
      move: "walk",
      compact: false,
    });
    push(
      "stage-press",
      stage.left + stage.width * 0.5 - W * 0.5,
      track.top - feet - H * 0.35,
      "press",
      { move: "walk" },
    );
    push("stage-jump", stage.left + stage.width * 0.5 + W * 0.4, track.top + H * 0.15, "jump", {
      move: "jump",
    });
  }

  if (founder) {
    // The canopy opens high above the section, then drifts down across two
    // long stops, so the descent reads as a slow drop rather than a hop.
    push(
      "founder-chute-open",
      founder.left + founder.width * 0.34,
      founder.top - H * 7.4,
      "parachute",
      { move: "parachute", compact: false, lift: 0 },
    );
    push(
      "founder-chute-drift",
      founder.left + founder.width * 0.7,
      founder.top - H * 4.9,
      "parachute",
      { move: "parachute", compact: false, lift: 0 },
    );
    push("founder-chute", founder.left + founder.width * 0.52, founder.top - H * 2.6, "parachute", {
      move: "parachute",
      lift: 0,
    });
    push("founder-land", founder.left + founder.width * 0.55, founder.top - feet - 4, "land", {
      move: "fall",
      pulse: true,
      pulseRect: founder,
    });
    push("founder-stand", founder.left + founder.width * 0.55 + W * 0.9, founder.top - feet - 4, "read", {
      move: "walk",
      compact: false,
    });
  }

  if (cta) {
    push("cta-approach", cta.left - W - 46, cta.top - feet - 4, "walk", { move: "run", compact: false });
    push("cta-hold", cta.left - W - 56, cta.top + cta.height * 0.12, "hold", {
      move: "walk",
      pulse: true,
      pulseRect: cta,
      touches: cta.el ? [cta.el] : null,
    });
  }
  }

  // Each stop fires as it reaches ~55% of the viewport, but never earlier than
  // the previous one: early page-top scenes play out in the first few hundred
  // pixels of scroll instead of bunching up behind the starting position.
  const pivot = (vh || 800) * 0.55;
  let previousTrigger = -1;
  const withTriggers = stops.map((stop) => {
    const trigger = Math.max(0, Math.round(stop.y - pivot), previousTrigger + 80);
    previousTrigger = trigger;
    return { ...stop, trigger };
  });

  // Keep the final scene reachable: the journey is compressed a little if the
  // page cannot be scrolled far enough to reach the last stop naturally.
  const last = withTriggers[withTriggers.length - 1];
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - (vh || window.innerHeight) - 40);
  let timed = withTriggers;
  if (last && last.trigger > maxScroll && maxScroll > 200) {
    const scale = maxScroll / last.trigger;
    timed = withTriggers.map((stop) => ({ ...stop, trigger: Math.round(stop.trigger * scale) }));
  }

  // Every crossing gets a real hop: the gap he has to cover decides how far he
  // leaves the surface, and how hard gravity brings him back down on arrival.
  return timed.map((stop, index) => {
    if (Number.isFinite(stop.lift)) return { ...stop, impact: liftImpact(stop.lift) };
    const from = timed[index - 1] || stop;
    const gap = Math.hypot(stop.x - from.x, stop.y - from.y);
    const type = LIFT_FACTOR[stop.move] ?? 0.85;
    const reach = compact ? 0.11 : 0.15;
    const lift = Math.round(Math.min(compact ? 34 : 52, Math.max(7, gap * reach)) * type);
    return { ...stop, lift, impact: liftImpact(lift) };
  });
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Travelling back up the page, nothing may rise the way it fell. The canopy
// stays furled: he climbs instead, and rising arrivals become leaps.
const ASCENT_POSE = {
  parachute: "climb",
  fall: "jump",
  land: "jump",
  slide: "climb",
};

/**
 * Turns the scroll position into a position, a pose and a facing direction.
 * `ascending` marks upward travel, so the pose suits the direction of motion.
 */
export function sampleJourney(stops, scrollY, ascending = false) {
  if (!stops.length) return { x: 0, y: 0, pose: "idle", flip: 1, index: 0 };

  if (scrollY <= stops[0].trigger) {
    const first = stops[0];
    return { x: first.x, y: first.y, pose: first.pose, flip: 1, index: 0 };
  }

  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i];
    const to = stops[i + 1];
    const start = from.trigger;
    const end = Math.max(to.trigger, start + 40);

    if (scrollY < end || i === stops.length - 2) {
      const t = Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
      const eased = easeInOut(t);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      // Projectile travel, not a diagonal. He leaves the surface, gravity pulls
      // him through the arc, and the landing is where the vertical speed peaks.
      let x = from.x + dx * eased;
      let y = from.y + dy * eased + arcOffset(eased, to.lift || 0);
      if (to.move === "parachute" && !ascending) {
        x += Math.sin(Math.PI * 2 * eased) * 5 * Math.sin(Math.PI * eased);
      } else if (to.move === "slide") {
        // Align to the edge early, then descend along it.
        x = from.x + dx * easeInOut(Math.min(1, t * 1.5));
      }

      // Hold landing / pressing poses near the surface, rather than long
      // before reaching it. Long travels are spent visibly moving instead of
      // hovering in an arrival pose, so the path reads as one clean journey.
      const gap = Math.hypot(dx, dy);
      const travel = ascending ? ASCENT_POSE[to.move] || to.move : to.move;
      const arrival = ascending ? ASCENT_POSE[to.pose] || to.pose : to.pose;
      let pose;
      if (to.move === "parachute" && !ascending) pose = "parachute";
      else if (to.move === "jump" && t > 0.16 && t < 0.81) pose = "style-jump";
      else if (gap > 190 && t < 0.45) pose = "walk";
      else pose = t < 0.86 ? travel : arrival;

      return {
        x,
        y,
        pose,
        flip: dx < -2 ? -1 : 1,
        index: t < 0.94 ? i : i + 1,
        impact: to.impact || 0.8,
        lift: to.lift || 0,
      };
    }
  }

  const last = stops[stops.length - 1];
  return { x: last.x, y: last.y, pose: last.pose, flip: 1, index: stops.length - 1 };
}