// Builds presentation/TerraTwin-demo.pptx (7 slides) with pptxgenjs.
// Usage: node presentation/build_deck.cjs   (needs pptxgenjs; screenshots in presentation/)
const path = require("path");
const pptxgen = require(process.env.PPTXGENJS || "pptxgenjs");
const { applyTheme } = require(process.env.APPLY_THEME || "./apply_theme.js");

const DIR = __dirname;
const OUT = path.join(DIR, "TerraTwin-demo.pptx");
const img = (f) => path.join(DIR, f);

const THEME = {
  name: "TerraTwin Telemetry",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "090D12",   // slide background
    lt1: "E3EAEE",   // primary text
    dk2: "131B24",   // panels
    lt2: "8A98A3",   // muted text
    accent1: "C6F24E", // lime signal
    accent2: "5CC8E6", // cyan: known analogs
    accent3: "5FE3B5", // mint: covered
    accent4: "F2C14E", // amber: partial
    accent5: "FF6B81", // rose: gap
    accent6: "26323F", // hairlines
    hlink: "5CC8E6",
    folHlink: "8A98A3",
  },
};
const HEX = THEME.colors;
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.title = "TerraTwin: Analog Portfolio Planner";
pres.author = "Team QBIT";
pres.subject = "NASA Space Apps 2026 submission demo";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// Crosshair marks at the four corners: the deck's visual motif (matches the app bezel).
function crosshairs() {
  const objs = [];
  const s = 0.14;
  for (const [x, y] of [[0.22, 0.22], [9.78, 0.22], [0.22, 5.405], [9.78, 5.405]]) {
    objs.push({ line: { x: x - s / 2, y, w: s, h: 0, line: { color: C.background2, width: 0.75 } } });
    objs.push({ line: { x, y: y - s / 2, w: 0, h: s, line: { color: C.background2, width: 0.75 } } });
  }
  return objs;
}

pres.defineSlideMaster({
  title: "TT_TITLE",
  background: { color: C.text1 },
  objects: crosshairs(),
});

pres.defineSlideMaster({
  title: "TT_CONTENT",
  background: { color: C.text1 },
  margin: [0.5, 0.5, 0.5, 0.5],
  objects: [
    ...crosshairs(),
    { placeholder: { options: { name: "eyebrow", type: "body", x: 0.5, y: 0.34, w: 9, h: 0.28, fontFace: MONO, fontSize: 10, color: C.accent1, charSpacing: 1, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.62, w: 9, h: 0.72, fontFace: "Arial", fontSize: 28, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
    { text: { text: "TERRATWIN  ·  TEAM QBIT  ·  NASA SPACE APPS 2026", options: { x: 0.5, y: 5.17, w: 6, h: 0.22, fontFace: MONO, fontSize: 8, color: C.background2, margin: 0, charSpacing: 1 } } },
  ],
  slideNumber: { x: 9.1, y: 5.17, w: 0.4, h: 0.22, fontFace: MONO, fontSize: 8, color: C.background2, align: "right" },
});

const T = (slide, text, opts) => slide.addText(text, { isTextBox: true, margin: 0, ...opts });
const panel = (slide, name, x, y, w, h, extra = {}) =>
  slide.addShape(pres.shapes.RECTANGLE, { objectName: name, x, y, w, h, fill: { color: C.text2 }, line: { color: C.accent6, width: 0.75 }, ...extra });

/* ---------------- Slide 1: title ---------------- */
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "TT_TITLE", sectionTitle: "Opening" });
  s.addShape(pres.shapes.OVAL, { objectName: "Live dot", x: 0.5, y: 0.72, w: 0.1, h: 0.1, fill: { color: C.accent1 }, line: { type: "none" } });
  T(s, "NASA SPACE APPS 2026  ·  TEAM QBIT", { objectName: "Eyebrow", x: 0.7, y: 0.66, w: 4, h: 0.22, fontFace: MONO, fontSize: 10, color: C.background1, charSpacing: 1 });
  T(s, "TerraTwin", { objectName: "Title", x: 0.5, y: 1.05, w: 4.3, h: 0.9, fontFace: "Arial", fontSize: 54, bold: true, color: C.background1 });
  T(s, [
    { text: "No place on Earth is the ", options: { color: C.background1 } },
    { text: "Moon", options: { color: C.accent1, bold: true } },
    { text: ". So which places, together, come closest?", options: { color: C.background1 } },
  ], { objectName: "Tagline", x: 0.5, y: 2.05, w: 4.0, h: 0.95, fontSize: 20, valign: "top" });
  T(s, "An analog portfolio planner: the smallest set of reachable Earth sites that lets us test what a lunar south-pole base and a Mars outpost need, and an honest list of what Earth can't test.",
    { objectName: "Summary", x: 0.5, y: 3.1, w: 4.0, h: 0.95, fontSize: 13, color: C.background2, valign: "top" });
  T(s, "CHALLENGE  ·  Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars",
    { objectName: "Challenge", x: 0.5, y: 4.55, w: 4.1, h: 0.45, fontFace: MONO, fontSize: 8.5, color: C.background2, valign: "top" });
  s.addImage({ objectName: "App screenshot", path: img("app-portfolio.png"), x: 4.85, y: 1.35, w: 4.9, h: 2.756, altText: "TerraTwin app: 3D globe with a five-site portfolio and coverage panel" });
  s.addShape(pres.shapes.RECTANGLE, { objectName: "Screenshot frame", x: 4.85, y: 1.35, w: 4.9, h: 2.756, fill: { type: "none" }, line: { color: C.accent6, width: 0.75 } });
  T(s, "LIVE DEMO  ·  terratwin-rust.vercel.app", { objectName: "Demo URL", x: 4.85, y: 4.2, w: 4.9, h: 0.22, fontFace: MONO, fontSize: 8.5, color: C.accent1, align: "right" });
  s.addNotes("No place on Earth is the Moon, and no place is Mars. Existing analog lists rank single 'best matches', but every Earth site matches only some factors. TerraTwin turns the question around: which small set of reachable Earth sites, together, lets NASA test what a lunar south-pole base and a Mars outpost need, and what can't be tested on Earth at all?");
}

/* ---------------- Slide 2: the insight ---------------- */
pres.addSection({ title: "Approach" });
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Approach" });
  s.addText("[01]  THE INSIGHT", { placeholder: "eyebrow" });
  s.addText("No single site matches, so we plan a portfolio", { placeholder: "title" });

  const pts = [
    ["One site, one match", "Atacama is dry but warm. Haughton is cold but wet. Every analog nails some factors and misses others."],
    ["Break each base into needs", "14 testable requirements, each measured with NASA data or cited geology, each with a source."],
    ["Cover needs, not rank sites", "Pick the fewest sites that together cover the most weighted needs, then say what's left."],
  ];
  pts.forEach(([h, b], i) => {
    const y = 1.55 + i * 1.12;
    s.addShape(pres.shapes.OVAL, { objectName: `Point ${i + 1} marker`, x: 0.5, y: y + 0.02, w: 0.36, h: 0.36, fill: { type: "none" }, line: { color: C.accent1, width: 1.25 } });
    T(s, String(i + 1).padStart(2, "0"), { objectName: `Point ${i + 1} number`, x: 0.5, y: y + 0.02, w: 0.36, h: 0.36, fontFace: MONO, fontSize: 9, color: C.accent1, align: "center", valign: "middle" });
    T(s, h, { objectName: `Point ${i + 1} head`, x: 1.05, y, w: 3.3, h: 0.3, fontSize: 16, bold: true, color: C.background1 });
    T(s, b, { objectName: `Point ${i + 1} body`, x: 1.05, y: y + 0.32, w: 3.3, h: 0.66, fontSize: 12, color: C.background2, valign: "top" });
  });

  // Requirement map: Moon-only | shared | Mars-only
  const cols = [
    { label: "MOON ONLY", color: C.background1, items: [["M1", "Extreme cold"], ["M2", "Polar light"], ["M3", "Regolith analog"]] },
    { label: "BOTH", color: C.accent1, items: [["M4", "Impact craters"], ["M5", "Ground ice"], ["M6", "Lava tubes"], ["M7", "Barren surface"], ["R4", "Daily temp swing"], ["R7", "Dust and wind"]] },
    { label: "MARS ONLY", color: C.background1, items: [["R1", "Hyperaridity"], ["R2", "High UV"], ["R3", "Low pressure"], ["R5", "Basaltic terrain"], ["R6", "Lakebeds, salts"]] },
  ];
  const x0 = 4.75, cw = 1.55, gap = 0.1;
  panel(s, "Requirement map panel", x0 - 0.15, 1.45, 3 * cw + 2 * gap + 0.3, 3.55);
  cols.forEach((c, ci) => {
    const x = x0 + ci * (cw + gap);
    T(s, c.label, { objectName: `${c.label} label`, x, y: 1.6, w: cw, h: 0.22, fontFace: MONO, fontSize: 8.5, color: c.color, charSpacing: 1 });
    c.items.forEach(([id, name], i) => {
      const y = 1.9 + i * 0.44;
      s.addShape(pres.shapes.RECTANGLE, { objectName: `${id} chip`, x, y, w: cw, h: 0.38, fill: { color: C.text1 }, line: { color: ci === 1 ? C.accent1 : C.accent6, width: 0.75 } });
      T(s, [
        { text: id + "  ", options: { fontFace: MONO, fontSize: 8, color: C.background2 } },
        { text: name, options: { fontSize: 10.5, color: C.background1 } },
      ], { objectName: `${id} text`, x: x + 0.08, y, w: cw - 0.12, h: 0.38, valign: "middle" });
    });
  });
  T(s, "14 requirements  ·  every one cites a NASA or peer-reviewed source", { objectName: "Map caption", x: x0, y: 4.6, w: 3 * cw + 2 * gap, h: 0.25, fontFace: MONO, fontSize: 8, color: C.background2 });
  s.addNotes("The core insight: no single Earth site matches the Moon or Mars on every factor. So instead of ranking one best match, TerraTwin breaks each base into 14 requirements: three Moon-only, five Mars-only, six shared. Each requirement is measured with NASA POWER climate data or cited geology, and every one carries a source.");
}

/* ---------------- Slide 3: how it works ---------------- */
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Approach" });
  s.addText("[02]  HOW IT WORKS", { placeholder: "eyebrow" });
  s.addText("From NASA data to a portfolio in four steps", { placeholder: "title" });

  const steps = [
    ["Requirements", "14 needs for a south-pole base and Jezero, with thresholds and citations"],
    ["Score", "71 Earth sites scored 0–1 per need from NASA POWER climatology and geology tags"],
    ["Greedy portfolio", "Add the site with the biggest coverage gain, minus a reachability penalty"],
    ["Gap list", "Gravity, vacuum, radiation, lunar night: shown always, never scored"],
  ];
  const w = 2.0, g = 0.33, y = 1.6, h = 1.85;
  steps.forEach(([head, body], i) => {
    const x = 0.5 + i * (w + g);
    panel(s, `Step ${i + 1} card`, x, y, w, h, i === 2 ? { line: { color: C.accent1, width: 1 } } : {});
    T(s, `[${String(i + 1).padStart(2, "0")}]`, { objectName: `Step ${i + 1} number`, x: x + 0.18, y: y + 0.18, w: 1, h: 0.25, fontFace: MONO, fontSize: 11, color: C.accent1 });
    T(s, head, { objectName: `Step ${i + 1} head`, x: x + 0.18, y: y + 0.5, w: w - 0.3, h: 0.32, fontSize: 16, bold: true, color: C.background1 });
    T(s, body, { objectName: `Step ${i + 1} body`, x: x + 0.18, y: y + 0.88, w: w - 0.32, h: 0.85, fontSize: 11.5, color: C.background2, valign: "top" });
    if (i < steps.length - 1) {
      s.addShape(pres.shapes.LINE, { objectName: `Arrow ${i + 1}`, x: x + w + 0.05, y: y + h / 2, w: g - 0.1, h: 0, line: { color: C.accent1, width: 1.25, endArrowType: "triangle" } });
    }
  });

  panel(s, "Objective panel", 0.5, 3.75, 9, 1.1);
  T(s, "OBJECTIVE", { objectName: "Objective label", x: 0.7, y: 3.88, w: 2, h: 0.2, fontFace: MONO, fontSize: 8.5, color: C.background2, charSpacing: 1 });
  T(s, "max  Σ w · best score  −  λ · Σ (tier − 1)", { objectName: "Objective formula", x: 0.7, y: 4.12, w: 5.6, h: 0.35, fontFace: MONO, fontSize: 13, color: C.accent1 });
  T(s, "Stops at k sites or when no site adds > 0.01. Greedy max coverage is fast, explainable and within ~63% of optimal.",
    { objectName: "Objective note", x: 0.7, y: 4.48, w: 5.8, h: 0.3, fontSize: 11, color: C.background2 });
  T(s, [
    { text: "Static site, no backend", options: { bold: true, color: C.background1, breakLine: true } },
    { text: "Scoring runs in the browser; controls update in ~2 ms", options: { color: C.background2 } },
  ], { objectName: "Stack note", x: 6.7, y: 3.95, w: 2.6, h: 0.75, fontSize: 11, valign: "top" });
  s.addNotes("How it works. One: requirements with thresholds and citations. Two: we score 71 Earth sites, 0 to 1 per requirement, using NASA POWER climatology (temperature, precipitation, UV, pressure, wind) plus cited geology tags. Three: a greedy solver adds whichever site gives the biggest gain in weighted coverage, minus a penalty for hard-to-reach sites. Four: things no Earth site can test are listed, never scored. It's a static site; everything runs in the browser in a couple of milliseconds.");
}

/* ---------------- Slide 4: the result ---------------- */
pres.addSection({ title: "Results" });
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Results" });
  s.addText("[03]  THE RESULT", { placeholder: "eyebrow" });
  s.addText("Five sites cover 95% of what Earth can test", { placeholder: "title" });

  T(s, "95%", { objectName: "Coverage stat", x: 0.5, y: 1.5, w: 3.2, h: 1.1, fontFace: "Arial", fontSize: 72, bold: true, color: C.accent1 });
  T(s, "of weighted Moon + Mars testable needs, Balanced preset, λ = 0.10", { objectName: "Coverage label", x: 0.5, y: 2.6, w: 3.2, h: 0.5, fontSize: 12, color: C.background2, valign: "top" });

  const picks = [
    ["01", "Harrat Khaybar", "Saudi Arabia", false],
    ["02", "Haughton Crater", "Canada", true],
    ["03", "Ojos del Salado", "Chile", false],
    ["04", "Allan Hills", "Antarctica", false],
    ["05", "Wadi Rum", "Jordan", false],
  ];
  picks.forEach(([n, name, ctry, known], i) => {
    const y = 3.22 + i * 0.36;
    T(s, n, { objectName: `Pick ${n} number`, x: 0.5, y, w: 0.35, h: 0.3, fontFace: MONO, fontSize: 9.5, color: known ? C.accent2 : C.accent1, valign: "middle" });
    T(s, [
      { text: name, options: { color: C.background1, bold: true } },
      { text: `  ${ctry}`, options: { color: C.background2 } },
    ], { objectName: `Pick ${n} name`, x: 0.88, y, w: 2.9, h: 0.3, fontSize: 12, valign: "middle" });
  });

  panel(s, "Chart panel", 4.1, 1.45, 5.4, 3.5);
  s.addChart(pres.charts.BAR, [{ name: "Marginal gain", labels: picks.map((p) => p[1]), values: [7.12, 4.01, 0.98, 0.48, 0.03] }], {
    objectName: "Marginal gain chart",
    x: 4.25, y: 1.55, w: 5.1, h: 2.85, barDir: "col",
    chartColors: [HEX.accent1],
    showTitle: true, title: "Gain added by each pick (diminishing returns)", titleColor: HEX.lt1, titleFontSize: 12, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: HEX.lt1, dataLabelFontSize: 10, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.00",
    catAxisLabelColor: HEX.lt2, catAxisLabelFontSize: 9, catAxisLabelFontFace: "+mn-lt",
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
    catAxisLineShow: true, catAxisLineColor: HEX.accent6,
    showLegend: false, barGapWidthPct: 55,
  });
  T(s, "4 of the 5 picks are new candidates, not existing analog sites", { objectName: "Chart caption", x: 4.3, y: 4.45, w: 5.0, h: 0.3, fontSize: 11.5, color: C.accent1 });
  s.addNotes("Demo: Mission set to Both, five sites. The portfolio appears in pick order and covers 95 percent of the weighted, testable needs. Notice the gains: the first pick adds over 7 points, the fifth adds almost nothing. That's diminishing returns, and the app stops early when an extra site would only duplicate coverage. Four of the five picks are new candidates, sites not used as analogs before. Only Haughton is an existing analog.");
}

/* ---------------- Slide 5: the tool ---------------- */
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Results" });
  s.addText("[04]  THE TOOL", { placeholder: "eyebrow" });
  s.addText("Every site is characterized, not just ranked", { placeholder: "title" });
  s.addImage({ objectName: "Site card screenshot", path: img("app-site.png"), x: 0.5, y: 1.5, w: 5.6, h: 3.15, altText: "TerraTwin site card for Lonar Crater, India, next to the 3D globe" });
  s.addShape(pres.shapes.RECTANGLE, { objectName: "Screenshot frame", x: 0.5, y: 1.5, w: 5.6, h: 3.15, fill: { type: "none" }, line: { color: C.accent6, width: 0.75 } });
  T(s, "Lonar Crater, India: impact crater in Deccan basalt, flagged New candidate", { objectName: "Screenshot caption", x: 0.5, y: 4.72, w: 5.6, h: 0.25, fontSize: 10.5, color: C.background2 });

  const feats = [
    ["Site cards", "Raw value → score for all 14 needs, Earth vs Moon/Mars target values, and the source behind each number."],
    ["Mission controls", "Moon · Mars · Both, five purpose presets, editable weights, portfolio size and reachability."],
    ["New candidates only", "One toggle hides known analogs to answer: where should NASA look next?"],
  ];
  feats.forEach(([h, b], i) => {
    const y = 1.5 + i * 1.08;
    s.addShape(pres.shapes.OVAL, { objectName: `Feature ${i + 1} dot`, x: 6.45, y: y + 0.08, w: 0.14, h: 0.14, fill: { color: C.accent1 }, line: { type: "none" } });
    T(s, h, { objectName: `Feature ${i + 1} head`, x: 6.75, y, w: 2.75, h: 0.3, fontSize: 15, bold: true, color: C.background1 });
    T(s, b, { objectName: `Feature ${i + 1} body`, x: 6.75, y: y + 0.32, w: 2.75, h: 0.7, fontSize: 11, color: C.background2, valign: "top" });
  });
  s.addNotes("Click Lonar Crater in India: an impact crater in Deccan basalt and a close analog for craters in Martian basalt. It's flagged New candidate. The site card shows every requirement: the raw NASA value, its score, and the Moon or Mars target value next to it, with the source. You can switch missions, pick a purpose such as ISRU or astrobiology, change the number of sites or the reachability penalty, or show new candidates only. Views are shareable by link and exportable as CSV.");
}

/* ---------------- Slide 6: validation ---------------- */
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Results" });
  s.addText("[05]  VALIDATION", { placeholder: "eyebrow" });
  s.addText("New candidates rank alongside known analogs", { placeholder: "title" });

  panel(s, "Top-half stat card", 0.5, 1.5, 2.6, 1.55);
  T(s, "12/16", { objectName: "Top-half stat", x: 0.7, y: 1.62, w: 2.3, h: 0.75, fontFace: "Arial", fontSize: 44, bold: true, color: C.accent1 });
  T(s, "known analogs rank in the top half of all 71 sites", { objectName: "Top-half label", x: 0.7, y: 2.4, w: 2.25, h: 0.55, fontSize: 11.5, color: C.background2, valign: "top" });
  panel(s, "Top-quartile stat card", 0.5, 3.2, 2.6, 1.55);
  T(s, "7/16", { objectName: "Top-quartile stat", x: 0.7, y: 3.32, w: 2.3, h: 0.75, fontFace: "Arial", fontSize: 44, bold: true, color: C.background1 });
  T(s, "in the top 25% (target was 60%; we report it, not tune it)", { objectName: "Top-quartile label", x: 0.7, y: 4.1, w: 2.25, h: 0.55, fontSize: 11.5, color: C.background2, valign: "top" });

  const lists = [
    ["TOP NEW CANDIDATES · MOON", ["Ross Island (Mt Erebus)", "Mistastin Lake Crater", "Tolbachik, Kamchatka", "Allan Hills", "Popigai Crater"]],
    ["TOP NEW CANDIDATES · MARS", ["Licancabur, Altiplano", "Ojos del Salado", "Monturaqui Crater", "Harrat Khaybar", "Ngari, western Tibet"]],
  ];
  lists.forEach(([label, items], li) => {
    const x = 3.4 + li * 3.1;
    T(s, label, { objectName: `${label} heading`, x, y: 1.52, w: 2.9, h: 0.22, fontFace: MONO, fontSize: 8.5, color: C.accent1, charSpacing: 1 });
    items.forEach((name, i) => {
      const y = 1.85 + i * 0.4;
      T(s, String(i + 1).padStart(2, "0"), { objectName: `${label} ${i + 1} rank`, x, y, w: 0.35, h: 0.32, fontFace: MONO, fontSize: 9, color: C.background2, valign: "middle" });
      T(s, name, { objectName: `${label} ${i + 1} name`, x: x + 0.38, y, w: 2.5, h: 0.32, fontSize: 13, color: C.background1, valign: "middle" });
      s.addShape(pres.shapes.LINE, { objectName: `${label} ${i + 1} rule`, x, y: y + 0.36, w: 2.85, h: 0, line: { color: C.accent6, width: 0.5 } });
    });
  });
  T(s, "Low-ranked analogs were chosen for things we don't score: acid chemistry (Rio Tinto), underwater EVA (Pavilion Lake), carbonates (Svalbard), habitat logistics (MDRS).",
    { objectName: "Honesty note", x: 3.4, y: 4.0, w: 6.0, h: 0.7, fontSize: 11, color: C.background2, valign: "top" });
  s.addNotes("Validation tab. We checked the method against 16 sites NASA and others already use as analogs. 12 of 16 rank in the top half of all 71 candidates; 7 rank in the top quarter. That's below the 60 percent we targeted, and we report it honestly instead of tuning until it passes. The low-ranked analogs were chosen for chemistry or operations, which TerraTwin doesn't score. Meanwhile the top new candidates, like Mount Erebus for the Moon and Licancabur for Mars, rank right alongside the known sites.");
}

/* ---------------- Slide 7: gaps + close ---------------- */
pres.addSection({ title: "Close" });
{
  const s = pres.addSlide({ masterName: "TT_CONTENT", sectionTitle: "Close" });
  s.addText("[06]  WHAT EARTH CAN'T TEST", { placeholder: "eyebrow" });
  s.addText("Some needs no Earth site can meet", { placeholder: "title" });

  const gaps = [
    "1/6 g (Moon) and 0.38 g (Mars) gravity",
    "Hard vacuum and a 0.6 kPa CO₂ atmosphere",
    "Permanently shadowed craters near 40 K",
    "Sharp, electrostatically charged lunar dust",
    "Galactic cosmic rays and solar particle events",
    "The two-week lunar night",
  ];
  panel(s, "Gap list panel", 0.5, 1.5, 4.6, 3.45, { line: { color: C.accent5, width: 0.75 } });
  gaps.forEach((g, i) => {
    const y = 1.68 + i * 0.52;
    T(s, "✕", { objectName: `Gap ${i + 1} mark`, x: 0.72, y, w: 0.3, h: 0.36, fontFace: MONO, fontSize: 12, color: C.accent5, valign: "middle" });
    T(s, g, { objectName: `Gap ${i + 1} text`, x: 1.08, y, w: 3.85, h: 0.36, fontSize: 13.5, color: C.background1, valign: "middle" });
  });

  T(s, "NASA DATA USED", { objectName: "Data heading", x: 5.5, y: 1.52, w: 4, h: 0.22, fontFace: MONO, fontSize: 8.5, color: C.accent1, charSpacing: 1 });
  const data = ["NASA POWER", "LRO Diviner", "LRO LOLA", "MGS MOLA", "Perseverance MEDA", "MODIS MOD13Q1", "LCROSS", "Blue Marble"];
  data.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.5 + col * 2.02, y = 1.85 + row * 0.42;
    s.addShape(pres.shapes.RECTANGLE, { objectName: `${d} chip`, x, y, w: 1.92, h: 0.34, fill: { color: C.text2 }, line: { color: C.accent6, width: 0.75 } });
    T(s, d, { objectName: `${d} label`, x: x + 0.1, y, w: 1.8, h: 0.34, fontSize: 11, color: C.background1, valign: "middle" });
  });
  T(s, [
    { text: "Try it: ", options: { color: C.background2 } },
    { text: "terratwin-rust.vercel.app", options: { color: C.accent1, bold: true, hyperlink: { url: "https://terratwin-rust.vercel.app/" }, breakLine: true } },
    { text: "Code: ", options: { color: C.background2 } },
    { text: "github.com/SoujanyaChatti/TerraTwin", options: { color: C.background1, hyperlink: { url: "https://github.com/SoujanyaChatti/TerraTwin" } } },
  ], { objectName: "Links", x: 5.5, y: 3.65, w: 4, h: 0.6, fontSize: 12.5, valign: "top" });
  T(s, "Code written with assistance from Claude (Anthropic); site research assisted by Claude. All data values come from the listed sources.",
    { objectName: "SI disclosure", x: 5.5, y: 4.35, w: 4, h: 0.5, fontSize: 9.5, color: C.background2, valign: "top" });
  s.addNotes("Finally, the gap box: what Earth can't test. Reduced gravity, vacuum, 40 kelvin shadowed craters, charged lunar dust, cosmic radiation and the two-week lunar night. TerraTwin always shows these, so the portfolio never overstates what Earth analogs can do. Everything runs on NASA data (POWER, LRO, MOLA, Perseverance MEDA), and it's live at the link on screen.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
