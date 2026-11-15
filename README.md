# TerraTwin: Analog Portfolio Planner

**No place on Earth is the Moon or Mars. So which places, together, come closest?**

TerraTwin is a static web app that picks the smallest set of reachable Earth sites that together let us test what a lunar south-pole base and a Jezero-like Mars outpost need. It also states plainly what no Earth site can test. It breaks each base into 14 requirements and scores 71 Earth candidates against each one using NASA POWER climate data and cited geology. It then builds a portfolio by greedy weighted max coverage. Sites that have not been used as analogs before are flagged **New candidate**.

Team QBIT · NASA Space Apps 2026 · Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

**Live site:** `https://<github-user>.github.io/<repo>/` *(fill in after enabling GitHub Pages; see Deployment)*

---

## How it works

1. **Requirements**: [`pipeline/requirements.yaml`](pipeline/requirements.yaml) lists 14 needs (M1–M7 lunar/shared, R1–R7 Mars/shared), each with a measure, thresholds and a citation.
2. **Scores**: every site gets a 0–1 score per requirement.
   - Climate measures use a linear ramp `s = clip((x − zero) / (full − zero), 0, 1)` on NASA POWER climatology.
   - Geology measures use tags: primary tag = 1.0, partial tag = 0.5, otherwise 0.
   - Missing data scores 0 and is shown as "no data".
3. **Greedy portfolio**: maximize `Σ_r w_r · max_{i∈S} s_ir − λ · Σ_{i∈S} (access_tier_i − 1)` with |S| ≤ k. Each step adds the site with the largest marginal gain, and the run stops at k sites or when no site adds more than 0.01. The UI shows each pick's gain so the diminishing returns are visible.
4. **Gap list**: things Earth can't test (reduced gravity, vacuum and a thin CO₂ atmosphere, 40 K shadowed craters, charged lunar dust, cosmic radiation, the two-week lunar night) are always shown and never scored.

Requirement status is **covered** at a best score ≥ 0.7, **partial** at 0.4–0.7, and a **gap** below 0.4. A site is **dual-use** if it scores ≥ 0.7 on at least two Moon-only and two Mars-only requirements.

**Mission-purpose presets** (Balanced, Rover and mobility, Habitat and isolation, ISRU and ice, Astrobiology) give emphasized requirements a weight of 3 and the rest 1. Every weight can be edited in the Advanced drawer.

### Example results (Balanced, λ = 0.1)

| Mission | Portfolio (pick order) | Coverage |
|---|---|---|
| Moon + Mars | Harrat Khaybar · Haughton Crater · Ojos del Salado · Allan Hills · Wadi Rum | 95% |
| Moon | Haughton Crater · Harrat Khaybar · Allan Hills · Wadi Rum | 96% |
| Mars | Licancabur · El Malpais · Lonar Crater · Allan Hills · Puga Valley | 95% |

Coverage saturates at 4–5 sites because 7 of the 14 requirements are tag-based (any matching site scores 1.0). After that, extra sites add less than 0.01 and greedy stops early, and the UI says so.

## Run locally

```bash
# 1. (optional) refresh NASA POWER data: writes data/cache/power_<id>.json
python3 -m pip install -r pipeline/requirements.txt
python3 pipeline/fetch_power.py          # skips sites already cached; --force to refetch

# 2. build web/data/sites.json (fully offline, from data/cache/)
python3 pipeline/build_sites.py

# 3. tests and validation
node --test                              # engine unit tests
node tests/validate.mjs                  # known-analog ranks (exit 1 if < 60% in top quartile)

# 4. serve the static site
python3 -m http.server 8000 -d web       # open http://localhost:8000
```

No build step and no backend. `web/` is plain HTML and ES modules, with globe.gl 2.46.2 loaded from jsdelivr. The 3D globe needs WebGL; without it the planner still works from the panels. The raw POWER responses are committed in `data/cache/`, so the pipeline never needs the network.

## Repository layout

```
pipeline/requirements.yaml   requirements, thresholds, presets, gap list (with citations)
pipeline/targets.yaml        Moon south pole + Jezero profiles (approximate, cited)
pipeline/candidates.csv      71 Earth sites: coords, tags, known-analog flag, access tier, citation
pipeline/fetch_power.py      NASA POWER climatology fetcher (cached)
pipeline/build_sites.py      builds web/data/sites.json offline
data/cache/                  raw NASA POWER responses
web/                         static app (index.html, css/, js/engine.js, js/app.js, data/sites.json)
tests/engine.test.mjs        node --test unit tests
tests/validate.mjs           known-analog validation check
```

## NASA data used

| Dataset | Used for | URL |
|---|---|---|
| NASA POWER climatology API (T2M, T2M_MIN, T2M_MAX, T2M_RANGE, PRECTOTCORR, ALLSKY_SFC_UV_INDEX, PS, WS10M) | All Earth climate features (M1, R1, R2, R3, R4, R7) | https://power.larc.nasa.gov/ |
| NASA Blue Marble | 3D globe surface imagery | https://visibleearth.nasa.gov/collection/1484/blue-marble |
| MODIS MOD13Q1 NDVI (ORNL DAAC) | Planned replacement for the `barren` tag (M7); cited, not yet ingested | https://modis.ornl.gov/data/modis_webservice.html |
| LRO Diviner Lunar Radiometer | Moon south-pole temperature profile | https://www.diviner.ucla.edu/ |
| LRO LOLA | Moon south-pole terrain and illumination | https://pds-geosciences.wustl.edu/missions/lro/lola.htm |
| MGS MOLA | Jezero elevation | https://pds-geosciences.wustl.edu/missions/mgs/mola.html |
| Mars 2020 Perseverance MEDA | Jezero pressure, temperature, wind | https://mars.nasa.gov/mars2020/spacecraft/instruments/meda/ |
| LCROSS (Colaprete et al. 2010) | Lunar polar water ice | https://doi.org/10.1126/science.1186986 |

*Paste this list into the submission form's NASA Data field.*

## Other data and tools

- **globe.gl 2.46.2** (MIT, three.js): https://globe.gl/ for the 3D globe
- **Globe imagery**: NASA Blue Marble (public domain) and a topography bump map, as packaged in the `three-globe` examples and served from `web/img/`: https://visibleearth.nasa.gov/collection/1484/blue-marble
- **Fonts**: Instrument Sans, Instrument Serif and Martian Mono via Google Fonts (SIL OFL)
- **Earth Impact Database** (Planetary and Space Science Centre, UNB): http://www.passc.net/EarthImpactDatabase/
- **Papers**:
  - Paige et al. 2010, *Science*, Diviner cold traps: https://doi.org/10.1126/science.1187726
  - Colaprete et al. 2010, *Science*, LCROSS water: https://doi.org/10.1126/science.1186986
  - Navarro-González et al. 2003, *Science*, Mars-like soils in the Atacama: https://doi.org/10.1126/science.1089143
  - Rodriguez-Manfredi et al. 2023, *Nature Geoscience*, Jezero meteorology (MEDA): https://doi.org/10.1038/s41561-022-01084-0
  - Farley et al. 2022, *Science*, Jezero floor igneous rocks: https://doi.org/10.1126/science.abo2196
  - Kaku et al. 2017, *GRL*, Marius Hills lava tubes: https://doi.org/10.1002/2017GL074998
- **Per-site citations**: the `citation_url` column of [`pipeline/candidates.csv`](pipeline/candidates.csv), shown on every site card.

## SI disclosure

Code in this repository was written with assistance from Claude (Anthropic) via Claude Code; site research was assisted by Claude. All data values come from the listed sources. No AI-generated images or video are used. The app icon is a hand-written SVG.

## Validation

`node tests/validate.mjs` ranks every known analog among all 71 candidates on the mission it is documented for (`analog_for` in `candidates.csv`), using Balanced weights.

**Current result: 7 of 16 known analogs rank in the top 25%, and 12 of 16 in the top half.** This is **below** the PRD's 60% target, and the check exits non-zero on purpose. We report it rather than tune the thresholds until it passes:

- **The test is hard by construction.** The 55 non-analog candidates were hand-picked as extreme, analog-like terrain, so known analogs compete against other strong sites, not ordinary land.
- **The low-ranked analogs were chosen for things TerraTwin does not score.** Rio Tinto was chosen for acid-mine chemistry, Pavilion Lake for underwater EVA operations, Svalbard for carbonate mineralogy, and MDRS for habitat logistics.
- **Possible next steps:** add negative-control sites (ordinary temperate land) to measure discrimination properly, and add chemistry and operations requirements.

### Threshold log

The PRD's starting thresholds were changed as follows. Each change is also commented in `requirements.yaml`.

| Req | PRD start (zero → full) | Now | Reason |
|---|---|---|---|
| M1 | 0 → −40 °C | 0 → −60 °C | Full set near the coldest site (−62 °C), so 1.0 means Earth-extreme |
| R1 | 250 → 25 mm/yr | 500 → 0 mm/yr | Zero widened to the semi-arid boundary; full = no rain |
| R2 | 4 → 10 | 1.5 → 4.5 | POWER's UV index is a 24 h mean; the highest peak month in the set is 4.3, so 4 → 10 scored every site 0 |
| R3 | 95 → 60 kPa | 95 → 50 kPa | Full set below the lowest site (54 kPa) |
| R4 | 8 → 20 °C | 6 → 20 °C | Zero lowered to separate polar and maritime sites (1–8 °C) |
| R7 | 2 → 8 m/s | 2 → 10 m/s | Full set near the windiest sites (~11 m/s) |

Validation also moved from a single "Moon + Mars" ranking (6/16) to ranking each analog on its documented mission (7/16). A Mars analog should not be penalized for not also being lunar.

### POWER parameter log

All requested parameters were accepted by the API, so no substitutions were needed. Derived values:
- Precipitation = `PRECTOTCORR` ANN (mm/day) × 365.
- UV = maximum monthly `ALLSKY_SFC_UV_INDEX`.
- Coldest = minimum monthly `T2M_MIN`.
- Elevation = POWER grid-cell elevation.

`fetch_power.py` retries with documented fallbacks if a parameter is ever rejected.

## Limitations

- **Point sampling, not a global grid.** 71 curated sites, and new candidates only come from that list (global grid mode is a stretch goal).
- **Climate is a 0.5° grid-cell average.** Summits and small craters are smoothed: Mauna Kea's cell sits at 636 m, not 4,200 m, and some nearby sites share a cell.
- **Geology is tag-based** from the literature, not mapped lithology. Tags are binary or partial.
- **Target values are approximate** and used only for side-by-side comparison, never for scoring.
- **Validation is below target** (see above). Some Wikipedia citations should be upgraded to the primary paper documenting analog use before submission.

## Deployment

1. Push to a public GitHub repo.
2. Go to **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/pages.yml` runs the tests and publishes `web/`.
3. Open the live URL in a private window to confirm it works logged out, then paste it above and into the submission form.

## 30-second demo script

1. **0–5 s**: "No place on Earth is the Moon. So which places together are?"
2. **5–15 s**: Mission = Both, k = 5. The portfolio appears, with coverage at **95%**, and gains shrink pick by pick.
3. **15–22 s**: Click **Lonar Crater** (India) to show its site card and **New candidate** badge, an impact crater in basalt.
4. **22–27 s**: Validation tab: 7 of 16 known analogs in the top quartile, and 12 of 16 in the top half.
5. **27–30 s**: Gap box: "What Earth can't test."

---

Built for NASA Space Apps 2026 by Team QBIT. No NASA logos, insignia or mission patches are used.
