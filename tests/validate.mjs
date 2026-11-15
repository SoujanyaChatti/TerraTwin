// Validation check: do known Moon/Mars analogs rank in the top quartile?
// Each known analog is ranked among all candidates on the mission it is
// documented as an analog for (candidates.csv `analog_for`), Balanced weights.
// Usage: node tests/validate.mjs [--all]
// Exit code 1 if fewer than 60% are in the top 25% (PRD: fail loudly).
import { readFileSync } from "node:fs";
import { scoreAll, presetWeights, validateKnownAnalogs } from "../web/js/engine.js";

const PASS_SHARE = 0.6;
const data = JSON.parse(readFileSync(new URL("../web/data/sites.json", import.meta.url)));
const scores = scoreAll(data.sites, data.requirements);
const weights = presetWeights(data.presets.balanced, data.requirements);
const v = validateKnownAnalogs(data.sites, scores, data.requirements, weights);

console.log(`Known-analog validation (preset: Balanced, ${v.n} sites, top-25% cutoff = rank ${v.cutoff})\n`);
console.log("rank  score  mission  top25  site");
for (const r of v.known) {
  console.log(`${String(r.rank).padStart(4)}  ${r.score.toFixed(3)}  ${r.mission.padEnd(7)}  ${r.topQuartile ? " yes " : "  -  "}  ${r.site.name}`);
}
console.log(`\n${v.inTop} of ${v.total} known analogs rank in the top 25% (${(v.share * 100).toFixed(0)}%); ${v.inHalf} of ${v.total} in the top half`);

if (process.argv.includes("--all")) {
  for (const m of ["moon", "mars"]) {
    console.log(`\nFull ranking (${m}):`);
    for (const r of v.rankings[m].slice(0, 25)) {
      console.log(`${String(r.rank).padStart(4)}  ${r.score.toFixed(3)}  ${r.site.is_known_analog ? "K" : " "}  ${r.site.name}`);
    }
  }
}

if (v.share < PASS_SHARE) {
  console.error(`\nFAIL: ${(v.share * 100).toFixed(0)}% < ${PASS_SHARE * 100}% of known analogs are in the top quartile. Tune thresholds (not the analog list) and log the change in README.md.`);
  process.exit(1);
}
console.log("PASS");
