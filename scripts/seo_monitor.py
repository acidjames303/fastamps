#!/usr/bin/env python3
"""Live SEO monitor for smartfunction.io (Base44)."""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any
from xml.etree import ElementTree as ET

BASE = "https://smartfunction.io"
PRIVATE_PATH_HINTS = (
    "/admin",
    "/login",
    "/register",
    "/mfa",
    "/forgot-password",
    "/reset-password",
)
PUBLIC_PATHS = [
    "/",
    "/about",
    "/approach",
    "/contact",
    "/services",
    "/work",
    "/insights",
    "/playground",
    "/privacy",
    "/cookies",
]
BOILERPLATE_DESC = re.compile(
    r"on SMARTFUNCTION\. A premium digital agency platform", re.I
)
CTX = ssl.create_default_context()
UA = "SmartFunctionSEOMonitor/1.0 (+https://github.com/acidjames303/fastamps)"


@dataclass
class Finding:
    severity: str
    code: str
    message: str
    url: str | None = None


@dataclass
class PageReport:
    path: str
    status: int | None
    title: str | None = None
    description: str | None = None
    robots: str | None = None
    canonical: str | None = None
    h1: list[str] = field(default_factory=list)
    json_ld_types: list[str] = field(default_factory=list)
    word_count: int = 0
    issues: list[str] = field(default_factory=list)


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title_parts: list[str] = []
        self._in_title = False
        self.metas: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.h1_parts: list[str] = []
        self._in_h1 = False
        self.json_ld: list[str] = []
        self._in_ld = False
        self._ld_buf: list[str] = []
        self.text_parts: list[str] = []
        self._skip_text = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        ad = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            self.metas.append(ad)
        elif tag == "link":
            self.links.append(ad)
        elif tag == "h1":
            self._in_h1 = True
            self.h1_parts.append("")
        elif tag == "script" and ad.get("type", "").lower() == "application/ld+json":
            self._in_ld = True
            self._ld_buf = []
            self._skip_text = True
        elif tag in {"script", "style", "noscript"}:
            self._skip_text = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
        elif tag == "script" and self._in_ld:
            self._in_ld = False
            self.json_ld.append("".join(self._ld_buf))
            self._skip_text = False
        elif tag in {"script", "style", "noscript"}:
            self._skip_text = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._in_h1 and self.h1_parts:
            self.h1_parts[-1] += data
        if self._in_ld:
            self._ld_buf.append(data)
        elif not self._skip_text:
            self.text_parts.append(data)


def fetch(url: str, timeout: int = 25) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, body, resp.geturl()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        return e.code, body, url


def meta_content(metas: list[dict[str, str]], name: str | None = None, prop: str | None = None) -> str | None:
    for m in metas:
        if name and m.get("name", "").lower() == name.lower():
            return m.get("content") or None
        if prop and m.get("property", "").lower() == prop.lower():
            return m.get("content") or None
    return None


def link_href(links: list[dict[str, str]], rel: str) -> str | None:
    for link in links:
        if link.get("rel", "").lower() == rel.lower():
            return link.get("href") or None
    return None


def ld_types(blocks: list[str]) -> list[str]:
    out: list[str] = []
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and "@type" in item:
                t = item["@type"]
                out.append(t if isinstance(t, str) else json.dumps(t))
    return out


def analyse_page(path: str) -> PageReport:
    status, html, _ = fetch(BASE + path)
    report = PageReport(path=path, status=status)
    if status != 200 or not html:
        report.issues.append(f"HTTP {status}")
        return report
    parser = MetaParser()
    parser.feed(html)
    report.title = "".join(parser.title_parts).strip() or None
    report.description = meta_content(parser.metas, name="description")
    report.robots = meta_content(parser.metas, name="robots")
    report.canonical = link_href(parser.links, "canonical")
    report.h1 = [h.strip() for h in parser.h1_parts if h.strip()]
    report.json_ld_types = ld_types(parser.json_ld)
    text = re.sub(r"\s+", " ", "".join(parser.text_parts)).strip()
    report.word_count = len(text.split())

    if not report.title:
        report.issues.append("missing_title")
    if not report.description:
        report.issues.append("missing_description")
    elif BOILERPLATE_DESC.search(report.description):
        report.issues.append("boilerplate_description")
    if not report.canonical:
        report.issues.append("missing_canonical")
    if not report.h1:
        report.issues.append("missing_h1")
    elif len(report.h1) > 1:
        report.issues.append("multiple_h1")
    if path in {"/privacy", "/cookies"}:
        if not report.robots or "noindex" not in report.robots.lower():
            report.issues.append("expected_noindex")
    if path.startswith(PRIVATE_PATH_HINTS) or path in {
        "/login",
        "/register",
        "/mfa",
        "/forgot-password",
        "/reset-password",
        "/admin",
    }:
        if not report.robots or "noindex" not in (report.robots or "").lower():
            report.issues.append("private_page_indexable")
    return report


def parse_sitemap() -> list[str]:
    status, body, _ = fetch(BASE + "/sitemap.xml")
    if status != 200:
        return []
    urls: list[str] = []
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return re.findall(r"<loc>(.*?)</loc>", body)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    for loc in root.findall(".//sm:loc", ns):
        if loc.text:
            urls.append(loc.text.strip())
    if not urls:
        urls = re.findall(r"<loc>(.*?)</loc>", body)
    return urls


def score_report(findings: list[Finding], pages: list[PageReport], sitemap: list[str]) -> dict[str, int]:
    technical = 100
    index_hygiene = 100
    onpage = 100
    schema = 100
    content = 100

    private_in_sitemap = [u for u in sitemap if any(h in u for h in PRIVATE_PATH_HINTS)]
    if private_in_sitemap:
        index_hygiene -= min(60, 10 * len(private_in_sitemap))
    boiler = sum(1 for p in pages if "boilerplate_description" in p.issues)
    if boiler:
        onpage -= min(50, 8 * boiler)
    missing_meta = sum(
        1
        for p in pages
        if p.path in PUBLIC_PATHS
        and p.path not in {"/privacy", "/cookies"}
        and ("missing_description" in p.issues or "missing_title" in p.issues)
    )
    onpage -= min(30, 6 * missing_meta)

    home = next((p for p in pages if p.path == "/"), None)
    if home and "Organization" not in home.json_ld_types:
        schema -= 20
    if home and "WebSite" not in home.json_ld_types:
        schema -= 15
    insights = next((p for p in pages if p.path == "/insights"), None)
    if insights and insights.word_count < 400:
        content -= 35
    if any(f.code == "llms_lists_private" for f in findings):
        index_hygiene -= 15
        content -= 10

    technical = max(0, technical - 5 * sum(1 for f in findings if f.severity == "technical"))
    return {
        "technical": max(0, technical),
        "index_hygiene": max(0, index_hygiene),
        "onpage": max(0, onpage),
        "schema": max(0, schema),
        "content_geo": max(0, content),
        "overall": int(
            round(
                (
                    max(0, technical)
                    + max(0, index_hygiene)
                    + max(0, onpage)
                    + max(0, schema)
                    + max(0, content)
                )
                / 5
            )
        ),
    }


def run() -> dict[str, Any]:
    findings: list[Finding] = []
    sitemap = parse_sitemap()
    private_in_sitemap = [u for u in sitemap if any(h in u for h in PRIVATE_PATH_HINTS)]
    for url in private_in_sitemap:
        findings.append(
            Finding("critical", "private_in_sitemap", "Private/auth URL listed in sitemap.xml", url)
        )

    status, robots, _ = fetch(BASE + "/robots.txt")
    if status != 200 or "Sitemap:" not in robots:
        findings.append(Finding("high", "robots_missing_sitemap", "robots.txt missing or has no Sitemap", BASE + "/robots.txt"))

    status, llms, _ = fetch(BASE + "/llms.txt")
    if status == 200:
        if any(h in llms for h in ("Admin", "/login", "/register", "Forgot Password", "Mfa")):
            findings.append(
                Finding("critical", "llms_lists_private", "llms.txt lists private/admin/auth pages", BASE + "/llms.txt")
            )
    else:
        findings.append(Finding("medium", "llms_missing", "llms.txt not reachable", BASE + "/llms.txt"))

    paths = list(dict.fromkeys(PUBLIC_PATHS + ["/login", "/admin", "/register"]))
    pages = [analyse_page(p) for p in paths]
    for page in pages:
        for issue in page.issues:
            sev = "critical" if issue in {"private_page_indexable", "boilerplate_description"} else "medium"
            if issue == "boilerplate_description":
                findings.append(
                    Finding(sev, issue, "Template Base44 meta description still in use", BASE + page.path)
                )
            elif issue == "private_page_indexable":
                findings.append(
                    Finding("critical", issue, "Private page is missing noindex", BASE + page.path)
                )

    scores = score_report(findings, pages, sitemap)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": BASE,
        "scores": scores,
        "sitemap_url_count": len(sitemap),
        "sitemap_private_urls": private_in_sitemap,
        "findings": [asdict(f) for f in findings],
        "pages": [asdict(p) for p in pages],
    }


def to_markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# SmartFunction SEO monitor — {report['generated_at']}",
        "",
        f"Overall score: **{report['scores']['overall']}/100**",
        "",
        "| Area | Score |",
        "|------|------:|",
    ]
    for k, v in report["scores"].items():
        if k == "overall":
            continue
        lines.append(f"| {k} | {v} |")
    lines += ["", "## Findings", ""]
    if not report["findings"]:
        lines.append("No findings.")
    for f in report["findings"]:
        lines.append(f"- **{f['severity']}** `{f['code']}` — {f['message']}" + (f" ({f['url']})" if f.get("url") else ""))
    lines += ["", "## Pages", ""]
    lines.append("| Path | Status | Title | Issues |")
    lines.append("|------|-------:|-------|--------|")
    for p in report["pages"]:
        title = (p.get("title") or "")[:48]
        issues = ", ".join(p.get("issues") or []) or "—"
        lines.append(f"| {p['path']} | {p.get('status')} | {title} | {issues} |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Monitor smartfunction.io SEO health")
    parser.add_argument("--json", dest="json_path", help="Write JSON report path")
    parser.add_argument("--md", dest="md_path", help="Write Markdown report path")
    parser.add_argument("--print", dest="do_print", action="store_true", help="Print markdown to stdout")
    args = parser.parse_args(argv)

    report = run()
    md = to_markdown(report)
    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
            fh.write("\n")
    if args.md_path:
        with open(args.md_path, "w", encoding="utf-8") as fh:
            fh.write(md)
    if args.do_print or not (args.json_path or args.md_path):
        print(md)
    print(
        f"seo_monitor: overall={report['scores']['overall']} findings={len(report['findings'])}",
        file=sys.stderr,
    )
    # Non-zero if critical findings remain — useful for CI awareness
    if any(f["severity"] == "critical" for f in report["findings"]):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
