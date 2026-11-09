# Evidence — W2 (Authentication) + W3.1/W3.2 (server-side tenant layer)

- **DATE:** 2026-11-09 · **القاعدة:** CranL `taployal-db` (PostgreSQL 16.15)
- **القرار المرجعي:** [ADR-001](../adr/ADR-001-cranl-native-infrastructure.md) · **الخطة:** [cranl-native-plan.md](../plans/cranl-native-plan.md)

## 1. توافق الاعتمادات — مُتحقَّق منه قبل التثبيت

| الحزمة | الإصدار | التحقق |
|---|---|---|
| `better-auth` | **1.7.18** (نُشر 2026-11-05) | peer deps: `next ^16.0.0` ✅ · `react ^19.0.0` ✅ · `drizzle-orm ^0.45.2` ✅ · `drizzle-kit >=0.31.4` ✅ |
| `@node-rs/argon2` | 2.2.2 | يوجد prebuilt **`linux-arm64-musl`** ⇒ لا بناء من المصدر |
| `drizzle-orm` | 0.45.4 | مطابق لمتطلب better-auth |
| `drizzle-kit` | 0.31.11 | مطابق |

**Argon2id يعمل فعليًا على هذا الجهاز** — مخرج حقيقي من تشغيل مباشر:
```
argon2id hash ok: $argon2id$v=19$m=19456,t=2,p=1$2...
verify: true
```
المعاملات (19 MiB · t=2 · p=1) هي خط الأساس الموصى به من OWASP، ومضبوطة صراحةً في `src/auth/index.ts` لا بالافتراضي.

## 2. مخطط المصادقة — مستخرج من المكتبة نفسها

بدل كتابة المخطط من الذاكرة، استُخرج من `getAuthTables()` داخل `better-auth@1.7.18` مباشرة:

| النموذج | الجدول | الحقول |
|---|---|---|
| user | `user` | name · email (unique) · emailVerified · image · **twoFactorEnabled** · createdAt · updatedAt |
| session | `session` | expiresAt · token (unique) · ipAddress · userAgent · userId → user.id |
| account | `account` | accountId · providerId · userId · accessToken · refreshToken · idToken · … · **password** |
| verification | `verification` | identifier · value · expiresAt |
| twoFactor | `twoFactor` | secret · backupCodes · userId · verified · failedVerificationCount · lockedUntil |

المِهاجر `drizzle/0003_auth_tables.sql` طُبِّقت: `applied: true`.

**قرار تصميمي مُعلَن:** جداول المصادقة **بلا RLS عن قصد** — المصادقة يجب أن تحلّ المستخدم/الجلسة **قبل** وجود سياق مستأجر. لا تحوي بيانات تجارية لتاجر، ووضع RLS عليها كان سيمنع تسجيل الدخول أصلًا.

## 3. 🎯 إثبات `ALTER DEFAULT PRIVILEGES` (تحقق من قرار W1)

منح `taployal_app` على جداول المصادقة الخمسة **الجديدة** حصل تلقائيًا بلا أي `GRANT` صريح:

| الجدول | الصلاحيات الفعلية |
|---|---|
| account · session · twoFactor · user · verification | `DELETE,INSERT,SELECT,UPDATE` |

هذا يثبت أن `ALTER DEFAULT PRIVILEGES` في المِهاجر 0001 يعمل فعليًا ⇒ الجداول المستقبلية لا ترث صلاحيات خاطئة ولا تفقد الصلاحيات الصحيحة بصمت.

## 4. طبقة العزل من جهة السيرفر (`withTenant`)

`src/db/tenant.ts` — المسار الوحيد المسموح للوصول لبيانات التاجر:

1. يرفض التنفيذ بلا `merchantId` (**fail-closed**، لا رجوع لاستعلام غير مُقيَّد).
2. يتحقق أن المعرّف **uuid** فعلي (لا تمرير نص خام إلى SQL).
3. يضبط `app.merchant_id` بـ`set_config(..., is_local = true)` **داخل المعاملة** ⇒ لا يتسرّب إلى الطلب التالي على اتصال مشترك.
4. يضبط `app.is_super_admin` **فقط** عندما تأتي الجلسة بدور `super_admin`.

**تعليق أمني صريح:** لا يقبل هذا الطابع أي `merchant_id` من المتصفح — القيمة تُمرَّر من الجلسة الموثوقة فقط، ومصدرها المُعلَن في `TenantContext` هو `requireSession()` (يُبنى في W2.2 المتبقية).

## 5. نتائج الاختبارات

### اختبارات الوحدة — `test/security/tenant-context.test.ts`
```
# tests 7 · # pass 7 · # fail 0        (exit 0)
```
| # | التأكيد | النتيجة |
|---|---|---|
| 1 | رفض جلسة غائبة | ok |
| 2 | رفض جلسة بلا معرّف تاجر | ok |
| 3 | رفض معرّف غير uuid (`1 OR 1=1`) بلا تحويل صامت | ok |
| 4 | قبول جلسة تاجر سليمة | ok |
| 5 | `withTenant` يضبط `app.merchant_id` على تاجر الجلسة، ولا يذكر تاجرًا آخر، ولا يمنح سياق super admin | ok |
| 6 | سياق super admin يُمنح للدور `super_admin` فقط (+ جملة واحدة إضافية بالضبط) | ok |
| 7 | **CANARY:** بلا سياق تاجر ⇒ **صفر معاملات وصفر جمل** | ok |

### إعادة تشغيل اختبارات العزل (فحص انحدار بعد إضافة جداول المصادقة)
```
assertions: 33 · failed: 0 · canary detected: true   (exit 0)
```
لا انحدار. الأثر الخام: [`w3-isolation-run.txt`](./w3-isolation-run.txt) · [`w2-unit-tests.txt`](./w2-unit-tests.txt)

### فحوص الجودة
`check-tokens` ✓ · `check-logical-css` ✓ · `tsc --noEmit` ✓ (صفر أخطاء)

## 6. عائق بيئي جديد وسجلّه

| العائق | الدليل | الحل |
|---|---|---|
| Node 22.23 هنا **لا يجرّد أنواع TS** | `ERR_NO_TYPESCRIPT` مع `--experimental-strip-types` و`--experimental-transform-types` | تحزيم اختبارات `.ts` بـ**esbuild** الموجود أصلًا كاعتماد تابع لـ`drizzle-kit` — **بلا اعتماد جديد** (`tools/run-unit-tests.sh`) |
| `node_modules/esbuild/bin/esbuild` ملف ELF لا shim | `SyntaxError` عند تشغيله بـ`node` | يُنفَّذ مباشرة بعد `chmod +x` |
| npm mirror يفشل على حزم better-auth | `NOT_FOUND`/`E500` | `--registry=https://registry.npmjs.org` |
| مِهاجر drizzle تلقّى اسمًا متعارضًا `0001_deep_ironclad` | تزاحم مع `0001_roles_and_grants` اليدوي | أُعيد تسميته `0003_auth_tables.sql` وتحديث `_journal.json` |

## 7. ما لم يُنجَز بعد في W2 (صريح — لا يُعلَن كمنجز)

| البند | الحالة |
|---|---|
| `requireSession()` المبني على الجلسة الحقيقية + `getTenantFromSession()` | ⬜ لم يُكتب |
| تسجيل/تحقق بريد/استعادة كلمة مرور | ⬜ الكود مُهيَّأ في `src/auth/index.ts`، **بلا اختبار سلوكي على قاعدة حقيقية** |
| MFA (TOTP) فرضًا للمشرف العام | 🟡 الـplugin مُسجَّل والجدول موجود · **سياسة الفرض في RBAC لم تُكتب** |
| RBAC + دعوات الموظفين + تعليق الحسابات | ⬜ لم تُكتب |
| CSRF | 🟡 Better Auth يوفّره افتراضيًا (SameSite + origin check) — **غير مُختبَر** |
| Rate limiting | 🟡 مُهيَّأ بحدود مخصّصة لكل مسار · **غير مُختبَر** |
| اختبارات IDOR عبر HTTP | ⬜ تحتاج تشغيل التطبيق (dev server بطيء جدًا هنا/`next build` غير موثوق) |
| البريد (تحقق/استعادة) | ⬜ `emails: connected=false` على CranL + مزوّد SMTP لم يُختر بعد |

> القاعدة المُتبعة: لا بند أعلاه يُعدّ منجزًا حتى يوجد مخرج اختبار فعلي. هذه هي حالة §14 من التوجيه.

---

# ملحق W2 — RBAC + حلّ الجلسة + الإلحاق (onboarding)

- **DATE:** 2026-11-09 · **الأثر الخام:** [`w2-unit-tests.txt`](./w2-unit-tests.txt) · [`onboarding-run.txt`](./onboarding-run.txt)

## 1. سياسة الترخيص (`src/identity/rbac.ts`)

**تفصيل افتراضي (deny by default):** أي صلاحية غير ممنوحة صراحةً لدور = مرفوضة. لا اعتماد على إخفاء عناصر الواجهة.

| الصلاحية | staff | merchant_owner | super_admin |
|---|:--:|:--:|:--:|
| `transaction:record` · `transaction:undo` · `reward:redeem` · `customer:read` · `card:read` | ✅ | ✅ | ❌ |
| `analytics:read` · `card:write` · `branch:write` · `staff:manage` · `customer:export` · `subscription:manage` · `customer:write` | ❌ | ✅ | ❌ |
| `platform:merchants:suspend` · `platform:audit:read` · `platform:settings:write` · `platform:merchants:read` | ❌ | ❌ | ✅ |

**فرض MFA:** `super_admin` هو **الدور الوحيد** الذي يتطلب عاملًا ثانيًا. `authorize()` يفحص بالترتيب: مصادقة → وجود مستأجر (لغير دور المنصة) → **MFA** → الصلاحية. حملُ الدور وحده لا يكفي.

## 2. حلّ الجلسة (`src/identity/session.ts`)

السلسلة: جلسة Better Auth (كوكي، تُتحقق على السيرفر) → هوية → صف الملف الشخصي في `users` → `{ role, merchantId }`.

**معرّف التاجر يُقرأ من قاعدة البيانات بمفتاح المستخدم المُصادَق — لا من header ولا body ولا query ولا تخزين العميل.** هذا هو جوهر §5 من توجيهك.

## 3. 🎯 الإلحاق تحت RLS — بدون أي تصعيد صلاحيات

المشكلة الحقيقية: سياسات `merchants` و`users` هي `... OR id = app_merchant_id()`، فكيف يُنشأ تاجر جديد عندما لا يوجد سياق مستأجر بعد؟

**الحل:** سياق الإلحاق هو **معرّف التاجر الذي سيُنشأ**، وهذا المعرّف يُولَّد على **السيرفر** (`randomUUID()`) ولا يُقبل من العميل. فيمرّ الـ`WITH CHECK` لصفٍّ واحد جديد فقط.

**مُثبت باختبار (6/6):**
| الفحص | النتيجة |
|---|---|
| إنشاء تاجر تحت معرّف جديد (مُولَّد على السيرفر) | `ok` ✅ |
| إنشاء صف المالك في `users` | `ok` ✅ |
| **إدراج تاجر تحت معرّف آخر في نفس الجلسة** | `raised:42501` ✅ |
| **إدراج صف ملف شخصي لتاجر آخر** | `raised:42501` ✅ |
| عدد التجّار المرئيين في تلك الجلسة | **1** (صفّه فقط) ✅ |

⇒ الآلية **ليست سماحًا عامًّا**. ولم أستخدم `SECURITY DEFINER`، فلم يُصعَّد أي امتياز ولا يوجد شيء إضافي يحتاج تدقيقًا.

## 4. نتائج اختبارات الوحدة (21/21)

**طبقة العزل (7):** رفض جلسة غائبة · رفض بلا معرّف تاجر · رفض معرّف غير uuid (`1 OR 1=1`) · قبول جلسة سليمة · ضبط `app.merchant_id` على تاجر الجلسة دون ذكر تاجر آخر · سياق super admin للدور الصحيح فقط · **كاناري: بلا سياق ⇒ صفر معاملات وصفر جمل**.

**RBAC (14):** رفض افتراضي لدور مجهول · `staff` ممنوع من التحليلات وتعديل الكارت وتصدير العملاء وإدارة الموظفين · `merchant_owner` يملك صلاحيات العمل · صلاحيات المنصة **غير قابلة للوصول** من أي دور مستأجر · `super_admin` وحده يتطلب MFA · رفض غير المُصادَق · رفض دور مستأجر بلا مستأجر · **فرض MFA حتى مع امتلاك الصلاحية** · قبول `super_admin` بعد MFA · رفض `staff` من التحليلات · رفض حساب معطَّل · رفض دور مستأجر بلا تاجر · قبول super admin بلا تاجر · **كاناري: لا حلّ جلسة بلا صف ملف شخصي**.

## 5. عائق بيئي جديد — السبب الجذري مُحدَّد الآن

**السبب الجذري لعطب المجلدات:** أي `file_write` إلى مسار **أبوه غير موجود** يترك **dentry معطوبًا**، ويصبح ذلك الاسم **غير قابل للإنشاء نهائيًا** — `mkdir` يقول «File exists» أو «No such file» بينما `ls` لا يُظهره.

الأسماء المعطوبة حتى الآن في `/root/taployal`: `scripts` · `tests` · `src/db/schema` · **`src/auth`** · `docs/ADR`.
البدائل المستخدمة: `tools/` · `test/` · `src/db/sql/` · **`src/identity/`** · `docs/adr/`.

**القاعدة الإلزامية المُتبنّاة:** لا `file_write` أبدًا إلى مجلد جديد قبل `mkdir -p` **والتحقق منه بـ`ls`**. هذا ما كلّفني إعادة كتابة ملفات المخطط الخمسة و RBAC مرتين.

## 6. المجموعة الكاملة الآن

| المجموعة | النتيجة |
|---|---|
| `test:unit` (عزل + RBAC + جلسة) | **21/21** |
| `test:isolation` (RLS على 15 جدولًا + canary) | **33/33** · canary ✅ |
| `test:engine` (المحرك + الطابور) | **18/18** |
| `test:onboarding` (الإلحاق تحت RLS) | **6/6** |
| `check` (tokens · logical CSS · tsc) | PASS |
| **الإجمالي** | **78 تأكيدًا · 0 فشل · كاناري مُثبت** |

## 7. ما لم يُنجَز (صريح)

- ⬜ **اختبار سلوكي لدخول فعلي عبر Better Auth** (`signUpEmail`/`signInEmail`) — يحتاج `DATABASE_URL` مباشرًا؛ لم يُطلب كشف كلمة المرور، فلم يُنفَّذ. **لن أعلن أن تسجيل الدخول «يعمل» قبل هذا الاختبار.**
- ⬜ التحقق من البريد واستعادة كلمة المرور — يحتاج مزوّد بريد (CranL Email `connected=false`).
- ⬜ ربط `databaseHooks` في Better Auth بإنشاء صف الملف الشخصي تلقائيًا.
- ⬜ حدّ المحاولات (rate limit) وCSRF — مُهيَّأة، **غير مُختبَرة**.
