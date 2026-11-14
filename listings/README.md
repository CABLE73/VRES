# VetsREI live 2–4 unit listings

How www.vetsrei.com/properties-2 stays current without anyone touching Wix:

1. A daily Claude scheduled task ("VRES Multi listings", 6:15 AM ET) scans public duplex/triplex/fourplex listing pages.
2. It runs `scripts/publish_listings.py scan.json` which cleans, dedupes and writes `data/listings.json`
   (it refuses to publish if the scan shrank by more than half, so a bad scrape never blanks the page).
3. It commits and pushes to the `live-listings` branch.
4. The Wix page holds one "Embed HTML" element containing `listings/wix-embed.html`. On every page view it fetches
   `https://raw.githubusercontent.com/CABLE73/VRES/live-listings/data/listings.json` (jsDelivr as a fallback) and renders it.

Visitors see new data within ~10 minutes of the push. The widget only needs re-pasting into Wix if its own design/code changes.

## Near-ZIP search
Visitors can type a ZIP and pick a radius (10–250 mi). The widget lazily loads `data/zips.json` (41,917 ZIP centroids, ~240 KB gzipped, from the open-source `zipcodes` package) only when a ZIP is entered, then measures straight-line (haversine) miles from that ZIP's center to each listing's ZIP center. Distances are approximate (ZIP center to ZIP center, not driving distance).
