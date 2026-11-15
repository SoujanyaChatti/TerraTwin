# TerraTwin PRD: Analog Portfolio Planner

Nov 15, 2026 · @Sou

## Overview

Build TerraTwin: a static web app that picks the smallest set of reachable Earth sites that together let NASA test what a lunar south-pole base and a Mars outpost need, and states what no Earth site can test. Team QBIT, NASA Space Apps 2026, challenge "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars". Submission closes Sunday 15 Nov 2026, 11:59 PM local time, so ship the MVP first and polish second.

**For Claude Code:** export this doc as Markdown, save it as `PRD.md` in an empty repo, then prompt: *"Read PRD.md and build the project milestone by milestone. After each milestone, run it, verify the acceptance criteria, and commit."*

**Core question the app answers:** "Which Earth sites, including ones not used as analogs yet, should NASA test at before building bases on the Moon and Mars, and what can't be tested on Earth at all?"

**Core insight:** no single Earth site matches the Moon or Mars on every factor. So the app does not rank one best match. It breaks each base into requirements, scores Earth sites per requirement, and builds a portfolio that covers the most requirements with the fewest sites.

**The challenge asks for three things, and the app maps to each:**

- *Identify new analogs* → candidate sites not in the known-analog list are flagged "New candidate".
- *Characterize them* → every site gets a data-backed profile card with per-requirement match scores and sources.
- *Present as a map or tool* → an interactive world map with mission, purpose and portfolio-size controls.

## Goals and non-goals

The MVP wins on clarity and credibility, not on data volume: about 60 well-characterized sites beat a noisy global grid built in a rush.

**Goals**

1. Score \~60 Earth candidate sites against \~12 Moon and Mars requirements using real NASA data.
2. Select a portfolio of k sites (default 5) by greedy weighted max coverage, for Moon, Mars or both.
3. Show which sites serve both missions, and list requirements no Earth site can cover.
4. Validate the method: known analogs (Atacama, Haughton, Death Valley, Dry Valleys) must score in the top quartile.
5. Deploy as a public static site with no login, as the submission form requires.

**Non-goals for the MVP**

- No backend, database or user accounts.
- No global raster grid or Google Earth Engine (needs auth; stretch goal only).
- No real-time data; all data is precomputed into one JSON file.
- No NASA logos, flags or mission insignia anywhere (submission rule for SI-assisted work).

**Judging alignment**

| Criterion | How TerraTwin meets it |
| --- | --- |
| Impact | A decision tool for planning analog campaigns, not just a map |
| Creativity | Portfolio optimization plus an honest gap report, instead of a single best match |
| Validity | Validation panel showing known analogs rank highly; every number traceable to a dataset |
| Relevance | Covers both Moon base and Mars, as the challenge title requires |
| Presentation | One-screen map, a 30-second demo path, clear site cards |

## Architecture and stack

Two parts: a Python pipeline that writes one `sites.json`, and a static frontend that loads it and runs scoring and set cover in the browser so sliders update instantly.

**Pipeline (runs once, offline)**

1. Load hand-curated inputs: `requirements.yaml`, `targets.yaml` (Moon and Mars site profiles), `candidates.csv` (Earth sites with lat/lon, tags, known-analog flag, citations).
2. Fetch climate per Earth site from the NASA POWER API (no key needed); cache raw responses in `data/cache/`.
3. Derive features: temperature stats, aridity, solar and UV exposure, elevation.
4. Write `web/data/sites.json` with features, tags and sources for every site.

If the POWER API is unreachable from the build environment, the pipeline must still run from `data/cache/` or from a committed `sites.seed.json` so the frontend is never blocked.

**Frontend**

- Plain HTML + vanilla JS (ES modules), no build step, deployable to GitHub Pages.
- Leaflet for the map, loaded from a pinned CDN version; OpenStreetMap or Esri tiles with attribution.
- All scoring and set-cover logic in `web/js/engine.js`, pure functions, unit-testable with Node.

**Repo layout**

```
terratwin/
  PRD.md
  README.md            # includes NASA data list + SI disclosure
  pipeline/
    requirements.yaml
    targets.yaml
    candidates.csv
    fetch_power.py
    build_sites.py
    requirements.txt
  data/cache/          # raw POWER responses
  web/
    index.html
    css/style.css
    js/engine.js       # scoring + greedy set cover
    js/app.js          # UI + map
    data/sites.json
  tests/engine.test.mjs
```

## Data

The whole project rests on the requirements list, so each requirement must cite a NASA or peer-reviewed source in `requirements.yaml`. Values below are starting points; the team verifies and cites each before submission.

**Requirements (`pipeline/requirements.yaml`)**

| ID | Requirement | Mission | Earth measure | Source of Earth value |
| --- | --- | --- | --- | --- |
| M1 | Extreme cold | Moon | Annual min and mean 2 m temperature (°C) | NASA POWER `T2M_MIN`, `T2M` |
| M2 | Low-angle polar lighting | Moon | abs(latitude) ≥ 66.5° | Site coordinates |
| M3 | Regolith analog (basalt or anorthosite) | Moon | Lithology tag | Geologic literature, USGS maps |
| M4 | Impact crater terrain | Moon, Mars | Tag `impact_crater` | Earth Impact Database |
| M5 | Ground ice or permafrost | Moon, Mars | Tag `permafrost` / `ground_ice` | Literature |
| M6 | Lava tubes or caves for shelter | Moon, Mars | Tag `lava_tube` | Literature |
| M7 | Barren, near-lifeless surface | Moon, Mars | Mean NDVI (optional) or tag `barren` | MODIS MOD13Q1 via ORNL DAAC API |
| R1 | Hyperaridity | Mars | Annual precipitation (mm) | NASA POWER `PRECTOTCORR` |
| R2 | High UV exposure | Mars | Mean UV index | NASA POWER `ALLSKY_SFC_UV_INDEX` |
| R3 | Low air pressure | Mars | Surface pressure (kPa) | NASA POWER `PS` |
| R4 | Large daily temperature swing | Moon, Mars | Mean diurnal range (°C) | NASA POWER `T2M_RANGE` |
| R5 | Iron-rich basalt or volcanic terrain | Mars | Tag `basalt` / `volcanic` | Literature |
| R6 | Ancient lakebed or evaporites (Jezero-like) | Mars | Tag `paleolake` / `evaporite` | Literature |
| R7 | Dust and wind | Moon, Mars | Mean 10 m wind speed (m/s) | NASA POWER `WS10M` |

If a POWER parameter name is rejected by the API, query the POWER parameter list endpoint and use the closest valid one; log the substitution in the README.

**Untestable on Earth (gap list, shown in the UI, never scored)**

- 1/6 g (Moon) and 0.38 g (Mars) gravity
- Hard vacuum (Moon) and a 0.6 kPa CO2 atmosphere (Mars)
- Permanently shadowed regions near 40 K
- Sharp, electrostatically charged lunar dust
- Galactic cosmic radiation and solar particle events
- The two-week lunar night

**Targets (`pipeline/targets.yaml`)**

Two profiles with short descriptions, approximate values and citations, shown on the map's side panel for comparison:

- **Moon south pole (Shackleton rim / Artemis candidate regions):** temperatures from LRO Diviner, terrain from LRO LOLA, water ice in shadowed craters.
- **Mars, Jezero Crater:** pressure and temperature from Perseverance MEDA, elevation from MOLA, delta and lakebed sediments, basaltic floor.

**Earth candidates (`pipeline/candidates.csv`)**

Columns: `id, name, country, lat, lon, tags, is_known_analog, access_tier (1 easy – 3 hard), description, citation_url`.

Target about 60 rows in three groups:

- **Known analogs (validation set, \~15):** Atacama (Yungay), Haughton Crater (Devon Island), Death Valley, McMurdo Dry Valleys, Mauna Kea, MDRS Utah, Rio Tinto, Svalbard (Bockfjord), Meteor Crater, Craters of the Moon, Lanzarote lava tubes, Iceland lava fields, Ladakh (Tso Kar), Qaidam Basin, Pavilion Lake.
- **Indian sites (\~6):** Lonar Crater (impact crater in Deccan basalt), Rann of Kutch, Spiti Valley, Puga Valley, Deccan Traps basalt, Changthang plateau.
- **New candidates (\~40):** deserts, polar, volcanic and cave sites, for example Dasht-e Lut, Danakil/Dallol, Namib, Gobi, Puna de Atacama, Salar de Uyuni, Altiplano, Kerguelen, Ross Island, Greenland ice-free margins, Kamchatka, Erta Ale, Undara lava tubes.

Mark `is_known_analog` true only when a citation shows the site has been used as a Moon or Mars analog. Everything else is labelled "New candidate" in the UI.

## Scoring and portfolio algorithm

Each site gets a 0–1 score per requirement; the portfolio maximizes weighted coverage, where a requirement counts as covered by its best-scoring site in the portfolio.

**Per-requirement score**

- Continuous measures use a linear ramp between a zero threshold and a full threshold, both set in `requirements.yaml`. Thresholds are relative to Earth's extremes, since no Earth value reaches Moon or Mars values.
- Tag measures score 1.0 for a primary tag (e.g. `lava_tube`), 0.5 for a partial tag (e.g. `volcanic_cave`), else 0.
- Missing data scores 0 and is shown as "no data" on the site card, never hidden.

Starting thresholds (zero → full): M1 `T2M_MIN` 0 → −40 °C · R1 precipitation 250 → 25 mm/yr · R2 UV index 4 → 10 · R3 pressure 95 → 60 kPa · R4 diurnal range 8 → 20 °C · R7 wind 2 → 8 m/s.

```latex
s_{i,r} = \mathrm{clip}\left(\frac{x_{i,r} - z_r}{f_r - z_r},\ 0,\ 1\right)
```

where x is the site's value, z the zero threshold and f the full threshold for requirement r.

**Portfolio objective**

```latex
\max_{S,\ |S| \le k} \ \sum_{r \in R} w_r \max_{i \in S} s_{i,r} \; - \; \lambda \sum_{i \in S} (a_i - 1)
```

R is the requirement set for the chosen mission (Moon, Mars or both), w the weights from the mission-purpose preset, a the access tier (1–3) and λ the reachability penalty (default 0.1, slider 0–0.5).

**Greedy solver (`engine.js`)**

1. Start with an empty portfolio.
2. For each site not yet chosen, compute the marginal gain in the objective.
3. Add the site with the largest gain; record which requirements it newly covers.
4. Stop at k sites or when no site adds gain above 0.01.

Greedy max coverage is within about 63% of optimal and is fast and explainable, which suits judging. Show the gain per added site so users see diminishing returns.

**Mission-purpose presets** (weights 0–3, editable in the UI)

| Preset | Emphasized requirements |
| --- | --- |
| Balanced | All weight 1 |
| Rover and mobility testing | M3, M4, R5, R7 |
| Habitat and isolation | M1, M2, M6, R3 |
| ISRU and ice extraction | M5, M3, R6 |
| Astrobiology and sample science | R1, R2, R6, M7 |

**Derived labels**

- *Covered:* a requirement whose best portfolio score is ≥ 0.7; *partial:* 0.4–0.7; *gap:* below 0.4.
- *Dual-use site:* scores ≥ 0.7 on at least two Moon-only and two Mars-only requirements.

## Frontend UI

One screen: controls on the left, the world map in the center, details on the right; on phones the panels stack below the map.

**Left panel: controls**

- Mission toggle: Moon · Mars · Both (default Both).
- Purpose preset dropdown (from the presets table), plus an "Advanced" drawer with one weight slider per requirement.
- Portfolio size k: slider 1–10, default 5.
- Reachability penalty λ: slider 0–0.5.
- Checkbox: "New candidates only" (excludes known analogs, to answer "what new sites should NASA look at?").

**Center: map**

- All candidate sites as small grey markers; portfolio sites as large numbered markers in pick order.
- Marker color: blue = known analog, orange = new candidate; a ring marks dual-use sites.
- Click a marker to open its site card.

**Right panel, tab 1: Portfolio**

- Ordered list of chosen sites with the requirements each newly covers and its marginal gain.
- Coverage bar: share of total requirement weight covered, e.g. "5 sites cover 78% of Moon + Mars testable needs".
- Requirement checklist: every requirement marked covered, partial or gap, with the covering site's name.
- Gap box: the untestable-on-Earth list, always visible, titled "What Earth can't test".

**Right panel, tab 2: Site card**

- Name, country, coordinates, Known analog / New candidate badge, access tier.
- Per-requirement score bars, with the raw value and unit (e.g. "Precipitation: 18 mm/yr → 1.00").
- Side-by-side line: Earth value vs Moon or Mars target value where one exists.
- Description and citation links; data source per value.

**Right panel, tab 3: Validation**

- Table of known analogs with their overall score and rank among all candidates.
- Headline metric: "X of Y known analogs rank in the top 25%".

**Design**

- Dark space theme with a light-mode variant via `prefers-color-scheme`.
- Readable at 1366×768 and on a 390 px wide phone.
- No NASA logos, insignia or mission patches. App name and an original icon only.
- Footer: data credits (NASA POWER, MODIS, LRO, MOLA, Perseverance MEDA, map tiles) and "Built for NASA Space Apps 2026 by Team QBIT".

## Validation, README and deployment

The submission is only eligible for a Global Award if the project and demo are at public links with no login, NASA data is listed, and SI use is disclosed.

**Validation (automated)**

- `tests/engine.test.mjs` (run with `node --test`): ramp scoring edge cases, greedy picks the obvious site on a toy dataset, k = 0 returns empty, weights of 0 drop a requirement.
- A pipeline check prints each known analog's overall score and rank; fail loudly if fewer than 60% are in the top quartile, then tune thresholds (not the analog list) and log the change.

**README.md must include**

1. One-paragraph summary and a link to the live site.
2. How it works: requirements → scores → greedy portfolio → gap list.
3. **NASA data used**, each with its URL: NASA POWER API, MODIS MOD13Q1 (ORNL DAAC), LRO Diviner, LRO LOLA, MOLA, Perseverance MEDA. Paste the same list into the submission form's NASA Data field.
4. **Other data and tools:** Leaflet, map tiles, Earth Impact Database, every paper cited in `candidates.csv`.
5. **SI disclosure:** "Code in this repository was written with assistance from Claude (Anthropic) via Claude Code; site research was assisted by Claude. All data values come from the listed sources." Add an SI watermark to any AI-generated image or video.
6. Limitations: point-site sampling instead of a global grid, tag-based geology, approximate target values.

**Deployment**

- Push to a public GitHub repo; enable GitHub Pages from `/web` (or copy `web/` to `/docs`).
- Verify the live URL in a private browser window before pasting it into the form.

**Demo (30-second video path)**

1. 0–5 s: "No place on Earth is the Moon. So which places together are?"
2. 5–15 s: Mission = Both, k = 5; the portfolio appears, coverage reads 78%.
3. 15–22 s: Click Lonar Crater; show its site card and the "New candidate" or "Known analog" badge.
4. 22–27 s: Validation tab: known analogs rank in the top quartile.
5. 27–30 s: Gap box: "What Earth can't test."

## Build order and acceptance criteria

Build in this order and commit after each milestone; milestones 1–4 are the minimum submittable product, 5–6 are polish.

- [ ] **M1. Data files.** Create `requirements.yaml`, `targets.yaml` and `candidates.csv` with \~60 sites. Done when: every site has lat/lon, tags, access tier and a citation URL; every known analog has a citation showing analog use.
- [ ] **M2. Pipeline.** `fetch_power.py` (annual climatology per site, cached) and `build_sites.py` → `web/data/sites.json`. Done when: `python pipeline/build_sites.py` runs from cache with no network, and every site has all POWER fields or an explicit null.
- [ ] **M3. Engine.** `engine.js` with ramp scoring, presets and greedy set cover, plus `node --test` tests. Done when: tests pass and the validation check prints known-analog ranks.
- [ ] **M4. Map UI and deploy.** Controls, map, Portfolio tab, gap box; publish to GitHub Pages. Done when: changing mission, preset, k or λ updates map and portfolio in under 200 ms, and the public URL works logged out.
- [ ] **M5. Site card and Validation tab.** Done when: every site card shows raw values, scores, Earth-vs-target comparison and sources.
- [ ] **M6. README, credits, demo.** README per the section above; record the 30-second video. Done when: README lists all NASA data with URLs and the SI disclosure, and the video is at a public link.

**Stretch goals (only after M6)**

- Global grid mode: score a 0.5° Earth grid with Google Earth Engine and show a heatmap per requirement, surfacing new candidates automatically.
- MODIS NDVI for M7 instead of the `barren` tag.
- Export the current portfolio as a shareable link (`#` hash state) or CSV.
