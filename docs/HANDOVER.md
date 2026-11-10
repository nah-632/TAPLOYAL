# TAPLOYAL — مستند التسليم (HANDOVER)

> **كيف تستأنف:** قل **«taployal»** في محادثة جديدة. هذا الملف + ذاكرة اليوم هما نقطة الاستئناف.
> **آخر تحديث:** 2026-11-10 · **آخر التزام:** `1a4d3a7` (مدفوع إلى GitHub)

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
| منع التكرار + أمان الرموز | الهاتف المكرر ⇒ **نفس الـserial** · الرموز **sha256 فقط** · إعادة الانضمام ⇒ القديم **404** |
| التخزين | `StorageService` بمُشغّل inline data-URL عامل (لا bucket على الخطة) |
| مرجع البناء + اللوقو | مُعتمدان · لوحة `§11.A` بلا ذهبي (قياس اللوقو: كحلي 46% · تركوازي 12%) |

### 🔴 جارٍ (غير مكتمل) — تكامل WalletWallet

**ما أُنجز:** مِهاجر `0007` (**مُطبَّق**) · `src/wallet/index.ts` (الواجهة + مُشغّل WalletWallet) · `src/modules/wallet-issuance.ts` (التنسيق + التخزين المؤقت + تحديد المعدّل). مُلتزم في `1a4d3a7`.

**ما ينقص لإكماله:**
1. **مسارات الـAPI** — `app/api/wallet/[token]/route.ts` (JSON) · `.../apple/route.ts` (يرسل `.pkpass` بـ`Content-Type: application/vnd.apple.pkpass`) · `.../google/route.ts` (302 إلى `googleSaveUrl`). المجلدات أُنشئت وفارغة.
2. **مكوّن الواجهة** — شعارات «أضف إلى Apple/Google Wallet» + كشف نوع الجهاز (iOS ⇒ Apple، Android ⇒ Google، غيره ⇒ الاثنان + QR لصفحة `shareUrl`) على `/j/[slug]/done` و`/c/[token]`.
3. **🔴 العائق الحقيقي: `WALLETWALLET_API_KEY` غير مضبوط على تطبيق CranL.** الموجود فقط: `PORT` · `DATABASE_URL` · `BETTER_AUTH_SECRET` · `BETTER_AUTH_URL` · `APP_URL` · `EMAIL_VERIFICATION_REQUIRED`.
   **الإضافة:** من لوحة CranL → التطبيق `taployal` → Environment → أضف `WALLETWALLET_API_KEY` بقيمة مفتاح يبدأ بـ`ww_live_`، ثم أعد النشر. (أو عبر واجهتي: `PUT /apps/{id}/env` بمفتاح `{"variables":{"WALLETWALLET_API_KEY":"..."}}`.)

### ⬜ لم يُنجَز (بصراحة)
- بقية شاشات التاجر: الداشبورد الكامل · مصمّم البطاقة المنفصل · العملاء · المكافآت · الموظفون · التحليلات · الاشتراك
- واجهة الموظف (مسح QR · إضافة · استبدال · تراجع) — المحرك جاهز، الواجهة لا
- لوحة Super Admin
- Cron Jobs · سياسة النسخ الاحتياطي + **اختبار استعادة حيّ** · IDOR عبر HTTP على مسارات الداشبورد
- التحقق من رقم الهاتف (SMS) · مزوّد البريد (`connected:false` ⇒ `EMAIL_VERIFICATION_REQUIRED=false` **مؤقت ومُعلَن**)
- إرسال البريد الحقيقي · استعادة كلمة المرور · TOTP سلوكيًا · CSRF/rate-limit مُختبَر
- **محجوب على الخطة المجانية:** `buckets` (تخزين) · `queues` مُدارة · منطقة MENA · نطاق مخصص · بيئات dev/staging

---

## 4. عوائق المنصة والبيئة (لا تُعِد اكتشافها)

### 🔴 عطب CranL المتكرر: فشل النشر بعد نجاح البناء
`POST /apps/{id}/deploy` **يبني ويرفع الصورة بنجاح** (`✅ Image Pushed`) ثم يسقط:
```
(HTTP 409) AlreadyExists: name conflicts with an existing object: service taployal-rvoepg already exists
```
ثم يبقى القفل: كل محاولة تالية ⇒ `deployment_in_progress` بينما لا يوجد نشر قيد التشغيل، و`GET /operations/{id}` يُظهر العملية **منتهية**.
**✅ الحل الوحيد العامل: إعادة النشر من [لوحة CranL](https://app.cranl.com/dashboard).** لا تُكرّر نداء الـAPI — اقرأ التشخيص أولًا (`/deployments/{id}/diagnosis`) لتتأكد أن البناء نجح.

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
sh tools/run-unit-tests.sh                           # 21 وحدة (بلا قاعدة)
node test/security/isolation.test.mjs                # 33 + كاناري
node test/security/transaction-engine.test.mjs       # 18
node test/security/onboarding.test.mjs               # 6
sh tools/run-integration-tests.sh                    # 8 (مصادقة حقيقية)
node tools/db-external-access.mjs off                # ← أغلقه فورًا

# CranL
node tools/cranl-migrate.mjs drizzle/<file>.sql --apply
node tools/cranl-query.mjs "SELECT 1"                # قراءة
```

---

## 6. ما يحتاج قرارك

| # | البند | اقتراحي |
|---|---|---|
| 1 | **إضافة `WALLETWALLET_API_KEY`** على تطبيق CranL ثم إعادة النشر | يحجب إكمال تكامل المحفظة — وهو أهم بند مفتوح |
| 2 | **إعادة نشر من اللوحة** بعد كل مرة يفشل فيها نشر الـAPI | هو المسار العامل الوحيد |
| 3 | تضييق مفتاح CranL (`["*"]`) وتوكن GitHub (`admin:enterprise`,`delete_repo`) | مبدأ أقل صلاحية |
| 4 | مزوّد البريد (CranL Email `connected:false`) | لإبطال `EMAIL_VERIFICATION_REQUIRED=false` المؤقت |
| 5 | حسم تعارض Supabase/Vercel إن كنت تقصد إلزامهما | افتراضيًا: البنية تبقى CranL Native |

---

## 7. سجل الصدق (ما رفضتُ ادّعاءه)

- لم أُعلن أن تسجيل الدخول «يعمل» قبل اختباره فعليًا على القاعدة.
- لم أعرض شعارَي Wallet لأنهما لا يعملان بلا شهادات — والبديل عبر المتصفح مطبَّق.
- لم أدّعِ أن الاستعادة الاحتياطية مُثبتة: الأرشيف مُثبت الصلاحية، والاستعادة الحيّة **محجوبة بالخطة**.
- لم أدّعِ أن التخزين على كائنات مُشغَّل: المُشغّل الحالي inline وموسوم بأنه مؤقت.
- عند كل عيب في كودي أبلغتُ عنه صراحةً وأصلحتُه (تصادم الـslug · عمود الإخراج المتعارض · صفحات الجلسة الثابتة · `bg-cream` بعد حذف الرمز).
