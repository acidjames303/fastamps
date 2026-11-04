import React from "react";
import SoftGlowLogo from "@/components/SoftGlowLogo";
import "./AuthLayout.css";

function Logo({ className = "" }) {
  return <SoftGlowLogo className={`fa-auth-logo ${className}`} variant="hero" />;
}

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="fa-auth-root">
      <div className="fa-auth-shell">
        <aside className="fa-auth-brand" aria-label="FastAmps Connect">
          <div className="fa-auth-brand-inner">
            <Logo className="fa-auth-desktop-logo" />
            <div className="fa-auth-product-name">FASTAMPS <span>CONNECT</span></div>
            <h2>THE NETWORK<br />THAT PAYS</h2>
            <p className="fa-auth-tagline">Install <span aria-hidden="true">·</span> Register <span aria-hidden="true">·</span> Get rewarded</p>
            <div className="fa-auth-brand-rule" />
            <p className="fa-auth-brand-description">Register installations, track your progress and earn eligible rewards.</p>
          </div>
          <div className="fa-auth-brand-address">fastamps.com</div>
        </aside>

        <main className="fa-auth-main">
          <div className="fa-auth-mobile-heading">
            <Logo />
            <div className="fa-auth-product-name">FASTAMPS <span>CONNECT</span></div>
            <div className="fa-auth-mobile-tagline">THE NETWORK THAT PAYS</div>
          </div>
          <section className="fa-auth-card" aria-label={title}>
            <div className="fa-auth-card-kicker">FASTAMPS CONNECT</div>
            <h1>{title}</h1>
            {subtitle && <p className="fa-auth-subtitle">{subtitle}</p>}
            <div className="fa-auth-form-content">{children}</div>
            {footer && <div className="fa-auth-card-footer">{footer}</div>}
          </section>
          <p className="fa-auth-legal">Install · Register · Get rewarded</p>
        </main>
      </div>
    </div>
  );
}
