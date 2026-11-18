// The computations of LDS-PRD-202, written the way a spreadsheet does them, so that a trainer can
// redo each one with COUNTIFS, AVERAGEIFS and PERCENTILE.INC. Used by prepare_files.mjs (to write
// labs/solutions/key.json) and by labs/solutions/check_all.mjs (to recompute from the CSV files).
const Z = 1.96;
const Z_POWER = 0.8416;
export const r4 = (x) => Math.round(x * 10000) / 10000;

// PERCENTILE.INC
export function percentileInc(values, p) {
  const v = values.slice().sort((a, b) => a - b);
  const h = (v.length - 1) * p;
  const lo = Math.floor(h);
  return lo + 1 < v.length ? v[lo] + (h - lo) * (v[lo + 1] - v[lo]) : v[lo];
}

// A grader against human labels: how many human fails it catches, how many human passes it accepts
export function agreement(rows) {
  const hf = rows.filter((x) => x.human === 'fail');
  const hp = rows.filter((x) => x.human === 'pass');
  const caught = hf.filter((x) => x.grader === 'fail').length;
  const accepted = hp.filter((x) => x.grader === 'pass').length;
  return {
    n: rows.length, human_fails: hf.length, caught, accepted, human_passes: hp.length,
    agreement: rows.length ? r4((caught + accepted) / rows.length) : null,
    fail_catch_rate: hf.length ? r4(caught / hf.length) : null,
    pass_accept_rate: hp.length ? r4(accepted / hp.length) : null
  };
}

// Two proportions: the difference B minus A with its 95% interval (unpooled normal)
export function diffCI(xa, na, xb, nb) {
  const pa = xa / na, pb = xb / nb;
  const se = Math.sqrt(pa * (1 - pa) / na + pb * (1 - pb) / nb);
  const d = pb - pa;
  return { a: r4(pa), b: r4(pb), diff_pp: r4(d * 100), low_pp: r4((d - Z * se) * 100), high_pp: r4((d + Z * se) * 100), na, nb };
}

// Sessions per arm for a two-sided test at 5% with 80% power
export function sampleSize(p, d) {
  return Math.ceil((Z + Z_POWER) ** 2 * (p * (1 - p) + (p + d) * (1 - p - d)) / (d * d));
}

export function readout(rows) {
  const arm = (a, f = () => true) => rows.filter((r) => r.arm === a && f(r));
  const res = (f = () => true) => {
    const A = arm('A', f), B = arm('B', f);
    return diffCI(A.filter((r) => r.resolved).length, A.length, B.filter((r) => r.resolved).length, B.length);
  };
  const guard = (f = () => true) => {
    const A = arm('A', (r) => r.need && f(r)), B = arm('B', (r) => r.need && f(r));
    return diffCI(A.filter((r) => r.missed).length, A.length, B.filter((r) => r.missed).length, B.length);
  };
  const comp = () => diffCI(arm('A').filter((r) => r.complaint).length, arm('A').length, arm('B').filter((r) => r.complaint).length, arm('B').length);
  const mean = (l, k) => l.reduce((s, r) => s + r[k], 0) / l.length;
  const langs = ['ar_msa', 'ar_gulf', 'en', 'mixed'];
  return {
    n: { A: arm('A').length, B: arm('B').length },
    primary: res(),
    primary_by_language: Object.fromEntries(langs.map((l) => [l, res((r) => r.language === l)])),
    primary_by_group: Object.fromEntries(['new', 'existing'].map((g) => [g, res((r) => r.group === g)])),
    guardrail_missed: guard(),
    guardrail_by_language: Object.fromEntries(langs.map((l) => [l, guard((r) => r.language === l)])),
    guardrail_by_group: Object.fromEntries(['new', 'existing'].map((g) => [g, guard((r) => r.group === g)])),
    complaints: comp(),
    cost_per_session: { A: r4(mean(arm('A'), 'cost')), B: r4(mean(arm('B'), 'cost')) },
    latency_p95_ms: { A: Math.round(percentileInc(arm('A').map((r) => r.latency), 0.95)), B: Math.round(percentileInc(arm('B').map((r) => r.latency), 0.95)) },
    peek_day3: res((r) => r.day <= 3),
    by_day_diff_pp: Object.fromEntries(Array.from({ length: 14 }, (_, i) => i + 1).map((d) => [d, res((r) => r.day <= d).diff_pp]))
  };
}

// Cost per call, per run and per successful task, latency percentiles, monthly cost and sensitivity
export function costing(rows, PRICE, A) {
  const out = {};
  const callCost = (r, f = 1) => {
    const p = PRICE[r.cfg][r.tier];
    return f * ((r.tin - r.cached) * p.in + r.cached * p.cached + r.tout * p.out) / 1e6;
  };
  for (const cfg of ['A', 'B', 'C']) {
    const l = rows.filter((r) => r.cfg === cfg);
    const passes = l.filter((r) => r.pass).length;
    const fails = l.length - passes;
    const model = l.reduce((s, r) => s + callCost(r), 0);
    const calls = l.reduce((s, r) => s + r.calls, 0);
    const p = passes / l.length;
    const perRun = model / l.length;
    const loaded = (model + fails * A.human_handling_sar) / passes;
    const byLang = Object.fromEntries(['ar_msa', 'ar_gulf', 'en', 'mixed'].map((lg) => {
      const s = l.filter((r) => r.lang === lg);
      return [lg, { runs: s.length, pass_rate: r4(s.filter((r) => r.pass).length / s.length), p95_ms: Math.round(percentileInc(s.map((r) => r.lat), 0.95)) }];
    }));
    const byGroup = Object.fromEntries(['new', 'existing'].map((g) => {
      const s = l.filter((r) => r.group === g);
      return [g, { runs: s.length, pass_rate: r4(s.filter((r) => r.pass).length / s.length) }];
    }));
    const runCosts = l.map((r) => callCost(r));
    const sens = (pp, priceF) => {
      const q = p + pp;
      const m = perRun * priceF;
      return r4((m + (1 - q) * A.human_handling_sar) / q);
    };
    out[cfg] = {
      runs: l.length, passes, pass_rate: r4(p), k4_fails: l.filter((r) => r.failed === 'K4').length,
      k3_fails: l.filter((r) => r.failed === 'K3').length,
      criterion_pass_rate: Object.fromEntries(['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'].map((k) => [k, r4(1 - l.filter((r) => r.failed === k).length / l.length)])),
      calls, tokens_in: l.reduce((s, r) => s + r.tin, 0), tokens_cached: l.reduce((s, r) => s + r.cached, 0), tokens_out: l.reduce((s, r) => s + r.tout, 0),
      model_cost_total: r4(model), cost_per_call: r4(model / calls), model_cost_per_run: r4(perRun),
      model_cost_per_success: r4(model / passes), loaded_cost_per_success: r4(loaded),
      run_cost_p50: r4(percentileInc(runCosts, 0.5)), run_cost_p90: r4(percentileInc(runCosts, 0.9)),
      latency_p50_ms: Math.round(percentileInc(l.map((r) => r.lat), 0.5)), latency_p95_ms: Math.round(percentileInc(l.map((r) => r.lat), 0.95)),
      meets_sla: Math.round(percentileInc(l.map((r) => r.lat), 0.95)) <= A.sla_p95_ms,
      by_language: byLang, by_group: byGroup,
      monthly_model_cost: A.volumes.map((v) => Math.round(perRun * v)),
      monthly_loaded_cost: A.volumes.map((v) => Math.round(perRun * v + (1 - p) * v * A.human_handling_sar)),
      within_budget: A.volumes.map((v) => perRun * v <= A.monthly_model_budget_sar),
      sensitivity_loaded_per_success: {
        base: sens(0, 1), success_minus5: sens(-0.05, 1), success_plus5: sens(0.05, 1),
        price_plus30: sens(0, 1.3), price_minus30: sens(0, 0.7), price_x2: sens(0, 2)
      }
    };
  }
  return out;
}
