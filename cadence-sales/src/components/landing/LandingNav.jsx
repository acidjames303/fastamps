import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const LINKS = [
  { label: "Product", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ink = "text-foreground";
  const sub = "text-muted-foreground hover:text-foreground";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "bg-background/85 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link
          to="/"
          className={`font-display text-lg tracking-tight font-semibold ${ink} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded`}
          onClick={() => setOpen(false)}
        >
          Cadence<span className="text-emerald-500">.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded ${sub}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Currently in ${theme === "dark" ? "night" : "day"} mode — click to switch`}
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-indigo-300" style={{ filter: "drop-shadow(0 0 5px rgba(165,180,252,0.9))" }} />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.9))" }} />
            )}
          </button>
          <Link
            to="/app"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Go Cadence
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-indigo-300" style={{ filter: "drop-shadow(0 0 5px rgba(165,180,252,0.9))" }} />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.9))" }} />
            )}
          </button>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-nav" className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <nav className="px-5 py-4 flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/app"
              className="mt-2 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              onClick={() => setOpen(false)}
            >
              Go Cadence
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}