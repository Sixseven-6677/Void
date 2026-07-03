# 27 — Roadmap

> **Status:** Official
> **Scope:** خارطة الطريق الكاملة لمشروع Void — من أول سطر كود حتى الإنتاج وما بعده
> **Authority:** هذا الملف هو المرجع الرسمي لتخطيط تطوير Void. يُحدَّث مع كل إصدار رئيسي ليعكس الواقع الفعلي للمشروع. الخارطة ليست وعوداً بمواعيد ثابتة — هي خطة تطوير واضحة الأولويات والتسلسل والمعايير. ما يُشحَن هو ما يُختبَر ويُوثَّق ويلتزم بالدستور.

---

## جدول المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [مبادئ التخطيط](#2-مبادئ-التخطيط)
3. [المرحلة 0 — Foundation](#3-المرحلة-0--foundation)
4. [المرحلة 1 — Core Framework](#4-المرحلة-1--core-framework)
5. [المرحلة 2 — Facebook Layer](#5-المرحلة-2--facebook-layer)
6. [المرحلة 3 — Authentication](#6-المرحلة-3--authentication)
7. [المرحلة 4 — Conversation Session Management](#7-المرحلة-4--conversation-session-management)
8. [المرحلة 5 — Event System](#8-المرحلة-5--event-system)
9. [المرحلة 6 — Command System](#9-المرحلة-6--command-system)
10. [المرحلة 7 — Plugin System](#10-المرحلة-7--plugin-system)
11. [المرحلة 8 — Database Layer](#11-المرحلة-8--database-layer)
12. [المرحلة 9 — Cache Layer](#12-المرحلة-9--cache-layer)
13. [المرحلة 10 — Scheduler](#13-المرحلة-10--scheduler)
14. [المرحلة 11 — Production Release](#14-المرحلة-11--production-release)
15. [المرحلة 12 — Future Features](#15-المرحلة-12--future-features)
16. [مصفوفة التبعيات](#16-مصفوفة-التبعيات)
17. [مؤشرات النجاح الكلية](#17-مؤشرات-النجاح-الكلية)

---

## 1. نظرة عامة

### 1.1 ما هو Void؟

Void هو **Framework متكامل لبناء بوتات Facebook Messenger** بـ TypeScript. ليس مجرد بوت واحد — هو بنية تحتية تُمكّن من بناء بوتات معقدة وقابلة للتوسع، مع فصل صارم بين المسؤوليات وقابلية اختبار عالية.

### 1.2 الهدف النهائي

```
بوت Facebook Messenger كامل الأهلية يمكنه:
  ✦ قبول رسائل وأحداث من Facebook Messenger
  ✦ معالجتها عبر Commands وPlugins قابلة للتكوين
  ✦ إدارة Sessions المستخدمين بشكل آمن ومستمر
  ✦ الرد برسائل غنية (نصوص، أزرار، قوائم، صور)
  ✦ تشغيل مهام مجدولة بشكل مستقل
  ✦ التوسع عبر Plugin System مرن
  ✦ الصمود في الإنتاج 24/7 بدون تدخل يدوي
```

### 1.3 خريطة المراحل

```
المرحلة 0: Foundation          ← البيئة والأدوات والبنية الأساسية
المرحلة 1: Core Framework      ← Interfaces والـ DI وهيكل التطبيق
المرحلة 2: Facebook Layer      ← الاتصال بـ Facebook API
المرحلة 3: Authentication      ← التحقق من هوية المستخدمين
المرحلة 4: Conversation Session ← إدارة حالة المحادثة مع المستخدم
المرحلة 5: Event System        ← التواصل الداخلي بين المكونات
المرحلة 6: Command System      ← معالجة رسائل المستخدم
المرحلة 7: Plugin System       ← التوسع والتخصيص
المرحلة 8: Database Layer      ← التخزين الدائم
المرحلة 9: Cache Layer         ← التخزين المؤقت والأداء
المرحلة 10: Scheduler          ← المهام الدورية والمجدولة
المرحلة 11: Production Release ← الجاهزية الكاملة للإنتاج
المرحلة 12: Future Features    ← ما بعد الإصدار الأول
```

---

## 2. مبادئ التخطيط

### 2.1 التسلسل الصارم

المراحل ليست مستقلة — كل مرحلة تبني فوق ما سبقها. لا تُبدأ مرحلة قبل اكتمال متطلباتها السابقة بالمعايير المحددة. الاختصار هنا يُنتج ديناً تقنياً يصعب سداده لاحقاً.

### 2.2 الجودة بوابة وليست نقطة وصول

معايير الإنجاز لكل مرحلة ليست "قائمة تمنيات" — هي بوابة. المرحلة لا تُعدّ مكتملة إلا عند استيفاء **جميع** معاييرها. "90% جاهز" يعني "لم يكتمل بعد".

### 2.3 الدستور يسبق الكود دائماً

أي قدرة جديدة لا تُبدأ فيها إلا بعد توثيق كيف تنتمي لمعمارية Void. الكود الذي لا يُفسَّر في الدستور هو كود في المنطقة الرمادية.

### 2.4 الأولويات

| الأولوية | المعنى |
|---|---|
| **P0 — حرجة** | يتوقف عليها كل شيء — لا تقدم بدونها |
| **P1 — عالية** | ضرورية للوظيفة الأساسية |
| **P2 — متوسطة** | تُحسِّن الجودة والموثوقية |
| **P3 — منخفضة** | مرغوبة لكنها قابلة للتأجيل |

---

## 3. المرحلة 0 — Foundation

> **الأولوية:** P0 — حرجة
> **الحالة:** 🔄 قيد التنفيذ

### الهدف

بناء البيئة التي سيعيش فيها كل كود Void — أدوات التطوير، هيكل المجلدات، نظام البناء، الاختبار، والتوثيق. مرحلة Foundation ليست "setup" بسيطاً — هي القرارات التي ستؤثر على كل يوم عمل بعدها.

### المخرجات

```
✦ Monorepo بـ pnpm workspaces مُهيكَل ومُوثَّق
✦ TypeScript 5.x بإعدادات صارمة (strict mode)
✦ ESLint + Prettier مُهيَّأن ومُدمجان في git hooks
✦ Jest أو Vitest مُهيَّأ مع دعم TypeScript
✦ Drizzle ORM + PostgreSQL مُهيَّأ
✦ pino Logger مُهيَّأ
✦ Dockerfile للتطوير المحلي
✦ .env.example موثَّق بجميع المتغيرات المطلوبة
✦ .constitution/ كاملة ومُراجَعة
✦ README.md للمشروع
✦ Git hooks: pre-commit (lint + typecheck)
```

### معايير الإنجاز

- [ ] `pnpm install` يعمل على جهاز جديد بدون أي تدخل يدوي
- [ ] `pnpm run typecheck` يمر بصفر أخطاء
- [ ] `pnpm run test` يشغّل مجموعة اختبارات أساسية وتنجح
- [ ] `pnpm run lint` يمر بصفر تحذيرات
- [ ] تشغيل `node index.js` يبدأ Server يستجيب على `/healthz`
- [ ] `.constitution/` يحتوي على جميع 27 ملفاً مكتملاً
- [ ] لا Secrets في أي ملف مُتتبَّع بـ git

### المتطلبات السابقة

لا شيء — هذه البداية.

---

## 4. المرحلة 1 — Core Framework

> **الأولوية:** P0 — حرجة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء الهيكل العظمي للتطبيق — Core Layer بكل Interfaces وTypes، نظام Dependency Injection، وهيكل التطبيق الرئيسي. هذه المرحلة تُحدد العقود التي ستُبنى عليها جميع المراحل التالية. كل Interface خاطئ هنا يُكلَّف إعادة كتابة طبقات كاملة لاحقاً.

### المخرجات

```
✦ Core Layer كاملة:
    - IFacebookClient          ← عقد التواصل مع Facebook
    - IEventBus                ← عقد نظام الأحداث
    - ISessionRepository       ← عقد تخزين Sessions
    - ISessionService          ← عقد خدمة Sessions
    - IUserRepository          ← عقد تخزين المستخدمين
    - IUserService             ← عقد خدمة المستخدمين
    - ICommandRegistry         ← عقد سجل Commands
    - IPluginRegistry          ← عقد سجل Plugins
    - ICacheClient             ← عقد Cache
    - IScheduler               ← عقد المجدوَل
    - ILogger                  ← عقد التسجيل
    - IConfig                  ← عقد الإعدادات

✦ Domain Types:
    - User, Session, Message, Event (أنواع البيانات الأساسية)
    - FacebookMessage, FacebookPayload (أنواع Facebook)
    - CommandContext, PluginContext (سياقات التنفيذ)

✦ Error Hierarchy:
    - VoidError (Base)
    - FacebookError, SessionError, AuthError
    - ValidationError, ConfigError, PluginError

✦ DI Container مُهيَّأ ومُوثَّق

✦ Application Bootstrap:
    - index.ts — نقطة الدخول
    - Config Loader — يُحمَّل ويُتحقق منه أول شيء
    - Graceful Shutdown Handler
```

### معايير الإنجاز

- [ ] جميع Interfaces موجودة في Core ولا تحتوي على أي implementation
- [ ] DI Container يُحقن بنجاح ويُحلّ التبعيات الدائرية
- [ ] Config Loader يفشل بوضوح عند غياب أي متغير إلزامي
- [ ] Graceful Shutdown يُنهي الاتصالات المفتوحة قبل الإغلاق
- [ ] `pnpm run typecheck` يمر بصفر أخطاء
- [ ] اختبارات وحدة للـ Error Hierarchy
- [ ] لا import من خارج Core داخل Core

### المتطلبات السابقة

- المرحلة 0 مكتملة بجميع معاييرها

---

## 5. المرحلة 2 — Facebook Layer

> **الأولوية:** P0 — حرجة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء الطبقة الوحيدة في النظام التي تتحدث مع Facebook API. هذه الطبقة هي بوابة كل شيء — إرسال الرسائل، استقبال الأحداث، التحقق من التوقيع، وإدارة الاتصال. خطأ هنا يعني انقطاع البوت عن العالم كلياً.

### المخرجات

```
✦ Facebook Webhook Handler:
    - استقبال POST /webhook من Facebook
    - التحقق من X-Hub-Signature-256
    - رفض كل طلب لا يجتاز التحقق فوراً
    - تحليل الـ Payload وتصنيفه

✦ Facebook Client (يُطبّق IFacebookClient):
    - sendTextMessage(recipientId, text)
    - sendQuickReplies(recipientId, text, replies)
    - sendButtonTemplate(recipientId, text, buttons)
    - sendGenericTemplate(recipientId, elements)
    - sendImage(recipientId, imageUrl)
    - setTypingIndicator(recipientId, isTyping)
    - getUserProfile(userId) → UserProfile
    - markMessageSeen(recipientId)

✦ Facebook Event Normalizer:
    - تحويل Facebook Payload الخام إلى Domain Events
    - تصنيف الأحداث: message, postback, delivery, read, typing

✦ Connection Manager:
    - إدارة حالة الاتصال بـ Facebook
    - Retry Logic عند فشل الطلبات
    - Rate Limit Handling
    - Circuit Breaker للحماية من الفشل المتكرر

✦ Webhook Verification (GET /webhook):
    - التحقق من verify_token عند تسجيل Webhook جديد
```

### معايير الإنجاز

- [ ] Webhook يستقبل أحداث Facebook الحقيقية ويُحللها
- [ ] كل طلب بتوقيع خاطئ يُرفَض بـ 403
- [ ] إرسال رسالة نصية يعمل ويصل للمستخدم
- [ ] إرسال Button Template يعمل ويُعرض بشكل صحيح
- [ ] فشل Facebook API يُعالَج ويُسجَّل دون crash
- [ ] Rate Limit من Facebook يُؤجَّل تلقائياً ويُعاد المحاولة
- [ ] لا معلومة عن Facebook تتسرب خارج هذه الطبقة
- [ ] اختبارات وحدة بـ Mock لـ Facebook API

### المتطلبات السابقة

- المرحلة 1 مكتملة بجميع معاييرها
- Facebook App مُنشأة ومُهيَّأة
- `FACEBOOK_PAGE_ACCESS_TOKEN` و `FACEBOOK_APP_SECRET` متاحان

---

## 6. المرحلة 3 — Authentication

> **الأولوية:** P0 — حرجة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء طبقة التحقق من هوية المستخدمين. في سياق Facebook Messenger، "Authentication" يعني التحقق من أن الطلبات تأتي فعلاً من Facebook وأن المستخدم المُعرَّف له وجود حقيقي في النظام. هذه الطبقة تحمي كل ما يأتي بعدها.

### المخرجات

```
✦ Signature Verification Middleware:
    - التحقق من HMAC-SHA256 لكل طلب وارد
    - رفض الطلبات غير الموقَّعة فوراً
    - تسجيل محاولات التحايل

✦ User Identity Resolver:
    - استخراج sender_id من Facebook Payload
    - البحث عن المستخدم في قاعدة البيانات
    - إنشاء مستخدم جديد إذا لم يُوجد (auto-registration)
    - إضافة User Profile لـ Context

✦ Authorization Layer:
    - تحديد صلاحيات كل مستخدم
    - دعم أدوار أساسية: user, admin, blocked
    - فحص الحظر قبل معالجة أي طلب

✦ Facebook User Profile Fetcher:
    - جلب اسم المستخدم وصورته من Facebook Graph API
    - تخزين المعلومات في قاعدة البيانات
    - تحديث دوري للمعلومات

✦ Blocked User Handler:
    - رفض طلبات المستخدمين المحظورين بصمت
    - تسجيل محاولات المحظورين
```

### معايير الإنجاز

- [ ] كل طلب بدون توقيع صحيح يُرفَض — بدون استثناء
- [ ] مستخدم جديد يُنشأ تلقائياً عند أول رسالة
- [ ] مستخدم محظور لا يصل إلى معالجة Commands
- [ ] User Profile يُجلَب من Facebook ويُخزَّن
- [ ] لا user_id يتسرب من Facebook إلى طبقات لا تحتاجه
- [ ] اختبارات: توقيع صحيح، توقيع خاطئ، مستخدم جديد، مستخدم محظور

### المتطلبات السابقة

- المرحلة 2 مكتملة بجميع معاييرها
- جدول `users` في قاعدة البيانات (من المرحلة 8 — يُؤجَّل Schema حتى تلك المرحلة)

> **ملاحظة:** يمكن تطوير Authentication بـ In-Memory Store مؤقت حتى اكتمال المرحلة 8.

---

## 7. المرحلة 4 — Conversation Session Management

> **الأولوية:** P0 — حرجة
> **الحالة:** ⏳ لم تبدأ

> **⚠️ ملاحظة مفهومية مهمة:** هذه المرحلة تُعرِّف **ConversationSession** — حالة المحادثة مع المستخدم (currentStep، data، TTL). هذا مختلف كلياً عن **FacebookSession** (AppState، Cookies، Tokens) الذي يُعرَّف في `11-session-management.md` ويُدار داخل Facebook Layer حصراً.

### الهدف

بناء نظام إدارة الجلسات — الذاكرة المؤقتة لكل محادثة. Session تحمل "أين نحن الآن" في تدفق المحادثة، بيانات مؤقتة، والحالة التي يحتاجها البوت ليكون محادثاً ذكياً لا ناسياً. بدون Sessions، كل رسالة تبدأ من الصفر.

### المخرجات

```
✦ Session Data Model:
    - sessionId (UUID)
    - userId
    - currentStep (أين المستخدم في التدفق)
    - data (بيانات مخصصة مرنة)
    - createdAt, updatedAt, expiresAt

✦ ConversationSessionService (يُطبّق IConversationSessionService):
    - getOrCreateSession(userId) → Session
    - updateSession(sessionId, data) → Session
    - deleteSession(sessionId) → void
    - expireSession(sessionId) → void
    - getSessionData<T>(sessionId, key) → T | null
    - setSessionData<T>(sessionId, key, value) → void

✦ Session Loader Middleware:
    - تحميل Session المستخدم وإضافتها للـ Context
    - إنشاء Session جديدة إذا لم تُوجد
    - تجديد وقت انتهاء الصلاحية عند كل نشاط

✦ Session Expiry Handler:
    - تنظيف Sessions منتهية الصلاحية
    - إطلاق Event عند انتهاء صلاحية Session
    - Configurable TTL

✦ Session Encryption:
    - تشفير محتوى Session قبل التخزين
    - فك التشفير عند الاسترجاع

✦ Session State Machine:
    - تعريف الانتقالات الصحيحة بين Steps
    - رفض الانتقالات غير الصحيحة
    - تسجيل كل انتقال
```

### معايير الإنجاز

- [ ] Session تُنشأ عند أول تواصل وتبقى عبر رسائل متعددة
- [ ] Session تنتهي تلقائياً بعد فترة الخمول المُحددة
- [ ] محتوى Session مُشفَّر في قاعدة البيانات
- [ ] انتقال غير صحيح في State Machine يُرفَض
- [ ] Session تحت عمليات متزامنة لا تُنتج حالة متعارضة
- [ ] اختبارات: إنشاء، تحديث، انتهاء صلاحية، تزامن

### المتطلبات السابقة

- المرحلة 3 مكتملة
- المرحلة 8 (Database) يجب أن يكون فيها جدول `sessions` على الأقل

---

## 8. المرحلة 5 — Event System

> **الأولوية:** P1 — عالية
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء العمود الفقري للتواصل الداخلي بين مكونات Void. EventDispatcher هو القلب الذي يضخ المعلومات بين الطبقات دون أن تعرف بعضها. بدون Event System سليم، المكونات ستتشابك وتُصبح غير قابلة للاختبار.

### المخرجات

```
✦ EventDispatcher (يُطبّق IEventBus):
    - emit(eventType, payload) → void
    - on(eventType, handler, options?) → Subscription
    - off(subscriptionId) → void
    - once(eventType, handler) → Subscription

✦ Priority Queue:
    - Critical Queue (Priority 0): أحداث النظام والأمان
    - Standard Queue (Priority 1-2): رسائل وجلسات
    - Low-Priority Queue (Priority 3-4): presence, typing, analytics

✦ Event Catalog (كتالوج الأنواع الرسمية):
    - facebook.message.received
    - facebook.message.delivered
    - facebook.message.read
    - facebook.typing.started / stopped
    - facebook.presence.online / offline
    - facebook.reaction.added / removed
    - system.connection.established / lost / restored
    - system.session.created / expired / invalidated / refreshed
    - system.plugin.loaded / disabled / failed

✦ Event Middleware Pipeline:
    - Rate Limit Middleware
    - Duplicate Detection Middleware
    - Security Check Middleware
    - Context Enrichment Middleware

✦ Dead Letter Queue:
    - أحداث فشلت معالجتها تُحفَظ هنا
    - Retry Logic قابل للتكوين
    - تنبيه عند تراكم الأخطاء

✦ EventContext Builder:
    - إثراء كل حدث بـ: eventId, timestamps, source, correlationId
```

### معايير الإنجاز

- [ ] emit() لا يتوقف حتى لو جميع الـ Handlers فشلوا
- [ ] الأحداث ذات الأولوية العالية تُعالَج قبل المنخفضة
- [ ] Handler يفشل لا يوقف delivery للـ Handlers الأخرى
- [ ] لا event يُعالَج مرتين (deduplication)
- [ ] Subscription تُلغى تلقائياً عند إيقاف Plugin
- [ ] الـ Dead Letter Queue يُسجَّل ويُراقَب
- [ ] اختبارات: priority ordering, handler isolation, cancellation

### المتطلبات السابقة

- المرحلة 1 (Core Interfaces) مكتملة
- المرحلة 2 (Facebook Layer) مكتملة — لأن Facebook events هي المصدر الرئيسي

---

## 9. المرحلة 6 — Command System

> **الأولوية:** P1 — عالية
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء نظام Commands — الطريقة التي يتفاعل بها المستخدم مع البوت. Command هو ربط بين نمط رسالة (نص، Postback، Quick Reply) وكود معالجة. نظام Commands القوي يجعل إضافة سلوكيات جديدة للبوت بسيطةً وآمنة.

### المخرجات

```
✦ Command Router:
    - تحليل الرسائل الواردة وإيجاد Command المناسب
    - دعم أنماط متعددة: نص exact، regex، postback، quick_reply
    - Fallback Command عندما لا يُطابق أي Pattern
    - Priority-based Command matching

✦ Command Registry (يُطبّق ICommandRegistry):
    - register(command) → void
    - unregister(commandName) → void
    - findMatch(message) → Command | null
    - listAll() → Command[]

✦ Command Context:
    - رسالة المستخدم الكاملة
    - User و Session المُحمَّلان
    - دوال مساعدة: reply(), sendButtons(), sendQuickReplies()
    - IFacebookClient مُحقَن

✦ Built-in Commands:
    - StartCommand: /start أو أول رسالة
    - HelpCommand: /help أو "مساعدة"
    - FallbackCommand: لأي رسالة لا تُطابق Command آخر

✦ Command Middleware:
    - Authorization Check (هل المستخدم مصرح له؟)
    - Rate Limiting per Command
    - Input Sanitization

✦ Command Pipeline:
    - Pre-Middleware → Matching → Handler → Post-Middleware
```

### معايير الإنجاز

- [ ] رسالة "/start" تُطلق StartCommand بشكل صحيح
- [ ] رسالة لا تُطابق أي Command تُطلق FallbackCommand
- [ ] Command Handler يرد بنجاح عبر الـ Context
- [ ] مستخدم غير مصرح له يُرفَض قبل وصوله للـ Handler
- [ ] Command Registration والـ Unregistration يعملان في runtime
- [ ] اختبارات: matching logic, authorization, fallback, context helpers

### المتطلبات السابقة

- المرحلة 4 (Session Management) مكتملة — Context يحتاج Session
- المرحلة 5 (Event System) مكتملة — Command results تُطلق Events

---

## 10. المرحلة 7 — Plugin System

> **الأولوية:** P1 — عالية
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء نظام Plugins — الآلية التي تجعل Void قابلاً للتوسع بدون تعديل Core. Plugin هي وحدة مستقلة تُضيف Commands، تستمع لـ Events، وتُجري منطقها الخاص — كلها خلف عقد موحّد. النظام الجيد يجعل كل ميزة اختيارية قابلة للتضمين كـ Plugin.

### المخرجات

```
✦ Plugin Registry (يُطبّق IPluginRegistry):
    - register(plugin) → void
    - unregister(pluginId) → void
    - enable(pluginId) → void
    - disable(pluginId) → void
    - getPlugin(pluginId) → Plugin | null
    - listAll() → Plugin[]

✦ Plugin Lifecycle Manager:
    - initialize() → استدعاء plugin.init() بترتيب التبعيات
    - shutdown() → استدعاء plugin.destroy() بترتيب عكسي
    - Timeout للـ init() والـ destroy()
    - Error Isolation — فشل Plugin لا يوقف بقية الـ Plugins

✦ Plugin Context:
    - الـ Services والـ Interfaces المُصرَّح بها فقط
    - registerCommand() — تسجيل Commands
    - subscribeToEvent() — الاشتراك في Events
    - emitEvent() — إطلاق Events (بـ namespace)
    - logger — للتسجيل

✦ Plugin Manifest:
    - pluginId (unique)
    - version
    - permissions (ما يُسمح للـ Plugin بالوصول إليه)
    - supportedEvents (الأحداث التي يمكنه إطلاقها)
    - dependencies (Plugins أخرى يعتمد عليها)

✦ Plugin Sandbox:
    - تقييد وصول Plugin للـ Interfaces المُصرَّح بها فقط
    - رفض أي محاولة للوصول للـ Core مباشرة
    - Namespace isolation للـ Events

✦ Example Plugins (للتحقق من النظام):
    - EchoPlugin: يُعيد كل رسالة
    - PingPlugin: يرد بـ "pong" على "ping"
```

### معايير الإنجاز

- [ ] Plugin تُسجَّل وتُفعَّل وتُعطَّل في runtime
- [ ] فشل Plugin أثناء init() لا يمنع تحميل بقية الـ Plugins
- [ ] Plugin لا تستطيع الوصول لـ Interface لم يُصرَّح بها
- [ ] Events من Plugin لها namespace صحيح تلقائياً
- [ ] Subscriptions تُلغى تلقائياً عند تعطيل Plugin
- [ ] EchoPlugin و PingPlugin يعملان بشكل كامل
- [ ] اختبارات: lifecycle, isolation, permission enforcement

### المتطلبات السابقة

- المرحلة 5 (Event System) مكتملة — Plugins تعتمد على Events
- المرحلة 6 (Command System) مكتملة — Plugins تُسجّل Commands

---

## 11. المرحلة 8 — Database Layer

> **الأولوية:** P0 — حرجة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء طبقة التخزين الدائم — المكان الوحيد في النظام الذي يتحدث مع قاعدة البيانات. Repository Pattern يضمن أن بقية النظام لا تعرف شيئاً عن PostgreSQL أو Drizzle — يعرفون فقط Domain Models نظيفة.

### المخرجات

```
✦ Database Schema (Drizzle):
    - users: id, facebookId, name, profilePicture, role, createdAt
    - sessions: id, userId, currentStep, data (encrypted), expiresAt, updatedAt
    - message_logs: id, userId, direction, content, timestamp
    - plugin_state: id, pluginId, userId, key, value, updatedAt
    - scheduled_jobs: id, type, payload, scheduledAt, status, attempts

✦ Repositories (يُطبّقون Interfaces من Core):
    - UserRepository: findById, findByFacebookId, create, update, delete
    - SessionRepository: findByUserId, create, update, delete, deleteExpired
    - MessageLogRepository: create, findByUserId, countByUserId
    - PluginStateRepository: get, set, delete, deleteByPlugin
    - ScheduledJobRepository: create, findDue, markComplete, markFailed

✦ Database Connection Manager:
    - Connection Pool مُهيَّأ ومُراقَب
    - Health Check لقاعدة البيانات
    - Retry Logic عند فقدان الاتصال
    - Graceful shutdown (تنهي الـ queries الجارية)

✦ Migration System:
    - Drizzle Migration Scripts
    - Up و Down Migrations لكل تغيير
    - Migration History مُتتبَّع في قاعدة البيانات

✦ Transaction Support:
    - withTransaction() helper للـ Services
    - Nested Transaction handling
```

### معايير الإنجاز

- [ ] جميع Migrations تعمل Up وDown بنجاح
- [ ] كل Repository يُعيد Domain Models نظيفة — لا Drizzle objects
- [ ] Connection Pool يتعامل مع 50 اتصال متزامن
- [ ] فقدان الاتصال بـ DB يُسجَّل ويُعاد الاتصال تلقائياً
- [ ] لا SQL تتسرب خارج طبقة Repositories
- [ ] اختبارات Integration بـ PostgreSQL حقيقي (Test Container)
- [ ] Migration تعمل على نسخة من بيانات الإنتاج (Staging)

### المتطلبات السابقة

- المرحلة 1 (Core Interfaces) مكتملة
- PostgreSQL متاح (محلياً أو عبر Docker)

> **ملاحظة:** يمكن تطوير هذه المرحلة بالتوازي مع المراحل 2-5 باستخدام In-Memory implementations مؤقتاً.

---

## 12. المرحلة 9 — Cache Layer

> **الأولوية:** P2 — متوسطة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء طبقة التخزين المؤقت التي تُقلل الضغط على قاعدة البيانات وتُسرّع الاستجابة. Cache في Void يتبع Cache-Aside Pattern — البيانات تُجلَب من DB وتُخزَّن في Cache، ولا تذهب DB مباشرة للـ Cache أبداً.

### المخرجات

```
✦ Cache Client (يُطبّق ICacheClient):
    - get<T>(key) → T | null
    - set<T>(key, value, ttl?) → void
    - delete(key) → void
    - exists(key) → boolean
    - flush(pattern?) → void

✦ Cache Strategies:
    - User Profile Cache: TTL = 1 ساعة
    - Session Cache: TTL = Session Expiry
    - Rate Limit Counters: TTL = Window Size
    - Facebook API Response Cache: TTL = 5 دقائق

✦ Cache Key Conventions:
    - user:{userId}:profile
    - session:{userId}:current
    - rate:{userId}:{commandName}:{window}
    - fb:user:{facebookId}:profile

✦ Cache Invalidation:
    - عند تحديث User → يُلغى user cache
    - عند تعديل Session → يُلغى session cache
    - Cache Stampede Protection (singleflight pattern)

✦ Redis Integration:
    - Redis Client مُهيَّأ ومُراقَب
    - Connection Pool
    - Health Check
    - Fallback لـ In-Memory عند غياب Redis (للتطوير)
```

### معايير الإنجاز

- [ ] User Profile يُجلَب من Cache في الطلب الثاني — لا DB
- [ ] Cache Invalidation يعمل فور التحديث
- [ ] غياب Redis يُفعّل In-Memory Fallback دون crash
- [ ] Cache Keys تتبع الاتفاقية المُحددة بدون استثناء
- [ ] اختبارات: cache hit, cache miss, invalidation, ttl expiry

### المتطلبات السابقة

- المرحلة 8 (Database) مكتملة — Cache يجلس فوق DB
- Redis متاح (محلياً أو عبر Docker)

---

## 13. المرحلة 10 — Scheduler

> **الأولوية:** P2 — متوسطة
> **الحالة:** ⏳ لم تبدأ

### الهدف

بناء نظام المهام المجدولة — القدرة على تنفيذ عمل في المستقبل دون تدخل المستخدم. Scheduler يُمكّن البوت من إرسال تذكيرات، تنظيف البيانات، ومزامنة المعلومات في أوقات محددة.

### المخرجات

```
✦ Scheduler (يُطبّق IScheduler):
    - scheduleOnce(jobType, payload, at) → JobId
    - schedulePeriodic(jobType, payload, cron) → JobId
    - cancelJob(jobId) → void
    - getJobStatus(jobId) → JobStatus

✦ Job Types:
    - SESSION_CLEANUP: تنظيف Sessions منتهية الصلاحية (كل ساعة)
    - USER_REMINDER: إرسال تذكير لمستخدم في وقت محدد
    - PLUGIN_JOB: مهام مُجدوَلة من Plugins
    - STATS_AGGREGATION: تجميع إحصاءات (كل يوم)

✦ Job Queue:
    - تخزين المهام في قاعدة البيانات (scheduled_jobs table)
    - Polling للمهام الحانة (كل 30 ثانية)
    - Retry Logic: 3 محاولات مع Exponential Backoff
    - Dead Letter Queue للمهام التي فشلت 3 مرات

✦ Job Executor:
    - تنفيذ كل Job في Isolation
    - Timeout لكل Job
    - Error Handling لا يوقف بقية المهام
    - تسجيل نتيجة كل تنفيذ

✦ Cron Support:
    - دعم Cron Expressions القياسية
    - التحقق من صحة الـ Expression قبل التسجيل
```

### معايير الإنجاز

- [ ] مهمة مُجدوَلة تُنفَّذ في الوقت المحدد (± 30 ثانية)
- [ ] مهمة فاشلة تُعاد 3 مرات ثم تُرسَل للـ Dead Letter Queue
- [ ] إعادة تشغيل الـ Server تُنفَّذ المهام الفائتة
- [ ] SESSION_CLEANUP تعمل وتُنظّف Sessions قديمة
- [ ] Timeout لكل Job — لا مهمة تعمل إلى الأبد
- [ ] اختبارات: scheduling, retry, timeout, periodic jobs

### المتطلبات السابقة

- المرحلة 8 (Database) مكتملة — Jobs تُخزَّن في DB
- المرحلة 5 (Event System) مكتملة — Jobs تُطلق Events عند اكتمالها

---

## 14. المرحلة 11 — Production Release

> **الأولوية:** P1 — عالية
> **الحالة:** ⏳ لم تبدأ

### الهدف

جعل Void جاهزاً للإنتاج — ليس فقط "يعمل" بل "يعمل بشكل موثوق ويمكن مراقبته وصيانته في بيئة حقيقية". هذه المرحلة تُحوّل الكود الجيد إلى منتج ناضج.

### المخرجات

```
✦ Observability Stack:
    - Structured Logging (pino) على كل طبقة
    - Metrics: latency p50/p95/p99, error rates, throughput
    - Health Endpoints:
        GET /healthz         ← صحة عامة
        GET /healthz/live    ← هل الـ Process حي؟
        GET /healthz/ready   ← هل جاهز لاستقبال طلبات؟
    - Alerting على: error rate > 5%, Facebook disconnection

✦ Production Configuration:
    - Helmet.js (Security Headers)
    - Compression Middleware
    - Request Size Limits
    - CORS مُهيَّأ بدقة (Webhook من Facebook فقط)

✦ Operational Tools:
    - Graceful Shutdown مُعزَّز (drain in-flight requests)
    - Admin Endpoints (محمية): قائمة Plugins، إحصاءات Sessions
    - Database Connection Pool Monitoring

✦ Security Hardening:
    - Rate Limiting على جميع Endpoints
    - IP-based blocking للطلبات المشبوهة
    - Audit Logging للعمليات الحساسة
    - Environment Variables Validation عند Startup

✦ Deployment Package:
    - Dockerfile للإنتاج (multi-stage build)
    - docker-compose.yml للتطوير المحلي
    - Environment Variables موثّقة بالكامل

✦ Release Infrastructure:
    - GitHub Actions CI/CD Pipeline
    - Automated Tests في CI
    - Automated Release Tagging
    - CHANGELOG Generation
```

### معايير الإنجاز

- [ ] 24 ساعة في Staging بدون crash
- [ ] معدل الأخطاء أقل من 0.1% في Staging
- [ ] Graceful Shutdown ينهي جميع الطلبات الجارية خلال 30 ثانية
- [ ] /healthz يستجيب في أقل من 50ms
- [ ] Facebook reconnection تعمل تلقائياً عند انقطاع الاتصال
- [ ] جميع Secrets في Environment Variables — لا شيء في الكود
- [ ] CI Pipeline يمنع merge الكود إذا فشل أي اختبار

### المتطلبات السابقة

- جميع المراحل من 0 إلى 10 مكتملة بمعاييرها

---

## 15. المرحلة 12 — Future Features

> **الأولوية:** P3 — منخفضة
> **الحالة:** ⏳ مُخطَّطة

### الهدف

ما بعد الإصدار الأول — الميزات التي تجعل Void أقوى، أوسع، وأكثر قيمة. هذه الميزات لن تبدأ قبل اكتمال المرحلة 11 وقبل أن يكون المشروع مستقراً في الإنتاج.

### 12.1 Multi-Account Support

```
الهدف: تشغيل أكثر من Facebook Page في نفس الوقت

المخرجات:
  - Account Isolation: كل Page لها Sessions وUsers مستقلون
  - Account-scoped Events: الأحداث لا تتسرب بين Accounts
  - Account Manager: إضافة وإزالة وتعطيل Accounts في runtime
  - Account-aware Plugins: Plugin يمكنها العمل على account محدد

معايير الإنجاز:
  - Page A وPage B يعملان بالتوازي بدون تداخل
  - Session لـ User في Page A لا تُرى من Page B
```

### 12.2 Rich Media Support

```
الهدف: دعم أنواع الرسائل الغنية المتقدمة

المخرجات:
  - Persistent Menu: قائمة ثابتة في واجهة Messenger
  - Carousel Templates: عرض عناصر متعددة للاختيار
  - Receipt Templates: إيصالات تسوق منسقة
  - Media Messages: إرسال صور، فيديو، صوت
  - Webview: فتح صفحة ويب داخل Messenger
```

### 12.3 Analytics & Reporting

```
الهدف: فهم كيف يتفاعل المستخدمون مع البوت

المخرجات:
  - Message Volume: كم رسالة يومياً / أسبوعياً
  - Command Usage: أي Commands الأكثر استخداماً
  - Session Analytics: متوسط طول المحادثة، نقاط التوقف
  - User Retention: المستخدمون العائدون مقابل الجدد
  - Error Analytics: أكثر الأخطاء تكراراً
  - Dashboard API: Endpoints لعرض هذه الإحصاءات
```

### 12.4 NLP Integration

```
الهدف: فهم لغة طبيعية بدلاً من Pattern Matching فقط

المخرجات:
  - NLP Middleware: يُحلّل الرسائل ويُضيف Intent وEntities للـ Context
  - Intent-based Command Matching: بدلاً من regex فقط
  - Language Detection: تحديد لغة المستخدم
  - Sentiment Analysis: لاكتشاف الإحباط والمساعدة الاستباقية
  - Abstraction Layer: يدعم أكثر من NLP Provider (Wit.ai, Dialogflow)
```

### 12.5 Flow Builder

```
الهدف: تعريف تدفقات محادثة معقدة بأسلوب declarative

المخرجات:
  - Flow DSL: طريقة تعريف تدفق محادثة بـ TypeScript بسيط
  - Flow Engine: يُنفّذ الـ Flow ويتتبع موضع المستخدم فيه
  - Conditional Branching: تفرعات بناءً على بيانات المستخدم
  - Flow Analytics: أين يتوقف المستخدمون في التدفق
  - Flow Validation: كشف مسارات ميتة قبل التشغيل
```

### 12.6 Plugin Marketplace Foundation

```
الهدف: البنية التحتية لمشاركة وتوزيع Plugins

المخرجات:
  - Plugin Manifest Standard: صيغة موحدة لتعريف Plugins
  - Plugin Validator: التحقق من سلامة Plugin قبل تثبيتها
  - Plugin Loader من NPM Package
  - Plugin Versioning: إدارة إصدارات Plugins وتوافقها
  - Plugin Documentation Standards: ما يجب أن يوثّق كل Plugin
```

### 12.7 Testing Utilities

```
الهدف: تسهيل كتابة اختبارات للـ Commands والـ Plugins

المخرجات:
  - MessageSimulator: إرسال رسائل وهمية لاختبار Handlers
  - MockFacebookClient: Client وهمي للاختبار
  - TestContext Builder: إنشاء Command Context للاختبار
  - Session Test Helpers: إنشاء وتعديل Sessions في الاختبارات
  - Assertion Helpers: `expectMessageSent()`, `expectButtonsSent()`
```

---

## 16. مصفوفة التبعيات

```
المرحلة 0 (Foundation)
    ↓
المرحلة 1 (Core Framework)
    ↓
المرحلة 2 (Facebook Layer) ←──────────────────────────┐
    ↓                                                    │
المرحلة 3 (Authentication)    المرحلة 8 (Database) ────┘
    ↓                               ↓
المرحلة 4 (Session Management) ←───┘
    ↓
المرحلة 5 (Event System)
    ↓
المرحلة 6 (Command System)
    ↓
المرحلة 7 (Plugin System)
    ↓
المرحلة 9 (Cache Layer)
    ↓
المرحلة 10 (Scheduler)
    ↓
المرحلة 11 (Production Release)
    ↓
المرحلة 12 (Future Features)
```

**مراحل يمكن تطويرها بالتوازي:**
- المرحلة 8 (Database) يمكن تطويرها بالتوازي مع 2-5
- المرحلة 9 (Cache) يمكن تطويرها بالتوازي مع 7
- المرحلة 10 (Scheduler) يمكن تطويرها بالتوازي مع 9

---

## 17. مؤشرات النجاح الكلية

### عند اكتمال المرحلة 6 (Command System)

```
الحد الأدنى الوظيفي — البوت يعمل:
  ✦ يستقبل رسائل Facebook
  ✦ يعرف من يتحدث إليه (Authentication)
  ✦ يتذكر سياق المحادثة (Session)
  ✦ يعالج Commands بشكل صحيح
  ✦ يرد برسائل غنية
```

### عند اكتمال المرحلة 10 (Scheduler)

```
البوت الناضج — جميع القدرات الأساسية:
  ✦ كل ما سبق +
  ✦ Plugins قابلة للتوسع
  ✦ بيانات محفوظة ومؤمّنة
  ✦ أداء محسَّن بـ Cache
  ✦ مهام مجدولة تعمل باستقلالية
```

### عند اكتمال المرحلة 11 (Production)

```
المنتج الجاهز للعالم الحقيقي:
  ✦ كل ما سبق +
  ✦ مراقبة كاملة
  ✦ قابلية الصيانة
  ✦ أمان حقيقي
  ✦ استمرارية في الإنتاج
```

### المقاييس التقنية المستهدفة عند الإنتاج

| المقياس | الهدف |
|---|---|
| وقت معالجة الرسالة (p50) | < 200ms |
| وقت معالجة الرسالة (p99) | < 1000ms |
| معدل نجاح إرسال الرسائل | > 99.5% |
| وقت تعافي الاتصال بـ Facebook | < 30 ثانية |
| Uptime الشهري | > 99.9% |
| تغطية الاختبارات الكلية | > 80% |
| وقت Cold Start | < 5 ثوانٍ |

---

*هذا الملف هو المرجع الرسمي لخطة تطوير Void. يُحدَّث عند اكتمال كل مرحلة ليعكس الحالة الفعلية — لا الحالة المأمولة. الخارطة الصادقة أكثر قيمة من الخارطة المتفائلة. كل مرحلة تُشحَن مكتملة أو لا تُشحَن.*

*آخر تحديث: 2026-07-03*
