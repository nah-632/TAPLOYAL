# Evidence — W7 (Production deployment on CranL)

- **DATE:** 2026-11-09 · **الحالة:** ✅ **منشور ويعمل**
- **URL:** https://taployal-rvoepg.cranl.net
- **App id:** `c495b970-e7cd-4eae-80c7-11db9c22017e` · **region:** `netherlands-1` · **project:** `taployal`
- **المصدر:** `public_repo` → `github.com/nah-632/TAPLOYAL`, فرع `main`, بناء من **Dockerfile**

## 1. النشر

| الالتزام | الحالة |
|---|---|
| `3bf7e74` المستودع الأولي | — |
| `91f0b37` standalone + Dockerfile + تهيئة مصادقة كسولة | ❌ فشل البناء |
| `51fdb22` إصلاح: `COPY tools` قبل `npm` | ✅ **`succeeded`** 20:27:24 |

**سبب الفشل الأول (مُشخَّص لا مُخمَّن)** من `GET /apps/{id}/deployments/{dep}/diagnosis`:
```
first_error: #8 9.371 Error: Cannot find module '/app/tools/patch-next-for-sandbox.mjs'
```
`postinstall` في `package.json` ينفّذ ذلك الملف، ومرحلة `deps` كانت تنسخ `package.json` فقط — ولم يكن `tools/` موجودًا بعد. وكان `.dockerignore` يستثني `tools`. أُصلح الاثنان.

## 2. التحقق الحيّ (مخرج حقيقي لكل سطر)

| الفحص | النتيجة |
|---|---|
| حالة النشر | **`succeeded`** · حالة التطبيق `done` |
| `GET /` | **HTTP 200** · 10,721 bytes · `<title>taployal — TAP. COLLECT. REDEEM.</title>` |
| `GET /api/auth/ok` | **HTTP 200** |
| سجلّ الإقلاع | **`[startup] database role verified: RLS is enforced`** |

**السطر الأخير هو الأهم:** حارس الإقلاع (`instrumentation.ts`) يؤكّد أن الإنتاج يتصل بالدور المقيّد `taployal_app` (`bypassrls=false`) — أي أن **عزل RLS مفعَّل فعلًا في الإنتاج**، لا مُعطَّلًا بصمت كما كان سيحدث لو استُخدم الدور `admin`.

## 3. 🎯 إثبات إنتاجي من طرف إلى طرف (HTTP → Next → Better Auth → PostgreSQL)

```
POST https://taployal-rvoepg.cranl.net/api/auth/sign-up/email   → HTTP 200 في 2.25s
```
| الحلقة | الدليل |
|---|---|
| الاستجابة | `{"user":{"id":"a121672e-ff00-439a-9eeb-f6ea7c0e1b02", "emailVerified":false, ...}}` |
| المعرّف | **UUID حقيقي** ⇒ إصلاح `advanced.database.generateId = randomUUID()` يعمل في الإنتاج |
| بوابة التحقق | `emailVerified: false` ⇒ `requireEmailVerification` فعّالة |
| كلمة المرور في القاعدة | **`$argon2id$v=19$m=19456,t=2,p=1`** · `provider_id: credential` |

هذا هو ما لم يكن قابلًا للقياس قبل النشر: مسار الإنتاج الحقيقي كاملًا.

## 4. 🔒 إغلاق الانكشاف الأمني (إنجاز الوعد)

الحالة السابقة: المنفذ العام لقاعدة البيانات مفتوح بلا TLS (نص صريح عبر الإنترنت).

**الإجراء:** `node tools/db-external-access.mjs off`

| الفحص بعد الإغلاق | النتيجة |
|---|---|
| الاتصال بالمنفذ من الإنترنت | **مرفوض / مغلق** (اختبار TCP) ✅ |
| `GET /` (الإنتاج) | **HTTP 200** ✅ |
| `POST /api/auth/sign-up/email` | **HTTP 200** — **كتابة في القاعدة نجحت عبر المضيف الداخلي `taployal-db-cadoql`** ✅ |

⇒ **إثبات مباشر أن الإنتاج لا يحتاج المنفذ العام ولا يمرّ بنص صريح عبر الإنترنت.**

## 5. ⚠️ كلفة الإغلاق — مُعلَنة لا مخفية

مجموعات الاختبار التي تلمس القاعدة **تتوقف** والمنفذ مُغلق، لأن الـAPI نفسه (`run_migration` · `query` · `snapshot`) يشترط الوصول الخارجي. تحقّقت من ذلك فعليًا:
```
node test/security/isolation.test.mjs
→ harness error: validation_failed: Query failed: External access is not enabled.
```

**الإجراء التشغيلي الموثَّق:** لتشغيل مجموعات القاعدة —
```bash
node tools/db-external-access.mjs on    # مؤقتًا
npm run test:isolation && npm run test:engine && npm run test:onboarding
node tools/db-external-access.mjs off   # أعِده فورًا
```
مجموعات `test:unit` و`test:integration` لا تحتاج المنفذ العام:
- `test:unit` بلا قاعدة أصلًا.
- `test:integration` يتصل مباشرة بالمنفذ العام للمضيف... ⇒ **يتوقف أيضًا وهو مُغلق** (يحتاج `on`).

## 6. ما لم يُنجَز (صريح)

| البند | الحالة |
|---|---|
| Cron Jobs (انتهاء شهادة Apple، تنظيف جلسات، مراقبة المهام الفاشلة) | ⬜ لم تُنشأ |
| سياسة النسخ الاحتياطي + **اختبار استعادة فعلي** | ⬜ لم تُنفَّذ |
| تضييق صلاحيات مفتاح CranL (`["*"]` حاليًا) | ⬜ |
| اختبارات IDOR عبر HTTP على مسارات التطبيق (تحتاج صفحات داشبورد) | ⬜ الطريق صار مفتوحًا الآن |
| **كاناري لحارس الإقلاع**: إثبات أنه يرفض فعلًا دورًا غير آمن في الإنتاج | ⬜ منطقه مُختبَر كوحدة، ولم يُختبر بإسقاط الإنتاج عمدًا |
| `buckets` (تخزين الملفات) · `queues` المُدارة · منطقة MENA · نطاق مخصص | ⛔ محجوبة على الخطة المجانية — لم تُدَّعَ كمنجزة |
