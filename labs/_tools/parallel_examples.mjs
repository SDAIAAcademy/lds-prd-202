// The parallel examples on the slides, checkpoints and practice bank of LDS-PRD-202. They use other
// departments of Khuta Fitness Clubs and other numbers than the labs, so no slide gives a lab's
// answer. Every number is computed here with a fixed seed. From the repository root:
//   node labs/_tools/parallel_examples.mjs
import * as M from './metrics.mjs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const out = {};

// Day 1. The training department's coach-rota assistant: 30 tasks, 4 trials each.
{
  const counts = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0, 0];
  const first = counts.map((k, i) => (k === 4 ? 1 : k >= 2 && i % 2 === 0 ? 1 : k === 3 ? 1 : 0));
  out.rota_trials = {
    tasks: 30, trials: 4,
    first_trial_pass: first.reduce((a, b) => a + b, 0),
    all_runs_pass: counts.reduce((a, b) => a + b, 0),
    tasks_all_trials: counts.filter((k) => k === 4).length
  };
}
// Day 1. The rota assistant's taxonomy from 80 traces: frequency against severity.
{
  const modes = [['shift swapped without the coach agreeing', 4, 3], ['wrong club in the rota', 9, 3], ['answer in English to an Arabic message', 15, 2], ['refuses a leave question it can answer', 11, 2], ['confirms a swap the rota system rejected', 3, 4]];
  out.rota_taxonomy = modes.map(([name, n, sev]) => ({ name, n, sev, score: Math.round((n / 80) * sev * 1000) / 1000 }))
    .sort((a, b) => (b.sev === 4) - (a.sev === 4) || b.score - a.score);
}
// Day 2. A model grader for "the rota reply names the coach's club": 50 human labels.
{
  const rows = [];
  const spec = { ar_msa: [6, 6, 14], ar_gulf: [6, 2, 10], en: [4, 4, 14] }; // [human fails, caught, human passes]
  for (const [l, [f, c, p]] of Object.entries(spec)) {
    for (let i = 0; i < f; i++) rows.push({ l, human: 'fail', grader: i < c ? 'fail' : 'pass' });
    for (let i = 0; i < p; i++) rows.push({ l, human: 'pass', grader: i === 0 && l === 'en' ? 'fail' : 'pass' });
  }
  out.rota_grader = { all: M.agreement(rows), byLang: Object.fromEntries(Object.keys(spec).map((l) => [l, M.agreement(rows.filter((x) => x.l === l))])) };
}
// Day 2. Marketing's class-reminder message test: attendance baseline 40%, minimum effect 3 points.
out.reminder_sample = { baseline: 0.4, mde: 0.03, per_arm: M.sampleSize(0.4, 0.03), per_arm_mde2: M.sampleSize(0.4, 0.02) };
// Day 3. The reminder test read out: 6,000 members per arm; a guardrail on unsubscribes.
{
  const r = rng(909);
  const rows = [];
  for (let i = 0; i < 12000; i++) {
    const arm = i % 2 ? 'B' : 'A';
    const lang = r() < 0.7 ? 'ar' : 'en';
    const att = r() < (arm === 'B' ? 0.425 : 0.4) ? 1 : 0;
    const unsub = r() < (arm === 'B' && lang === 'en' ? 0.03 : 0.012) ? 1 : 0;
    rows.push({ arm, lang, att, unsub });
  }
  const d = (f, k) => { const A = rows.filter((x) => x.arm === 'A' && f(x)), B = rows.filter((x) => x.arm === 'B' && f(x)); return M.diffCI(A.filter((x) => x[k]).length, A.length, B.filter((x) => x[k]).length, B.length); };
  out.reminder_readout = { attendance: d(() => true, 'att'), unsub: d(() => true, 'unsub'), unsub_en: d((x) => x.lang === 'en', 'unsub'), unsub_ar: d((x) => x.lang === 'ar', 'unsub') };
}
// Day 3. Marketing's offer-copy assistant: cost per accepted draft for two models.
{
  const cfg = { big: { pin: 9, pout: 36, calls: 1.3, accept: 0.88 }, small: { pin: 0.6, pout: 2.4, calls: 1.6, accept: 0.6 } };
  const tin = 2600, tout = 450, edit = 4; // SAR of a copywriter's time to rewrite a rejected draft
  out.copy_cost = Object.fromEntries(Object.entries(cfg).map(([k, c]) => {
    const call = (tin * c.pin + tout * c.pout) / 1e6;
    const perDraft = call * c.calls;
    return [k, { per_call: M.r4(call), per_draft: M.r4(perDraft), per_accepted_model_only: M.r4(perDraft / c.accept), per_accepted_loaded: M.r4((perDraft + (1 - c.accept) * edit) / c.accept) }];
  }));
}
// Day 3. Billed tokens for one rota question: what the coach typed against what was billed.
out.rota_tokens = { typed_words: 9, system_prompt: 1800, rota_extract: 1350, history: 420, question: 14, output: 160 };
out.rota_tokens.billed_input = out.rota_tokens.system_prompt + out.rota_tokens.rota_extract + out.rota_tokens.history + out.rota_tokens.question;

console.log(JSON.stringify(out, null, 2));
