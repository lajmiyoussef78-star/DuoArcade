#!/usr/bin/env python3
"""
fetch_chkobba_cards.py

Downloads every file in https://commons.wikimedia.org/wiki/Category:Chkobba
and records the licence of each one separately.

    python scripts/fetch_chkobba_cards.py

Outputs into ./public/chkobba-cards/
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
CATEGORY = "Category:Chkobba"
# Served by Vite from /chkobba-cards/...
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "public", "chkobba-cards")

UA = "DuoArcadeChkobbaFetcher/1.0 (https://github.com/lajmiyoussef78-star/DuoArcade; contact: lajmiyoussef78-star@users.noreply.github.com)"

PERMISSIVE = {"cc0", "publicdomain", "pd"}


def api(**params):
    params.setdefault("format", "json")
    params.setdefault("action", "query")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def list_category(cat):
    files, cont = [], {}
    while True:
        data = api(list="categorymembers", cmtitle=cat,
                   cmtype="file", cmlimit="500", **cont)
        files += [m["title"] for m in data["query"]["categorymembers"]]
        if "continue" not in data:
            return files
        cont = data["continue"]


def file_info(titles):
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        data = api(titles="|".join(batch), prop="imageinfo",
                   iiprop="url|extmetadata")
        for page in data["query"]["pages"].values():
            info = page.get("imageinfo")
            if info:
                out[page["title"]] = info[0]
        time.sleep(0.2)
    return out


def plain(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    print(f"listing {CATEGORY} ...")
    titles = list_category(CATEGORY)
    print(f"  {len(titles)} files")

    info = file_info(titles)
    records, review = [], []

    for title in sorted(titles):
        meta = info.get(title)
        if not meta:
            review.append(f"{title}: no imageinfo returned")
            continue

        ext = meta.get("extmetadata", {})
        lic = (ext.get("LicenseShortName", {}).get("value") or "").strip()
        licid = (ext.get("License", {}).get("value") or "").strip().lower()
        author = plain(ext.get("Artist", {}).get("value")) or "unknown"
        licurl = (ext.get("LicenseUrl", {}).get("value") or "").strip()

        name = title.split(":", 1)[1]
        safe = name.replace(" ", "_")
        dest = os.path.join(OUTDIR, safe)

        if not os.path.exists(dest):
            req = urllib.request.Request(meta["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r, open(dest, "wb") as f:
                f.write(r.read())
            time.sleep(0.15)

        rec = {
            "file": safe,
            "title": title,
            "author": author,
            "license": lic or "UNKNOWN",
            "license_id": licid or "unknown",
            "license_url": licurl,
            "source": meta.get("descriptionurl", ""),
            "attribution_required": licid not in PERMISSIVE,
            "share_alike": "sa" in licid,
        }
        records.append(rec)

        if not lic:
            review.append(f"{title}: licence field empty — check the file page")

        flag = "free" if licid in PERMISSIVE else lic
        print(f"  {safe:34s} {flag}")

    with open(os.path.join(OUTDIR, "licenses.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)

    need = [r for r in records if r["attribution_required"]]
    with open(os.path.join(OUTDIR, "ATTRIBUTION.md"), "w", encoding="utf-8") as f:
        f.write("# Card artwork credits\n\n")
        if not need:
            f.write("All card files are public domain / CC0. "
                    "No attribution is legally required.\n")
        else:
            f.write("Card artwork from Wikimedia Commons. "
                    "Files below require credit under their licence.\n\n")
            for r in need:
                f.write(f"- **{r['file']}** — {r['author']}, "
                        f"[{r['license']}]({r['license_url']}) — "
                        f"[source]({r['source']})\n")
            if any(r["share_alike"] for r in need):
                f.write("\n> Share-alike applies: any file you MODIFY must be "
                        "redistributed under the same or a compatible licence. "
                        "Note in this file which ones you changed.\n")

    with open(os.path.join(OUTDIR, "REVIEW.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(review) if review
                else "Nothing flagged. Still spot-check a few file pages.\n")

    sa = sum(r["share_alike"] for r in records)
    free = sum(not r["attribution_required"] for r in records)
    print(f"\n{len(records)} files -> {OUTDIR}/")
    print(f"  {free} with no conditions, {sa} share-alike")
    if review:
        print(f"  {len(review)} need manual review — see REVIEW.txt")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.reason}")
