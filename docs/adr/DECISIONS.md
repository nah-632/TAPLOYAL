# DECISIONS — taployal (ADR log)

الصيغة: `ID · DATE · CONTEXT · DECISION · ALTERNATIVES · CONSEQUENCES · STATUS`

---

## ADR-001 — وضع «الديمو أولًا» ومزوّدون محاكيون
- **DATE:** 2026-11-09
- **CONTEXT:** المالك اختار بناء ديمو تقني+تجاري معًا، بلا حسابات مدفوعة (Apple Developer، Google Wallet Issuer، بوابة دفع).
- **DECISION:** لا نتوقف على أي حساب خارجي مدفوع. تُبنى كل نقاط التكامل الخارجي خلف واجهات (`WalletProvider`, `PaymentProvider`) ومزوّدها الافتراضي **Mock** قابل للتبديل.
- **ALTERNATIVES:** (أ) شراء الحسابات الآن؛ (ب) تأجيل كل شيء حتى توفّرها. كلاهما يوقف التقدّم بلا داعٍ.
- **CONSEQUENCES:** الديمو كامل الشكل والعمق، ولا ادّعاء كاذب بقبول wallet فعلي. التبديل لاحقًا = تغيير مزوّد فقط.
- **STATUS:** APPROVED

## ADR-002 — قفل الستاك (لا استبدال بلا موافقة)
- **DATE:** 2026-11-09
- **CONTEXT:** §7 و§12 من المصدر: Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase · Recharts · Lucide · PWA داخل نفس المشروع.
- **DECISION:** الستاك مقفل كما هو. أي مكتبة خارج القائمة تتطلّب سؤال المالك أولًا.
- **ALTERNATIVES:** Vite/Remix/SvelteKit؛ Prisma/Drizzle بدل Supabase client — كلها مرفوضة بلا موافقة.
- **CONSEQUENCES:** التزام بتفضيلات المالك؛ لا مفاجآت اعتمادات.
- **STATUS:** APPROVED

## ADR-003 — أساس الترجمة (i18n) — يحتاج موافقة
- **DATE:** 2026-11-09
- **CONTEXT:** المطلوب عربي افتراضي + إنجليزي + مبدّل لغة، وRTL في الجذر. المصدر لا يسمّي مكتبة i18n.
- **DECISION (PROPOSED):** كتالوج داخلي بسيط (`messages/ar.json`, `messages/en.json`) + `[locale]` segment + `dir` على `<html>` — **بلا اعتماد جديد**.
- **ALTERNATIVES:** `next-intl` (ناضجة، لكنها خارج الستاك المُعلن ⇒ تحتاج موافقة صريحة).
- **CONSEQUENCES:** لو وافق المالك على `next-intl` لاحقًا فالترحيل محدود (طبقة واحدة).
- **STATUS:** PROPOSED — بانتظار موافقة

## ADR-004 — مصادقة الموظف: جلسة Supabase + PIN موثَّق على السيرفر
- **DATE:** 2026-11-09
- **CONTEXT:** §2: الموظف يدخل بـPIN أو رابط دعوة، ولا يرى التحليلات ولا يعدّل الكارت. RLS مفتاحه `merchant_id`.
- **DECISION:** الموظف يحصل على جلسة Supabase عادية (invite/email)، و`pin_hash` يُتحقّق منه **على السيرفر** قبل تنفيذ أي إجراء حساس. الصلاحيات تُفرض في RLS + policy على الدور.
- **ALTERNATIVES:** جدول sessions مخصّص وPIN فقط — يخلق نظام auth موازيًا ويصعّب RLS.
- **CONSEQUENCES:** تكامل نظيف مع RLS؛ PIN طبقة تحقّق إضافية لا نظام هوية.
- **STATUS:** APPROVED

## ADR-005 — `WalletProvider` interface + MockWalletProvider افتراضيًا
- **DATE:** 2026-11-09
- **CONTEXT:** §8.1 يطلب صراحةً تجريدًا يفصل منطق المنصة عن مزوّد المحفظة.
- **DECISION:** واجهة واحدة: `issuePass`, `updatePass`, `registerDevice`, `unregisterDevice`, `listUpdatedSince`, `fetchLatest`, `logError`. تنفيذان: `MockWalletProvider` (يولّد `.pkpass` فعلي البنية + JSON لـGoogle) و`ApplePassProvider`/`GoogleWalletProvider` (لاحقًا).
- **ALTERNATIVES:** كود مباشر لكل محفظة — يخالف §8.1 ويصعّب الاختبار.
- **CONSEQUENCES:** كل الطبقة العليا تُختبر بلا شبكة؛ توليد الملفات حقيقي وقابل للفحص.
- **STATUS:** APPROVED

## ADR-006 — `Transactions` مصدر الحقيقة الوحيد للرصيد
- **DATE:** 2026-11-09
- **CONTEXT:** §6: `Transactions` append-only، والرصيد يُحدَّث في نفس معاملة الـinsert، ولا يُعدَّل يدويًا إلا بـ`adjust`.
- **DECISION:** لا كتابة مباشرة على `passes.balance` من أي route. كل تغيير يمرّ عبر insert معاملة + `idempotency_key` UNIQUE + تحديث الرصيد داخل نفس الـDB transaction.
- **ALTERNATIVES:** تحديث الرصيد مباشرة — يفقد التتبّع ويكسر «KPIs = SUM(transactions)».
- **CONSEQUENCES:** نقرة مزدوجة لا تُسجّل مرتين (idempotency)؛ undo = معاملة عكسية مرتبطة.
- **STATUS:** APPROVED

## ADR-007 — Region الـSupabase
- **DATE:** 2026-11-09
- **CONTEXT:** §9 يذكر التوافق مع قوانين حماية البيانات في البحرين والسعودية والإمارات.
- **DECISION:** **معلّق** حتى يعيّن المالك المنطقة. الافتراضي المقترح: أقرب منطقة خليجية متاحة على الخطة المجانية.
- **CONSEQUENCES:** يمسّ latency وdata residency — لا يُحسم من طرفي.
- **STATUS:** OPEN

## ADR-008 — Tailwind كنسخة واحدة ومصدر واحد للتوكنز
- **DATE:** 2026-11-09
- **CONTEXT:** §11: «لا يظهر أي hex أو خط آخر في كود واجهة المنصة».
- **DECISION:** كل الألوان والخطوط تُعرَّف مرة واحدة كـdesign tokens في `app/globals.css` (`@theme`) وتُستهلك عبر utility names فقط. يُضاف فحص grep يمنع أي `#hex` خارج ملف التوكنز.
- **ALTERNATIVES:** hex مضمّن في المكونات — يخالف §11 مباشرة.
- **CONSEQUENCES:** تغيير الهوية = ملف واحد؛ الفحص قابل للأتمتة.
- **STATUS:** APPROVED

---

## ADR-009 — ترقيع Next.js لتعارض `NODE_OPTIONS` في هذه البيئة
- **DATE:** 2026-11-09
- **CONTEXT:** كل استدعاء لـ`node` في هذه البيئة يأتي مسبوقًا بوسائط V8 مفروضة (`--single-generation`، `--no-opt`، `--no-maglev`، `--no-sparkplug`، `--regexp-interpret-all`، `--no-lazy-compile-dispatcher`، `--no-concurrent-recompilation`، `--no-concurrent-marking`)، فتظهر دائمًا في `process.execArgv` — ولا يمكن إزالتها (تثبت أن `spawnSync` يعيد إنتاجها).
  Next.js يبني بيئة الطفل بـ`getParsedNodeOptions() = [...process.execArgv, ...NODE_OPTIONS]` ثم يمرّر كل ما ليس في `EXEC_ARGV_ONLY_OPTIONS` عبر `NODE_OPTIONS` ⇒ يموت child dev-server بـ:
  `node: --single-generation is not allowed in NODE_OPTIONS`
- **DECISION:** سكربت `tools/patch-next-for-sandbox.mjs` يضيف أسماء هذه الوسائط إلى `EXEC_ARGV_ONLY_OPTIONS` داخل `node_modules/next/dist/server/lib/utils.js` و`.../esm/...` — فتُمرَّر كوسائط CLI حقيقية (تمامًا كما يفعل الأب) لا عبر `NODE_OPTIONS`. مُربوط بـ`postinstall` و`predev`.
- **ALTERNATIVES:** (أ) إعادة بناء node بلا هذه الوسائط — مستحيل من داخل الحاوية؛ (ب) تشغيل `start-server` مباشرة بتجاوز CLI — هشّ ويتخطّى تهيئة Next؛ (ج) ترك البيئة — يمنع تشغيل أي شيء.
- **CONSEQUENCES:** الملف **idempotent**، **يكتشف نفسه**، ولا يفعل شيئًا على جهاز عادي، ولا يكتب خارج `node_modules`، ويزول بأي `npm install` ثم يُعاد تطبيقه تلقائيًا. التكلفة: ترقيع موثَّق لأصل خارجي (يُنقل إلى CI نظيف لاحقًا).
- **STATUS:** APPROVED

## ADR-010 — خطوط مستضافة ذاتيًا (`next/font/local`) بدل `next/font/google`
- **DATE:** 2026-11-09
- **CONTEXT:** `next/font/google` فشل فعليًا: `EHOSTUNREACH` إلى `fonts.gstatic.com` (IPv6 غير قابل للوصول من هذه البيئة)، وواجهة `next dev` سجّلت الخطأ عند كل بناء.
- **DECISION:** الخطوط الأربعة المطلوبة في §10.2 تُستضاف محليًا في `public/fonts` (woff2، مجموعات latin/arabic فقط) وتُحمَّل عبر `next/font/local`: Playfair Display (400/600/700) · Inter (400/500/600/700) · IBM Plex Sans Arabic (400/500/600/700) · Noto Naskh Arabic (400/600/700). الحجم الكلي 512KB وكل خط مُجزَّأ (subset).
- **ALTERNATIVES:** إجبار IPv4 (`--dns-result-order=ipv4first`) — قد يعمل لكنه يترك اعتمادًا شبكيًا على طرف ثالث في المسار الحرج؛ مرفوض.
- **CONSEQUENCES:** يخدم ثلاثة أهداف: يعمل بلا شبكة، يحقّق ميزانية §10.7 (join page < 100KB)، ويلغي مخاطر الخصوصية/التبعية. الأسماء والتوكنات (`--font-playfair`, `--font-inter`, `--font-plex-arabic`, `--font-noto-naskh`) لم تتغيّر ⇒ لا أثر على بقية الكود.
- **STATUS:** APPROVED

## ADR-011 — موقع المشروع: `/root/taployal` مع مرآة في `/var/minis/workspace`
- **DATE:** 2026-11-09
- **CONTEXT:** مسار الجسر `/var/minis/**` لا يدعم: (1) إنشاء symlinks (`Operation not permitted`) — يفشل `npm install` عند إنشاء `.bin`؛ (2) `fs.realpathSync.native` (`ENOENT`) — وهو ما يستخدمه Next.js للتحقق من مجلد المشروع، فيرفض الإقلاع.
- **DECISION:** المشروع القابل للتنفيذ في `/root/taployal` (ملفات حقيقية، symlinks، realpath سليم). وتُنشأ **مرآة مصدر** (بلا `node_modules`/`.next`) في `/var/minis/workspace/taployal` ليراها المالك ويُعاين ملفاتها من المحادثة.
- **ALTERNATIVES:** ترقيع npm ليعمل بلا symlinks + ترقيع Next ليتجاوز realpath — ترقيعان إضافيان لأصل خارجي مقابل حلّ واحد نظيف.
- **CONSEQUENCES:** التطوير والتشغيل في `/root`، والمرآة تُحدَّث بأمر واحد. ⚠ ملاحظة: المرآة قد تتأخر عن المصدر إن لم تُحدَّث بعد كل تغيير.
- **STATUS:** APPROVED
