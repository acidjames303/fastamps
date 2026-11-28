import React from "react";
import { Image } from "@/components/ui/image";

// The C is transparent; the green dot's navy surround notches its lower arm.
const BRAND_MARK =
  "https://base44.app/api/apps/6a7338f6106b1962aa31c00a/files/mp/public/6a7338f6106b1962aa31c00a/5606003d7bbef2bc951b6b144bb5e90e_cadence-transparent-notch-v5.svg"; // pragma: allowlist secret

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Image
            src={BRAND_MARK}
            alt="Cadence"
            className="inline-block w-14 h-14 rounded-xl mb-4 shadow-sm"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
        <p className="text-center text-xs text-muted-foreground/70 mt-8">
          Designed by{" "}
          <a
            href="https://smartfunction.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            © SMARTFUNCTION 2026
          </a>
        </p>
      </div>
    </div>
  );
}
