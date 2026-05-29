# Piped & Invidious Fallback Integration Guide

This guide details the setup, operation, and troubleshooting of the YouTube API fallbacks (Piped and Invidious) implemented in the Curated Feed pipeline.

---

## A. Required Setup & Manual Actions

To initialize the new fallback systems, execute the following actions in order:

1. **Database Migration:** Open the Supabase SQL Editor and execute the updated [SUPABASE_SCHEMA.sql](file:///d:/GitHub/cognitive-os/SUPABASE_SCHEMA.sql). Block 13 at the bottom of the file contains the idempotent migration statement that resets poisoned creator state rows (with transient errors) back to eligible for resolution.
2. **Restart Dev Server:** Restart your local development environment by running:
   ```bash
   npm run dev
   ```
3. **Trigger Resolution:** Navigate to `/feed` in your browser and click **"Generate fresh feed"**. Look for the client-side information toast notification indicating which fallback provider (Piped or Invidious) was successfully resolved to fill the feed.
4. **Cache Recovery (Stuck Creators):** If creators ever get stuck or poisoned by transient API failures again, you can manually force resolution without waiting for the 1-hour transient backoff by executing a POST request to:
   ```bash
   curl -X POST http://localhost:3000/api/feed/reset-failed-creators
   ```
   This will immediately reset all cached transient resolution errors.
5. **View System Diagnostics:** Visit the diagnostics endpoint at:
   ```html
   http://localhost:3000/api/feed/diagnostics
   ```
   This endpoint lists active search states, resolved creators, and the `fallback_summary` indicating which provider served the last generation query.
6. **Pin Specific Instances (Optional):** If automatic rotation across public instances is slow or encountering high rates of failure, you can pin dedicated fallback base URLs in your `.env.local` file:
   - `PIPED_API_BASE_OVERRIDE` (e.g. `https://api.piped.private.coffee`)
   - `INVIDIOUS_INSTANCE_OVERRIDE` (e.g. `https://invidious.nerdvpn.de`)
7. **Self-Hosting Fallbacks (Optional):** If public instances become completely blocked or unavailable in your network, you are encouraged to self-host your own Piped instance on Render, Fly.io, or Railway:
   - Official Self-Hosting Guide: https://docs.piped.video/docs/self-hosting/

---

## B. YouTube API Quota Budget Math

The Google YouTube Data API v3 has a default daily quota limit of **10,000 units**:
- A single user-triggered feed generation executes up to **8 channel top video searches** (`search.list` @ 100 units/search) and **creator details lookup** (`channels.list` or `playlistItems.list` @ 1 unit/request) plus **details enrichment** (`videos.list` @ 1 unit/request).
- This totals approximately **1,300 quota units** consumed per full generate call.
- Thus, the daily budget allows for approximately **7 full generation calls** before the standard quota is exhausted and the pipeline falls back to Piped and Invidious.

---

## C. Fallback Provider Lists & Probing

You can manually probe the list of configured fallback instances from your terminal using the following template commands:

### Piped Instances Pool
- `https://api.piped.private.coffee`
- `https://pipedapi.kavin.rocks`
- `https://pipedapi.leptons.xyz`
- `https://pipedapi.nosebs.ru`
- `https://pipedapi-libre.kavin.rocks`
- `https://piped-api.privacy.com.de`
- `https://pipedapi.adminforge.de`
- `https://api.piped.yt`
- `https://pipedapi.drgns.space`
- `https://pipedapi.owo.si`
- `https://pipedapi.ducks.party`
- `https://piped-api.codespace.cz`
- `https://pipedapi.reallyaweso.me`
- `https://pipedapi.darkness.services`
- `https://pipedapi.orangenet.cc`

**Probe Command Example:**
```bash
curl -m 6 -s https://api.piped.private.coffee/c/AlexHormozi | head -c 400
```

### Invidious Instances Pool
- `https://inv.thepixora.com`
- `https://invidious.nerdvpn.de`
- `https://inv.nadeko.net`
- `https://invidious.f5.si`
- `https://yt.chocolatemoo53.com`

**Probe Command Example:**
```bash
curl -m 6 -s https://invidious.nerdvpn.de/api/v1/channels/@AlexHormozi | head -c 400
```

---

## D. Troubleshooting Diagnostics States

Use this reference table to evaluate states returned by `/api/feed/diagnostics`:

| Diagnostic State | Meaning | Actions / Resolution |
| --- | --- | --- |
| `fallback_used: true` | Piped successfully served the request. | None. Normal fallback operation. |
| `invidious_used: true` | Invidious successfully served the request. | None. Normal Plan C fallback operation. |
| Both false AND `data.length > 0` | YouTube API worked normally. | None. Primary API is healthy. |
| Both false, `data.length == 0` AND `quota_exhausted: true` | All three providers (YouTube, Piped, Invidious) failed. | Check `creator_resolution_failures` in `funnel_summary` for errors, verify network connectivity, and probe fallback endpoints. |
