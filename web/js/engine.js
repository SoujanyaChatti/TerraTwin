// TerraTwin engine: per-requirement scoring and greedy weighted max coverage.
// Pure functions only (no DOM), so they run unchanged in the browser and in Node tests.

export const COVERED = 0.7;
export const PARTIAL = 0.4;
export const MIN_GAIN = 0.01;
export const EMPHASIS_WEIGHT = 3;

/** Linear ramp from `zero` (score 0) to `full` (score 1), clipped. Works for
 *  rising (full > zero) and falling (full < zero) ramps. null/NaN -> null. */
export function rampScore(x, zero, full) {
  if (x === null || x === undefined || Number.isNaN(x)) return null;
  if (full === zero) return x >= full ? 1 : 0;
  const s = (x - zero) / (full - zero);
  return Math.min(1, Math.max(0, s));
}

/** 1.0 for any primary tag, 0.5 for any partial tag, else 0. */
export function tagScore(tags, primary = [], partial = []) {
  const set = new Set(tags || []);
  if (primary.some((t) => set.has(t))) return 1;
  if (partial.some((t) => set.has(t))) return 0.5;
  return 0;
}

/** Score one site on one requirement.
 *  Returns { score, value, missing }; missing data scores 0 and is flagged. */
export function scoreRequirement(site, req) {
  if (req.type === "tags") {
    const score = tagScore(site.tags, req.primary, req.partial);
    const hit = (site.tags || []).filter((t) => (req.primary || []).includes(t) || (req.partial || []).includes(t));
    return { score, value: hit.length ? hit.join(", ") : "none", missing: false };
  }
  const value = site.features ? site.features[req.feature] : undefined;
  const s = rampScore(value, req.zero, req.full);
  if (s === null) return { score: 0, value: null, missing: true };
  return { score: s, value, missing: false };
}

/** Score matrix: { siteId: { reqId: {score, value, missing} } } */
export function scoreAll(sites, requirements) {
  const out = {};
  for (const site of sites) {
    const row = {};
    for (const req of requirements) row[req.id] = scoreRequirement(site, req);
    out[site.id] = row;
  }
  return out;
}

/** Requirements that apply to mission 'moon' | 'mars' | 'both'. */
export function requirementsForMission(requirements, mission) {
  if (mission === "both") return requirements.slice();
  return requirements.filter((r) => r.missions.includes(mission));
}

/** Weights for a preset: emphasized requirements get 3, others 1. */
export function presetWeights(preset, requirements) {
  const emph = new Set((preset && preset.emphasis) || []);
  const w = {};
  for (const r of requirements) w[r.id] = emph.has(r.id) ? EMPHASIS_WEIGHT : 1;
  return w;
}

export function statusOf(score) {
  if (score >= COVERED) return "covered";
  if (score >= PARTIAL) return "partial";
  return "gap";
}

/** Weighted coverage of a set of best scores: sum_r w_r * best_r. */
function coverageValue(best, reqIds, weights) {
  let v = 0;
  for (const id of reqIds) v += (weights[id] || 0) * (best[id] ? best[id].score : 0);
  return v;
}

/**
 * Greedy weighted max coverage with a reachability penalty.
 *   objective(S) = sum_r w_r * max_{i in S} s_ir  -  lambda * sum_{i in S} (a_i - 1)
 * Adds the site with the largest marginal gain until k sites are chosen or no
 * site adds more than `minGain`.
 *
 * @param {object} p
 * @param {Array}  p.sites      candidate sites (already filtered)
 * @param {object} p.scores     score matrix from scoreAll
 * @param {Array}  p.reqIds     requirement ids in play
 * @param {object} p.weights    { reqId: weight }
 * @param {number} p.k          max portfolio size
 * @param {number} [p.lambda]   reachability penalty per access tier above 1
 * @param {number} [p.minGain]  stop threshold
 */
export function greedyPortfolio({ sites, scores, reqIds, weights, k, lambda = 0.1, minGain = MIN_GAIN }) {
  const best = {};
  for (const id of reqIds) best[id] = { score: 0, siteId: null };
  const totalWeight = reqIds.reduce((a, id) => a + (weights[id] || 0), 0);
  const picks = [];
  const chosen = new Set();

  for (let step = 0; step < k; step++) {
    let top = null;
    for (const site of sites) {
      if (chosen.has(site.id)) continue;
      const row = scores[site.id];
      let coverageGain = 0;
      for (const id of reqIds) {
        const s = row[id].score;
        if (s > best[id].score) coverageGain += (weights[id] || 0) * (s - best[id].score);
      }
      const penalty = lambda * (site.access_tier - 1);
      const gain = coverageGain - penalty;
      // Ties broken by easier access, then id, so results are deterministic.
      if (
        !top || gain > top.gain + 1e-12 ||
        (Math.abs(gain - top.gain) <= 1e-12 &&
          (site.access_tier < top.site.access_tier ||
            (site.access_tier === top.site.access_tier && site.id < top.site.id)))
      ) {
        top = { site, gain, coverageGain, penalty };
      }
    }
    if (!top || top.gain <= minGain) break;

    const improved = [];
    for (const id of reqIds) {
      const s = scores[top.site.id][id].score;
      if (s > best[id].score) {
        improved.push({ reqId: id, from: best[id].score, to: s, status: statusOf(s) });
        best[id] = { score: s, siteId: top.site.id };
      }
    }
    chosen.add(top.site.id);
    picks.push({
      site: top.site,
      gain: top.gain,
      coverageGain: top.coverageGain,
      penalty: top.penalty,
      improved,
      cumulativeCoverage: totalWeight ? coverageValue(best, reqIds, weights) / totalWeight : 0,
    });
  }

  const value = coverageValue(best, reqIds, weights);
  return {
    picks,
    best,
    coverage: totalWeight ? value / totalWeight : 0,
    objective: value - picks.reduce((a, p) => a + p.penalty, 0),
    totalWeight,
  };
}

/** Weighted mean score of one site over the given requirements (0-1). */
export function overallScore(siteScores, reqIds, weights) {
  let num = 0;
  let den = 0;
  for (const id of reqIds) {
    const w = weights[id] || 0;
    num += w * siteScores[id].score;
    den += w;
  }
  return den ? num / den : 0;
}

/** Dual-use: >= COVERED on at least two Moon-only and two Mars-only requirements. */
export function isDualUse(siteScores, requirements) {
  let moon = 0;
  let mars = 0;
  for (const r of requirements) {
    if (siteScores[r.id].score < COVERED) continue;
    const m = r.missions;
    if (m.length === 1 && m[0] === "moon") moon++;
    if (m.length === 1 && m[0] === "mars") mars++;
  }
  return moon >= 2 && mars >= 2;
}

/** Rank all sites by overall score over the requirements of one mission. */
export function rankSites(sites, scores, requirements, weights, mission = "both") {
  const reqIds = requirementsForMission(requirements, mission).map((r) => r.id);
  const ranked = sites
    .map((s) => ({ site: s, score: overallScore(scores[s.id], reqIds, weights) }))
    .sort((a, b) => b.score - a.score || a.site.id.localeCompare(b.site.id));
  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}

/** Validation: each known analog is ranked among ALL candidates on the mission
 *  it is documented as an analog for (`analog_for`: moon | mars | both). */
export function validateKnownAnalogs(sites, scores, requirements, weights) {
  const rankings = {};
  for (const m of ["moon", "mars", "both"]) rankings[m] = rankSites(sites, scores, requirements, weights, m);
  const n = sites.length;
  const cutoff = Math.ceil(n * 0.25);
  const half = Math.ceil(n * 0.5);
  const known = sites
    .filter((s) => s.is_known_analog)
    .map((s) => {
      const mission = s.analog_for || "both";
      const r = rankings[mission].find((x) => x.site.id === s.id);
      return { site: s, mission, score: r.score, rank: r.rank, topQuartile: r.rank <= cutoff, topHalf: r.rank <= half };
    })
    .sort((a, b) => a.rank - b.rank || a.site.id.localeCompare(b.site.id));
  const inTop = known.filter((r) => r.topQuartile).length;
  const inHalf = known.filter((r) => r.topHalf).length;
  return {
    rankings, known, n, cutoff, inTop, inHalf,
    total: known.length,
    share: known.length ? inTop / known.length : 0,
  };
}
