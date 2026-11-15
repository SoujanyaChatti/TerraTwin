// TerraTwin UI: controls, 3D globe (globe.gl), Portfolio / Site card / Validation tabs.
import {
  scoreAll, requirementsForMission, presetWeights, greedyPortfolio, statusOf,
  isDualUse, rankSites, validateKnownAnalogs,
} from "./engine.js";

/* global Globe */

const MISSION_LABEL = { moon: "Moon", mars: "Mars", both: "Moon + Mars" };
const HERO_WORD = { moon: "Moon.", mars: "Mars.", both: "Moon. Or Mars." };
const STATUS_ICON = { covered: "✓", partial: "◐", gap: "✕" };
const DEFAULTS = { mission: "both", preset: "balanced", k: 5, lambda: 0.1, newOnly: false };

const state = { ...DEFAULTS, weights: null, selected: null, tab: "portfolio" };
let DATA, SCORES, REQS, REQ_BY_ID, SITE_BY_ID, DUAL, VALIDATION;
let globe = null;
let lastResult = null;
const pins = {}; // siteId -> HTMLElement

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (x, nd = 2) => (x === null || x === undefined ? "–" : Number(x).toFixed(nd));
const pct = (x) => Math.round(x * 100);
const pad2 = (n) => String(n).padStart(2, "0");
const latStr = (lat) => `${Math.abs(lat).toFixed(2).padStart(5, "0")}°${lat >= 0 ? "N" : "S"}`;
const lonStr = (lon) => `${Math.abs(lon).toFixed(2).padStart(6, "0")}°${lon >= 0 ? "E" : "W"}`;

/* ---------- boot ---------- */

async function boot() {
  try {
    const res = await fetch("data/sites.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
  } catch (err) {
    $("#tab-portfolio").innerHTML = `<p class="empty">Could not load data/sites.json (${esc(err.message)}). Serve the <code>web/</code> folder over HTTP, e.g. <code>python3 -m http.server -d web</code>.</p>`;
    return;
  }
  REQS = DATA.requirements;
  REQ_BY_ID = Object.fromEntries(REQS.map((r) => [r.id, r]));
  SITE_BY_ID = Object.fromEntries(DATA.sites.map((s) => [s.id, s]));
  SCORES = scoreAll(DATA.sites, REQS);
  DUAL = new Set(DATA.sites.filter((s) => isDualUse(SCORES[s.id], REQS)).map((s) => s.id));
  VALIDATION = validateKnownAnalogs(DATA.sites, SCORES, REQS, presetWeights(DATA.presets.balanced, REQS));

  readHash();
  if (!state.weights) state.weights = presetWeights(DATA.presets[state.preset] || DATA.presets.balanced, REQS);

  const generated = DATA.generated ? DATA.generated.slice(0, 10) : "";
  $("#data-readout").innerHTML = `${DATA.sites.length} sites · ${REQS.length} requirements · NASA POWER ${esc(generated)}`;

  buildControls();
  buildTargets();
  buildGlobe();
  renderValidation();
  update();
  if (state.selected && SITE_BY_ID[state.selected]) renderSite(state.selected);
  selectTab(state.tab);
  window.addEventListener("hashchange", () => {
    if (location.hash.slice(1) === lastHash) return;
    state.selected = null;
    state.tab = "portfolio";
    readHash();
    syncControls();
    update();
    selectTab(state.tab);
  });
}

/* ---------- URL hash state (shareable link) ---------- */

let lastHash = "";
function writeHash() {
  const p = new URLSearchParams();
  p.set("m", state.mission);
  p.set("p", state.preset);
  p.set("k", state.k);
  p.set("l", state.lambda);
  if (state.newOnly) p.set("n", "1");
  if (state.preset === "custom") p.set("w", REQS.map((r) => state.weights[r.id]).join(""));
  if (state.selected) p.set("s", state.selected);
  if (state.tab !== "portfolio") p.set("t", state.tab);
  lastHash = p.toString();
  history.replaceState(null, "", `#${lastHash}`);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (["moon", "mars", "both"].includes(p.get("m"))) state.mission = p.get("m");
  const k = parseInt(p.get("k"), 10);
  if (k >= 1 && k <= 10) state.k = k;
  const l = parseFloat(p.get("l"));
  if (l >= 0 && l <= 0.5) state.lambda = l;
  state.newOnly = p.get("n") === "1";
  const preset = p.get("p");
  if (preset === "custom" && /^[0-3]+$/.test(p.get("w") || "") && p.get("w").length === REQS.length) {
    state.preset = "custom";
    state.weights = Object.fromEntries(REQS.map((r, i) => [r.id, Number(p.get("w")[i])]));
  } else if (preset && DATA.presets[preset]) {
    state.preset = preset;
    state.weights = presetWeights(DATA.presets[preset], REQS);
  }
  if (p.get("s") && SITE_BY_ID[p.get("s")]) state.selected = p.get("s");
  if (["portfolio", "site", "validation"].includes(p.get("t"))) state.tab = p.get("t");
}

/* ---------- controls ---------- */

function buildControls() {
  $("#mission").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-value]");
    if (!b) return;
    state.mission = b.dataset.value;
    syncControls();
    update();
  });

  const sel = $("#preset");
  sel.innerHTML =
    Object.entries(DATA.presets).map(([id, p]) => `<option value="${esc(id)}">${esc(p.label)}</option>`).join("") +
    `<option value="custom">Custom weights</option>`;
  sel.addEventListener("change", () => {
    state.preset = sel.value;
    if (sel.value !== "custom") state.weights = presetWeights(DATA.presets[sel.value], REQS);
    syncControls();
    update();
  });

  $("#weights").innerHTML = REQS.map((r) => `
    <div class="weight-row" data-req="${r.id}">
      <label class="wname" for="w-${r.id}" title="${esc(r.name)}"><b>${r.id}</b>${esc(r.name)}</label>
      <input type="range" id="w-${r.id}" min="0" max="3" step="1" />
      <output id="w-${r.id}-out"></output>
    </div>`).join("");
  $("#weights").addEventListener("input", (e) => {
    const row = e.target.closest(".weight-row");
    if (!row) return;
    state.weights = { ...state.weights, [row.dataset.req]: Number(e.target.value) };
    state.preset = "custom";
    syncControls();
    update();
  });

  $("#k").addEventListener("input", (e) => { state.k = Number(e.target.value); syncControls(); update(); });
  $("#lambda").addEventListener("input", (e) => { state.lambda = Number(e.target.value); syncControls(); update(); });
  $("#new-only").addEventListener("change", (e) => { state.newOnly = e.target.checked; update(); });

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) selectTab(b.dataset.tab);
  });

  $("#copy-link").addEventListener("click", async () => {
    writeHash();
    try {
      await navigator.clipboard.writeText(location.href);
      flash($("#copy-link"), "Copied");
    } catch {
      prompt("Copy this link:", location.href);
    }
  });
  $("#export-csv").addEventListener("click", exportCsv);
  $("#how-link").addEventListener("click", () => $("#how").showModal());

  syncControls();
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1200);
}

function syncControls() {
  document.querySelectorAll("#mission button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === state.mission)));
  $("#hero-word").textContent = HERO_WORD[state.mission];
  $("#preset").value = state.preset;
  $("#k").value = state.k;
  $("#k-out").textContent = pad2(state.k);
  $("#lambda").value = state.lambda;
  $("#lambda-out").textContent = state.lambda.toFixed(2);
  $("#new-only").checked = state.newOnly;
  const inMission = new Set(requirementsForMission(REQS, state.mission).map((r) => r.id));
  for (const r of REQS) {
    const input = $(`#w-${r.id}`);
    input.value = state.weights[r.id];
    $(`#w-${r.id}-out`).textContent = state.weights[r.id];
    const row = input.closest(".weight-row");
    row.classList.toggle("off", state.weights[r.id] === 0 || !inMission.has(r.id));
    row.title = inMission.has(r.id) ? "" : `Not used for ${MISSION_LABEL[state.mission]}`;
  }
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  for (const t of ["portfolio", "site", "validation"]) $(`#tab-${t}`).hidden = t !== tab;
  if (tab === "site" && !state.selected) $("#tab-site").innerHTML = `<p class="empty">Click a site on the globe, or a site in the portfolio, to open its card.</p>`;
  writeHash();
}

function buildTargets() {
  $("#targets").innerHTML = `<summary class="mono">Target environments · Moon south pole vs Jezero</summary>` +
    Object.values(DATA.targets).map((t) => `
      <div class="target">
        <h4>${esc(t.name)}</h4>
        <p>${esc(t.description)}</p>
        <dl>${t.facts.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)} <span class="src">${esc(f.source)}</span></dd>`).join("")}</dl>
        <p class="src" style="margin-top:10px">Sources: ${t.citations.map((c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join(" · ")}</p>
      </div>`).join("");
}

/* ---------- globe ---------- */

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function makePin(site) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `pin ${site.is_known_analog ? "known" : "new"}`;
  el.setAttribute("aria-label", `${site.name}, ${site.is_known_analog ? "known analog" : "new candidate"}`);
  el.innerHTML = `<span class="dot"></span><span class="reticle"></span><span class="tag">${esc(site.name)}</span>`;
  el.addEventListener("click", (e) => { e.stopPropagation(); openSite(site.id, true); });
  el.addEventListener("mouseenter", () => showCursor(site));
  el.addEventListener("mouseleave", () => showCursor(state.selected ? SITE_BY_ID[state.selected] : null));
  return el;
}

function buildGlobe() {
  for (const s of DATA.sites) pins[s.id] = makePin(s);
  if (typeof Globe !== "function" || !webglAvailable()) {
    $("#scene-fallback").hidden = false;
    return;
  }
  const host = $("#scene");
  const light = window.matchMedia("(prefers-color-scheme: light)").matches;
  globe = new Globe(host, { animateIn: true })
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("img/earth-blue-marble.jpg")
    .bumpImageUrl("img/earth-topology.png")
    .showAtmosphere(true)
    .atmosphereColor(light ? "#7fa9bd" : "#a9c7d3")
    .atmosphereAltitude(0.16)
    .htmlElementsData(DATA.sites)
    .htmlLat("lat")
    .htmlLng("lon")
    .htmlAltitude(0.006)
    .htmlElement((d) => pins[d.id])
    .ringColor(() => (t) => `rgba(255,106,26,${(1 - t) * 0.9})`)
    .ringMaxRadius(4.5)
    .ringPropagationSpeed(2.2)
    .ringRepeatPeriod(1600)
    .arcColor(() => ["rgba(255,106,26,0.15)", "rgba(255,106,26,0.95)"])
    .arcStroke(0.45)
    .arcDashLength(0.35)
    .arcDashGap(0.18)
    .arcDashAnimateTime(2600)
    .arcAltitudeAutoScale(0.35);

  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.enableDamping = true;
  controls.minDistance = 140;
  controls.maxDistance = 600;
  controls.addEventListener("start", () => (controls.autoRotate = false));

  const resize = () => globe.width(host.clientWidth).height(host.clientHeight);
  resize();
  window.addEventListener("resize", resize);
  globe.pointOfView({ lat: 18, lng: 20, altitude: 2.35 });
  globe.onGlobeClick(() => { controls.autoRotate = false; });
}

function flyTo(site) {
  if (!globe) return;
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat: site.lat, lng: site.lon, altitude: 1.55 }, 1100);
}

function openSite(id, fly = false) {
  state.selected = id;
  renderSite(id);
  selectTab("site");
  drawPins(lastResult);
  showCursor(SITE_BY_ID[id]);
  if (fly) flyTo(SITE_BY_ID[id]);
}

function showCursor(site) {
  const el = $("#cursor-readout");
  if (!site) {
    el.innerHTML = `Drag to rotate · Scroll to zoom<br><b>Click a site</b> to open its card`;
    return;
  }
  el.innerHTML = `<b>${esc(site.name)}</b><br>${latStr(site.lat)} ${lonStr(site.lon)} · <span class="${site.is_known_analog ? "" : "sig"}">${site.is_known_analog ? "Known analog" : "New candidate"}</span>`;
}

/* ---------- main update ---------- */

function candidatePool() {
  return state.newOnly ? DATA.sites.filter((s) => !s.is_known_analog) : DATA.sites;
}

function update() {
  const t0 = performance.now();
  const reqs = requirementsForMission(REQS, state.mission);
  lastResult = greedyPortfolio({
    sites: candidatePool(), scores: SCORES, reqIds: reqs.map((r) => r.id), weights: state.weights, k: state.k, lambda: state.lambda,
  });
  drawPins(lastResult);
  drawGlobeLayers(lastResult);
  renderPortfolio(lastResult, reqs);
  if (state.selected) renderSite(state.selected);
  showCursor(state.selected ? SITE_BY_ID[state.selected] : null);
  writeHash();
  $("#perf").textContent = `· updated in ${(performance.now() - t0).toFixed(0)} ms`;
}

function drawPins(result) {
  const order = new Map((result?.picks || []).map((p, i) => [p.site.id, i]));
  for (const s of DATA.sites) {
    const el = pins[s.id];
    const i = order.get(s.id);
    const isPick = i !== undefined;
    el.classList.toggle("pick", isPick);
    el.classList.toggle("dual", DUAL.has(s.id));
    el.classList.toggle("dim", state.newOnly && s.is_known_analog);
    el.classList.toggle("selected", state.selected === s.id);
    el.querySelector(".reticle").textContent = isPick ? pad2(i + 1) : "";
    el.querySelector(".tag").textContent = isPick ? s.name : s.name;
    el.style.zIndex = isPick ? String(100 - i) : "1";
  }
}

function drawGlobeLayers(result) {
  if (!globe) return;
  const picks = result.picks.map((p) => p.site);
  globe.ringsData(picks.map((s) => ({ lat: s.lat, lng: s.lon })));
  globe.ringLat("lat").ringLng("lng");
  const arcs = [];
  for (let i = 1; i < picks.length; i++) {
    arcs.push({ startLat: picks[i - 1].lat, startLng: picks[i - 1].lon, endLat: picks[i].lat, endLng: picks[i].lon });
  }
  globe.arcsData(arcs);
}

/* ---------- Portfolio tab ---------- */

function renderPortfolio(result, reqs) {
  const n = result.picks.length;
  const activeReqs = reqs.filter((r) => (state.weights[r.id] || 0) > 0);
  const maxGain = Math.max(0.0001, ...result.picks.map((p) => p.gain));
  const missionText = MISSION_LABEL[state.mission];
  const counts = { covered: 0, partial: 0, gap: 0 };
  for (const r of activeReqs) counts[statusOf(result.best[r.id]?.score || 0)]++;

  $("#coverage-readout").innerHTML = n
    ? `<b>${pad2(n)} sites</b> · <span class="sig">${pct(result.coverage)}%</span> of ${missionText} testable needs<br>${counts.covered} covered · ${counts.partial} partial · ${counts.gap} gap · <span class="nocase">λ</span> ${state.lambda.toFixed(2)}`
    : `<b>No portfolio</b><br>No site adds enough coverage`;

  const picksHtml = result.picks.map((p, i) => {
    const s = p.site;
    const chips = p.improved
      .filter((x) => (state.weights[x.reqId] || 0) > 0)
      .map((x) => `<span class="chip ${x.status}" title="${esc(REQ_BY_ID[x.reqId].name)}: ${fmt(x.from)} → ${fmt(x.to)}">${x.reqId} ${STATUS_ICON[x.status]}</span>`).join("");
    return `
      <li class="pick" tabindex="0" data-site="${s.id}">
        <span class="idx ${s.is_known_analog ? "known" : "new"}">${pad2(i + 1)}</span>
        <div>
          <div class="name">${esc(s.name)}</div>
          <div class="meta">${esc(s.country)} · <span class="${s.is_known_analog ? "k" : "n"}">${s.is_known_analog ? "Known analog" : "New candidate"}</span> · T${s.access_tier}${DUAL.has(s.id) ? " · dual-use" : ""}</div>
          <div class="chips">${chips}</div>
        </div>
        <div class="gain"><b>+${fmt(p.gain)}</b>${p.penalty ? `−${fmt(p.penalty)} reach` : "gain"}
          <div class="gainbar" style="width:${Math.max(6, (p.gain / maxGain) * 64)}px"></div></div>
      </li>`;
  }).join("");

  const checklist = reqs.map((r) => {
    const w = state.weights[r.id] || 0;
    const b = result.best[r.id];
    const st = statusOf(b ? b.score : 0);
    const who = b && b.siteId ? `${esc(SITE_BY_ID[b.siteId].name)} · ${fmt(b.score)}` : "no site";
    return `<li class="${w === 0 ? "off" : ""}" title="${w === 0 ? "Weight 0: ignored" : `weight ${w}`}">
      <span class="status-icon ${st}" aria-label="${st}">${STATUS_ICON[st]}</span>
      <span><span class="rid">${r.id}</span>${esc(r.name)}</span>
      <span class="who" title="${who}">${who}</span></li>`;
  }).join("");

  const gaps = DATA.gaps.filter((g) => state.mission === "both" || g.missions.includes(state.mission));

  $("#tab-portfolio").innerHTML = `
    <div class="big">
      <span class="num">${pct(result.coverage)}<small>%</small></span>
      <span class="cap">of ${missionText} testable needs covered by <em>${n} site${n === 1 ? "" : "s"}</em>${state.newOnly ? ", new candidates only" : ""}</span>
    </div>
    <div class="bar" role="img" aria-label="Coverage ${pct(result.coverage)} percent"><span style="width:${result.coverage * 100}%"></span></div>
    <div class="tally"><span class="covered"><b>${counts.covered}</b> covered</span><span class="partial"><b>${counts.partial}</b> partial</span><span class="gap"><b>${counts.gap}</b> gap</span><span>of ${activeReqs.length}</span></div>

    <h3 class="sec">Portfolio · pick order</h3>
    ${n ? `<ol class="picks">${picksHtml}</ol>` : `<p class="empty">Empty portfolio.</p>`}
    ${n > 1 ? `<p class="sub">Gain shrinks with each pick: greedy max coverage shows diminishing returns.</p>` : ""}
    ${n < state.k ? `<p class="sub">Stopped at ${n} of ${state.k}: no remaining site adds more than 0.01 to the objective${state.lambda ? " after the reachability penalty" : ""}. Extra sites would only duplicate coverage.</p>` : ""}

    <h3 class="sec">Requirement checklist</h3>
    <ul class="checklist">${checklist}</ul>
    <p class="sub">✓ covered ≥ 0.7 · ◐ partial 0.4–0.7 · ✕ gap &lt; 0.4 (best score in portfolio)</p>

    <div class="gapbox">
      <p class="mono dim" style="margin:0 0 6px">Untestable on Earth</p>
      <h3>What Earth <em>can't</em> test</h3>
      <ul>${gaps.map((g) => `<li>${esc(g.text)}</li>`).join("")}</ul>
    </div>`;

  $("#tab-portfolio").querySelectorAll(".pick").forEach((el) => {
    const go = () => openSite(el.dataset.site, true);
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
}

/* ---------- Site card tab ---------- */

function formatValue(req, r) {
  if (r.missing) return `<span class="nodata">no data</span>`;
  if (req.type === "tags") return esc(r.value);
  const nd = req.unit === "mm/yr" ? 0 : req.unit === "°" ? 1 : 2;
  return `${fmt(r.value, nd)} ${esc(req.unit)}`;
}

function renderSite(id) {
  const s = SITE_BY_ID[id];
  if (!s) return;
  const reqs = requirementsForMission(REQS, state.mission);
  const ranked = rankSites(DATA.sites, SCORES, REQS, state.weights, state.mission);
  const rank = ranked.find((x) => x.site.id === id);
  const pickIdx = lastResult ? lastResult.picks.findIndex((p) => p.site.id === id) : -1;

  const rows = REQS.map((req) => {
    const r = SCORES[id][req.id];
    const inMission = reqs.includes(req);
    const st = statusOf(r.score);
    const targets = req.missions
      .filter((m) => DATA.targets[m]?.compare?.[req.id])
      .map((m) => `${esc(DATA.targets[m].short)}: ${esc(DATA.targets[m].compare[req.id])}`);
    return `
      <div class="score-row" style="${inMission ? "" : "opacity:.45"}">
        <div class="top">
          <span class="rname"><span class="rid">${req.id}</span>${esc(req.name)}</span>
          <span class="rval">${formatValue(req, r)} → <b>${fmt(r.score)}</b></span>
        </div>
        <div class="sbar"><span style="width:${r.score * 100}%;background:var(--${st})"></span></div>
        <div class="cmp">Earth: ${formatValue(req, r)}${targets.length ? ` &nbsp;vs&nbsp; ${targets.join(" · ")}` : ""}</div>
        <div class="src">${esc(req.type === "tags" ? `${req.source}; tag from site citation` : req.source)}${req.type === "ramp" ? ` · ramp ${req.zero} → ${req.full} ${esc(req.unit)}` : ""}</div>
      </div>`;
  }).join("");

  const feats = Object.entries(DATA.features).map(([k, meta]) => `
    <tr><td title="${esc(meta.source)}">${esc(meta.label)}</td><td>${s.features[k] === null ? '<span class="nodata">no data</span>' : `${fmt(s.features[k], k === "precip_mm_yr" || k === "elevation_m" ? 0 : 2)} ${esc(meta.unit)}`}</td></tr>`).join("");

  $("#tab-site").innerHTML = `
    <div class="site-head">
      <p class="mono dim" style="margin:0 0 8px">${esc(s.country)}</p>
      <h2>${esc(s.name)}</h2>
      <p class="coords">${latStr(s.lat)} &nbsp;${lonStr(s.lon)}</p>
      <div class="badges">
        <span class="badge ${s.is_known_analog ? "known" : "new"}">${s.is_known_analog ? `Known analog${s.analog_for ? ` · ${MISSION_LABEL[s.analog_for]}` : ""}` : "New candidate"}</span>
        <span class="badge">Access tier ${s.access_tier}</span>
        ${DUAL.has(id) ? `<span class="badge dual">Dual-use</span>` : ""}
        ${pickIdx >= 0 ? `<span class="badge">Portfolio #${pad2(pickIdx + 1)}</span>` : ""}
      </div>
    </div>
    <div class="statline">
      <div><span>${esc(MISSION_LABEL[state.mission])} score</span><b>${fmt(rank.score)}</b></div>
      <div><span>Rank</span><b>${rank.rank}<small style="font-size:12px;color:var(--bone-3)"> / ${ranked.length}</small></b></div>
      <div><span>Precip</span><b>${s.features.precip_mm_yr ?? "–"}<small style="font-size:12px;color:var(--bone-3)"> mm</small></b></div>
    </div>
    <p class="desc">${esc(s.description)}</p>
    <div class="chips">${s.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>

    <h3 class="sec">Per-requirement match</h3>
    ${rows}
    <p class="sub">Faded rows are not used for the current mission.</p>

    <h3 class="sec">Climate profile</h3>
    <table class="feat-table">${feats}</table>
    <p class="sub">NASA POWER climatology for the 0.5° grid cell${s.power_cell ? ` centred near ${fmt(s.power_cell.lat, 2)}, ${fmt(s.power_cell.lon, 2)}` : ""}; cell averages smooth out local extremes such as summits.</p>

    <h3 class="sec">Sources</h3>
    <p style="word-break:break-all"><a href="${esc(s.citation_url)}" target="_blank" rel="noopener">${esc(s.citation_url)}</a></p>
    <p class="sub"><a href="https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_MIN,T2M_MAX,T2M_RANGE,PRECTOTCORR,ALLSKY_SFC_UV_INDEX,PS,WS10M&community=RE&latitude=${s.lat}&longitude=${s.lon}&format=JSON" target="_blank" rel="noopener">Raw NASA POWER response for this site ↗</a></p>`;
}

/* ---------- Validation tab ---------- */

function renderValidation() {
  const v = VALIDATION;
  const rows = v.known.map((r) => `
    <tr data-site="${r.site.id}">
      <td>${esc(r.site.name)}</td>
      <td class="for">${MISSION_LABEL[r.mission]}</td>
      <td class="num">${fmt(r.score)}</td>
      <td class="num">${pad2(r.rank)} / ${v.n}</td>
      <td class="num">${r.topQuartile ? '<span class="yes">✓</span>' : '<span class="no">–</span>'}</td>
    </tr>`).join("");

  const topNew = (m) => v.rankings[m].filter((x) => !x.site.is_known_analog).slice(0, 5)
    .map((x) => `<li><a href="#" data-site="${x.site.id}">${esc(x.site.name)}</a> <span class="sub">${esc(x.site.country)} · ${fmt(x.score)} · rank ${x.rank}</span></li>`).join("");

  $("#tab-validation").innerHTML = `
    <div class="big">
      <span class="num">${v.inTop}<small>/${v.total}</small></span>
      <span class="cap">known analogs rank in the <em>top 25%</em> of all ${v.n} candidates</span>
    </div>
    <div class="bar"><span style="width:${(v.inTop / v.total) * 100}%"></span></div>
    <p class="sub">${v.inHalf} of ${v.total} rank in the top half. Each analog is ranked on the mission it is documented for (Balanced weights). Top-25% cutoff: rank ${v.cutoff}.</p>
    <h3 class="sec">Known analogs</h3>
    <table class="val">
      <thead><tr><th>Site</th><th>For</th><th class="num">Score</th><th class="num">Rank</th><th class="num">Top ¼</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note"><b>Reading this honestly.</b> The ${v.n - v.total} new candidates were themselves hand-picked as extreme, analog-like terrain, so known analogs compete against strong sites, not ordinary land. Analogs that rank low were mostly chosen for things TerraTwin does not score: acid-mine chemistry (Rio Tinto), underwater EVA operations (Pavilion Lake), carbonate mineralogy (Svalbard) or habitat logistics (MDRS).</p>
    <h3 class="sec">Top new candidates · Moon</h3><ol class="top-new">${topNew("moon")}</ol>
    <h3 class="sec">Top new candidates · Mars</h3><ol class="top-new">${topNew("mars")}</ol>`;

  $("#tab-validation").addEventListener("click", (e) => {
    const el = e.target.closest("[data-site]");
    if (!el) return;
    e.preventDefault();
    openSite(el.dataset.site, true);
  });
}

/* ---------- CSV export ---------- */

function exportCsv() {
  if (!lastResult) return;
  const reqIds = requirementsForMission(REQS, state.mission).map((r) => r.id);
  const header = ["pick", "id", "name", "country", "lat", "lon", "known_analog", "access_tier", "gain", "penalty", "cumulative_coverage", ...reqIds];
  const lines = [header.join(",")];
  lastResult.picks.forEach((p, i) => {
    const s = p.site;
    lines.push([i + 1, s.id, `"${s.name.replace(/"/g, '""')}"`, `"${s.country}"`, s.lat, s.lon, s.is_known_analog, s.access_tier,
      p.gain.toFixed(3), p.penalty.toFixed(3), p.cumulativeCoverage.toFixed(3), ...reqIds.map((id) => SCORES[s.id][id].score.toFixed(2))].join(","));
  });
  lines.push("");
  lines.push(`# mission=${state.mission},preset=${state.preset},k=${state.k},lambda=${state.lambda},new_only=${state.newOnly},coverage=${lastResult.coverage.toFixed(3)}`);
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `terratwin-portfolio-${state.mission}-k${state.k}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

boot();
