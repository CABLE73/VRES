#!/usr/bin/env python3
"""Validate a fresh scan and write data/listings.json for the live Wix widget.

Usage:  python3 scripts/publish_listings.py NEW_RECORDS.json [--date YYYY-MM-DD]

NEW_RECORDS.json is a JSON array of records shaped like:
  {"type": "Duplex|Triplex|Fourplex", "units": 2-4, "address": str, "city": str,
   "state": "TX", "zip": "76116", "price": int, "sqft": int|null,
   "url": str, "note": str, "src": str}

Safety rules (so a bad scan never blanks the public page):
  * records missing address/city/state/price, or with a non-positive price, are dropped
  * duplicates (same address + zip) are collapsed, keeping the first
  * if the cleaned scan has fewer than 50% of the current listing count, nothing is written
    and the script exits 2
"""
import json, sys, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "listings.json")
UNITS = {"Duplex": 2, "Triplex": 3, "Fourplex": 4, "Quadplex": 4}


def clean(rec):
    t = str(rec.get("type", "")).strip().title()
    if t == "Quadplex":
        t = "Fourplex"
    if t not in UNITS:
        return None
    try:
        price = int(round(float(rec.get("price") or 0)))
    except (TypeError, ValueError):
        return None
    addr, city = str(rec.get("address", "")).strip(), str(rec.get("city", "")).strip()
    state = str(rec.get("state", "")).strip().upper()[:2]
    if not (addr and city and len(state) == 2 and price > 0):
        return None
    sqft = rec.get("sqft")
    try:
        sqft = int(sqft) if sqft else None
    except (TypeError, ValueError):
        sqft = None
    zip_ = str(rec.get("zip", "")).strip()[:5]
    url = str(rec.get("url", "")).strip()
    if not url.startswith("http"):
        from urllib.parse import quote_plus
        url = "https://www.google.com/search?q=" + quote_plus(f"{addr}, {city}, {state} {zip_} for sale")
    return {"type": t, "units": UNITS[t], "address": addr, "city": city, "state": state,
            "zip": zip_, "price": price, "sqft": sqft, "url": url,
            "note": str(rec.get("note", "") or "").strip(), "src": str(rec.get("src", "") or "").strip()}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    date = datetime.date.today().isoformat()
    if "--date" in sys.argv:
        date = sys.argv[sys.argv.index("--date") + 1]
    raw = json.load(open(sys.argv[1]))
    if isinstance(raw, dict):
        raw = raw.get("listings", [])
    seen, out = set(), []
    for r in raw:
        c = clean(r)
        if not c:
            continue
        key = (c["address"].lower(), c["zip"])
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    prev = 0
    if os.path.exists(OUT):
        prev = json.load(open(OUT)).get("count", 0)
    if prev and len(out) < prev * 0.5:
        print(f"REFUSED: scan has {len(out)} listings vs {prev} currently live (<50%). Not publishing.")
        sys.exit(2)
    doc = {"updated": date,
           "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
           "source": "Public duplex/triplex/fourplex listing pages (daily sample, not a full MLS feed)",
           "count": len(out), "listings": out}
    with open(OUT, "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    states = len({r["state"] for r in out})
    print(f"OK: wrote {len(out)} listings across {states} states (was {prev}) dated {date}")


if __name__ == "__main__":
    main()
