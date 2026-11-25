import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Smartphone } from "lucide-react";

export default function MobileCTA() {
  const appUrl = typeof window !== "undefined"
    ? window.location.origin + "/app"
    : "https://evasive-dial-flow-go.base44.app/app";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    appUrl
  )}&color=0f172a&bgcolor=ffffff&margin=0`;

  return (
    <section className="bg-card py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Take Cadence anywhere
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Go Cadence on your phone or desktop and keep the same calling workflow with you.
              Runs in any browser and installs as a progressive web app on your device.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/app"
                className="group inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-7 py-3.5 rounded-full transition-colors shadow-lg shadow-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Go Cadence
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="w-4 h-4" />
                Or scan the code to open on mobile
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="rounded-3xl bg-white p-4 shadow-2xl shadow-black/20">
              <img src={qrSrc} alt="QR code linking to the Cadence app" width="200" height="200" className="w-48 h-48" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Opens Cadence on this device</p>
          </div>
        </div>
      </div>
    </section>
  );
}