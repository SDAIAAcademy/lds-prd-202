// Trainer's check of every lab of LDS-PRD-202. From the repository root:
//   node labs/solutions/check_all.mjs
// 1. The generator writes the same bytes as the files on disk.
// 2. Each lab's reference numbers are recomputed from the CSV and text files alone, the way a
//    spreadsheet does them, and compared with labs/solutions/key.json.
// 3. The findings each lab is built to surface are asserted, so a change to the data that hides
//    one of them fails here.
// 4. Every starting file a lab names opens and has the columns the lab page uses.
// Prints PASS, or every difference and exits 1.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as M from '../_tools/metrics.mjs';

const labs = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = JSON.parse(readFileSync(join(labs, 'solutions', 'key.json'), 'utf8'));
let fails = 0;
const ok = (name, cond, info = '') => { if (!cond) { console.log('FAIL ' + name + (info ? ': ' + info : '')); fails++; } };
const eq = (name, got, want, tol = 0.0005) => ok(name, typeof want === 'number' ? Math.abs(got - want) <= tol : JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

function parseCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  const [head, ...body] = rows;
  return { head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h, /^-?\d+(\.\d+)?$/.test(r[i]) ? Number(r[i]) : r[i]]))) };
}
const f = (name) => parseCsv(join(labs, 'files', name)).rows;
const s = (name) => parseCsv(join(labs, 'solutions', name)).rows;
const txt = (name) => readFileSync(join(labs, 'files', name), 'utf8');

// 1. bytes
const gen = spawnSync(process.execPath, [join(labs, '_tools', 'prepare_files.mjs'), '--check'], { encoding: 'utf8' });
ok('generator writes the files on disk', gen.status === 0, gen.stdout + gen.stderr);

// 4. starting files open with the columns the lab pages use
const NEED = {
  'traces_300.csv': ['trace_id', 'language', 'member_group', 'member_message', 'retrieved', 'tool_status', 'assistant_reply', 'handoff'],
  'coding_sheet_P001_P100.csv': ['trace_id', 'open_note', 'failure_mode', 'severity', 'coder'],
  'open_notes_P001_P050.csv': ['trace_id', 'open_note_by_engineering_lead'],
  'team_coding_P101_P300.csv': ['trace_id', 'failure_mode', 'severity'],
  'taxonomy_v0_engineering.csv': ['code', 'name', 'definition', 'severity'],
  'repeated_trials.csv': ['task_id', 'language', 'trial', 'pass'],
  'acceptance_criteria.csv': ['criterion', 'text', 'failure_mode', 'severity_if_failed'],
  'grader_calibration.csv': ['item_id', 'criterion', 'language', 'human_label', 'grader_label'],
  'eval_candidates.csv': ['cand_id', 'source', 'language', 'member_group', 'targets', 'member_message'],
  'evalset_changelog_template.csv': ['version', 'date', 'change', 'reason', 'proposed_by', 'approved_by'],
  'sessions_20000.csv': ['session_id', 'day', 'arm', 'language', 'member_group', 'resolved', 'missed_escalation', 'escalation_needed', 'complaint', 'cost_sar', 'latency_ms'],
  'experiment_plan_template.csv': ['item', 'your_plan'],
  'gateway_runs.csv': ['config', 'example_id', 'trial', 'language', 'member_group', 'model_tier', 'model_calls', 'tokens_in', 'tokens_cached', 'tokens_out', 'latency_ms', 'pass', 'failed_criterion'],
  'price_sheet_provider_a.csv': ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  'price_sheet_provider_b.csv': ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  'price_sheet_provider_c.csv': ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  'assumptions.csv': ['item', 'value'],
  'release_criteria_template.csv': ['criterion', 'metric_and_threshold', 'evidence_source', 'slice_checked', 'owner', 'signed_off_by'],
  'monitoring_spec_template.csv': ['signal', 'source', 'slice', 'alert_threshold', 'response_when_crossed', 'owner'],
  'owners.csv': ['name', 'role', 'may_sign_off']
};
for (const [file, cols] of Object.entries(NEED)) {
  const { head } = parseCsv(join(labs, 'files', file));
  for (const c of cols) ok(`${file} has column ${c}`, head.includes(c));
}

// Lab 1.1: one run against five
const trials = f('repeated_trials.csv');
eq('1.1 trial-1 passes', trials.filter((r) => r.trial === 1 && r.pass === 1).length, key.trials.trial1_pass);
eq('1.1 passes over 100 runs', trials.filter((r) => r.pass === 1).length, key.trials.all_pass);
const perTask = {};
for (const r of trials) perTask[r.task_id] = (perTask[r.task_id] || 0) + r.pass;
eq('1.1 tasks passing all five', Object.values(perTask).filter((v) => v === 5).length, key.trials.tasks_all5);
ok('1.1 one run overstates consistency', key.trials.trial1_pass / 20 - key.trials.tasks_all5 / 20 >= 0.25);
ok('1.1 Gulf dialect is the weakest slice', key.trials.by_lang.ar_gulf.pass / key.trials.by_lang.ar_gulf.runs < key.trials.by_lang.en.pass / key.trials.by_lang.en.runs - 0.3);

// Labs 1.2 to 1.4: the taxonomy
const ref = s('reference_coding_P001_P100.csv');
const team = f('team_coding_P101_P300.csv');
const count = (rows) => { const c = {}; for (const r of rows) c[r.failure_mode] = (c[r.failure_mode] || 0) + 1; return c; };
const cs = count(ref), ct = count(team);
for (const m of Object.keys(key.traces.sample_counts)) {
  eq(`1.3 sample count ${m}`, cs[m] || 0, key.traces.sample_counts[m]);
  eq(`1.4 team count ${m}`, ct[m] || 0, key.traces.team_counts[m]);
}
ok('1.3 five or more modes in the sample', Object.keys(cs).filter((m) => m !== 'pass').length >= 5);
const traces = f('traces_300.csv');
const byId = Object.fromEntries(traces.map((t) => [t.trace_id, t]));
// every planted mode is visible in the trace itself
for (const r of ref) {
  const t = byId[r.trace_id];
  if (r.failure_mode === 'F3') ok(`F3 visible in ${t.trace_id}`, String(t.tool_status).startsWith('error'));
  if (r.failure_mode === 'F1') ok(`F1 visible in ${t.trace_id}`, / v1$/.test(t.retrieved));
  if (r.failure_mode === 'F4') ok(`F4 visible in ${t.trace_id}`, t.handoff === 'no');
}
const sevOf = Object.fromEntries(f('taxonomy_v0_engineering.csv').map((r) => [r.code, r.severity]));
const all = { ...ct };
for (const [m, n] of Object.entries(cs)) all[m] = (all[m] || 0) + n;
const rank = Object.keys(sevOf).map((m) => ({ m, sev: sevOf[m], score: Math.round(((all[m] || 0) / 300) * sevOf[m] * 1000) / 1000 }))
  .sort((a, b) => (b.sev === 4) - (a.sev === 4) || b.score - a.score).map((x) => x.m);
eq('1.4 priority order', rank, key.traces.priority);
ok('1.4 the most frequent mode is not first', rank[0] !== Object.keys(sevOf).sort((a, b) => (all[b] || 0) - (all[a] || 0))[0]);
// 1.4 starts from the team file alone when the participant's coding is missing
const rankTeam = Object.keys(sevOf).map((m) => ({ m, sev: sevOf[m], score: ((ct[m] || 0) / 200) * sevOf[m] })).sort((a, b) => (b.sev === 4) - (a.sev === 4) || b.score - a.score).map((x) => x.m);
ok('1.4 runs on the team file alone', rankTeam.length === 8 && rankTeam[0] === 'F4');
const modeOf = Object.fromEntries([...ref, ...team].map((r) => [r.trace_id, r.failure_mode]));
for (const m of ['F1', 'F3', 'F4', 'F5']) for (const l of ['ar_msa', 'ar_gulf', 'en', 'mixed']) eq(`1.4 slice ${m} ${l}`, traces.filter((t) => modeOf[t.trace_id] === m && t.language === l).length, key.traces.slices[m].language[l]);
eq('1.2 median tokens billed per trace', M.percentileInc(traces.map((t) => t.tokens_in), 0.5), key.traces.tokens_in_median);

// Lab 2.2: calibration
const cal = f('grader_calibration.csv');
const rule = (st, byLang) => st.fail_catch_rate >= 0.85 && st.pass_accept_rate >= 0.9 && Object.values(byLang).every((x) => x.fail_catch_rate === null || x.fail_catch_rate >= 0.5);
const verdict = {};
for (const k of ['K2', 'K4', 'K6', 'K8']) {
  const rows = cal.filter((r) => r.criterion === k).map((r) => ({ human: r.human_label, grader: r.grader_label, l: r.language }));
  const st = M.agreement(rows);
  const byLang = Object.fromEntries(['ar_msa', 'ar_gulf', 'en', 'mixed'].map((l) => [l, M.agreement(rows.filter((x) => x.l === l))]));
  eq(`2.2 ${k} agreement`, st.agreement, key.calibration[k].agreement);
  eq(`2.2 ${k} catch rate`, st.fail_catch_rate, key.calibration[k].fail_catch_rate);
  verdict[k] = rule(st, byLang);
}
eq('2.2 graders that pass the rule', verdict, { K2: true, K4: false, K6: true, K8: false });
ok('2.2 K4 looks fine on agreement alone', key.calibration.K4.agreement >= 0.85);

// Lab 2.3: the evaluation set
const cand = f('eval_candidates.csv');
const examples = txt('prompt_examples.txt').split('\n').filter((l) => /^EX\d\d \| /.test(l)).map((l) => l.slice(7));
const seen = new Set();
const keep = [];
let dupN = 0, leakN = 0;
for (const c of cand) {
  if (examples.includes(c.member_message)) { leakN++; continue; }
  if (seen.has(c.member_message)) { dupN++; continue; }
  seen.add(c.member_message); keep.push(c);
}
eq('2.3 duplicates', dupN, key.evalset.duplicates);
eq('2.3 leaks', leakN, key.evalset.leaks);
eq('2.3 kept', keep.length, 120);
const cov = (p) => keep.filter(p).length;
for (const m of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']) ok(`2.3 ${m} has 8 or more`, cov((c) => String(c.targets).startsWith(m)) >= 8);
eq('2.3 English must-escalate (the gap)', cov((c) => String(c.targets).startsWith('F4') && c.language === 'en'), key.evalset.must_escalate_en);
ok('2.3 the English must-escalate gap is real', key.evalset.must_escalate_en < 3);
ok('2.3 English share meets the rule', cov((c) => c.language === 'en') / 120 >= 0.25);
ok('2.3 new members share meets the rule', cov((c) => c.member_group === 'new') / 120 >= 0.3);
ok('2.3 F8 appears in production traces only', (cs.F8 || 0) === 0 && (ct.F8 || 0) >= 1);
// The rule removes exact copies only; the stretch of 2.3 asks about near-copies (a prompt example
// without its closing "شكرًا." or "Thanks.") that the rule keeps.
const bare = (t) => String(t).replace(/ ?(شكرًا.|Thanks.)$/, '').trim();
const nearLeaks = keep.filter((c) => examples.map(bare).includes(bare(c.member_message)));
console.log('2.3 near-copies of prompt examples kept by the rule: ' + nearLeaks.map((c) => c.cand_id).join(' '));
ok('2.3 near-copies exist for the stretch', nearLeaks.length >= 3);
const g = f('gateway_runs.csv');
ok('2.3 gateway runs use exactly the 120 kept examples', new Set(g.map((r) => r.example_id)).size === 120 && g.every((r) => seen.has(keep.find((k) => k.cand_id === r.example_id)?.member_message)));

// Labs 2.4 and 3.1: the experiment
const plan = Object.fromEntries(f('experiment_plan_reference.csv').map((r) => [r.item, String(r.reference_plan)]));
ok('2.4 reference plan sample per arm', plan.sample_per_arm.startsWith(String(key.experiment.sample_size_2pp)));
ok('2.4 reference plan duration covers the sample', 2 * key.experiment.sample_size_2pp / 1430 <= 14);

const sess = f('sessions_20000.csv').map((r) => ({ day: r.day, arm: r.arm, language: r.language, group: r.member_group, resolved: r.resolved, missed: r.missed_escalation, need: r.escalation_needed, complaint: r.complaint, cost: r.cost_sar, latency: r.latency_ms }));
eq('3.1 sessions', sess.length, 20000);
const ro = M.readout(sess);
eq('3.1 primary diff', ro.primary.diff_pp, key.experiment.primary.diff_pp);
eq('3.1 primary low', ro.primary.low_pp, key.experiment.primary.low_pp);
eq('3.1 guardrail diff', ro.guardrail_missed.diff_pp, key.experiment.guardrail_missed.diff_pp);
eq('3.1 Gulf guardrail diff', ro.guardrail_by_language.ar_gulf.diff_pp, key.experiment.guardrail_by_language.ar_gulf.diff_pp);
eq('3.1 cost per session', ro.cost_per_session, key.experiment.cost_per_session);
ok('3.1 primary interval excludes zero', ro.primary.low_pp > 0);
ok('3.1 overall guardrail interval includes zero', ro.guardrail_missed.low_pp < 0 && ro.guardrail_missed.high_pp > 0);
ok('3.1 Gulf dialect guardrail is worse and clear', ro.guardrail_by_language.ar_gulf.low_pp > 0);
ok('3.1 the day-3 peek overstates the effect', ro.peek_day3.diff_pp > ro.primary.diff_pp + 1);
ok('3.1 arms are balanced', Math.abs(ro.n.A - ro.n.B) / 20000 < 0.02);
eq('2.4 sample size per arm, 2 points', M.sampleSize(0.62, 0.02), key.experiment.sample_size_2pp);
ok('2.4 the log is big enough for a 2-point effect', Math.min(ro.n.A, ro.n.B) >= M.sampleSize(0.62, 0.02));

// Labs 3.2 and 3.3: costing, from the price sheets as a spreadsheet reads them
const PRICE = {};
for (const [cfg, file] of [['A', 'price_sheet_provider_a.csv'], ['B', 'price_sheet_provider_b.csv'], ['C', 'price_sheet_provider_c.csv']]) {
  PRICE[cfg] = {};
  for (const r of f(file)) {
    PRICE[cfg][r.model_tier] ||= {};
    PRICE[cfg][r.model_tier][{ input: 'in', cached_input: 'cached', output: 'out' }[r.item]] = r.sar_per_million_tokens;
  }
}
const asum = Object.fromEntries(f('assumptions.csv').map((r) => [r.item, r.value]));
const A = { human_handling_sar: asum.human_handling_sar, sla_p95_ms: asum.sla_p95_ms, monthly_model_budget_sar: asum.monthly_model_budget_sar, volumes: [asum.volume_low, asum.volume_base, asum.volume_high] };
const rows = g.map((r) => ({ cfg: r.config, lang: r.language, group: r.member_group, tier: r.model_tier, calls: r.model_calls, tin: r.tokens_in, cached: r.tokens_cached, tout: r.tokens_out, lat: r.latency_ms, pass: r.pass, failed: r.failed_criterion }));
const co = M.costing(rows, PRICE, A);
for (const c of ['A', 'B', 'C']) {
  for (const k of ['pass_rate', 'cost_per_call', 'model_cost_per_success', 'loaded_cost_per_success', 'latency_p95_ms']) eq(`3.2 ${c} ${k}`, co[c][k], key.costing[c][k]);
  eq(`3.3 ${c} monthly cost`, co[c].monthly_model_cost, key.costing[c].monthly_model_cost);
}
const cheapest = (k) => ['A', 'B', 'C'].sort((x, y) => co[x][k] - co[y][k])[0];
ok('3.2 cheapest per call is B', cheapest('cost_per_call') === 'B');
ok('3.2 B is the dearest per successful task', ['A', 'C'].every((c) => co.B.loaded_cost_per_success > co[c].loaded_cost_per_success));
ok('3.2 A misses the latency service level', !co.A.meets_sla);
ok('3.2 C meets the service level overall and in every language', co.C.meets_sla && Object.values(co.C.by_language).every((x) => x.p95_ms <= A.sla_p95_ms));
const thr = { K1: 0.97, K2: 0.97, K3: 1, K4: 1, K5: 0.9, K6: 0.9, K7: 0.97 };
const meets = (c) => Object.entries(thr).every(([k, t]) => co[c].criterion_pass_rate[k] >= t);
eq('3.2 configurations that meet every threshold', ['A', 'B', 'C'].filter(meets), ['A', 'C']);
ok('3.3 A breaks the budget at the high volume', co.A.within_budget[2] === false);
ok('3.3 C stays in budget at every volume', co.C.within_budget.every(Boolean));
// the defence's price changes: A 30% cheaper still misses latency; C's large tier at double price still fits the budget
const priceAx = JSON.parse(JSON.stringify(PRICE)); for (const k in priceAx.A.large) priceAx.A.large[k] *= 0.7;
const coA = M.costing(rows, priceAx, A);
ok('defence: A at -30% still misses latency', !coA.A.meets_sla);
ok('defence: A at -30% still breaks the budget at the high volume', coA.A.within_budget[2] === false);
const priceCx = JSON.parse(JSON.stringify(PRICE)); for (const k in priceCx.C.large) priceCx.C.large[k] *= 2;
const coC = M.costing(rows, priceCx, A);
ok('defence: C with its large tier at x2 stays in budget', coC.C.within_budget.every(Boolean));
ok('defence: C with its large tier at x2 costs more per success', coC.C.loaded_cost_per_success > co.C.loaded_cost_per_success);

if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
console.log('PASS');
