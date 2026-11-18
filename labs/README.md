# تقييم منتجات الذكاء الاصطناعي وتجاربها واقتصادياتها: المختبرات

اثنا عشر مختبرًا لمقرر أكاديمية سدايا **LDS-PRD-202**، مدة كل منها 35 دقيقة. المختبرات صفحات إرشادية بالعربية: ما
تخرج به، والملفات، وخطوات بدقائقها ومعادلات تُنسخ إلى جدول البيانات، وأسئلة تحقق، وتمرين إضافي ✱، ومفتاح للمدرب. لا
كود يكتبه المشارك، ولا نموذج يُنزَّل، ولا مفتاح حساب يلزم.

كل المختبرات في جهة واحدة: **أندية خُطى للياقة**، سلسلة أندية افتراضية، ومساعدها «مِضمار» في مشروع تجريبي في ستة أندية.
كل الأسماء والأرقام والآثار والجلسات والأسعار اصطناعية. ردود المساعد وأحكام المصححات وتشغيلات بوابة النماذج مكتوبة
بمحاكاة ذات بذرة ثابتة، لا من نموذج حقيقي.

## ما يحتاجه المشارك

- جدول بيانات يفتح ملف CSV بالعربية: LibreOffice Calc أو Microsoft Excel أو Google Sheets. المعادلات في الصفحات
  تستعمل `XLOOKUP` و`FILTER` و`PERCENTILE.INC`.
- متصفح لعارض آثار التنفيذ `tools/traces.html`، ويعمل دون شبكة.
- مساعد ذكاء اصطناعي عام بخطة مجانية للمختبرات التي يسمح فيها المقرر بمساعد مرشد. قاعدة الحالة: لا يدخل أي أثر ولا
  سطر جلسة في أداة ذكاء اصطناعي توليدي؛ الجداول المجمعة التي يحسبها المشارك «عام».

## نقطة البداية والحل

كل مختبر يبدأ من ملفات في `files/`. المختبر الذي يكمل عمل مختبر سابق له ملف بداية بديل لمن لم يكمل.

| المختبر | الصفحة | يبدأ من | الحل المرجعي |
|---|---|---|---|
| 1.1 | `D1_1_vendor_claims.html` | `vendor_claims.txt`، `repeated_trials.csv` | مفتاح الصفحة |
| 1.2 | `D1_2_open_coding.html` | `traces_300.csv`، `tools/traces.html`، `coding_sheet_P001_P100.csv` | `solutions/reference_coding_P001_P100.csv` |
| 1.3 | `D1_3_axial_coding.html` | `open_notes_P001_P050.csv` (بديل) | `solutions/reference_coding_P001_P100.csv` |
| 1.4 | `D1_4_frequency_severity.html` | `team_coding_P101_P300.csv` (بديل)، `taxonomy_v0_engineering.csv` | مفتاح الصفحة |
| 2.1 | `D2_1_grader_choice.html` | `acceptance_criteria.csv`، `grader_options.txt` | مفتاح الصفحة |
| 2.2 | `D2_2_grader_calibration.html` | `grader_calibration.csv`، `threshold_rule.txt` | مفتاح الصفحة |
| 2.3 | `D2_3_evalset_v1.html` | `eval_candidates.csv`، `prompt_examples.txt`، `evalset_rules.txt` | `solutions/evalset_v1_reference.csv` |
| 2.4 | `D2_4_experiment_plan.html` | `experiment_brief.txt`، `experiment_plan_template.csv` | `files/experiment_plan_reference.csv` |
| 3.1 | `D3_1_experiment_readout.html` | `experiment_plan_reference.csv` (بديل)، `sessions_20000.csv` | مفتاح الصفحة |
| 3.2 | `D3_2_cost_per_success.html` | `gateway_runs.csv`، قوائم الأسعار الثلاث، `assumptions.csv` | مفتاح الصفحة |
| 3.3 | `D3_3_cost_sensitivity.html` | أرقام البداية في الصفحة (بديل)، `assumptions.csv` | مفتاح الصفحة |
| 3.4 | `D3_4_release_criteria.html` | `release_criteria_template.csv`، `monitoring_spec_template.csv` | مفتاح الصفحة، و`solutions/answer_key.md` |

## للمدرب

- `node labs/solutions/check_all.mjs` يتحقق أن المولّد يكتب الملفات نفسها، ويعيد حساب كل رقم مرجعي من ملفات CSV، ويتحقق
  أن كل نتيجة صُممت المختبرات لكشفها ما زالت في البيانات، ويطبع الأرقام التي تذكرها مفاتيح الصفحات. يكفيه Node 22 أو أحدث.
- `node labs/_tools/prepare_files.mjs` يعيد كتابة كل الملفات من البذرة الثابتة، و`--check` يقارنها بما على القرص.
- `node labs/_tools/parallel_examples.mjs` يحسب أرقام الأمثلة الموازية في الشرائح وبنك الأسئلة.
- `solutions/answer_key.md`: ما صُممت المختبرات لكشفه، وما تدعمه الأدلة في المذكرة، وبنك التغييرات في المناقشة.
