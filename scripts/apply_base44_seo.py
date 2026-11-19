#!/usr/bin/env python3
"""Apply prepared SEO settings to a Base44 app via the public API.

Requires:
  BASE44_APP_ID
  BASE44_API_KEY   (or BASE44_API_TOKEN)

Docs: https://docs.base44.com/api-reference/update-seo-settings
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
META_PATH = ROOT / "seo" / "base44" / "page-meta.json"
SETTINGS_PATH = ROOT / "seo" / "base44" / "seo-settings-payload.json"
API_BASE = os.environ.get("BASE44_API_BASE", "https://api.base44.com")


def load_payload() -> dict:
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    settings_doc = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    settings = settings_doc.get("settings", settings_doc)
    pages = {k: v for k, v in meta.get("pages", {}).items() if not k.startswith("_")}
    # Merge page overrides into settings.pages
    settings = dict(settings)
    settings["pages"] = pages
    return {"settings": settings}


def apply(payload: dict, dry_run: bool = False) -> int:
    app_id = os.environ.get("BASE44_APP_ID")
    token = os.environ.get("BASE44_API_KEY") or os.environ.get("BASE44_API_TOKEN")
    if not app_id or not token:
        print(
            "Missing BASE44_APP_ID and BASE44_API_KEY/BASE44_API_TOKEN.\n"
            "Add them as Cursor app secrets / env, then re-run.\n"
            "Until then, apply manually via seo/base44/DASHBOARD_CHECKLIST.md",
            file=sys.stderr,
        )
        return 1

    url = f"{API_BASE}/api/apps/{app_id}/seo/settings"
    body = json.dumps(payload).encode("utf-8")
    print(f"{'DRY-RUN ' if dry_run else ''}PATCH {url}")
    print(f"pages={len(payload['settings'].get('pages', {}))} schema_keys={list(payload['settings'])}")
    if dry_run:
        print(json.dumps(payload, indent=2)[:4000])
        return 0

    req = urllib.request.Request(
        url,
        data=body,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SmartFunctionSEOMonitor/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8", "replace")
            print(f"status={resp.status}")
            print(raw[:2000])
            return 0
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:2000]}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    payload = load_payload()
    return apply(payload, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
