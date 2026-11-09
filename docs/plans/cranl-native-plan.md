# خطة التنفيذ — CranL Native Architecture (TDD-ready)

- **DATE:** 2026-11-09 · **المرجع:** [`ADR-001`](../adr/ADR-001-cranl-native-infrastructure.md)
- **المنهجية:** superpowers → writing-plans → executing-plans → test-driven-development → verification-before-completion
- **قاعدة الاختيار المُطبَّقة:** اختبار يفشل أولًا (RED) → أصغر تنفيذ ينجح (GREEN) → تحسين (REFACTOR). لا مهمة تُعدّ منتهية بلا دليل تنفيذ حقيقي.

## ⛔ العوائق الحاكمة قبل W1

| # | العائق | ما يمنعه | الحل |
|---|---|---|---|
| B1 | `POST /databases/{id}/query` يرفض التنفيذ بلا **external access** | **كل** اختبار SQL/RLS/IDOR | قرار المالك: فتح منفذ عام مؤقتًا، أو تشغيل المِهاجر من داخل تطبيق على CranL |
| B2 | PostgreSQL محلي **مستحيل** (`FATAL: signalfd() failed` — iSH) | اختبار محلي بلا شبكة | لا بديل: الاختبار على CranL |
| B3 | `buckets: 0` · `storage: false` | W4 كامل على CranL | مُشغّل S3 بمزوّد خارجي + واجهة جاهزة لـCranL Buckets عند الترقية |
| B4 | `queues.plan.access: false` | W5 المُشغّل المُدار | طابور على PostgreSQL (outbox + `SKIP LOCKED`) بمُشغّل حقيقي، وواجهة تستقبل CranL Queues لاحقًا |
| B5 | `apps_and_databases: 2` · لا Staging | الفصل بين dev/staging/prod | بيئة واحدة (prod) بفصل منطقي بالمخططات (schemas) وبيانات اختبار معزولة |

---

## W1 — طبقة البيانات (Drizzle + Migrations)

| # | المهمة | الاختبار أولًا (RED) | الملفات |
|---|---|---|---|
| W1.1 | تثبيت Drizzle + `postgres` (JS خالص) + إعداد `drizzle.config` | اختبار يفشل: الاتصال بـ`DATABASE_URL` ينجح و`select 1` | `drizzle.config.ts`, `src/db/client.ts` |
| W1.2 | مخطط كل الجداول من مواصفة المنتج §6 | اختبار: كل جدول فيه `id uuid pk` + `created_at` + `updated_at`؛ وكل جدول تاجر فيه `merchant_id NOT NULL` مفهرس | `src/db/schema/*.ts` |
| W1.3 | توليد Migration أولى + تطبيقها | `drizzle-kit generate` ⇒ ملف SQL مراجع؛ التطبيق ينجح و`information_schema` يطابق المخطط | `drizzle/*.sql` |
| W1.4 | أدوار DB محدودة الصلاحيات | اختبار: `app_user` **لا** يملك `SUPERUSER`/`CREATEROLE`/`BYPASSRLS` | migration للأدوار |
| W1.5 | فهارس وقيود الأداء | اختبار: فهارس على كل `merchant_id` وكل FK؛ `unique(merchant_id, phone)` موجود | migration |

## W2 — المصادقة (Better Auth)

| # | المهمة | الاختبار أولًا | الملفات |
|---|---|---|---|
| W2.1 | تحقق توافق الإصدار المستقر مع Next 16.4.5/React 19.3.1 ثم تثبيت مثبَّت | اختبار انحلال (import) يعمل | `package.json` |
| W2.2 | تسجيل + تحقق بريد + دخول | RED: مستخدم جديد يُنشأ؛ بريد غير مُتحقَّق لا يدخل | `src/auth/*` |
| W2.3 | Argon2id | اختبار: `password_hash` يبدأ بـ`$argon2id$` ولا يساوي كلمة المرور | migration + config |
| W2.4 | جلسات: HttpOnly + Secure(prod) + SameSite + تدوير/إلغاء | اختبار: كوكي الجلسة `HttpOnly`؛ إلغاء الجلسة يُبطلها فورًا | `src/auth/session.ts` |
| W2.5 | MFA (TOTP) للمشرف العام | RED: super_admin بلا MFA يُرفض؛ وبعد التفعيل ينجح | `src/auth/mfa.ts` |
| W2.6 | RBAC + دعوات الموظفين + تعليق الحساب | اختبار: staff لا يصل إلى مسارات المالك؛ حساب معلّق يُرفض | `src/auth/rbac.ts` |
| W2.7 | CSRF + Rate limit + Brute force | اختبار: N محاولة فاشلة متتالية ⇒ 429 | middleware |

## W3 — عزل المستأجرين (الأهم أمنيًا)

| # | المهمة | الاختبار أولًا | الملفات |
|---|---|---|---|
| W3.1 | `withTenant()` إلزامية | RED: استعلام بلا tenant context **يرمي** ولا يعيد بيانات | `src/db/tenant.ts` |
| W3.2 | هوية التاجر من الجلسة فقط | RED: تمرير `merchant_id` في الـbody لا يُستخدم أبدًا | `src/auth/tenant-context.ts` |
| W3.3 | PostgreSQL RLS أصلي (سياسات على `current_setting('app.merchant_id')`) | RED: بدور `app_user` و`merchant_a` ⇒ استعلام بيانات `merchant_b` يعيد صفر صفوف | migration السياسات |
| W3.4 | **اختبار IDOR** | RED: تعديل `customer_id` في الطلب يدويًا ⇒ 403/404، وبيانات B لا تظهر | `tests/security/idor.test.ts` |
| W3.5 | **اختبار Cross-Tenant** | RED: A يقرأ/يعدّل/يحذف كل كيان (customers/passes/transactions/rewards/staff/branches/reports/files) | `tests/security/cross-tenant.test.ts` |
| W3.6 | **Canary: الاختبار قادر على الفشل** | تعطيل سياسة RLS مؤقتًا ⇒ الاختبار **يفشل**، ثم تُعاد في `finally` | نفس الملفات |
| W3.7 | Audit Logs للعمليات الحساسة | اختبار: كل عملية حساسة تُنتج صفًا في `audit_logs` بممثل وفاعل وتاجر | `src/audit.ts` |

## W4 — التخزين

| # | المهمة | الاختبار أولًا | ملاحظة |
|---|---|---|---|
| W4.1 | `StorageService` واجهة | اختبار تعاقدي (contract test) يعمل على أي مُشغّل | مستقل عن المزوّد |
| W4.2 | مُشغّل S3 حقيقي | رفع/قراءة/حذف + Signed URL ينتهي بانتهاء المدة | `@aws-sdk/client-s3` أو `aws4fetch` |
| W4.3 | تحقّق MIME/الحجم/منع التنفيذي + أسماء عشوائية | RED: `.exe`/MIME مزيّف/حجم زائد ⇒ رفض | مستقل |
| W4.4 | تحقّق الملكية قبل الوصول + بادئة لكل تاجر | RED: تاجر A يطلب ملف تاجر B ⇒ 403 | مستقل |
| W4.5 | سياسة احتفاظ + نسخ احتياطي | اختبار: ملف أقدم من المدة يُنظَّف | **يعتمد على B3** |

## W5 — الطوابير والمهام

| # | المهمة | الاختبار أولًا | ملاحظة |
|---|---|---|---|
| W5.1 | `JobQueue` واجهة | contract test | مستقل |
| W5.2 | مُشغّل PostgreSQL (transactional outbox + `FOR UPDATE SKIP LOCKED`) | RED: مهمتان متوازيتان لا تُنفّذان نفس الصف مرتين | يعمل على Free |
| W5.3 | Retry + Exponential backoff + DLQ | RED: فشل متكرر ⇒ ينتقل إلى dead-letter بعد N محاولات | مستقل |
| W5.4 | Idempotency | RED: نفس `idempotency_key` مرتين ⇒ معاملة واحدة فقط | مستقل |
| W5.5 | فصل المعاملة عن الإشعار | RED: إضافة نقاط تنجح حتى لو فشل إرسال مهمة تحديث البطاقة | يطابق §7 من التوجيه |

## W6 — المحافظ

| # | المهمة | الاختبار أولًا |
|---|---|---|
| W6.1 | `WalletProvider` (موجود كقرار ADR-005) | contract test على mock + real |
| W6.2 | توليد `.pkpass` فعلي البنية | RED: zip يحوي `pass.json`+`manifest.json`+`signature`؛ SHA-1 لكل ملف صحيح |
| W6.3 | Google Loyalty Class/Object + JWT | RED: بنية JSON + توقيع JWT قابل للتحقق |
| W6.4 | ربط التحديثات بالطابور (W5) | RED: تغيير رصيد ⇒ مهمة واحدة، وليست نداءً متزامنًا |

## W7 — النشر على CranL

| # | المهمة | التحقق |
|---|---|---|
| W7.1 | `output: "standalone"` + Dockerfile | بناء ناجح + صورة تُشغّل التطبيق |
| W7.2 | إنشاء التطبيق + `connect` القاعدة (يحقن `DATABASE_URL`) | التطبيق يقرأ القاعدة داخليًا |
| W7.3 | ربط المستودع + نشر + Rollback مُجرَّب | نشر ناجح + رجوع ناجح |
| W7.4 | Cron Jobs (انتهاء شهادة Apple، تنظيف جلسات/ملفات، مراقبة المهام الفاشلة) | كل مهمة **idempotent** وقابلة لإعادة التشغيل |
| W7.5 | سياسة النسخ الاحتياطي + **اختبار استعادة فعلي** | استعادة مثبتة بمقارنة عدد السجلات |
| W7.6 | تضييق صلاحيات مفتاح CranL | المفتاح الجديد بحدود أدنى |

---

## بوابة الإنجاز (لا اكتمال بلا هذه الأدلة)

كل بند من §14 «Security Acceptance Criteria» في التوجيه يحتاج **مخرجًا فعليًا** محفوظًا تحت `docs/evidence/`. أي بند لا يمكن قياسه يُسجَّل صراحةً كـ**غير مُتحقَّق** — لا كنجاح.

## الترتيب المقترح للتنفيذ

```
W1 (يحتاج B1) → W3.1–W3.3 → W3.4–W3.6 (الدليل الأمني) → W2 (المصادقة)
   → W5 (الطوابير، لا تعتمد على مزوّد) → W4 (التخزين) → W6 (المحافظ) → W7 (النشر)
```
**لماذا W5 قبل W4/W6:** الطابور على PostgreSQL يعمل على Free بلا اعتماد خارجي، وهو شرط §7 («لا تجعل تحديث البطاقة مرتبطًا باستجابة الموظف»). أما التخزين فمحجوب بـB3، والمحافظ تحتاج شهادات.
