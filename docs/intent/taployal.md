# Statement of Intent — taployal

- **Status:** CONFIRMED (2026-11-09) — صاغه الوكيل من إجابات المستخدم، وأكّده المستخدم بـ«اكمل» بعد عرضه سطرًا بسطر.
- **Source:** `docs/spec-source.md` (مواصفة المستخدم الأصلية، 355 سطرًا، 13 قسمًا).
- **Reference:** `docs/brand-reference.png` (brand system + mockup).

## 1. النتيجة المستهدفة (Outcome)

ديمو **taployal** يعمل فعلًا ويُعرَض: منصة loyalty متعددة المستأجرين (multi-tenant SaaS)، عربية RTL افتراضيًا + إنجليزية، يبني فيها التاجر كارت ولاء بهويته البصرية ويُصدره لعميله بلا تطبيق، مع مسار موظف يقرأ الباركود، ولوحة تحكم بأرقام صحيحة، ولوحة Super Admin.

## 2. الجمهور والمستخدمون (Users)

| الجهة | الوصف |
|---|---|
| جمهور الديمو | المالك + عميل/مستثمر محتمل + مُقيّم تقني |
| مستخدمو المنتج | Merchant Owner · Staff · End Customer (بلا حساب) · Super Admin |

## 3. السبب الآن (Why now)

إثبات الفكرة وجودة التنفيذ قبل أي التزام تجاري أو مالي (لا حسابات مدفوعة، لا بوابات دفع، لا شهادات Apple/Google).

## 4. معيار النجاح (Success) — قابل للتحقق

1. عزل RLS **مُثبت باختبار قادر على الفشل** (تاجر أ لا يقرأ/يعدّل بيانات تاجر ب).
2. Card Builder بمعاينة **حيّة فورية** عند تغيير لون/شعار/أيقونة.
3. مسار كامل: QR → join → issuance → balance update.
4. `Transactions` مصدر الحقيقة الوحيد للرصيد، وKPIs في Overview = مجموع `Transactions`.
5. `WalletProvider` mock + توليد `.pkpass` فعلي البنية قابل للتنزيل (بتصريح صادق أنه لا يُقبل في Wallet بلا Pass Type ID حقيقي).
6. كل الشاشات سليمة RTL من 360px وأعلى، وبلا أي fallback glyph عربي.

## 5. القيد الحاكم (Constraint)

جهاز واحد (iSH على iOS) · أدوات مجانية فقط (Supabase free) · لا حسابات مدفوعة · لا وصول حقيقي لـAPNs أو Google Wallet API · `next build` معلوم أنه يتعلّق على هذا الجهاز ⇒ **`next dev` + اختبارات Node هي مرجع التحقق المحلي**، والبناء الكامل يُترك لـCI لاحقًا.

## 6. خارج النطاق (Out of scope) — مؤكَّد

اشتراكات/فواتير حقيقية · APNs حقيقي · Google Wallet API حقيقي · custom domains · Broadcast · Tiers · تحليلات لكل فرع · Birthday rewards · POS/Webhooks · أي ميزة تسويقية (SMS/Email/Referrals) · أي ميزة AI · تطبيق native · محفظة قيمة مخزّنة.

## 7. افتراضات مثبّتة (ما لم تُصحَّح)

| # | الافتراض | الحالة |
|---|---|---|
| 1 | البدء بـ**Phase 0 فقط** ثم توقف للمراجعة | CONFIRMED |
| 2 | البناء محلي وقابل للنشر لاحقًا بموافقة صريحة (لا نشر الآن) | CONFIRMED |
| 3 | مشروع Supabase free جديد (PostgreSQL + Auth + RLS) | CONFIRMED |
| 4 | مزوّد دفع **محاكى** خلف واجهة، بلا مفاتيح | CONFIRMED |
| 5 | الشعار العربي «المس. اجمع. استبدل.» | **PROPOSED — بانتظار موافقة صريحة قبل الاستخدام** |
| 6 | Supabase region قريب من الخليج (data residency) | **UNKNOWN — يحتاج تأكيدك** |
| 7 | i18n: بدون مكتبة جديدة بلا موافقة (§12 من المواصفة) | PROPOSED |
| 8 | Western digits (0-9) في الواجهتين | CONFIRMED (بموجب §10.5) |

## 8. بنود مفتوحة حقيقية (Open items)

1. بوابة الدفع النهائية عند التحوّل التجاري: Tap / Moyasar / PayTabs / Stripe.
2. الدومين القصير لروابط الانضمام.
3. Region الـSupabase.
4. نموذج الكسب في `points` mode (`points_per_unit` — كم نقطة لكل 1 BHD؟ التقريب؟).
5. سلوك اليوم الثامن بعد `past_due` (إيقاف كتابة فقط أم إيقاف كامل مع بقاء البيانات).
6. شهادة Apple الحقيقية + Google Issuer (لاحقًا عند التحوّل التجاري).
