import React from "react";
import "@/styles/fastamps-glow.css";

/** Flat dark wordmark — soft bloom is applied in CSS, not baked into the file. */
export const FASTAMPS_LOGO_DARK_FLAT = "/fastamps-logo-dark-flat.png";

/**
 * Organic soft glow: blurred near + far duplicates behind a sharp logo.
 * @param {"hero" | "nav"} variant — hero for auth/loading, nav for compact header
 */
export default function SoftGlowLogo({
  className = "",
  variant = "hero",
  alt = "FastAmps — Simply Reliable",
}) {
  const src = FASTAMPS_LOGO_DARK_FLAT;
  const sizeClass = variant === "nav" ? "fa-glow-twopass--nav" : "";

  return (
    <span className={`fa-glow-twopass ${sizeClass} ${className}`.trim()}>
      <span className="fa-bloom-far" aria-hidden="true">
        <img src={src} alt="" />
      </span>
      <span className="fa-bloom-near" aria-hidden="true">
        <img src={src} alt="" />
      </span>
      <img className="fa-logo-sharp" src={src} alt={alt} />
    </span>
  );
}
