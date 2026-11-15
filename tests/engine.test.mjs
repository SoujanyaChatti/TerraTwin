import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  rampScore, tagScore, scoreRequirement, scoreAll, requirementsForMission,
  presetWeights, greedyPortfolio, isDualUse, statusOf, validateKnownAnalogs,
} from "../web/js/engine.js";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("ramp: rising, falling, clipping and midpoint", () => {
  close(rampScore(5, 0, 10), 0.5);
  close(rampScore(-20, 0, -40), 0.5); // falling ramp (colder is better)
  close(rampScore(-100, 0, -40), 1);
  close(rampScore(30, 0, -40), 0);
  close(rampScore(137.5, 250, 25), 0.5);
  close(rampScore(0, 0, 10), 0);
  close(rampScore(10, 0, 10), 1);
});

test("ramp: missing values return null; equal thresholds act as a step", () => {
  assert.equal(rampScore(null, 0, 1), null);
  assert.equal(rampScore(undefined, 0, 1), null);
  assert.equal(rampScore(NaN, 0, 1), null);
  assert.equal(rampScore(5, 5, 5), 1);
  assert.equal(rampScore(4, 5, 5), 0);
});

test("tags: primary 1, partial 0.5, none 0", () => {
  assert.equal(tagScore(["lava_tube", "basalt"], ["lava_tube"], ["cave"]), 1);
  assert.equal(tagScore(["cave"], ["lava_tube"], ["cave"]), 0.5);
  assert.equal(tagScore(["barren"], ["lava_tube"], ["cave"]), 0);
  assert.equal(tagScore(undefined, ["lava_tube"]), 0);
});

test("missing feature scores 0 and is flagged", () => {
  const req = { id: "R1", type: "ramp", feature: "precip_mm_yr", zero: 250, full: 25 };
  const r = scoreRequirement({ id: "x", tags: [], features: { precip_mm_yr: null } }, req);
  assert.deepEqual(r, { score: 0, value: null, missing: true });
});

// Toy dataset: three requirements, one site that covers everything.
const reqs = [
  { id: "A", missions: ["moon"], type: "tags", primary: ["a"] },
  { id: "B", missions: ["mars"], type: "tags", primary: ["b"] },
  { id: "C", missions: ["moon", "mars"], type: "tags", primary: ["c"] },
];
const sites = [
  { id: "only_a", access_tier: 1, tags: ["a"] },
  { id: "all", access_tier: 1, tags: ["a", "b", "c"] },
  { id: "only_b", access_tier: 1, tags: ["b"] },
];
const scores = scoreAll(sites, reqs);
const ones = { A: 1, B: 1, C: 1 };

test("greedy picks the obvious all-covering site first and then stops", () => {
  const res = greedyPortfolio({ sites, scores, reqIds: ["A", "B", "C"], weights: ones, k: 3, lambda: 0 });
  assert.equal(res.picks.length, 1);
  assert.equal(res.picks[0].site.id, "all");
  close(res.coverage, 1);
});

test("k = 0 returns an empty portfolio", () => {
  const res = greedyPortfolio({ sites, scores, reqIds: ["A", "B", "C"], weights: ones, k: 0 });
  assert.equal(res.picks.length, 0);
  close(res.coverage, 0);
});

test("a weight of 0 drops a requirement", () => {
  const s2 = [
    { id: "a_site", access_tier: 1, tags: ["a"] },
    { id: "b_site", access_tier: 1, tags: ["b"] },
  ];
  const sc = scoreAll(s2, reqs);
  const res = greedyPortfolio({ sites: s2, scores: sc, reqIds: ["A", "B"], weights: { A: 0, B: 1 }, k: 2, lambda: 0 });
  assert.deepEqual(res.picks.map((p) => p.site.id), ["b_site"]);
  close(res.coverage, 1);
});

test("reachability penalty prefers the easier site and can block hard ones", () => {
  const s3 = [
    { id: "hard", access_tier: 3, tags: ["a"] },
    { id: "easy", access_tier: 1, tags: ["a"] },
  ];
  const sc = scoreAll(s3, reqs);
  const res = greedyPortfolio({ sites: s3, scores: sc, reqIds: ["A"], weights: { A: 1 }, k: 1, lambda: 0.3 });
  assert.equal(res.picks[0].site.id, "easy");
  const blocked = greedyPortfolio({ sites: [s3[0]], scores: sc, reqIds: ["A"], weights: { A: 1 }, k: 1, lambda: 0.5 });
  assert.equal(blocked.picks.length, 0); // gain 1 - 0.5*2 = 0 <= minGain
});

test("gains are non-increasing (diminishing returns)", () => {
  const res = greedyPortfolio({ sites, scores, reqIds: ["A", "B", "C"], weights: ones, k: 3, lambda: 0 });
  for (let i = 1; i < res.picks.length; i++) assert.ok(res.picks[i].gain <= res.picks[i - 1].gain);
});

test("mission filter, presets, status and dual-use", () => {
  assert.deepEqual(requirementsForMission(reqs, "moon").map((r) => r.id), ["A", "C"]);
  assert.deepEqual(requirementsForMission(reqs, "both").map((r) => r.id), ["A", "B", "C"]);
  assert.deepEqual(presetWeights({ emphasis: ["B"] }, reqs), { A: 1, B: 3, C: 1 });
  assert.equal(statusOf(0.7), "covered");
  assert.equal(statusOf(0.5), "partial");
  assert.equal(statusOf(0.39), "gap");
  const dualReqs = [
    { id: "m1", missions: ["moon"] }, { id: "m2", missions: ["moon"] },
    { id: "r1", missions: ["mars"] }, { id: "r2", missions: ["mars"] },
    { id: "both", missions: ["moon", "mars"] },
  ];
  const s = (v) => ({ score: v });
  assert.equal(isDualUse({ m1: s(1), m2: s(0.8), r1: s(0.7), r2: s(0.9), both: s(0) }, dualReqs), true);
  assert.equal(isDualUse({ m1: s(1), m2: s(0.6), r1: s(1), r2: s(1), both: s(1) }, dualReqs), false);
});

test("real data: sites.json is well formed and the engine runs on it", () => {
  const data = JSON.parse(readFileSync(new URL("../web/data/sites.json", import.meta.url)));
  assert.ok(data.sites.length >= 50);
  const sc = scoreAll(data.sites, data.requirements);
  const w = presetWeights(data.presets.balanced, data.requirements);
  const res = greedyPortfolio({
    sites: data.sites, scores: sc, reqIds: data.requirements.map((r) => r.id), weights: w, k: 5, lambda: 0.1,
  });
  assert.equal(res.picks.length, 5);
  assert.ok(res.coverage > 0.5 && res.coverage <= 1);
  const v = validateKnownAnalogs(data.sites, sc, data.requirements, w);
  assert.ok(v.total > 0);
});
