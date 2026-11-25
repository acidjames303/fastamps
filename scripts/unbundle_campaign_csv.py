#!/usr/bin/env python3
"""One-off helper: turn a legacy Cadence campaign CSV (contacts joined with
newlines in a single company row) into the new one-row-per-person format.

New Cadence exports already emit this shape; use this only for older downloads.
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

NICKNAMES = {
    "ben": "benjamin",
    "benjamin": "ben",
    "tony": "anthony",
    "anthony": "tony",
    "nick": "nicholas",
    "nicholas": "nick",
    "chris": "christopher",
    "christopher": "chris",
    "mike": "michael",
    "michael": "mike",
    "pete": "peter",
    "peter": "pete",
    "steve": "steven",
    "steven": "steve",
    "dan": "daniel",
    "daniel": "dan",
    "andy": "andrew",
    "andrew": "andy",
    "phil": "philip",
    "philip": "phil",
    "will": "william",
    "william": "will",
}

OUT_HEADERS = [
    "Client",
    "Campaign",
    "Target list",
    "Company",
    "Website",
    "First name",
    "Last name",
    "Job title",
    "Personal email",
    "Company email",
    "Email status",
    "Email source",
    "Mobile",
    "Direct dial",
    "Switchboard",
    "Phone",
    "Phone type",
    "Phone status",
    "Phone source",
    "Evidence URL",
    "Review status",
    "Owner",
    "Last activity",
    "Next action",
    "Notes",
]


def split_lines(value: str) -> list[str]:
    return [x.strip() for x in (value or "").split("\n") if x.strip()]


def norm(token: str) -> str:
    return re.sub(r"[^a-z]", "", (token or "").lower())


def split_name(full: str) -> tuple[str, str]:
    value = re.sub(r"[\u2018\u2019\u02BC']", "'", full or "")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^(dr|mr|mrs|ms|miss|prof|sir|dame|lord|lady)\.?\s+", "", value, flags=re.I)
    parts = value.split()
    while len(parts) > 2 and parts[-1].replace(".", "").lower() in {
        "jr",
        "sr",
        "ii",
        "iii",
        "iv",
        "mbe",
        "obe",
        "cbe",
        "phd",
        "mba",
    }:
        parts.pop()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def tokens(full: str) -> list[str]:
    first, last = split_name(full)
    return [t for t in [norm(first), *[norm(p) for p in last.split()]] if t and t not in {"o", "de", "da", "van", "von"}]


def score_email(name: str, email: str) -> int:
    toks = tokens(name)
    if not toks:
        return 0
    first, *rest = toks
    last = rest[-1] if rest else ""
    local_raw = email.split("@")[0].lower()
    local = norm(local_raw)
    if not local:
        return 0
    score = 0
    if first and last and first in local and last in local:
        score = max(score, 6)
    if first and last and local == first[0] + last:
        score = max(score, 5)
    if first and rest and local == "".join(t[0] for t in toks):
        score = max(score, 5)
    if first and last and local == first[0] + last[0]:
        score = max(score, 4)
    if first and last and local_raw.startswith(first + ".") and (
        local_raw.endswith("." + last[0]) or local_raw == f"{first}.{last[0]}"
    ):
        score = max(score, 6)
    nick = NICKNAMES.get(first)
    if nick and nick in local and (not last or last in local):
        score = max(score, 5)
    if first and local == first:
        score = max(score, 3)
    if last and last in local and len(last) > 2:
        score = max(score, 3)
    return score


def assign_emails(names: list[str], emails: list[str]) -> dict[int, str]:
    pairs = []
    for i, name in enumerate(names):
        for j, email in enumerate(emails):
            s = score_email(name, email)
            if s:
                pairs.append((s, i, j))
    pairs.sort(reverse=True)
    used_n: set[int] = set()
    used_e: set[int] = set()
    mapping: dict[int, str] = {}
    for _, i, j in pairs:
        if i in used_n or j in used_e:
            continue
        used_n.add(i)
        used_e.add(j)
        mapping[i] = emails[j]
    return mapping


def convert(path: Path, dest: Path) -> int:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows_raw = list(csv.reader(handle))
    header = [h.lstrip("\ufeff").strip('"') for h in rows_raw[0]]
    rows = [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in rows_raw[1:]]
    out_rows = []
    for row in rows:
        names = split_lines(row.get("Contact name", ""))
        titles = split_lines(row.get("Job title", ""))
        emails = split_lines(row.get("Personal email", ""))
        company_emails = split_lines(row.get("Company email", ""))
        mobiles = split_lines(row.get("Mobile", ""))
        directs = split_lines(row.get("Direct dial", ""))
        switchboard = (row.get("Switchboard") or "").replace("\t", "").strip()
        status_by_email = {}
        for line in split_lines(row.get("Email status", "")):
            if ":" in line:
                status_by_email[line.split(":", 1)[0].strip().lower()] = line
        source_by_email = {}
        for line in split_lines(row.get("Email source", "")):
            if ":" in line:
                source_by_email.setdefault(line.split(":", 1)[0].strip().lower(), line)
        email_map = assign_emails(names, emails)
        people = names or [""]
        for i, name in enumerate(people):
            first, last = split_name(name) if name else ("", "")
            email = email_map.get(i, "")
            mobile = mobiles[i] if len(mobiles) == len(people) else ""
            direct = directs[i] if len(directs) == len(people) else (directs[0] if len(directs) == 1 and len(people) == 1 else "")
            phone = mobile or direct or switchboard
            phone_type = "Mobile" if mobile else ("Direct dial" if direct else ("Switchboard" if switchboard else ""))
            out_rows.append(
                [
                    row.get("Client", ""),
                    row.get("Campaign", ""),
                    row.get("Target list", ""),
                    row.get("Company", ""),
                    row.get("Website", ""),
                    first,
                    last,
                    titles[i] if i < len(titles) else "",
                    email,
                    company_emails[0] if company_emails else "",
                    status_by_email.get(email.lower(), ""),
                    source_by_email.get(email.lower(), ""),
                    mobile,
                    direct,
                    switchboard,
                    phone,
                    phone_type,
                    (row.get("Phone status") or "").replace("\n", "; "),
                    row.get("Phone source", ""),
                    row.get("Evidence URL", ""),
                    (row.get("Review status") or "").replace("\n", "; "),
                    row.get("Owner", ""),
                    row.get("Last activity", ""),
                    row.get("Next action", ""),
                    (row.get("Notes") or "").replace("\n", " ").strip(),
                ]
            )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\r\n")
        writer.writerow(OUT_HEADERS)
        writer.writerows(out_rows)
    return len(out_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_csv", type=Path)
    parser.add_argument("-o", "--output", type=Path, required=True)
    args = parser.parse_args()
    count = convert(args.input_csv, args.output)
    print(f"Wrote {count} contact rows to {args.output}")


if __name__ == "__main__":
    main()
