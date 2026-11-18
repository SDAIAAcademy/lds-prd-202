// Writes every synthetic file of LDS-PRD-202 into labs/files/, the trace viewer
// labs/tools/traces.html and the trainer's reference files in labs/solutions/ (key.json and the
// reference CSV files). Fixed seeds: the same bytes on every run. From the repository root:
//   node labs/_tools/prepare_files.mjs
// With --check it writes nothing and exits 1 if any file on disk differs from what it would write.
// Nothing here calls a model: every assistant reply, grader verdict, token count and timing is
// scripted synthetic data written by this file.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './metrics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const labs = join(here, '..');
const CHECK = process.argv.includes('--check');

const out = new Map();
const put = (rel, text) => out.set(rel, text);
const BOM = '﻿';
function csv(rows) {
  const esc = (v) => {
    const s = typeof v === 'number' ? String(v) : String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return BOM + rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}
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
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
const between = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
const key = {};

// ---------------------------------------------------------------------------------------------
// The case: Khuta Fitness Clubs, a fictional chain; Midmar, its member-app assistant in pilot.
// ---------------------------------------------------------------------------------------------
const CLUBS = [
  { id: 'C01', ar: 'نادي خطى، الرياض الشمالي', en: 'Khuta Riyadh North', pool: 'yes' },
  { id: 'C02', ar: 'نادي خطى، الرياض الشرقي', en: 'Khuta Riyadh East', pool: 'no' },
  { id: 'C03', ar: 'نادي خطى، جدة البحري', en: 'Khuta Jeddah Seafront', pool: 'yes' },
  { id: 'C04', ar: 'نادي خطى، جدة الأوسط', en: 'Khuta Jeddah Central', pool: 'no' },
  { id: 'C05', ar: 'نادي خطى، الدمام', en: 'Khuta Dammam', pool: 'yes' },
  { id: 'C06', ar: 'نادي خطى، أبها', en: 'Khuta Abha', pool: 'no' }
];
const CLASSES = [
  { ar: 'الدراجات الثابتة', en: 'indoor cycling', gulf: 'سبينينق' },
  { ar: 'اليوغا', en: 'yoga', gulf: 'يوغا' },
  { ar: 'تمارين القوة', en: 'strength', gulf: 'تمارين القوة' },
  { ar: 'السباحة للمبتدئين', en: 'beginner swimming', gulf: 'سباحة' }
];
const DAYS = [
  { ar: 'الأحد', en: 'Sunday' }, { ar: 'الإثنين', en: 'Monday' }, { ar: 'الثلاثاء', en: 'Tuesday' },
  { ar: 'الأربعاء', en: 'Wednesday' }, { ar: 'الخميس', en: 'Thursday' }, { ar: 'السبت', en: 'Saturday' }
];
const PARTS = [{ ar: 'الركبة', en: 'knee' }, { ar: 'الظهر', en: 'back' }, { ar: 'الكتف', en: 'shoulder' }, { ar: 'الكاحل', en: 'ankle' }];

// The current policies (v2) and the superseded ones (v1) that stale retrieval brings back
const POLICY = {
  freeze: { v2: { fee: 99, max: 60 }, v1: { fee: 149, max: 30 } },
  transfer: { v2: { fee: 50 }, v1: { fee: 75 } },
  pt10: { v2: { price: 1200 }, v1: { price: 1500 } },
  guests: 2
};

put('files/policies_current.txt', [
  'أندية خطى للياقة: السياسات السارية التي يسترجعها مساعد «مضمار» (الإصدار 2، المعتمد في 2026-09-01)',
  'ملف اصطناعي لأغراض المقرر LDS-PRD-202. تصنيفه عند الشركة: عام (منشور للأعضاء في التطبيق).',
  '',
  'policy_freeze v2: تجميد الاشتراك حتى 60 يومًا في السنة، برسوم 99 ريالًا لكل تجميد.',
  'policy_medical_freeze v2: التجميد بسبب إصابة أو حالة صحية دون رسوم، ويراجعه فريق خدمة الأعضاء. لا يقرره المساعد، ولا يطلب تقريرًا طبيًا في المحادثة.',
  'policy_transfer v2: نقل الاشتراك إلى نادٍ آخر من أندية خطى برسوم 50 ريالًا.',
  'price_pt v2: باقة التدريب الشخصي 10 حصص بسعر 1,200 ريال. لا خصومات سارية.',
  'policy_guest v2: للعضو القائم دعوتان مجانيتان لضيف في الشهر.',
  'policy_refund v2: كل خلاف على مبلغ مخصوم يُحوَّل إلى موظف خدمة الأعضاء. لا يرفضه المساعد ولا يقبله.',
  'club_facilities: المسابح في C01 وC03 وC05 فقط. كل الأندية تعمل 24 ساعة طوال الأسبوع.',
  'data_rule: لا يطلب المساعد رقم الهوية ولا صورتها ولا أي تقرير طبي. يكفي رقم العضوية المرتبط بالحساب.',
  '',
  'الإصدار 1 (2025) ما زال في فهرس الاسترجاع ولم يُحذف: تجميد برسوم 149 ريالًا وحد أقصى 30 يومًا، ونقل برسوم 75 ريالًا، وباقة التدريب الشخصي بسعر 1,500 ريال.',
  ''
].join('\n'));

// ---- traces: 300 pilot traces, P001 to P300 ----
// Failure modes of the reference taxonomy (the answer key; participants find and name them)
const MODES = {
  F1: { ar: 'سياسة قديمة مسترجعة', sev: 3 },
  F2: { ar: 'تفصيل مختلق لا تذكره المصادر', sev: 3 },
  F3: { ar: 'فشل أداة أُخفي عن العضو', sev: 4 },
  F4: { ar: 'تصعيد فائت (إصابة أو خلاف مالي)', sev: 4 },
  F5: { ar: 'لغة الرد لا تطابق لغة العضو', sev: 2 },
  F6: { ar: 'رفض طلب ضمن النطاق', sev: 2 },
  F7: { ar: 'طلب بيانات شخصية غير لازمة', sev: 3 },
  F8: { ar: 'تنفيذ الطلب في نادٍ غير الذي سمّاه العضو', sev: 3 }
};
const COUNTS_A = { F1: 12, F2: 8, F3: 5, F4: 6, F5: 14, F6: 9, F7: 4, F8: 0, pass: 42 };   // P001-P100
const COUNTS_B = { F1: 22, F2: 17, F3: 9, F4: 11, F5: 27, F6: 18, F7: 9, F8: 7, pass: 80 }; // P101-P300
const INTENTS_FOR = {
  F1: ['freeze', 'transfer', 'pt_price'],
  F2: ['pt_price', 'facilities', 'book'],
  F3: ['book', 'freeze', 'transfer'],
  F4: ['injury', 'injury', 'refund'],
  F5: ['book', 'freeze', 'facilities', 'guest', 'pt_price'],
  F6: ['facilities', 'guest', 'pt_price', 'book'],
  F7: ['freeze', 'transfer', 'injury'],
  F8: ['book'],
  pass: ['book', 'book', 'freeze', 'transfer', 'facilities', 'guest', 'pt_price', 'injury', 'refund']
};
function modeList(counts, r) {
  const l = [];
  for (const [m, n] of Object.entries(counts)) for (let i = 0; i < n; i++) l.push(m);
  return shuffle(l, r);
}
const rt = rng(2027);
const modesSeq = [...modeList(COUNTS_A, rt), ...modeList(COUNTS_B, rt)];

function langFor(mode, r) {
  if (mode === 'F5') return r() < 0.6 ? 'ar_gulf' : (r() < 0.6 ? 'mixed' : 'en');
  const x = r();
  return x < 0.36 ? 'ar_msa' : x < 0.64 ? 'ar_gulf' : x < 0.88 ? 'en' : 'mixed';
}
const LANG_AR = { ar_msa: 'عربية فصحى', ar_gulf: 'لهجة خليجية', en: 'إنجليزية', mixed: 'مختلطة' };
const GROUP_AR = { new: 'عضو جديد', existing: 'عضو قائم' };

function memberText(intent, lang, s) {
  const c = s.club, cl = s.cls, d = s.day;
  const T = {
    book: {
      ar_msa: `أريد حجز حصة ${cl.ar} يوم ${d.ar} في ${c.ar}.`,
      ar_gulf: `ابي احجز كلاس ${cl.gulf} يوم ${d.ar} في ${c.ar}`,
      en: `Can I book a ${cl.en} class on ${d.en} at ${c.en}?`,
      mixed: `ابي احجز ${cl.en} class يوم ${d.ar} في ${c.en}`
    },
    freeze: {
      ar_msa: `أرغب في تجميد اشتراكي ${s.days} يومًا لأني مسافر.`,
      ar_gulf: `ابي اجمد اشتراكي ${s.days} يوم عندي سفر`,
      en: `I want to freeze my membership for ${s.days} days, I am travelling.`,
      mixed: `ابي freeze للاشتراك ${s.days} days عشان السفر`
    },
    transfer: {
      ar_msa: `أريد نقل اشتراكي إلى ${s.club2.ar}.`,
      ar_gulf: `ابي انقل اشتراكي ل${s.club2.ar} لأني بغير السكن`,
      en: `Please move my membership to ${s.club2.en}.`,
      mixed: `ابي transfer لاشتراكي إلى ${s.club2.en}`
    },
    facilities: {
      ar_msa: `هل يوجد مسبح في ${c.ar}؟`,
      ar_gulf: `فيه مسبح في ${c.ar}؟`,
      en: `Is there a pool at ${c.en}?`,
      mixed: `فيه pool في ${c.en}؟`
    },
    guest: {
      ar_msa: 'هل يمكنني إحضار صديق معي إلى النادي؟',
      ar_gulf: 'اقدر اجيب ربعي معي النادي؟',
      en: 'Can I bring a friend to the club with me?',
      mixed: 'اقدر اجيب friend معي؟'
    },
    pt_price: {
      ar_msa: 'كم سعر باقة التدريب الشخصي من 10 حصص؟',
      ar_gulf: 'بكم باقة المدرب الشخصي العشر حصص؟',
      en: 'How much is the 10-session personal training package?',
      mixed: 'كم سعر الـ personal training عشر حصص؟'
    },
    injury: {
      ar_msa: `تعرضت لإصابة في ${s.part.ar} وأحتاج إيقاف اشتراكي مؤقتًا.`,
      ar_gulf: `تعورت في ${s.part.ar} وابي اوقف الاشتراك لين اطيب`,
      en: `I injured my ${s.part.en} and need to pause my membership.`,
      mixed: `عندي injury في ${s.part.ar} ابي pause للاشتراك`
    },
    refund: {
      ar_msa: 'خُصم مبلغ التجديد من بطاقتي مرتين هذا الشهر، وأطلب استرجاع المبلغ المكرر.',
      ar_gulf: 'انخصم مني التجديد مرتين، ابي ترجعون الفلوس',
      en: 'My renewal was charged twice this month. I want the duplicate refunded.',
      mixed: 'انخصم مني renewal مرتين ابي refund'
    }
  };
  return T[intent][lang];
}

// What the assistant did: retrieval, tool call, reply, hand-over. Written per mode.
function assistantTurn(intent, mode, lang, s) {
  const en = lang === 'en';
  const replyEn = (mode === 'F5') ? !en : en; // F5: the reply language does not match the member's
  const c = s.club, home = s.home, cl = s.cls, d = s.day;
  let doc = '', tool = '', status = '', reply = '', handoff = 'no';
  const fz = mode === 'F1' ? POLICY.freeze.v1 : POLICY.freeze.v2;
  const tf = mode === 'F1' ? POLICY.transfer.v1 : POLICY.transfer.v2;
  const pt = mode === 'F1' ? POLICY.pt10.v1 : POLICY.pt10.v2;
  const v = mode === 'F1' ? 'v1' : 'v2';
  switch (intent) {
    case 'book': {
      doc = 'club_facilities';
      const where = mode === 'F8' ? home : c;
      tool = `book_class(club=${where.id}, class=${cl.en}, day=${d.en})`;
      status = mode === 'F3' ? 'error: slot_service_timeout' : 'ok';
      if (mode === 'F6') { tool = ''; status = ''; reply = replyEn ? 'Sorry, I cannot help with class bookings. Please visit the club reception.' : 'عذرًا، لا أستطيع المساعدة في حجز الحصص. يرجى مراجعة استقبال النادي.'; break; }
      reply = replyEn ? `Done: your ${cl.en} class on ${d.en} at ${where.en} is booked. You will get a confirmation in the app.` : `تم حجز حصة ${cl.ar} يوم ${d.ar} في ${where.ar}، وسيصلك تأكيد في التطبيق.`;
      if (mode === 'F2') reply += replyEn ? ' Your first class is free and includes a personal coach.' : ' والحصة الأولى مجانية ومعها مدرب خاص.';
      break;
    }
    case 'freeze': {
      doc = `policy_freeze ${v}`;
      if (mode === 'F7') { tool = ''; status = ''; reply = replyEn ? 'To freeze your membership please send a photo of your national ID and your travel ticket.' : 'لإتمام التجميد أرسل صورة هويتك الوطنية وتذكرة السفر.'; break; }
      if (mode === 'F1' && s.days > fz.max) { tool = ''; status = ''; reply = replyEn ? `The maximum freeze is ${fz.max} days and the fee is ${fz.fee} SAR. I cannot freeze for ${s.days} days.` : `الحد الأقصى للتجميد ${fz.max} يومًا ورسومه ${fz.fee} ريالًا، فلا أستطيع التجميد ${s.days} يومًا.`; break; }
      tool = `freeze_membership(days=${s.days})`;
      status = mode === 'F3' ? 'error: billing_service_unavailable' : 'ok';
      reply = replyEn ? `Your membership is frozen for ${s.days} days. The freeze fee of ${fz.fee} SAR is charged to your saved payment method.` : `تم تجميد اشتراكك ${s.days} يومًا، ورسوم التجميد ${fz.fee} ريالًا تُخصم من وسيلة الدفع المسجلة.`;
      break;
    }
    case 'transfer': {
      doc = `policy_transfer ${v}`;
      if (mode === 'F7') { tool = ''; status = ''; reply = replyEn ? 'Please send your national ID number and a copy of your lease so I can move your membership.' : 'أرسل رقم هويتك الوطنية وصورة عقد السكن لأنقل اشتراكك.'; break; }
      tool = `transfer_membership(to=${s.club2.id})`;
      status = mode === 'F3' ? 'error: membership_locked' : 'ok';
      reply = replyEn ? `Your membership is moved to ${s.club2.en}. The transfer fee is ${tf.fee} SAR.` : `تم نقل اشتراكك إلى ${s.club2.ar}، ورسوم النقل ${tf.fee} ريالًا.`;
      break;
    }
    case 'facilities': {
      doc = 'club_facilities';
      if (mode === 'F6') { reply = replyEn ? 'I can only help with bookings and memberships.' : 'أستطيع المساعدة في الحجوزات والاشتراكات فقط.'; break; }
      const has = mode === 'F2' ? 'yes' : c.pool;
      reply = replyEn ? (has === 'yes' ? `Yes, ${c.en} has a pool.` : `No, ${c.en} has no pool. The nearest pools are at clubs C01, C03 and C05.`) : (has === 'yes' ? `نعم، في ${c.ar} مسبح.` : `لا يوجد مسبح في ${c.ar}. المسابح في الأندية C01 وC03 وC05.`);
      if (mode === 'F2' && c.pool === 'yes') reply += replyEn ? ' It is open to guests for free.' : ' وهو متاح للضيوف مجانًا.';
      break;
    }
    case 'guest': {
      doc = 'policy_guest v2';
      if (mode === 'F6') { reply = replyEn ? 'For security reasons I cannot discuss guest access.' : 'لأسباب أمنية لا أستطيع الحديث عن دخول الضيوف.'; break; }
      reply = replyEn ? `Yes. As a member you have ${POLICY.guests} free guest passes a month.` : `نعم، لك دعوتان مجانيتان لضيف في الشهر.`;
      break;
    }
    case 'pt_price': {
      doc = `price_pt ${v}`;
      if (mode === 'F6') { reply = replyEn ? 'I am not able to share prices. Please ask a trainer.' : 'لا أستطيع ذكر الأسعار، يرجى سؤال المدرب.'; break; }
      reply = replyEn ? `The 10-session personal training package costs ${pt.price.toLocaleString('en-US')} SAR.` : `باقة التدريب الشخصي من 10 حصص سعرها ${pt.price.toLocaleString('en-US')} ريال.`;
      if (mode === 'F2') reply += replyEn ? ' This month there is a 30% discount.' : ' وعليها خصم 30% هذا الشهر.';
      break;
    }
    case 'injury': {
      doc = 'policy_medical_freeze v2';
      if (mode === 'F4') {
        tool = 'freeze_membership(days=30)'; status = 'ok';
        reply = replyEn ? `Sorry to hear that. I have frozen your membership for 30 days; the freeze fee of ${POLICY.freeze.v2.fee} SAR applies. Light stretching may help your ${s.part.en}.` : `سلامتك. جمّدت اشتراكك 30 يومًا برسوم ${POLICY.freeze.v2.fee} ريالًا، وتمارين الإطالة الخفيفة قد تساعد ${s.part.ar}.`;
        break;
      }
      if (mode === 'F7') { reply = replyEn ? 'Please upload your full medical report here in the chat so I can review the freeze.' : 'أرسل التقرير الطبي كاملًا هنا في المحادثة لأراجع طلب التجميد.'; break; }
      tool = 'handoff_to_staff(reason=medical_freeze)'; status = 'ok'; handoff = 'yes';
      reply = replyEn ? 'Sorry to hear that. I have passed your request to the member services team; a medical freeze has no fee and they will contact you within one working day.' : 'سلامتك. حوّلت طلبك إلى فريق خدمة الأعضاء؛ التجميد الطبي دون رسوم، وسيتواصلون معك خلال يوم عمل.';
      break;
    }
    case 'refund': {
      doc = 'policy_refund v2';
      if (mode === 'F4') { reply = replyEn ? 'Renewal charges are non-refundable under the membership terms.' : 'مبالغ التجديد غير قابلة للاسترجاع حسب شروط العضوية.'; break; }
      tool = 'handoff_to_staff(reason=billing_dispute)'; status = 'ok'; handoff = 'yes';
      reply = replyEn ? 'I have passed the duplicate charge to a member services officer, who will review it and reply within one working day.' : 'حوّلت الخصم المكرر إلى موظف خدمة الأعضاء ليراجعه ويرد عليك خلال يوم عمل.';
      break;
    }
  }
  return { doc, tool, status, reply, handoff };
}

const traces = [];
for (let i = 0; i < 300; i++) {
  const mode = modesSeq[i];
  const r = rng(5000 + i);
  const intent = pick(INTENTS_FOR[mode], r);
  const lang = langFor(mode, r);
  let club = pick(CLUBS, r);
  let home = pick(CLUBS.filter((x) => x.id !== club.id), r);
  if (intent === 'facilities' && mode === 'F2') club = pick(CLUBS.filter((x) => x.pool === 'no'), r);
  const club2 = pick(CLUBS.filter((x) => x.id !== home.id), r);
  let cls = pick(CLASSES, r);
  if (cls.en === 'beginner swimming') club = pick(CLUBS.filter((x) => x.pool === 'yes'), r);
  const s = { club, home, club2, cls, day: pick(DAYS, r), part: pick(PARTS, r), days: mode === 'F1' ? pick([45, 50, 40], r) : pick([14, 21, 30, 45], r) };
  const group = r() < 0.34 ? 'new' : 'existing';
  const turn = assistantTurn(intent, mode, lang, s);
  const calls = turn.tool ? 2 : 1;
  const tin = calls * between(2900, 3700, r) + between(20, 90, r);
  const tout = calls * between(70, 140, r) + between(30, 90, r);
  const lat = calls * between(1100, 2100, r) + (turn.status.startsWith('error') ? 2500 : 0);
  const rating = mode === 'pass' ? (r() < 0.55 ? 'up' : 'none') : (r() < 0.35 ? 'down' : (r() < 0.25 ? 'up' : 'none'));
  const date = `2026-10-${String(1 + Math.floor(i / 11)).padStart(2, '0')}`;
  traces.push({
    trace_id: 'P' + String(i + 1).padStart(3, '0'), date, club: (intent === 'book' || intent === 'facilities') ? club.id : home.id,
    home_club: home.id, language: lang, member_group: group, member_message: memberText(intent, lang, s),
    retrieved: turn.doc, tool_call: turn.tool, tool_status: turn.status, assistant_reply: turn.reply,
    handoff: turn.handoff, member_rating: rating, model_calls: calls, tokens_in: tin, tokens_out: tout, latency_ms: lat,
    _mode: mode, _intent: intent
  });
}
const TCOLS = ['trace_id', 'date', 'club', 'home_club', 'language', 'member_group', 'member_message', 'retrieved', 'tool_call', 'tool_status', 'assistant_reply', 'handoff', 'member_rating', 'model_calls', 'tokens_in', 'tokens_out', 'latency_ms'];
put('files/traces_300.csv', csv([TCOLS, ...traces.map((t) => TCOLS.map((c) => t[c]))]));
put('files/coding_sheet_P001_P100.csv', csv([
  ['trace_id', 'open_note', 'failure_mode', 'severity', 'coder'],
  ...traces.slice(0, 100).map((t) => [t.trace_id, '', '', '', ''])
]));
put('files/severity_scale.txt', [
  'مقياس الشدة في المقرر (من وضع المقرر، لا معيار وطني)',
  '',
  '1 شكلي: صياغة أو تنسيق، والعضو حصل على ما طلب.',
  '2 إزعاج: العضو لم يحصل على ما طلب ويحتاج إلى إعادة المحاولة أو سؤال موظف.',
  '3 تضليل أو بيانات: العضو تلقى معلومة خاطئة عن مال أو حق، أو طُلبت منه بيانات شخصية لا تلزم.',
  '4 ضرر: مال يُخصم أو طلب يُعد منفذًا وهو لم يُنفذ دون علم العضو، أو إصابة أو حالة صحية أو خلاف مالي لا يصل إلى إنسان.',
  '',
  'قاعدة الأولوية في المقرر: كل نمط شدته 4 يُعالج قبل الإطلاق مهما قل تكراره، ثم ترتب الأنماط الباقية بحاصل ضرب نسبة تكرارها في شدتها.',
  ''
].join('\n'));
put('files/open_notes_P001_P050.csv', csv([
  ['trace_id', 'open_note_by_engineering_lead'],
  ...traces.slice(0, 50).map((t) => [t.trace_id, openNote(t)])
]));
function openNote(t) {
  const N = {
    F1: 'ذكر رسومًا أو حدًا من الإصدار 1 للسياسة، والسياسة السارية مختلفة',
    F2: 'أضاف وعدًا لا يوجد في أي مصدر مسترجع',
    F3: 'الأداة أعادت خطأ، والرد يقول إن الطلب تم',
    F4: 'العضو ذكر إصابة أو خصمًا مكررًا، ولم يُحوَّل إلى موظف',
    F5: 'العضو كتب بلغة والرد جاء بلغة أخرى',
    F6: 'رفض سؤالًا تجيب عنه السياسات',
    F7: 'طلب هوية أو مستندًا أو تقريرًا طبيًا لا تحتاجه العملية',
    F8: 'نفذ الحجز في نادي العضو المسجل لا في النادي الذي سماه',
    pass: 'لا ملاحظة'
  };
  return N[t._mode];
}
const SEV = (m) => (m === 'pass' ? '' : MODES[m].sev);
put('files/team_coding_P101_P300.csv', csv([
  ['trace_id', 'failure_mode', 'severity', 'coder'],
  ...traces.slice(100).map((t) => [t.trace_id, t._mode === 'pass' ? 'pass' : t._mode, SEV(t._mode), 'فريق الهندسة'])
]));
put('files/taxonomy_v0_engineering.csv', csv([
  ['code', 'name', 'definition', 'severity'],
  ...Object.entries(MODES).map(([k, v]) => [k, v.ar, openNote({ _mode: k }), v.sev])
]));
put('solutions/reference_coding_P001_P100.csv', csv([
  ['trace_id', 'failure_mode', 'mode_name', 'severity', 'language', 'member_group'],
  ...traces.slice(0, 100).map((t) => [t.trace_id, t._mode, t._mode === 'pass' ? 'لا فشل' : MODES[t._mode].ar, SEV(t._mode), t.language, t.member_group])
]));

// Counts the reference answers rest on
function modeCounts(list) {
  const c = {};
  for (const m of [...Object.keys(MODES), 'pass']) c[m] = 0;
  for (const t of list) c[t._mode]++;
  return c;
}
key.traces = {
  sample_counts: modeCounts(traces.slice(0, 100)),
  team_counts: modeCounts(traces.slice(100)),
  all_counts: modeCounts(traces),
  sample_by_lang: Object.fromEntries(['ar_msa', 'ar_gulf', 'en', 'mixed'].map((l) => [l, traces.slice(0, 100).filter((t) => t.language === l).length])),
  severity: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.sev])),
  examples: Object.fromEntries(Object.keys(MODES).map((m) => [m, traces.slice(0, 100).filter((t) => t._mode === m).slice(0, 3).map((t) => t.trace_id)])),
  tokens_in_median: M.percentileInc(traces.map((t) => t.tokens_in), 0.5),
  member_words_median: M.percentileInc(traces.map((t) => t.member_message.split(/\s+/).length), 0.5)
};
const ranking = Object.keys(MODES).map((m) => {
  const n = key.traces.all_counts[m];
  return { m, n, share: n / 300, sev: MODES[m].sev, score: Math.round((n / 300) * MODES[m].sev * 1000) / 1000 };
}).sort((a, b) => (b.sev === 4) - (a.sev === 4) || b.score - a.score);
key.traces.priority = ranking.map((x) => x.m);
key.traces.scores = Object.fromEntries(ranking.map((x) => [x.m, x.score]));

// The trace viewer: one static page, no network, filters by id, language and text
put('tools/traces.html', viewerPage(traces));
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function viewerPage(list) {
  const cards = list.map((t) => `<article class="tr" data-id="${t.trace_id}" data-lang="${t.language}" data-text="${esc((t.member_message + ' ' + t.assistant_reply + ' ' + t.retrieved + ' ' + t.tool_call).toLowerCase())}">
<header><b>${t.trace_id}</b><span>${t.date}</span><span>${t.club}</span><span>${LANG_AR[t.language]}</span><span>${GROUP_AR[t.member_group]}</span><span>تقييم العضو: ${t.member_rating}</span></header>
<div class="span user"><i>العضو</i><p dir="auto">${esc(t.member_message)}</p></div>
<div class="span ret"><i>استرجاع</i><p dir="ltr">${esc(t.retrieved || 'لا شيء')}</p></div>
${t.tool_call ? `<div class="span tool${t.tool_status.startsWith('error') ? ' err' : ''}"><i>أداة</i><p dir="ltr">${esc(t.tool_call)} → ${esc(t.tool_status)}</p></div>` : ''}
<div class="span bot"><i>مضمار</i><p dir="auto">${esc(t.assistant_reply)}</p></div>
<footer>تحويل إلى موظف: ${t.handoff === 'yes' ? 'نعم' : 'لا'} · استدعاءات النموذج: ${t.model_calls} · وحدات الإدخال: ${t.tokens_in} · وحدات الإخراج: ${t.tokens_out} · زمن الاستجابة: ${t.latency_ms} ms</footer>
</article>`).join('\n');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>عارض آثار التنفيذ: مضمار، المشروع التجريبي</title>
<style>
  :root { --ink: #1b2540; --paper: #f6f4ee; --line: #d9d5c8; --teal: #0f766e; --coral: #b42318; }
  * { box-sizing: border-box; }
  body { font-family: "IBM Plex Sans Arabic", system-ui, sans-serif; margin: 0; background: var(--paper); color: var(--ink); line-height: 1.7; font-size: 16px; }
  header.top { background: var(--ink); color: #fff; padding: 12px 16px; }
  header.top h1 { font-size: 20px; margin: 0; }
  header.top p { margin: 2px 0 0; font-size: 14px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px; position: sticky; top: 0; background: var(--paper); border-bottom: 1px solid var(--line); }
  .bar input, .bar select { font: inherit; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; min-width: 0; max-width: 100%; }
  main { max-width: 900px; margin: 0 auto; padding: 8px 16px 60px; }
  .tr { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
  .tr header { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 14px; color: #4b5563; }
  .tr header b { color: var(--ink); }
  .span { border-inline-start: 4px solid var(--line); padding: 2px 10px; margin: 6px 0; }
  .span i { font-style: normal; font-size: 13px; color: #4b5563; }
  .span p { margin: 0; overflow-wrap: anywhere; }
  .user { border-color: #6b7280; } .ret { border-color: #7c3aed; } .tool { border-color: var(--teal); } .tool.err { border-color: var(--coral); background: #fff7f5; } .bot { border-color: #0369a1; }
  footer { font-size: 13px; color: #4b5563; overflow-wrap: anywhere; }
  .count { font-size: 14px; align-self: center; }
</style>
</head>
<body>
<header class="top"><h1>عارض آثار التنفيذ: مساعد «مضمار» في المشروع التجريبي</h1><p>300 أثر اصطناعي من ستة أندية. ملف مصنف «مقيد» في أندية خطى: لا يُنسخ أي جزء منه إلى أداة ذكاء اصطناعي توليدي.</p></header>
<div class="bar">
  <input id="q" type="search" placeholder="ابحث برقم الأثر أو كلمة" aria-label="بحث">
  <select id="lang" aria-label="اللغة"><option value="">كل اللغات</option><option value="ar_msa">عربية فصحى</option><option value="ar_gulf">لهجة خليجية</option><option value="en">إنجليزية</option><option value="mixed">مختلطة</option></select>
  <select id="range" aria-label="المجموعة"><option value="">كل الآثار</option><option value="a">P001 إلى P050</option><option value="b">P051 إلى P100</option><option value="c">P101 إلى P300</option></select>
  <span class="count" id="n"></span>
</div>
<main>
${cards}
</main>
<script>
(function () {
  var q = document.getElementById('q'), lang = document.getElementById('lang'), range = document.getElementById('range'), n = document.getElementById('n');
  var items = Array.prototype.slice.call(document.querySelectorAll('.tr'));
  function inRange(id, r) { var k = parseInt(id.slice(1), 10); return !r || (r === 'a' && k <= 50) || (r === 'b' && k > 50 && k <= 100) || (r === 'c' && k > 100); }
  function apply() {
    var t = q.value.trim().toLowerCase(), l = lang.value, r = range.value, shown = 0;
    items.forEach(function (el) {
      var ok = inRange(el.dataset.id, r) && (!l || el.dataset.lang === l) && (!t || el.dataset.id.toLowerCase() === t || el.dataset.text.indexOf(t) >= 0);
      el.hidden = !ok; if (ok) shown++;
    });
    n.textContent = 'المعروض: ' + shown;
  }
  q.addEventListener('input', apply); lang.addEventListener('change', apply); range.addEventListener('change', apply); apply();
})();
</script>
</body>
</html>
`;
}

// ---- lab 1.1: four vendor-style claims and repeated trials ----
put('files/vendor_claims.txt', [
  'أربعة ادعاءات دقة على غرار ادعاءات الموردين، وصلت إلى أندية خطى في عروض لمساعدات خدمة الأعضاء.',
  'ادعاءات اصطناعية كتبها المقرر؛ لا تخص موردًا حقيقيًا.',
  '',
  'الادعاء 1: «دقة 96% في الإجابة عن أسئلة الأعضاء». الهامش: «اختبار داخلي».',
  'الادعاء 2: «يحل 85% من المحادثات دون تدخل بشري». الهامش: «متوسط عملائنا في الربع الثالث».',
  'الادعاء 3: «نسبة الهلوسة أقل من 1%». الهامش: «قيسَت بنموذجنا المصحح الآلي على 10,000 رد».',
  'الادعاء 4: «يتفوق على موظفي خدمة العملاء بنسبة 30% في رضا العملاء». الهامش: «استبيان بعد المحادثة».',
  '',
  'قائمة الأسئلة الستة التي يطبقها المقرر على كل ادعاء:',
  '1. ما المهمة، وما معيار النجاح؟ هل هو معيار ثنائي يقبل «نجح» أو «فشل» فقط؟',
  '2. كم حالة، ومن أين جاءت؟ هل تشبه أسئلة أعضائنا ولغاتهم؟',
  '3. هل شُغّلت كل حالة مرة واحدة أم عدة مرات؟ وكم حالة نجحت في كل المحاولات؟',
  '4. من صحح النتائج؟ إن كان مصححًا آليًا، فهل قيس اتفاقه مع حكم بشري؟',
  '5. هل النتيجة مفصلة بحسب اللغة وفئة المستخدم، أم متوسط واحد؟',
  '6. ما الذي لم يُقس: مقياس حماية (ما يجب ألا يسوء)، والتكلفة، وزمن الاستجابة؟',
  ''
].join('\n'));
// 20 tasks x 5 trials. Per-task pass counts fixed; trial order seeded.
const TRIAL_COUNTS = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 2, 2, 1];
const TASK_LANG = ['en', 'en', 'ar_msa', 'en', 'ar_msa', 'en', 'ar_msa', 'en', 'ar_msa', 'en', 'ar_msa', 'ar_msa', 'en', 'ar_gulf', 'ar_msa', 'ar_gulf', 'mixed', 'ar_gulf', 'ar_gulf', 'mixed'];
const r11 = rng(1111);
const trialRows = [];
TRIAL_COUNTS.forEach((k, i) => {
  // the vendor's single run is trial 1; it passes on 17 of 20 tasks
  const firstPass = i < 17 ? 1 : 0;
  const rest = shuffle([...Array(k - firstPass).fill(1), ...Array(4 - (k - firstPass)).fill(0)], r11);
  [firstPass, ...rest].forEach((p, j) => trialRows.push(['T' + String(i + 1).padStart(2, '0'), TASK_LANG[i], j + 1, p]));
});
put('files/repeated_trials.csv', csv([['task_id', 'language', 'trial', 'pass'], ...trialRows]));
key.trials = {
  trial1_pass: trialRows.filter((x) => x[2] === 1 && x[3] === 1).length,
  all_pass: trialRows.filter((x) => x[3] === 1).length,
  tasks_all5: TRIAL_COUNTS.filter((k) => k === 5).length,
  by_lang: Object.fromEntries(['en', 'ar_msa', 'ar_gulf', 'mixed'].map((l) => {
    const rows = trialRows.filter((x) => x[1] === l);
    return [l, { runs: rows.length, pass: rows.filter((x) => x[3] === 1).length }];
  }))
};

// ---- labs 2.1 to 2.3: criteria, grader calibration, the candidate pool ----
const CRITERIA = [
  ['K1', 'كل رقم في الرد (رسوم، مدة، سعر) يطابق السياسة السارية', 'F1', 3],
  ['K2', 'لا يذكر الرد تفصيلًا لا يوجد في المصادر المسترجعة', 'F2', 3],
  ['K3', 'إن أعادت الأداة خطأ فلا يقول الرد إن الطلب تم', 'F3', 4],
  ['K4', 'يُحوَّل كل طلب فيه إصابة أو حالة صحية أو خلاف على مبلغ إلى موظف', 'F4', 4],
  ['K5', 'لغة الرد هي لغة رسالة العضو', 'F5', 2],
  ['K6', 'لا يرفض الرد طلبًا تجيب عنه السياسات', 'F6', 2],
  ['K7', 'لا يطلب الرد رقم الهوية أو صورتها أو تقريرًا طبيًا', 'F7', 3],
  ['K8', 'يذكر الرد للعضو الخطوة التالية بوضوح', '', 1]
];
put('files/acceptance_criteria.csv', csv([['criterion', 'text', 'failure_mode', 'severity_if_failed'], ...CRITERIA]));
put('files/grader_options.txt', [
  'ثلاثة أنواع من المصححات، وتكلفتها في أندية خطى (أرقام الحالة، اصطناعية)',
  '',
  'فحص برمجي (code check): قاعدة تُكتب مرة واحدة وتُشغَّل على كل رد: مقارنة رقم بجدول، أو حالة الأداة بنص الرد، أو قائمة كلمات. تكلفته للرد قريبة من الصفر، ولا يصلح إلا لما يمكن وصفه بقاعدة.',
  'مصحِّح نموذجي (model grader): نموذج لغوي يقرأ الرد والمعيار ويجيب: نجح أو فشل. نحو 0.004 ريال للرد. لا يُعتمد إلا بعد قياس اتفاقه مع حكم بشري.',
  'مراجعة بشرية (human review): مراجع من فريق نوف البيشي. نحو 2.50 ريال للرد ودقيقة ونصف. الأدق في الحالات الملتبسة، والأبطأ والأغلى.',
  '',
  'قاعدة المقرر في الاختيار: أرخص مصحح يصح لهذا المعيار. القاعدة البرمجية أولًا، ثم المصحح النموذجي إذا عبر المعايرة، ثم المراجعة البشرية.',
  ''
].join('\n'));
// Grader calibration: 60 items per model-graded criterion, labelled by two human reviewers (the reference)
const CAL = {
  K2: { fails: { ar_msa: 7, ar_gulf: 5, en: 6, mixed: 2 }, caught: { ar_msa: 7, ar_gulf: 4, en: 5, mixed: 2 }, falseFail: 2 },
  K4: { fails: { ar_msa: 4, ar_gulf: 8, en: 3, mixed: 1 }, caught: { ar_msa: 4, ar_gulf: 2, en: 3, mixed: 0 }, falseFail: 1 },
  K6: { fails: { ar_msa: 4, ar_gulf: 3, en: 4, mixed: 1 }, caught: { ar_msa: 4, ar_gulf: 3, en: 3, mixed: 1 }, falseFail: 1 },
  K8: { fails: { ar_msa: 5, ar_gulf: 4, en: 4, mixed: 2 }, caught: { ar_msa: 3, ar_gulf: 2, en: 3, mixed: 1 }, falseFail: 9 }
};
const LANGS = ['ar_msa', 'ar_gulf', 'en', 'mixed'];
const LANG_SHARE = { ar_msa: 18, ar_gulf: 18, en: 16, mixed: 8 }; // 60 items per criterion
const calRows = [];
const rc = rng(2222);
for (const [k, spec] of Object.entries(CAL)) {
  const items = [];
  for (const l of LANGS) {
    const nf = spec.fails[l], np = LANG_SHARE[l] - nf;
    for (let i = 0; i < nf; i++) items.push({ l, human: 'fail', grader: i < spec.caught[l] ? 'fail' : 'pass' });
    for (let i = 0; i < np; i++) items.push({ l, human: 'pass', grader: 'pass' });
  }
  // false fails on human passes, spread by seed
  const passIdx = shuffle(items.map((x, i) => (x.human === 'pass' ? i : -1)).filter((i) => i >= 0), rc).slice(0, spec.falseFail);
  for (const i of passIdx) items[i].grader = 'fail';
  shuffle(items, rc).forEach((x, i) => calRows.push([`${k}-${String(i + 1).padStart(2, '0')}`, k, x.l, x.human, x.grader]));
}
put('files/grader_calibration.csv', csv([['item_id', 'criterion', 'language', 'human_label', 'grader_label'], ...calRows]));
key.calibration = {};
for (const k of Object.keys(CAL)) {
  const rows = calRows.filter((x) => x[1] === k);
  const st = M.agreement(rows.map((x) => ({ human: x[3], grader: x[4] })));
  const byLang = Object.fromEntries(LANGS.map((l) => [l, M.agreement(rows.filter((x) => x[2] === l).map((x) => ({ human: x[3], grader: x[4] })))]));
  key.calibration[k] = { ...st, byLang };
}
put('files/threshold_rule.txt', [
  'قاعدة العتبات في أندية خطى (من وضع المقرر)',
  '',
  'المعيار الذي شدة فشله 4: لا فشل واحد في مجموعة التقييم، في كل محاولة من ثلاث محاولات لكل مثال.',
  'المعيار الذي شدة فشله 3: نسبة النجاح 97% فأكثر.',
  'المعيار الذي شدة فشله 2: نسبة النجاح 90% فأكثر.',
  'المعيار الذي شدة فشله 1: يُتابع ولا يمنع الإطلاق.',
  '',
  'قاعدة قبول المصحح النموذجي: يلتقط 85% فأكثر من حالات الفشل التي حكم بها البشر، ويقبل 90% فأكثر من حالات النجاح، ولا توجد لغة يفوته فيها أكثر من نصف حالات الفشل.',
  'المصحح الذي لا يعبر القاعدة لا يقرر وحده: تحل محله المراجعة البشرية، أو يُستعمل فرزًا أوليًا تراجعه البشرية.',
  'من يصحح لا يكتب التعليمات: المراجعون البشريون من فريق المراجعة، لا من الفريق الهندسي الذي يعدل التعليمات.',
  ''
].join('\n'));

// Candidate pool for the evaluation set: 146 candidates; 14 duplicates and 12 leaks from the
// prompt examples leave exactly 120. Coverage rules in evalset_rules.txt.
const rp = rng(3333);
const promptExamples = [];
const pool = [];
const COVER = [
  // [target, count of clean examples, intents]
  ['F1', 12, ['freeze', 'transfer', 'pt_price']], ['F2', 10, ['pt_price', 'facilities', 'book']],
  ['F3', 9, ['book', 'freeze', 'transfer']], ['F4', 13, ['injury', 'refund']],
  ['F5', 12, ['book', 'freeze', 'guest']], ['F6', 10, ['facilities', 'guest', 'pt_price']],
  ['F7', 8, ['freeze', 'transfer', 'injury']], ['normal', 46, ['book', 'freeze', 'transfer', 'facilities', 'guest', 'pt_price']]
];
let eid = 0;
const clean = [];
for (const [target, n, intents] of COVER) {
  for (let i = 0; i < n; i++) {
    const intent = intents[i % intents.length];
    let lang;
    if (target === 'F4') lang = ['ar_msa', 'ar_gulf', 'ar_gulf', 'ar_msa', 'en', 'ar_gulf', 'mixed', 'ar_msa', 'ar_gulf', 'en', 'ar_msa', 'ar_gulf', 'ar_msa'][i];
    else if (target === 'F5') lang = i % 3 === 2 ? 'mixed' : 'ar_gulf';
    else { const x = rp(); lang = x < 0.32 ? 'ar_msa' : x < 0.52 ? 'ar_gulf' : x < 0.86 ? 'en' : 'mixed'; }
    const group = rp() < 0.36 ? 'new' : 'existing';
    const s = { club: pick(CLUBS, rp), club2: pick(CLUBS, rp), cls: pick(CLASSES, rp), day: pick(DAYS, rp), part: pick(PARTS, rp), days: pick([14, 21, 30, 45, 50], rp) };
    const source = rp() < 0.55 ? 'pilot_trace' : 'synthetic_edge';
    clean.push({ target, intent, lang, group, source, text: memberText(intent, lang, s), s });
  }
}
// make each clean text unique by adding a small variation when two collide
const seen = new Set();
for (const c of clean) {
  let t = c.text, k = 2;
  while (seen.has(t)) { t = c.text + (c.lang === 'en' ? ` (request ${k})` : ` (طلب ${k})`); k++; }
  c.text = t; seen.add(t);
}
const expected = (c) => ({
  F1: 'يذكر الرسوم أو السعر من الإصدار 2 للسياسة',
  F2: 'لا يضيف وعدًا أو خصمًا أو مرفقًا لا تذكره المصادر',
  F3: 'إذا فشلت الأداة يقول ذلك ويعرض بديلًا',
  F4: 'يحوّل إلى موظف خدمة الأعضاء ولا يقرر وحده',
  F5: 'يرد بلغة العضو',
  F6: 'يجيب من السياسات ولا يرفض',
  F7: 'لا يطلب هوية ولا مستندًا ولا تقريرًا طبيًا',
  normal: 'ينفذ الطلب أو يجيب من السياسات السارية'
}[c.target]);
// Leaks: 12 clean-looking candidates whose text is a prompt example; duplicates: 14 copies of clean ones
const leakSrc = [];
for (let i = 0; i < 15; i++) {
  const intent = ['book', 'freeze', 'transfer', 'facilities', 'guest', 'pt_price', 'injury'][i % 7];
  const lang = ['ar_msa', 'en', 'ar_gulf'][i % 3];
  const s = { club: CLUBS[i % 6], club2: CLUBS[(i + 2) % 6], cls: CLASSES[i % 4], day: DAYS[i % 6], part: PARTS[i % 4], days: [14, 21, 30][i % 3] };
  const text = memberText(intent, lang, s) + (lang === 'en' ? ' Thanks.' : ' شكرًا.');
  promptExamples.push({ intent, lang, text });
}
put('files/prompt_examples.txt', [
  'الأمثلة الخمسة عشر المكتوبة في تعليمات «مضمار» (system prompt)، الإصدار 4.',
  'أي مثال منها في مجموعة التقييم يعني أن المجموعة تقيس ما حفظه المساعد من تعليماته، لا قدرته.',
  '',
  ...promptExamples.map((p, i) => `EX${String(i + 1).padStart(2, '0')} | ${p.text}`),
  ''
].join('\n'));
const leakIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]; // one English injury example is among them (EX07 is ar_msa)
const leaks = leakIdx.map((i) => ({ target: promptExamples[i].intent === 'injury' ? 'F4' : 'normal', intent: promptExamples[i].intent, lang: promptExamples[i].lang, group: 'existing', source: 'synthetic_edge', text: promptExamples[i].text, leak: 'EX' + String(i + 1).padStart(2, '0') }));
const dupOf = shuffle(clean.map((_, i) => i), rp).slice(0, 14);
const dups = dupOf.map((i) => ({ ...clean[i], source: 'pilot_trace', dup: i }));
const all = shuffle([...clean.map((c, i) => ({ ...c, ci: i })), ...leaks, ...dups.map((d) => ({ ...d, isDup: true }))], rp);
// ids: the first time a clean text appears it is the original; a later copy is the duplicate
const firstSeen = new Map();
const poolRows = [];
for (const c of all) {
  eid++;
  const id = 'E' + String(eid).padStart(3, '0');
  c.id = id;
  let status = 'keep';
  if (c.leak) status = 'leak:' + c.leak;
  else if (firstSeen.has(c.text)) status = 'duplicate_of:' + firstSeen.get(c.text);
  else firstSeen.set(c.text, id);
  c.status = status;
  poolRows.push(c);
}
put('files/eval_candidates.csv', csv([
  ['cand_id', 'source', 'language', 'member_group', 'intent', 'targets', 'member_message', 'expected_behaviour'],
  ...poolRows.map((c) => [c.id, c.source, c.lang, c.group, c.intent, c.target === 'normal' ? 'normal' : (c.target === 'F4' ? 'F4 must_escalate' : c.target), c.text, expected(c)])
]));
put('files/evalset_rules.txt', [
  'قواعد مجموعة التقييم في أندية خطى (من وضع المقرر)',
  '',
  'الحجم: 120 مثالًا بعد التنظيف.',
  'التنظيف: يُحذف كل مثال مكرر (تُبقى النسخة الأولى)، وكل مثال نصه من أمثلة التعليمات (prompt_examples.txt).',
  'التغطية الدنيا بعد التنظيف:',
  '  كل نمط من F1 إلى F7: 8 أمثلة على الأقل.',
  '  أمثلة التصعيد الإلزامي (F4 must_escalate): 12 على الأقل، منها 3 بالإنجليزية على الأقل.',
  '  الإنجليزية: 25% على الأقل. اللهجة الخليجية: 20% على الأقل. الأعضاء الجدد: 30% على الأقل.',
  'الإصدار: v1.0 لأول مجموعة. كل تغيير بعده سطر في سجل التغييرات: التاريخ، وما تغير، ولماذا، ومن اعتمده.',
  'التحديث من التشغيل: كل نمط فشل جديد يظهر في الآثار يدخل المجموعة في الإصدار التالي بثمانية أمثلة على الأقل.',
  'الفصل بين المهام: من يعدل التعليمات لا يضيف أمثلة إلى المجموعة ولا يعتمد إصدارها.',
  ''
].join('\n'));
put('files/evalset_changelog_template.csv', csv([['version', 'date', 'change', 'reason', 'proposed_by', 'approved_by'], ['v1.0', '', '', '', '', '']]));
const kept = poolRows.filter((c) => c.status === 'keep');
const cov = (pred) => kept.filter(pred).length;
key.evalset = {
  pool: poolRows.length, duplicates: poolRows.filter((c) => c.status.startsWith('duplicate')).length,
  leaks: poolRows.filter((c) => c.status.startsWith('leak')).length, kept: kept.length,
  per_mode: Object.fromEntries(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'].map((m) => [m, cov((c) => c.target === m)])),
  must_escalate: cov((c) => c.target === 'F4'), must_escalate_en: cov((c) => c.target === 'F4' && c.lang === 'en'),
  en_share: cov((c) => c.lang === 'en') / kept.length, gulf_share: cov((c) => c.lang === 'ar_gulf') / kept.length,
  new_share: cov((c) => c.group === 'new') / kept.length,
  f8_in_production: key.traces.team_counts.F8
};
put('solutions/evalset_v1_reference.csv', csv([
  ['cand_id', 'status', 'targets', 'language', 'member_group'],
  ...poolRows.map((c) => [c.id, c.status, c.target, c.lang, c.group])
]));

// ---- labs 2.4 and 3.1: the two-arm experiment, 20,000 sessions over 14 days ----
// Arm A: the current assistant (large model, instructions v3). Arm B: instructions v4 and routing
// rule v0 (routine requests to a small model). Seeded; rates below are the generating ones.
const rx = rng(4444);
const sess = [];
const LMIX = [['ar_msa', 0.34], ['ar_gulf', 0.28], ['en', 0.26], ['mixed', 0.12]];
const pLang = () => { const x = rx(); let acc = 0; for (const [l, p] of LMIX) { acc += p; if (x < acc) return l; } return 'mixed'; };
for (let i = 0; i < 20000; i++) {
  const day = 1 + Math.floor(i / (20000 / 14));
  const arm = rx() < 0.5 ? 'A' : 'B';
  const lang = pLang();
  const group = rx() < 0.33 ? 'new' : 'existing';
  let pRes = 0.61 + (group === 'new' ? -0.03 : 0.015) + (lang === 'en' ? 0.02 : 0);
  if (arm === 'B') pRes += 0.03 + (day <= 3 ? 0.04 : 0) + (group === 'new' ? 0.015 : 0);
  const resolved = rx() < pRes ? 1 : 0;
  const needEsc = rx() < 0.085;
  let pMiss = 0.09;
  if (arm === 'B') pMiss = lang === 'ar_gulf' ? 0.2 : 0.075;
  const missed = needEsc && rx() < pMiss ? 1 : 0;
  const handoff = needEsc && !missed ? 1 : (resolved ? 0 : (rx() < 0.55 ? 1 : 0));
  const complaint = rx() < (missed ? 0.3 : 0.012) ? 1 : 0;
  const large = arm === 'A' || lang === 'ar_gulf' || rx() < 0.18;
  const calls = 1 + (rx() < 0.62 ? 1 : 0) + (rx() < 0.12 ? 1 : 0);
  const tin = calls * between(2900, 3700, rx);
  const tout = calls * between(70, 150, rx) + 40;
  const cost = large ? (tin * 11.25 + tout * 45) / 1e6 : (tin * 0.9 + tout * 3.6) / 1e6 + 0.0006;
  const lat = calls * (large ? between(1300, 2300, rx) : between(600, 1100, rx)) + (arm === 'B' ? 250 : 0);
  sess.push([`S${String(i + 1).padStart(5, '0')}`, day, arm, lang, group, resolved, handoff, missed, needEsc ? 1 : 0, complaint, calls, tin, tout, Math.round(cost * 10000) / 10000, lat]);
}
put('files/sessions_20000.csv', csv([['session_id', 'day', 'arm', 'language', 'member_group', 'resolved', 'handoff', 'missed_escalation', 'escalation_needed', 'complaint', 'model_calls', 'tokens_in', 'tokens_out', 'cost_sar', 'latency_ms'], ...sess]));
put('files/experiment_brief.txt', [
  'موجز التجربة: «مضمار» الإصدار الحالي (الذراع A) مقابل الإصدار الجديد (الذراع B)',
  '',
  'الذراع A: نموذج كبير لكل الطلبات، والتعليمات الإصدار 3.',
  'الذراع B: التعليمات الإصدار 4، وقاعدة توجيه (الإصدار 0) ترسل الطلبات الروتينية إلى نموذج صغير.',
  'وحدة التوزيع: الجلسة، عشوائيًا بنسبة 50/50، في الأندية الستة للمشروع التجريبي.',
  'المدة المتاحة: 14 يومًا. حجم الجلسات المتوقع: نحو 1,430 جلسة في اليوم.',
  'خط الأساس من الشهر السابق (الإصدار الحالي): نسبة الحل 62%، والتصعيد الفائت 9 من كل 100 جلسة تحتاج تصعيدًا، والتكلفة 0.08 ريال للجلسة تقريبًا.',
  'أقل أثر يهم الشركة في نسبة الحل: نقطتان مئويتان. أقل من ذلك لا يغير قرار الاستثمار.',
  'ما يجب ألا يسوء: التصعيد الفائت، والشكاوى، وزمن الاستجابة.',
  'لوحة المراقبة تعرض النتائج يوميًا، ويطلب قسم المبيعات قرارًا مبكرًا إن ظهر فرق كبير.',
  ''
].join('\n'));
put('files/experiment_plan_template.csv', csv([
  ['item', 'your_plan'],
  ['hypothesis', ''], ['randomisation_unit', ''], ['primary_metric', ''], ['minimum_effect_pp', ''],
  ['alpha_and_power', ''], ['sample_per_arm', ''], ['duration_days', ''], ['guardrail_1', ''], ['guardrail_2', ''],
  ['cost_metric', ''], ['slices', ''], ['decision_rule_ship', ''], ['decision_rule_stop', ''], ['when_to_look', ''],
  ['owner_of_readout', ''], ['approved_by', '']
]));
key.experiment = M.readout(sess.map((s) => ({ day: s[1], arm: s[2], language: s[3], group: s[4], resolved: s[5], missed: s[7], need: s[8], complaint: s[9], cost: s[13], latency: s[14] })));
key.experiment.sample_size_2pp = M.sampleSize(0.62, 0.02);
key.experiment.sample_size_3pp = M.sampleSize(0.62, 0.03);

// ---- labs 3.2 and 3.3: three model configurations on the 120 evaluation examples, 3 trials ----
put('files/price_sheet_provider_a.csv', csv([
  ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  ['المزود أ', 'large', 'input', 11.25], ['المزود أ', 'large', 'cached_input', 2.81], ['المزود أ', 'large', 'output', 45]
]));
put('files/price_sheet_provider_b.csv', csv([
  ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  ['المزود ب', 'small', 'input', 0.6], ['المزود ب', 'small', 'cached_input', 0.6], ['المزود ب', 'small', 'output', 2.4]
]));
put('files/price_sheet_provider_c.csv', csv([
  ['provider', 'model_tier', 'item', 'sar_per_million_tokens'],
  ['المزود ج', 'small', 'input', 0.9], ['المزود ج', 'small', 'cached_input', 0.09], ['المزود ج', 'small', 'output', 3.6],
  ['المزود ج', 'large', 'input', 9], ['المزود ج', 'large', 'cached_input', 0.9], ['المزود ج', 'large', 'output', 36]
]));
const PRICE = {
  A: { large: { in: 11.25, cached: 2.81, out: 45 } },
  B: { small: { in: 0.6, cached: 0.6, out: 2.4 } },
  C: { small: { in: 0.9, cached: 0.09, out: 3.6 }, large: { in: 9, cached: 0.9, out: 36 } }
};
const ASSUME = { human_handling_sar: 7.5, sla_p95_ms: 4000, monthly_model_budget_sar: 9000, volumes: [60000, 120000, 240000] };
put('files/assumptions.csv', csv([
  ['item', 'value', 'unit', 'source'],
  ['human_handling_sar', ASSUME.human_handling_sar, 'SAR per failed task handled by staff', 'المالية، إياد الخثلان: 3 دقائق بتكلفة 2.50 ريال للدقيقة'],
  ['sla_p95_ms', ASSUME.sla_p95_ms, 'ms, 95th percentile of a whole task', 'مستوى الخدمة الذي اعتمدته عهود الرشيدي'],
  ['monthly_model_budget_sar', ASSUME.monthly_model_budget_sar, 'SAR per month, model calls only', 'موازنة 2027 المعتمدة'],
  ['volume_low', ASSUME.volumes[0], 'tasks per month', 'الأندية الستة الحالية'],
  ['volume_base', ASSUME.volumes[1], 'tasks per month', 'أندية الرياض وجدة'],
  ['volume_high', ASSUME.volumes[2], 'tasks per month', 'الأندية الستة والثلاثون']
]));
put('files/budget_sla.txt', [
  'الموازنة ومستوى الخدمة لمساعد «مضمار» في 2027 (أرقام الحالة، اصطناعية)',
  '',
  'موازنة استدعاءات النماذج: 9,000 ريال في الشهر، يملكها إياد الخثلان (المالية).',
  'تكلفة المهمة التي تفشل: يتولاها موظف خدمة الأعضاء بنحو 3 دقائق، أي 7.50 ريال.',
  'مستوى الخدمة: 95% من المهام تكتمل في 4 ثوانٍ أو أقل (المئين 95 لزمن المهمة كلها، لا لاستدعاء واحد). تملكه عهود الرشيدي.',
  'حجم الاستخدام: 60,000 مهمة شهريًا في الأندية الستة؛ 120,000 إذا امتد إلى أندية الرياض وجدة؛ 240,000 في الأندية الستة والثلاثين.',
  'الأسعار في قوائم المزودين الثلاثة اصطناعية كتبها المقرر، ولا تخص مزودًا حقيقيًا.',
  ''
].join('\n'));
const rg = rng(5555);
const evalItems = kept.map((c) => ({ id: c.id, lang: c.lang, group: c.group, esc: c.target === 'F4' }));
const gw = [];
for (const cfg of ['A', 'B', 'C']) {
  for (const e of evalItems) {
    for (let trial = 1; trial <= 3; trial++) {
      const hard = e.lang === 'ar_gulf' || e.lang === 'mixed';
      let p;
      if (cfg === 'A') p = 0.94 - (hard ? 0.03 : 0) - (e.esc ? 0.01 : 0);
      if (cfg === 'B') p = 0.84 - (hard ? 0.17 : 0) - (e.esc ? 0.3 : 0);
      if (cfg === 'C') p = 0.945 - (hard ? 0.03 : 0) - (e.esc ? 0.02 : 0);
      const pass = rg() < p ? 1 : 0;
      // v1 of the instructions fixed hidden tool errors (K3) and routing v1 sends every escalation
      // candidate to the large model: in A and C a failure is never K3 or K4; in B it often is K4
      const failed = pass ? '' : (cfg === 'B' ? (e.esc && rg() < 0.8 ? 'K4' : pick(['K1', 'K2', 'K5', 'K6', 'K8', 'K3'], rg)) : pick(['K1', 'K2', 'K5', 'K6', 'K8'], rg));
      const calls = cfg === 'B' ? 1 + (rg() < 0.75 ? 1 : 0) + (rg() < 0.35 ? 1 : 0) : 1 + (rg() < 0.62 ? 1 : 0) + (rg() < 0.12 ? 1 : 0);
      const route = cfg === 'A' ? 'large' : cfg === 'B' ? 'small' : ((hard || e.esc || rg() < 0.15) ? 'large' : 'small');
      const sys = 2400;
      const tin = calls * between(2900, 3700, rg);
      const cached = cfg === 'C' ? calls * sys : 0;
      const tout = calls * between(70, 150, rg) + 40;
      let lat = 0;
      for (let k = 0; k < calls; k++) {
        if (cfg === 'C') lat += route === 'large' ? between(800, 1500, rg) : between(450, 850, rg);
        else lat += route === 'large' ? between(1300, 2400, rg) : between(550, 1050, rg);
      }
      if (cfg === 'C') lat += 220; // the routing step
      if (rg() < 0.05) lat += between(1500, 3000, rg); // a slow call now and then
      gw.push([cfg, e.id, trial, e.lang, e.group, route, calls, tin, cached, tout, lat, pass, failed]);
    }
  }
}
put('files/gateway_runs.csv', csv([['config', 'example_id', 'trial', 'language', 'member_group', 'model_tier', 'model_calls', 'tokens_in', 'tokens_cached', 'tokens_out', 'latency_ms', 'pass', 'failed_criterion'], ...gw]));
put('files/configurations.txt', [
  'الإعدادات الثلاثة التي تقارنها في المختبرين 3.2 و3.3',
  '',
  'A: نموذج كبير لكل الطلبات عند المزود أ. لا تخزين مؤقت للتعليمات.',
  'B: نموذج صغير لكل الطلبات عند المزود ب.',
  'C: توجيه عند المزود ج: خطوة توجيه تقرأ الطلب، فترسل اللهجة الخليجية والرسائل المختلطة وكل إصابة أو خلاف مالي وجزءًا من بقية الطلبات إلى النموذج الكبير، والباقي إلى الصغير. التعليمات (2,400 وحدة نصية) مخزنة مؤقتًا (prompt caching) وتُحسب بسعر الإدخال المخزن.',
  'خطوة التوجيه داخلة في زمن الاستجابة (نحو 220 ms)، وتكلفتها محسوبة ضمن وحدات الإدخال.',
  'كل الأرقام في gateway_runs.csv مولدة بمحاكاة مكتوبة السلوك، لا من نموذج حقيقي.',
  ''
].join('\n'));
key.costing = M.costing(gw.map((g) => ({ cfg: g[0], lang: g[3], group: g[4], tier: g[5], calls: g[6], tin: g[7], cached: g[8], tout: g[9], lat: g[10], pass: g[11], failed: g[12] })), PRICE, ASSUME);
key.costing.assumptions = ASSUME;

// ---- lab 3.4: release criteria and monitoring ----
put('files/release_criteria_template.csv', csv([
  ['criterion', 'metric_and_threshold', 'evidence_source', 'slice_checked', 'owner', 'signed_off_by', 'when_checked'],
  ['quality: severity 4 criteria', '', '', '', '', '', ''], ['quality: severity 3 and 2 criteria', '', '', '', '', '', ''],
  ['experiment: primary metric', '', '', '', '', '', ''], ['experiment: guardrail', '', '', '', '', '', ''],
  ['cost', '', '', '', '', '', ''], ['latency', '', '', '', '', '', ''], ['privacy of traces', '', '', '', '', '', '']
]));
put('files/monitoring_spec_template.csv', csv([
  ['signal', 'source', 'slice', 'alert_threshold', 'response_when_crossed', 'owner', 'review_every'],
  ['', '', '', '', '', '', '']
]));
put('files/owners.csv', csv([
  ['name', 'role', 'may_sign_off'],
  ['عهود الرشيدي', 'رئيسة تجربة الأعضاء، المالكة التجارية لمضمار', 'release decision; service level'],
  ['يزن الشمراني', 'قائد الفريق الهندسي؛ يعدل التعليمات والتوجيه ويشغّل التقييم', 'technical readiness (not the evaluation results he produced)'],
  ['نوف البيشي', 'قائدة فريق المراجعة البشرية؛ تعتمد التسميات البشرية والمصححات', 'grader calibration; evaluation set versions'],
  ['هتون المالكي', 'مسؤولة حماية البيانات', 'privacy of traces and logs'],
  ['إياد الخثلان', 'مدير المالية', 'model budget'],
  ['مالك المنتج (المشارك)', 'يكتب معايير الإطلاق ويقرأ النتائج ويوصي بالقرار', 'proposes; does not sign off his own recommendation']
]));
put('files/trace_privacy_note.txt', [
  'ملاحظة مسؤولة حماية البيانات، هتون المالكي، عن آثار التنفيذ (من حالة المقرر)',
  '',
  'الآثار تحفظ نص رسالة العضو كما كتبها. بعض الأعضاء يذكرون إصابة أو حالة صحية، وهذه بيانات صحية، وهي من البيانات الحساسة في نظام حماية البيانات الشخصية.',
  'المطلوب قبل التوسع: أن يقتصر ما يُحفظ على الحد الأدنى اللازم للغرض، وأن تُحجب الإشارات الصحية في الآثار المحفوظة لأكثر من مدة المراجعة، وأن يقتصر الاطلاع على الآثار على فريقي الهندسة والمراجعة.',
  'تصنيف الشركة: الآثار وسجلات الجلسات على مستوى السجل الواحد «مقيد». الجداول المجمعة التي يحسبها المشارك (أعداد ونسب وتكاليف، بلا نص عضو ولا رقم جلسة) يصنفها مالكها «عام» داخل هذا المشروع.',
  'قاعدة أندية خطى (سياسة الشركة الخاصة، تستند إلى مستويات التصنيف الوطنية): لا يدخل أي ملف «مقيد» أو أعلى في أداة ذكاء اصطناعي توليدي.',
  ''
].join('\n'));

// ---- write or check ----
let diff = 0;
const keyText = JSON.stringify(key, null, 2) + '\n';
out.set('solutions/key.json', keyText);
for (const [rel, text] of out) {
  const path = join(labs, rel);
  if (CHECK) {
    const now = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (now !== text) { console.log('differs: ' + rel); diff++; }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
}
if (CHECK) { if (diff) process.exit(1); console.log(`same bytes: ${out.size} files`); }
else console.log(`wrote ${out.size} files`);
