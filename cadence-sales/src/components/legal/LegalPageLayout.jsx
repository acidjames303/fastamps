import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function LegalSection({ title, children }) {
  return (
    <section className="scroll-mt-24 border-t border-slate-200 pt-8 first:border-0 first:pt-0">
      <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <div className="mt-4 space-y-4 text-sm sm:text-base leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export function LegalTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold text-slate-800">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="min-w-44 px-4 py-3 align-top text-slate-600">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalPageLayout({ eyebrow = "Legal", title, summary, updated = "23 August 2026", children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="font-display text-lg font-semibold text-white">
            Cadence<span className="text-emerald-400">.</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Cadence
          </Link>
        </div>
      </header>

      <main>
        <div className="bg-slate-950">
          <div className="mx-auto max-w-4xl px-5 pb-16 pt-14 sm:pb-20 sm:pt-20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">{eyebrow}</p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">{summary}</p>
            <p className="mt-5 text-xs text-slate-500">Last updated: {updated}</p>
          </div>
        </div>

        <div className="mx-auto grid max-w-4xl gap-10 px-5 py-12 sm:py-16">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-8 text-sm text-slate-500">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/support-info" className="hover:text-slate-950">Support</Link>
            <Link to="/privacy" className="hover:text-slate-950">Privacy</Link>
            <Link to="/terms" className="hover:text-slate-950">Terms</Link>
            <Link to="/data-processing" className="hover:text-slate-950">Data Processing</Link>
          </div>
          <span className="text-xs text-slate-400">
            Designed by{" "}
            <a
              href="https://smartfunction.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-700 transition-colors"
            >
              © SMARTFUNCTION 2026
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}