# TAPLOYAL — مستند التسليم (HANDOVER)

> **كيف تستأنف:** قل **«taployal»** في محادثة جديدة. هذا الملف + ذاكرة اليوم هما نقطة الاستئناف.
> **آخر تحديث:** 2026-11-10 (مساءً) · **آخر التزام:** `f2a7db6` (مدفوع · **منشور وحيّ**)
> **القفزة الأخيرة:** تكامل المحفظة **مكتمل ومُتحقَّق منه حيًّا** — بطاقة حقيقية صادرة، `.pkpass` موقّعة، رابط Google يعمل، QR مُفكّك بالـVision، وإصلاحان أمنيان (تخزين عام + token مُشفّر مرتين). التفاصيل: `docs/evidence/wallet-issuance.md`

---

## 1. هوية المشروع

| البند | القيمة |
|---|---|
| المنتج | **taployal** — منصة SaaS متعددة المستأجرين لبطاقات الولاء الرقمية (Apple/Google Wallet) |
| السوق | الخليج والوطن العربي · عربي RTL افتراضي + إنجليزي |
| المستودع | https://github.com/nah-632/TAPLOYAL (عام) · الفرع `main` |
| التطبيق الحيّ | **https://taployal-rvoepg.cranl.net** |
| كود المشروع (قابل للتشغيل) | **`/root/taployal`** |
| مرآة المصدر (للبحث/المعاينة) | `/var/minis/workspace/taployal` (بأمر `npm run sync:workspace`) |
| مرجع البناء | **`docs/BUILD-PROMPT.md`** (1645 سطرًا · 15 قسمًا) — اعتمده المالك، ويتقدّم على `docs/spec-source.md` |
| اللوقو | `public/brand/taployal-logo.{jpeg,png}` — الأصل بلا تعديل، وpng بخلفية شفافة |

### أوراق الاعتماد (مواقع فقط — لا قيم هنا)
- `CRANL_ACCESS_KEY` — **متغيّر بيئة في الصدفة**، مفتاح CranL API (صلاحيات `["*"]` — يستحق التضييق).
- `DATABASE_URL` — في `/root/taployal/.env.local` (صلاحيات 600، مستثنى من git) بكلمة مرور دور `taployal_app` المحدود.
- `BETTER_AUTH_SECRET` · `WALLETWALLET_API_KEY` — متغيّرات بيئة على تطبيق CranL.
- GitHub: مصادَق عليه عبر `gh` بحساب `nah-632`.

### معرّفات CranL
- project `taployal` = `218c4cb5-8655-4ddb-918f-3216035edabf`
- database `taployal-db` = `864dd005-bcd2-4662-a2bf-1603beea1811` (PG 16.15 · netherlands-1 · internal host `taployal-db-cadoql`)
- app `taployal` = `c495b970-e7cd-4eae-80c7-11db9c22017e`

---

## 2. البنية المعتمدة (ADR-001)

**CranL Native — بلا Supabase وبلا Vercel** (توجيه صريح من المالك يتقدّم على ذِكر Supabase/Vercel كخيارات في مرجع البناء).
- Next.js 16.4.5 (App Router) · React 19.3.1 · Tailwind 4.3.5 (`@theme` tokens) · TS 5.9.3
- PostgreSQL مُدار على CranL + **RLS أصلي** + دور تشغيل **`taployal_app` بـ`NOBYPASSRLS`**
- **Better Auth** + **Argon2id** (`@node-rs/argon2`) + جلسات HttpOnly + MFA (TOTP) + RBAC
- مزوّدات مجرّدة: `WalletProvider` · `StorageService` · طابور على PostgreSQL
- `lucide-react` للأيقونات · `qrcode` لتوليد QR · `postgres` + `drizzle-orm`

### القرارات الجوهرية
- **محرك المعاملات داخل القاعدة** (`app_record_transaction`): `FOR UPDATE` → idempotency → ledger → تحديث الرصيد → إدراج مهمة المحفظة **في نفس المعاملة**.
- **نقاط عامة ضيّقة بـ`SECURITY DEFINER`** بدل توسيع الرؤية: `app_public_program` · `app_join_program` · `app_pass_by_token` · `app_pass_wallet` · `app_store_wallet_artifacts` · `app_job_claim` (الاستثناءان الوحيدان مع search_path مثبّت).
- **التحقق قبل الادّعاء**: كل ميزة تُقاس حيًّا قبل الإعلان عنها.

### الملفات المرجعية في المستودع
```
docs/BUILD-PROMPT.md              مرجع البناء (سلطة عليا)
docs/SPEC.md                      فهرس منظّم + الفروق
docs/adr/ADR-001-cranl-native-infrastructure.md
docs/adr/ADR-002-build-prompt-and-logo.md
docs/plans/cranl-native-plan.md   خطة W1–W7
docs/evidence/*.md                تقارير الأدلة لكل شريحة
drizzle/0000..0007_*.sql          المِهاجر (انظر الجدول أدناه)
tools/*.mjs|sh                    أدوات CranL + الحرّاس + المزامنة
test/security/*                   مجموعات الاختبار
```

---

## 3. الحالة الحقيقية — ما هو مُنجَز وما ليس كذلك

### ✅ مُنجَز ومُتحقَّق منه حيًّا

| المجال | الدليل |
|---|---|
| المخطط + الأدوار + RLS | 15 جدولًا · **15/15** عليها RLS + FORCE · دور `taployal_app` `bypassrls=false` |
| عزل المستأجرين | **33 تأكيدًا + كاناري** · cross-tenant = 0 · بلا سياق = 0 (fail-closed) |
| محرك المعاملات + الطابور | **18/18**: النقرة المزدوجة لا تُسجّل مرتين · undo يعيد الرصيد · IDOR مرفوض |
| الإلحاق تحت RLS | **6/6** بلا تصعيد صلاحيات (`raised:42501` عند محاولة تاجر آخر) |
| المصادقة | **8/8** على القاعدة الحيّة: Argon2id `$argon2id$v=19$m=19456,t=2,p=1$` · HttpOnly · جلسة حقيقية |
| RBAC + الجلسة | **21/21** وحدة: تفصيل افتراضي · MFA للسوبر أدمن |
| النشر | `succeeded` · `[startup] database role verified: RLS is enforced` |
| معالج الإعداد (4 خطوات) | حيّ: brand · program · preview (307 بلا جلسة) |
| رحلة العميل | **حيّة في المتصفح**: `/j/tenant-a` ⇒ انضمام ⇒ «تم!» ⇒ بطاقة `/c/<token>` |
| **المحفظة (WalletWallet)** | **مكتملة ومُتحقَّق منها حيًّا**: بطاقة صادرة فعليًا (quota 2/1000) · `.pkpass` 200 `application/vnd.apple.pkpass` (٥٣٥٨ بايت، تبدأ بـ`PK`) · Google ⇒ 302 إلى `pay.google.com` · الاسم الأول فقط داخل البطاقة · QR مُفكّك بالـVision يعطي الرابط الصحيح |
| منع التكرار + أمان الرموز | الهاتف المكرر ⇒ **نفس الـserial** · الرموز **sha256 فقط** · إعادة الانضمام ⇒ القديم **404** · **وGET ثم POST ثم عدة تحميلات للصفحة استهلكت وحدة واحدة فقط** (العدّاد الخارجي عند المزوّد) |
| التخزين | `StorageService` بمُشغّل inline data-URL عامل (لا bucket على الخطة) |
| مرجع البناء + اللوقو | مُعتمدان · لوحة `§11.A` بلا ذهبي (قياس اللوقو: كحلي 46% · تركوازي 12%) |

### ✅ تكامل WalletWallet — مكتمل ومُتحقَّق منه (2026-11-10)

**المفتاح مضبوط الآن على تطبيق CranL** (`WALLETWALLET_API_KEY`، حساب trial: 1000 بطاقة/شهر، ينتهي 2026-12-10) ⇒ `GET /api/auth/usage` يعيد `plan:"trial"`.

**ما بُني:** `app/api/wallet/[token]/{route,apple/route,google/route}.ts` · `app/_components/add-to-wallet.tsx` · `src/modules/site-url.ts` · ربطهما في `/j/[slug]/done` و`/c/[token]`.
- `GET /api/wallet/[token]` **قراءة فقط** (لا تستهلك حصة) · `POST` يُصدر بلا تكرار.
- `/apple` يخدم الـ`.pkpass` **من نطاقنا** وبـ MIME الصحيح، **بلا `Content-Disposition: attachment`** (مع attachment يذهب الملف إلى تطبيق الملفات بدل Wallet).
- `/google` تحويل 302 مع **تحقق من المضيف** (`pay.google.com` فقط) لأنه هدف تحويل.
- التصميم: `colorPreset` فقط (اللون المخصّص `color` ميزة Pro ⇒ الاعتماد عليه كان سيكسر الإصدار عند تغيّر الخطة). الشعار بالألوان/الكلمات الخاصة بـtaployal لا شعارات Apple/Google الرسمية (استعمال شعار معدّل مخالفة لإرشاداتهم، والأصول الرسمية غير موجودة في المستودع).

### 🔴 ما اكتُشف وأُصلح في هذه الجولة (اقرأه — كله كان يبدو سليمًا)

1. **مِهاجر `0007` لم يكن مُطبَّقًا فعلًا** رغم أن التسليم قال «مُطبَّق». فحص المخطط الحيّ أظهر صفر أعمدة وصفر دوال. طُبِّق ثم تُحقّق منه في **نداء منفصل ومتأخّر**. (مِهاجران جديدان: `0008` قراءة الـ`.pkpass` بالرمز · `0009` لون البطاقة.)
2. **`getApplePass()` كان يقرأ `passes` مباشرة** ⇒ تحت RLS وبلا سياق مستأجر يعيد **صفر صفوف** ⇒ كل تنزيل `.pkpass` كان سيُعيد 404 في الإنتاج. صار عبر `app_apple_pass_by_token`.
3. **`next.config.ts` كان يعلن كل الاستجابات عامة التخزين**: قاعدة `/:path*` تشمل `/api/**`، وNext **يتجاوز** هيدر المسار بها ⇒ ما طلبناه `private, no-store` خرج `public, s-maxage=60`، والـedge ردّ **`x-ggp-cache: HIT`** على `.pkpass` وJSON حالة البطاقة. صار `private, no-store` على `/api` و`/dashboard` و`/onboarding` و`/c` (المسار المجرّد **وأبناؤه**) + `CDN-Cache-Control`. **اختبار انحدار حيّ: `test/security/cache-headers.test.mjs` — 6 إخفاقات قبل الإصلاح، 0 بعده.**
4. **`/c/[token]` كان يُشفّر الرمز مرتين**: Next يعيد مقطع **المسار** مُشفّرًا بينما **معامل الاستعلام** يصل مفكوكًا، فأعاد `encodeURIComponent` التشفير ⇒ `%2B` صار `%252B` ⇒ **كل روابط المحفظة ورمز QR تذهب إلى 404**. اكتُشف بقراءة `href` في متصفح حقيقي — كل الفحوصات السيرفرية كانت خضراء.
5. حدود حقول المزوّد: تُقصّ الآن (أي حقل يتجاوز الحد = 400 صريح).

### ⬜ لم يُنجَز (بصراحة)
- **تحديث البطاقة المُثبَّتة (live pass updates): المزوّد يدعم `PUT /api/passes/<serial>` ولا كود عندنا يستدعيه** ⇒ تغيّر الرصيد لا يصل بعدُ إلى البطاقة المُثبَّتة على الهاتف. البطاقة المُثبَّتة اليوم تُظهر رصيد لحظة الإصدار. (المزوّد يحتاج خطة Pro لهذه الميزة، والتجربة سارية حتى 2026-12-10.)
- بقية شاشات التاجر: الداشبورد الكامل · مصمّم البطاقة المنفصل · العملاء · المكافآت · الموظفون · التحليلات · الاشتراك
- واجهة الموظف (مسح QR · إضافة · استبدال · تراجع) — المحرك جاهز، الواجهة لا
- لوحة Super Admin
- Cron Jobs · سياسة النسخ الاحتياطي + **اختبار استعادة حيّ** · IDOR عبر HTTP على مسارات الداشبورد
- التحقق من رقم الهاتف (SMS) · مزوّد البريد (`connected:false` ⇒ `EMAIL_VERIFICATION_REQUIRED=false` **مؤقت ومُعلَن**)
- إرسال البريد الحقيقي · استعادة كلمة المرور · TOTP سلوكيًا · CSRF/rate-limit مُختبَر
- **محجوب على الخطة المجانية:** `buckets` (تخزين) · `queues` مُدارة · منطقة MENA · نطاق مخصص · بيئات dev/staging

---

## 4. عوائق المنصة والبيئة (لا تُعِد اكتشافها)

### 🟠 عطب CranL: فشل خطوة التشغيل بعد نجاح البناء (وأصبح له حلّان)

`POST /apps/{id}/deploy` **يبني ويرفع الصورة بنجاح** (`✅ Image Pushed` + digest) ثم قد يسقط:
```
(HTTP 409) AlreadyExists: name conflicts with an existing object: service taployal-rvoepg already exists
```

**🆕 ما تأكّد في 2026-11-10:**
1. **العطب متقطّع، ليس دائمًا** — نشر واحد نجح كاملًا (`succeeded · stage: live`) بلا أي تدخّل. فلا تفترض الفشل؛ اقرأ الحالة.
2. **عند الفشل: الصورة الجديدة موجودة فعلًا في السجل** (`registry.cranl.net/library/taployal-rvoepg:latest`). ولأن خطوة التشغيل هي التي تفشل (لا البناء)، فإن **إعادة تشغيل الحاوية تُقلع بالصورة الجديدة** — أُثبت ذلك مرتين:
   `PATCH /apps/{id}/env` بجسم `{"variables":{"WALLETWALLET_API_KEY":"<نفس القيمة>"},"expected_version":"<من GET>","restart":true}` ⇒ بعد ~20 ثانية يعمل الكود الجديد (تحقّقنا من ظهور مسار جديد في الاستجابة).
   ⚠️ لاحظ: لو كانت القيمة نفسها فقد يعيد `changed: []` — أعد التشغيل يحدث على أي حال لأن `restart:true` مُرسَل، لكن **تحقّق دائمًا** من أن الصورة الجديدة فعليًا حيّة قبل أن تدّعي النشر.
3. **تحذير قديم غير صحيح:** `GET /deployments/{id}/diagnosis` يعيد `unknown_operation`. المسار الصحيح `GET /apps/{app_id}/deployments/{deployment_id}/diagnosis` (وكذلك `.../logs` و`.../ai-fix`).
4. **لوحة CranL تبقى الحل الاحتياطي** ([app.cranl.com/dashboard](https://app.cranl.com/dashboard)) إن لم تنجح إعادة التشغيل. لا تُكرّر `POST /deploy` أكثر من مرة واحدة — اقرأ النتيجة أولًا.

### عوائق بيئية مُثبتة (تفاصيلها في مهارة `minis-node-env`)
1. **`file_write` يفشل بصمت إذا لم يوجد المجلد الأب، ويُعطب الاسم نهائيًا.** أسماء معطوبة فعليًا: `scripts` · `tests` · `src/db/schema` · `src/auth` · `src/brand` · `docs/ADR`. البدائل: `tools/` · `test/` · `src/db/sql/` · `src/identity/` · `src/palette/` · `docs/adr/`. **القاعدة: `mkdir -p` + `ls -d` قبل أي كتابة.**
2. **لا symlinks ولا `realpathSync.native` على `/var/minis/**`** ⇒ Next.js لا يقلع وشغّل المشروع في `/root`.
3. **Node بلا JIT** + البيئة تحقن وسائط V8 في `NODE_OPTIONS` ⇒ يلزم `tools/patch-next-for-sandbox.mjs` مربوطًا بـ`postinstall`.
4. **PostgreSQL محلي مستحيل** (`signalfd()`) ⇒ كل اختبار SQL على CranL.
5. **`node:test` يشغّل الاختبارات العليا بالتوازي** ⇒ التسلسل عبر `await t.test()` داخل أب واحد.
6. **تعديلان على نفس الملف في دفعة واحدة ⇒ أحدهما يضيع بصمت.**
7. **DDL عبر الـAPI**: تحقّق في **نداء منفصل ومتأخّر** — وقع أن مِهاجرًا بدا مُطبَّقًا ثم اختفى.
8. `node_modules/esbuild/bin/esbuild` **ELF** لا shim · اختبارات `.ts` تحتاج تحزيمًا بـesbuild (Node لا يجرّد الأنواع) · npm mirror يفشل بـ`E500` ⇒ `--registry=https://registry.npmjs.org`.

---

## 5. الأوامر الأساسية

```bash
# المشروع
cd /root/taployal && npm run sync:workspace          # مرآة المصدر
node node_modules/typescript/bin/tsc --noEmit        # أنواع
node tools/check-routes.mjs && node tools/check-tokens.mjs && node tools/check-logical-css.mjs   # الحرّاس الثلاثة

# الاختبارات (القاعدة تحتاج الوصول الخارجي)
node tools/db-external-access.mjs on                # ← مؤقتًا
sh tools/run-unit-tests.sh                           # 26 وحدة (بلا قاعدة، بلا شبكة)
node test/security/isolation.test.mjs                # 33 + كاناري
node test/security/transaction-engine.test.mjs       # 18
node test/security/onboarding.test.mjs               # 6
node test/security/wallet-artifacts.test.mjs         # 21 (قاعدة حيّة · بلا حاجة للوصول الخارجي — يمرّ عبر CranL API)
node test/security/cache-headers.test.mjs            # 10 (HTTP حيّ على الإنتاج — هيدرات التخزين)
sh tools/run-integration-tests.sh                    # 8 (مصادقة حقيقية)
node tools/db-external-access.mjs off                # ← أغلقه فورًا

# المجموع الحالي: 114 تأكيدًا · 0 فشل (+ كاناري مُثبت)
# npm test = unit + isolation + engine + onboarding + wallet
# npm run test:all = npm test + test:cache + test:integration

# CranL
node tools/cranl-migrate.mjs drizzle/<file>.sql --apply   # ⚠️ تحقّق من الـDDL في نداء منفصل ومتأخّر
node tools/cranl-query.mjs "SELECT 1"                # قراءة
node test/security/cache-headers.test.mjs            # تأكّد أن النشر الجديد حيّ فعلًا
```

---

## 6. ما يحتاج قرارك

| # | البند | اقتراحي |
|---|---|---|
| 1 | ~~إضافة `WALLETWALLET_API_KEY`~~ ✅ **تم** (2026-11-10) | مضبوط على التطبيق، وحساب المزوّد **trial** ينتهي 2026-12-10 ⇒ بعدها تنزل الخطة إلى Free (1000/شهر). الكود يستخدم حقول Free فقط فلن ينكسر، لكن **حدّد موقفك من الاشتراك قبل انتهاء التجربة**. |
| 2 | ~~إعادة نشر من اللوحة~~ ✅ **حُلَّت** — النشر صار قابلاً للإنهاء بـ`restart:true`، ونشر واحد نجح كاملًا | انظر §4 |
| 3 | تضييق مفتاح CranL (`["*"]`) وتوكن GitHub (`admin:enterprise`,`delete_repo`) | مبدأ أقل صلاحية |
| 4 | مزوّد البريد (CranL Email `connected:false`) | لإبطال `EMAIL_VERIFICATION_REQUIRED=false` المؤقت |
| 5 | حسم تعارض Supabase/Vercel إن كنت تقصد إلزامهما | افتراضيًا: البنية تبقى CranL Native |
| 6 | **الأولوية التالية:** واجهة الموظف (مسح QR ⇒ إضافة/استبدال/تراجع) | المحرك مُختبَر بالكامل؛ الشاشة هي التي تنقص لإكمال الحلقة التشغيلية |

---

## 7. سجل الصدق (ما رفضتُ ادّعاءه)

**جلسة 2026-11-10 (المحفظة):**
- لم أُعلن أن `0007` مُطبَّق بناءً على مستند التسليم — قرأت المخطط الحيّ فوجدته **غائبًا تمامًا**.
- لم أدّعِ أن شهادات Apple Pass Type ID وGoogle Issuer مطلوبة: **المزوّد يوقّع بشهاداته الخاصة**، والافتراض السابق في التسليم كان **خاطئًا** — ولذلك عاد شعار «أضف إلى المحفظة» بعد أن مُنع بحجة أنه لا يعمل.
- لم أدّعِ أن عطب النشر دائم: **نشر واحد نجح كاملًا**، والآخر أُكمل بإعادة تشغيل الحاوية. لا أُعمّم من حالة واحدة.
- **تحديث البطاقة المُثبَّتة غير منفّذ** — `PUT /api/passes/<serial>` موجود عند المزوّد ولا كود يستدعيه، فالبطاقة المُثبَّتة تُظهر رصيد الإصدار فقط.
- لم أدّعِ أن الشعارات الرسمية لـApple/Google مُستخدَمة: **لا نستعمل شعاراتهما** لأن أصولهم الرسمية غير موجودة في المستودع واستعمال شعار معدّل مخالفة لإرشاداتهم؛ الإجراء بصياغة taployal.
- **اختبار كان هشًّا بسبب تلوّث البيئة** (`count FROM merchants = 2` عالمي) — أصلحته بتضييق التأكيد على الـfixtures، ولم أُضعفه: القوة للنمط المُثبَت (رؤية المستأجرين معًا في سياق super admin) بقيت كما هي.
- **عدّاد المزوّد هو الدليل** على عدم التكرار (2 استهلاك لبطاقة واحدة عبر GET+POST+عدة تحميلات)، لا تخزيننا المؤقت.

- لم أُعلن أن تسجيل الدخول «يعمل» قبل اختباره فعليًا على القاعدة.
- لم أعرض شعارَي Wallet لأنهما لا يعملان بلا شهادات — والبديل عبر المتصفح مطبَّق.
- لم أدّعِ أن الاستعادة الاحتياطية مُثبتة: الأرشيف مُثبت الصلاحية، والاستعادة الحيّة **محجوبة بالخطة**.
- لم أدّعِ أن التخزين على كائنات مُشغَّل: المُشغّل الحالي inline وموسوم بأنه مؤقت.
- عند كل عيب في كودي أبلغتُ عنه صراحةً وأصلحتُه (تصادم الـslug · عمود الإخراج المتعارض · صفحات الجلسة الثابتة · `bg-cream` بعد حذف الرمز).
