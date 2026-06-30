# 03 — Layer Responsibilities

> **المرجع الرسمي لمسؤوليات طبقات مشروع Void**
> يُستخدم هذا الملف لتحديد المكان الصحيح لأي كود جديد قبل كتابته.
> أي تداخل في المسؤوليات بين الطبقات يُعدّ انتهاكًا معماريًا يجب تصحيحه.

---

## Table of Contents

1. [Core Layer](#1-core-layer)
2. [Facebook Layer](#2-facebook-layer)
3. [Services Layer](#3-services-layer)
4. [Commands Layer](#4-commands-layer)
5. [Plugins Layer](#5-plugins-layer)
6. [Events Layer](#6-events-layer)
7. [Middleware Layer](#7-middleware-layer)
8. [Managers Layer](#8-managers-layer)
9. [Database Layer](#9-database-layer)
10. [Cache Layer](#10-cache-layer)
11. [Scheduler Layer](#11-scheduler-layer)
12. [Utils Layer](#12-utils-layer)
13. [Configs Layer](#13-configs-layer)
14. [Layer Boundary Violations](#14-layer-boundary-violations)
15. [Responsibility Decision Guide](#15-responsibility-decision-guide)

---

## 1. Core Layer

### Purpose
Core هو المركز الجوهري للمشروع. يحتوي على التجريدات والعقود والنماذج التي يعتمد عليها النظام بأكمله. هو الطبقة الوحيدة التي لا تعتمد على أي طبقة أخرى — كل الطبقات الأخرى تعتمد عليه أو تُطبّق عقوده.

Core لا يحتوي Business Logic. لا يعرف كيف تُرسَل الرسائل. لا يعرف كيف تُخزَّن البيانات. يعرف فقط ما هي الأشياء الموجودة وكيف تبدو.

### Primary Responsibilities
- تعريف جميع Interfaces التي تُستخدم كحدود بين الطبقات.
- تعريف Domain Models وهياكل البيانات الأساسية التي تتدفق عبر النظام.
- تعريف Enums والـ Constants على مستوى النظام.
- تعريف أنواع الأحداث الداخلية (Internal Event Types).
- تعريف أنواع الأخطاء المخصصة (Custom Error Types).

### Secondary Responsibilities
- توفير Type Utilities مشتركة تحتاجها طبقات متعددة.
- توفير Value Objects بسيطة تعبّر عن مفاهيم النطاق.

### What This Layer Owns
- جميع `interface I*` المستخدمة كحدود.
- جميع `type` و `interface` التي تُعبّر عن Domain Concepts.
- جميع `enum` الخاصة بأنواع الأحداث والحالات.
- جميع `class Error` المخصصة.
- الـ Constants العالمية على مستوى النظام.

### What This Layer Must Never Do
- لا تنفيذ Business Logic من أي نوع.
- لا استدعاء Facebook API أو أي API خارجي.
- لا تفاعل مع قاعدة البيانات أو الـ Cache.
- لا اعتماد على أي Dependency خارجية (npm packages) باستثناء أدوات الأنواع البحتة.
- لا معرفة بوجود Express أو أي Framework.
- لا حالة قابلة للتغيير (Mutable State) على مستوى الـ Module.

### Allowed Dependencies
- لا شيء — Core لا يعتمد على أي طبقة داخلية.
- يمكن الاعتماد على مكتبات الأنواع البحتة التي لا تُنفَّذ في Runtime.

### Forbidden Dependencies
- أي طبقة أخرى في المشروع.
- أي مكتبة تتطلب Runtime execution (Express, Drizzle, Redis, إلخ).

### Public Interfaces
- `IUserRepository` — عقد الوصول لبيانات المستخدمين.
- `ISessionRepository` — عقد الوصول لبيانات الجلسات.
- `IFacebookClient` — عقد التواصل مع Facebook API.
- `ILogger` — عقد التسجيل.
- `ICacheClient` — عقد التخزين المؤقت.
- `IEventBus` — عقد نظام الأحداث.
- `IService` (Base) — العقد الأساسي للـ Services.

### Internal Components
- `types/` — Domain Models وهياكل البيانات.
- `interfaces/` — جميع الـ Interfaces.
- `enums/` — الـ Enums والـ Constants.
- `errors/` — Custom Error Classes.

### Communication Rules
- Core لا يتواصل مع أي طبقة — هو المرجع الذي تتواصل معه كل الطبقات الأخرى.
- التواصل معه يكون بالاستيراد فقط، لا بالاستدعاء.

### Common Mistakes
- وضع Business Logic داخل Domain Models ("Fat Models").
- وضع Helper Functions التي تعتمد على Framework داخل Core.
- إضافة مكتبات خارجية كـ Dependencies في Core.
- وضع Default Implementations داخل Interfaces.

### Best Practices
- Interfaces تبقى صغيرة ومتخصصة — Interface كبير يُشير لمشكلة في التصميم.
- Domain Models تحمل البيانات فقط — لا دوال تحتوي منطقًا.
- كل نوع جديد يُفكَّر فيه ملياً قبل الإضافة — Core يجب أن يبقى مستقرًا.
- الأسماء في Core تُعبّر عن مفاهيم النطاق، لا عن تفاصيل التنفيذ.

### Examples of Correct Responsibilities
- ✅ تعريف `interface IUserRepository { findById(id: string): Promise<User | null> }`
- ✅ تعريف `type MessengerEvent = { senderId: string; type: EventType; payload: unknown }`
- ✅ تعريف `class VoidError extends Error { constructor(public code: ErrorCode, message: string) }`
- ✅ تعريف `enum EventType { Message = 'message', Postback = 'postback' }`

### Examples of Incorrect Responsibilities
- ❌ `class User { save() { db.query('INSERT ...') } }` — Business Logic داخل Model.
- ❌ `interface IUserRepository { sendWelcomeMessage() }` — مسؤولية خارج نطاق Repository.
- ❌ `import axios from 'axios'` داخل Core — اعتماد على مكتبة Runtime.

---

## 2. Facebook Layer

### Purpose
Facebook Layer هي الحاجز الوقائي بين النظام الداخلي وتفاصيل Facebook Messenger API. أي شيء يتعلق بـ Facebook API — وارد أو صادر — يمر عبر هذه الطبقة حصرًا. باقي النظام لا يعرف شيئًا عن تفاصيل Facebook API.

هذا العزل يضمن أن أي تغيير في Facebook API يستلزم تعديل هذه الطبقة فقط، دون أن يمسّ الطبقات الداخلية.

### Primary Responsibilities
- التحقق من صحة Webhook requests عبر `X-Hub-Signature-256`.
- تحليل (Parsing) Webhook Payloads الخام إلى Domain Models داخلية.
- تحويل (Mapping) أنواع أحداث Facebook إلى Internal Event Types.
- إرسال جميع أنواع الرسائل لـ Facebook Send API.
- معالجة أخطاء Facebook API والـ Rate Limits.

### Secondary Responsibilities
- تطبيق Retry Logic للطلبات الفاشلة لأسباب مؤقتة.
- تجميع (Batching) الطلبات حين يكون ذلك ممكنًا وفعّالًا.
- تحويل Internal Response Format إلى Facebook API Format.

### What This Layer Owns
- منطق التحقق من توقيع Webhook.
- منطق تحليل Payloads الخام.
- منطق بناء جميع أنواع رسائل Facebook (Text، Button Template، Generic Template، إلخ).
- إدارة HTTP Client المستخدم للتواصل مع Facebook.
- معرفة URL نقاط نهاية Facebook API.

### What This Layer Must Never Do
- لا Business Logic — لا قرارات تتعلق بمحتوى الرد أو ما يُرسَل.
- لا استدعاء مباشر للـ Services.
- لا معرفة عميقة بـ Session أو User Profile خارج ما تحتاجه لإرسال الرسالة.
- لا وصول مباشر لقاعدة البيانات.
- لا معرفة بوجود Commands أو Plugins.

### Allowed Dependencies
- Core Layer — للـ Interfaces وDomain Types.
- HTTP Client Library (مثل Axios أو fetch).
- Crypto utilities للتحقق من التوقيع.

### Forbidden Dependencies
- Services Layer — Facebook Layer لا تستدعي Services.
- Database Layer — لا وصول مباشر لقاعدة البيانات.
- Commands / Plugins.
- Managers (إلا عبر Interfaces معرّفة في Core).

### Public Interfaces
- `IFacebookClient` (معرّفة في Core، مُطبَّقة هنا) — واجهة إرسال الرسائل.
- `WebhookParser` — تحليل Payloads الواردة.
- `SignatureVerifier` — التحقق من التوقيع.

### Internal Components
- `webhook/` — منطق استقبال وتحليل Events الواردة.
- `sender/` — منطق إرسال الرسائل الصادرة بجميع أنواعها.
- `mappers/` — تحويل Facebook types لـ Internal types والعكس.
- `http-client/` — HTTP Client مُعدَّ للتواصل مع Facebook API.

### Communication Rules
- الاتجاه الوارد: تستقبل من Express → تُحوّل → تُسلّم لـ Router.
- الاتجاه الصادر: تستقبل طلبات الإرسال عبر `IFacebookClient` → تُرسل لـ Facebook API.
- لا تستدعي أحدًا مباشرة لاتخاذ قرار — فقط تُنفّذ ما تُطلب منه.

### Common Mistakes
- استدعاء Service مباشرة من داخل Payload Parser.
- بناء محتوى الرد (منطق القرار) داخل Facebook Layer.
- تسريب كائنات Facebook الخام (Raw Facebook Objects) للطبقات الداخلية بدلًا من تحويلها.
- وضع Business Logic في Message Builder.

### Best Practices
- كل نوع رسالة له Builder منفصل — لا دالة ضخمة تتعامل مع كل الأنواع.
- الأخطاء من Facebook API تُسجَّل وتُصنَّف قبل إعادة رميها.
- التحقق من التوقيع يكون أول شيء — قبل أي معالجة أخرى.
- Internal Domain Models فقط تخرج من هذه الطبقة — لا Raw Payloads.

### Examples of Correct Responsibilities
- ✅ `verifySignature(payload, signature)` — التحقق من الطلب.
- ✅ `parseWebhookPayload(raw)` → `MessengerEvent[]` — تحليل وتحويل.
- ✅ `sendTextMessage(recipientId, text)` — إرسال رسالة نصية.
- ✅ `sendButtonTemplate(recipientId, buttons)` — إرسال أزرار.

### Examples of Incorrect Responsibilities
- ❌ `if (user.isBlocked) return` داخل Facebook Layer — هذا Business Logic.
- ❌ `const user = await userRepo.findById(...)` داخل Message Sender — وصول مباشر للـ DB.
- ❌ تمرير `req.body` مباشرة للـ Service دون تحليل — تسريب Facebook details.

---

## 3. Services Layer

### Purpose
Services هي قلب البرنامج. المكان الوحيد في النظام الذي يحتوي Business Logic. كل قرار يتعلق بما يجب فعله، وكيف يُعالَج الطلب، وما هي القواعد التي تحكم التفاعل — يوجد هنا فقط.

Services لا تعرف كيف تصل الرسائل (Facebook أو غيرها). لا تعرف كيف تُخزَّن البيانات (PostgreSQL أو غيره). تعرف فقط **ماذا يجب أن يحدث**.

### Primary Responsibilities
- تنفيذ جميع Business Logic في المشروع.
- اتخاذ القرارات المتعلقة بسير العمل.
- تنسيق الاستعلامات والتحديثات عبر Repositories.
- التحقق من صحة الأعمال (Business Validation) — ليس فقط صحة الشكل.
- إطلاق Internal Events عند حدوث أشياء مهمة.

### Secondary Responsibilities
- تنسيق عمل Services متعددة عند الحاجة.
- إدارة Transactions بين عمليات قاعدة بيانات متعددة مترابطة.
- إعداد وتجهيز البيانات اللازمة للاستجابة.

### What This Layer Owns
- جميع قواعد الأعمال (Business Rules).
- منطق التحقق من الأعمال (Business Validation).
- قرارات التدفق (Flow Decisions): إذا حدث X فافعل Y.
- منطق الحسابات والتحويلات الخاصة بالنطاق.

### What This Layer Must Never Do
- لا استدعاء مباشر لـ Facebook API — يستخدم `IFacebookClient` Interface فقط.
- لا معرفة بوجود Express أو HTTP.
- لا معرفة بتفاصيل قاعدة البيانات (SQL، ORM specifics).
- لا بناء رسائل بتنسيق Facebook (Button Templates، Generic Templates).
- لا قراءة من `process.env` مباشرة.
- لا معرفة بوجود Commands أو Plugins بالاسم.

### Allowed Dependencies
- Core Layer — للـ Interfaces والـ Domain Types.
- Repository Interfaces (من Core) — للبيانات.
- Cache Interface (من Core) — للتخزين المؤقت.
- IFacebookClient Interface (من Core) — للإرسال دون معرفة التفاصيل.
- IEventBus Interface (من Core) — لإطلاق Events.
- ILogger Interface (من Core) — للتسجيل.
- Services أخرى عبر Interfaces.

### Forbidden Dependencies
- Facebook Layer مباشرة (فقط عبر Interface).
- Database Layer مباشرة (فقط عبر Repository Interfaces).
- Commands / Plugins.
- Express / HTTP Framework.

### Public Interfaces
- كل Service تُعرِّف Interface خاصًا بها في Core (`IUserService`، `ISessionService`، إلخ).

### Internal Components
- كل Service ملف مستقل بمسؤولية واحدة.
- لا Service ضخمة تجمع مسؤوليات متعددة.

### Communication Rules
- تستقبل البيانات من Command Handlers وPlugin Handlers.
- تُعيد نتائج نظيفة (Domain Models أو قيم بسيطة).
- تستخدم Repositories عبر Interfaces للبيانات.
- تُطلق Events عبر IEventBus عند الحاجة.
- لا تتواصل مع Facebook مباشرة — عبر IFacebookClient فقط.

### Common Mistakes
- استدعاء `facebookClient.sendMessage()` مباشرة لبناء رد — بدلًا من إعادة البيانات للـ Handler.
- وضع SQL queries داخل Service.
- وضع Validation للشكل (Schema Validation) داخل Service — هذا عمل Middleware.
- Service تعرف اسم Command الذي استدعاها.

### Best Practices
- اسم Service يعبّر عن النطاق: `UserService`، `SessionService`، `OrderService`.
- كل Method في Service لها مسؤولية واحدة.
- Business Validation تحدث داخل Service وترمي Typed Errors واضحة.
- Service لا تُعيد أشياء مُنسَّقة للعرض — تُعيد Domain Models.

### Examples of Correct Responsibilities
- ✅ `async getOrCreateUser(senderId: string): Promise<User>` — Business Logic.
- ✅ `async processCommand(userId, command): Promise<CommandResult>` — قرار العمل.
- ✅ `async checkEligibility(userId): Promise<boolean>` — Business Validation.

### Examples of Incorrect Responsibilities
- ❌ `buildButtonTemplate(title, buttons)` داخل Service — هذا عمل Facebook Layer.
- ❌ `db.query('SELECT * FROM users WHERE ...')` داخل Service — عمل Repository.
- ❌ `res.json({ status: 'ok' })` داخل Service — عمل HTTP Handler.

---

## 4. Commands Layer

### Purpose
Commands هي نقاط دخول منظمة تربط أنماطًا من رسائل المستخدمين بـ Handlers محددة. الـ Command يعرف ما يُطلقه (Pattern) ومن يُعالجه (Handler) — لكنه لا يعرف كيف يُنفَّذ العمل. يُفوّض دائمًا للـ Service.

### Primary Responsibilities
- تعريف Pattern الذي يُطلق Command (نص، Postback، Quick Reply).
- تعريف Handler الذي يُستدعى حين يتطابق Pattern.
- استخراج البيانات اللازمة من Context وتمريرها للـ Service.
- تنسيق الاستجابة النهائية بعد اكتمال Service.

### Secondary Responsibilities
- تعريف Middleware خاصة بهذا Command إذا كانت هناك حاجة.
- تعريف Metadata الخاصة بالـ Command (الوصف، الصلاحيات المطلوبة).

### What This Layer Owns
- Pattern matching logic (بسيط — مطابقة نمط لا قرار أعمال).
- تعريف الـ Command نفسه (اسمه، نمطه، Handler).

### What This Layer Must Never Do
- لا Business Logic من أي نوع.
- لا استدعاء مباشر للـ Repository.
- لا استدعاء مباشر لـ Facebook API.
- لا قرارات تتعلق بسير العمل — فقط تفويض.
- لا وصول للـ Database.
- لا Scheduling مهام.

### Allowed Dependencies
- Core Layer — للـ Types والـ Interfaces.
- Service Interfaces (من Core) — للتفويض.
- ILogger (من Core) — للتسجيل البسيط.

### Forbidden Dependencies
- Repository Implementations.
- Facebook Layer مباشرة.
- Database Layer.
- Cache Layer.
- Scheduler.

### Public Interfaces
- كل Command يُصدَّر كـ Object أو Class يُطبّق `ICommand` Interface.

### Internal Components
- Command Definition (Pattern + Handler + Middleware).
- Command Handler (يستخرج البيانات ويُفوّض للـ Service).

### Communication Rules
- يستقبل Context من Router.
- يستخرج البيانات من Context.
- يُفوّض للـ Service المناسب.
- يستقبل النتيجة ويُنسّق الاستجابة.
- لا تواصل مباشر مع طبقات أخرى.

### Common Mistakes
- وضع `if/else` منطقية تقرر ماذا يحدث بناءً على بيانات المستخدم — هذا Business Logic.
- استخدام Repository مباشرة: `userRepo.findById(...)`.
- بناء رسائل Facebook بالتفصيل داخل Handler.
- Scheduling مهمة داخل Command Handler.

### Best Practices
- Command Handler لا يتجاوز 15-20 سطرًا في معظم الحالات.
- استخراج البيانات بشكل نظيف من Context ثم تفويض فوري للـ Service.
- اسم Command يعبّر عن فعل المستخدم: `StartCommand`، `HelpCommand`، `OrderCommand`.

### Examples of Correct Responsibilities
- ✅ `command: { pattern: /^\/start/, handler: StartHandler }`
- ✅ `const result = await userService.initializeUser(context.senderId)`
- ✅ استخراج `senderId` و `text` من Context وتمريرهما للـ Service.

### Examples of Incorrect Responsibilities
- ❌ `if (user.credits < 10) { /* رفض الطلب */ }` داخل Command Handler.
- ❌ `await db.query('UPDATE users SET ...')` داخل Command.
- ❌ `await scheduler.scheduleJob(...)` داخل Command Handler.

---

## 5. Plugins Layer

### Purpose
Plugins تُضيف وظائف اختيارية للـ Framework دون تعديل الـ Core. كل Plugin وحدة مستقلة ذاتية الكفاية تُعرِّف ما تُضيفه وتُسجِّله عبر الآلية الرسمية. الـ Core لا يعرف بوجود أي Plugin — يتعامل مع جميع Plugins بنفس الطريقة الموحدة.

### Primary Responsibilities
- تسجيل Commands إضافية (اختياري).
- تسجيل Middlewares إضافية (اختياري).
- تسجيل Event Listeners (اختياري).
- تنفيذ منطق التهيئة الخاص بها عند Startup.
- تفويض العمل الفعلي للـ Services.

### Secondary Responsibilities
- تعريف وتسجيل Services خاصة بها إذا احتاجت.
- تنظيف الموارد عند Shutdown.

### What This Layer Owns
- منطق التسجيل والتهيئة الخاص بالـ Plugin.
- Handlers الخاصة بها (بشرط التفويض للـ Service).

### What This Layer Must Never Do
- لا تعديل للـ Core أو أي Interface في Core.
- لا Business Logic داخل Plugin Handlers.
- لا استدعاء مباشر للـ Repository.
- لا استدعاء مباشر لـ Facebook API.
- لا تواصل مباشر مع Plugins أخرى (فقط عبر Event Bus).
- لا معرفة بترتيب تحميل Plugins الأخرى أو وجودها.

### Allowed Dependencies
- Core Layer — للـ Interfaces والـ Types.
- Service Interfaces (من Core) — للتفويض.
- IEventBus (من Core) — للاستماع والإطلاق.
- ILogger (من Core) — للتسجيل.

### Forbidden Dependencies
- Repository Implementations مباشرة.
- Facebook Layer مباشرة.
- Database Layer مباشرة.
- Plugins أخرى مباشرة.

### Public Interfaces
- كل Plugin تُطبّق `IPlugin` Interface: `initialize()`, `destroy()`.

### Internal Components
- `plugin.ts` — تعريف الـ Plugin وتسجيله.
- `handlers/` — Plugin Handlers (مع تفويض للـ Services).

### Communication Rules
- التواصل مع بقية النظام يكون عبر Event Bus أو عبر Services المُحقنة.
- لا استدعاءات مباشرة بين Plugins.
- Plugin يُسجَّل في PluginRegistry ثم يُنسى — النظام يتعامل معه عبر الـ Interface.

### Common Mistakes
- Plugin تُعدّل ملفات في Core مباشرة.
- Plugin Handler يحتوي Business Logic.
- Plugin تستدعي Plugin أخرى مباشرة بدلًا من Event Bus.
- Plugin تستدعي Repository مباشرة بدلًا من Service.

### Best Practices
- كل Plugin في مجلد مستقل بمحتوياتها الكاملة.
- Plugin لها `initialize()` واضحة تُظهر كل ما تُسجّله.
- Plugin لها `destroy()` تُنظّف فيها مواردها.
- Plugin لا تفترض وجود Plugin أخرى.

### Examples of Correct Responsibilities
- ✅ `plugin.registerCommand({ pattern: /!help/, handler: HelpHandler })`
- ✅ `eventBus.on('user.created', async (user) => { await analyticsService.track(user) })`
- ✅ `const result = await userService.getUserProfile(senderId)` داخل Plugin Handler.

### Examples of Incorrect Responsibilities
- ❌ تعديل `IUserRepository` Interface داخل Plugin.
- ❌ `await db.query('SELECT...')` داخل Plugin.
- ❌ `import { anotherPlugin } from '../analytics-plugin'` تبعية مباشرة بين Plugins.

---

## 6. Events Layer

### Purpose
Events Layer مسؤولة عن نظام الأحداث الداخلي الذي يُتيح التواصل غير المباشر بين المكونات. تُعرّف أنواع الأحداث، وتوفر Event Bus الذي تُطلق عبره المكونات الأحداث وتستمع إليها.

### Primary Responsibilities
- توفير Event Bus (Publisher-Subscriber) داخلي.
- تعريف جميع أنواع Internal Events وهياكل بياناتها.
- ضمان توزيع الأحداث على جميع Listeners المسجلين.
- عزل المُطلِق عن المستمع.

### Secondary Responsibilities
- تسجيل الأحداث وتتبعها للأغراض التشخيصية.
- ضمان أن فشل Listener لا يُوقف بقية الـ Listeners.

### What This Layer Owns
- تطبيق Event Bus.
- قائمة أنواع الأحداث الرسمية.
- منطق توزيع الأحداث.

### What This Layer Must Never Do
- لا Business Logic داخل Event Bus نفسه.
- لا استدعاء مباشر للـ Services (Event Bus لا يعرف من سيستمع).
- لا تخزين دائم للأحداث (ليس Event Sourcing).
- لا ضمان ترتيب المعالجة بين Listeners مختلفين (ما لم يُتفق على ذلك صراحةً).

### Allowed Dependencies
- Core Layer — للـ Interfaces وEvent Types.
- ILogger — لتسجيل الأحداث.

### Forbidden Dependencies
- Services مباشرة.
- Database / Cache.
- Facebook Layer.

### Public Interfaces
- `IEventBus` (معرّفة في Core، مُطبَّقة هنا).
- قائمة Event Type Constants.

### Internal Components
- `event-bus.ts` — تطبيق Publisher-Subscriber.
- `event-types.ts` — تعريف جميع أنواع الأحداث وهياكل بياناتها.

### Communication Rules
- أي مكون يُطلق حدثًا عبر `IEventBus.emit(eventType, data)`.
- أي مكون يستمع لحدث عبر `IEventBus.on(eventType, handler)`.
- المُطلِق لا يعرف بوجود أي مستمع.
- المستمع لا يعرف من أطلق الحدث.

### Common Mistakes
- وضع Business Logic داخل Event Bus (مثل تصفية الأحداث بناءً على بيانات المستخدم).
- استخدام Events كـ Return Values لنقل نتائج بين مكونات متزامنة.
- وضع تبعيات صارمة بين ترتيب Listeners.

### Best Practices
- أسماء الأحداث تتبع نمط `domain.action`: `user.created`، `session.expired`، `command.failed`.
- بيانات الحدث تكون Domain Models نظيفة، لا Raw Payloads.
- Listener يعالج استثناءاته الخاصة ولا يدعها تصل للـ Event Bus.

### Examples of Correct Responsibilities
- ✅ `eventBus.emit('user.created', { userId, senderId, createdAt })`
- ✅ `eventBus.on('session.expired', async (data) => { await cleanupService.clearSession(data.sessionId) })`

### Examples of Incorrect Responsibilities
- ❌ `if (event.userId && user.isActive) emit(...)` — Business Logic في Event Bus.
- ❌ استخدام Event لنقل Response بين Command وService بدلًا من Direct Call.

---

## 7. Middleware Layer

### Purpose
Middleware مسؤولة عن المعالجة الأفقية التي تُطبَّق على جميع الطلبات أو مجموعة منها، قبل وصولها للـ Handler أو بعد مغادرتها. كل Middleware تتعامل مع جانب واحد فقط من المعالجة.

### Primary Responsibilities
- التحقق من التوقيع (Signature Verification) — أول ما يحدث.
- تحميل Session المستخدم وإرفاقها بالـ Context.
- تطبيق Rate Limiting.
- تسجيل الطلبات الواردة والاستجابات الصادرة.
- التحقق من الصلاحيات (Authorization) إذا كانت مطلوبة.
- التحقق من صحة شكل البيانات (Schema Validation) عبر Zod.

### Secondary Responsibilities
- بناء Context Object وإضافة البيانات المتوفرة إليه.
- تطبيق تحويلات على البيانات قبل وصولها للـ Handler.

### What This Layer Owns
- منطق التحقق وإعداد السياق.
- تعريف ترتيب تطبيق Middlewares.

### What This Layer Must Never Do
- لا Business Logic — Middleware لا تقرر ما يجب فعله بناءً على قواعد الأعمال.
- لا إرسال رسائل Facebook مباشرة.
- لا وصول مباشر لـ Repository (إلا عبر Service أو Interface لتحميل Session فقط).
- لا استدعاء مباشر للـ Scheduler.

### Allowed Dependencies
- Core Layer — للـ Types والـ Interfaces.
- ISessionRepository أو ISessionService — لتحميل الجلسات.
- ILogger — للتسجيل.
- Cache Interface — للـ Rate Limiting.

### Forbidden Dependencies
- Facebook Layer مباشرة (إلا Signature Verifier).
- Business Services مباشرة (إلا لتحميل السياق).
- Database Layer مباشرة.

### Public Interfaces
- كل Middleware تُطبّق `IMiddleware` Interface.

### Internal Components
- `signature-verifier.middleware.ts`
- `session-loader.middleware.ts`
- `rate-limiter.middleware.ts`
- `logger.middleware.ts`
- `validator.middleware.ts`

### Communication Rules
- تأخذ Context، تُعدّله أو تتحقق منه، تُمرّره للـ Middleware التالية.
- إذا فشل التحقق، تُوقف التدفق وتُرجع رد خطأ مناسب.
- لا تتواصل مع بعضها مباشرة — تتسلسل عبر Pipeline.

### Common Mistakes
- وضع `if (user.subscriptionType === 'premium')` داخل Middleware — هذا Business Logic.
- بناء رسالة رد كاملة داخل Middleware.
- تحميل بيانات لا تحتاجها الطبقة الحالية (Over-fetching).

### Best Practices
- كل Middleware مسؤولية واحدة فقط.
- Middleware تُسمّى بما تفعله: `SessionLoaderMiddleware`، `RateLimiterMiddleware`.
- الترتيب في Pipeline مُوثَّق ومُعلَّل.

### Examples of Correct Responsibilities
- ✅ التحقق من `X-Hub-Signature-256` وإيقاف الطلب إذا كان التوقيع غير صحيح.
- ✅ تحميل Session المستخدم وإضافتها لـ Context.
- ✅ التحقق من أن الطلب لم يتجاوز Rate Limit.

### Examples of Incorrect Responsibilities
- ❌ `if (!user.hasCompletedOnboarding) sendOnboardingMessage()` داخل Middleware.
- ❌ `await db.query('UPDATE user_activity SET ...')` داخل Middleware.

---

## 8. Managers Layer

### Purpose
Managers مسؤولون عن إدارة دورة حياة الأنظمة وتنسيق العمل بين مكونات متعددة. لا يحتوون Business Logic ولا ينفّذون عمليات الأعمال بأنفسهم — يُنظّمون ويُنسّقون فقط.

الفرق بين Manager وService: Service تُنفّذ، Manager يُنسّق.

### Primary Responsibilities
- إدارة دورة حياة الأنظمة: التهيئة، التشغيل، الإيقاف.
- تنسيق العمل بين مكونات متعددة دون احتواء المنطق نفسه.
- إدارة موارد النظام (اتصالات قاعدة البيانات، اتصالات Cache).
- مثال: `SessionManager` يُدير إنشاء الجلسات وانتهاء صلاحيتها — لكن منطق القرارات في `SessionService`.

### Secondary Responsibilities
- توفير وضع النظام (Health Checks).
- الإبلاغ عن المشاكل عبر Logging.

### What This Layer Owns
- منطق التهيئة وترتيب تشغيل المكونات.
- منطق Graceful Shutdown.
- إدارة Pools والاتصالات.

### What This Layer Must Never Do
- لا Business Logic — لا قرارات تتعلق بقواعد الأعمال.
- لا تفاعل مباشر مع المستخدمين (لا إرسال رسائل).
- لا استدعاء مباشر لـ Facebook API.
- لا تنفيذ عمليات Business يجب أن تكون في Services.

### Allowed Dependencies
- Core Layer.
- Services عبر Interfaces.
- Infrastructure Layer عبر Interfaces (للـ Pools والاتصالات).
- ILogger.

### Forbidden Dependencies
- Facebook Layer مباشرة.
- Commands / Plugins.
- Repository Implementations مباشرة.

### Public Interfaces
- `ISessionManager`، `IConnectionManager`، إلخ (مُعرَّفة في Core).

### Internal Components
- كل Manager ملف مستقل بمسؤولية إدارية واحدة.

### Communication Rules
- يُهيَّأ في Startup ويُوقَف في Shutdown.
- يُحقَن في من يحتاجه عبر DI Container.
- لا يستدعي بشكل عشوائي من أي مكان في النظام.

### Common Mistakes
- وضع `if (user.type === 'vip') { /* منطق VIP */ }` داخل Manager.
- Manager يستدعي Facebook API لإرسال رسالة مباشرة.
- Manager يحتوي SQL queries.

### Best Practices
- اسم Manager يعبّر عما يُدار: `SessionManager`، `DatabaseConnectionManager`.
- `initialize()` و `shutdown()` موثقتان بوضوح.
- Manager يُبلّغ عن حالته لا يُقرر مكان آخر.

### Examples of Correct Responsibilities
- ✅ `sessionManager.initialize()` — إنشاء Connection Pool لـ Session Storage.
- ✅ `sessionManager.shutdown()` — إغلاق الاتصالات بأمان.
- ✅ تنسيق ترتيب تهيئة المكونات في Startup.

### Examples of Incorrect Responsibilities
- ❌ `if (session.messageCount > 100) blockUser()` داخل SessionManager — هذا Business Logic.
- ❌ `await facebookClient.sendMessage(...)` داخل Manager.

---

## 9. Database Layer

### Purpose
Database Layer (Repositories) مسؤولة عن كل تفاعل مع قاعدة البيانات. تخزين البيانات، استرجاعها، تحديثها، حذفها. لا أحد يتعامل مع قاعدة البيانات مباشرة إلا من هنا.

### Primary Responsibilities
- تنفيذ CRUD operations على قاعدة البيانات.
- تحويل Database Records إلى Domain Models والعكس.
- إدارة Transactions المعقدة.
- تطبيق Query Optimization عند الحاجة.

### Secondary Responsibilities
- تطبيق Pagination وFiltering في الاستعلامات.
- تجميع Queries لتحسين الأداء.

### What This Layer Owns
- منطق الاستعلامات والتعديلات على قاعدة البيانات.
- منطق التحويل بين Database Schema وDomain Models.
- إدارة Database Transactions.

### What This Layer Must Never Do
- لا Business Logic — Repository تعمل ما يُطلب منها دون قرار.
- لا استدعاء Facebook API.
- لا Cache operations (إلا إذا كان هناك Pattern محدد كـ Cache-Aside في Service).
- لا استدعاء Services أخرى.
- لا إطلاق Business Events.

### Allowed Dependencies
- Core Layer — للـ Interfaces والـ Domain Types.
- ORM Library (Drizzle أو ما شابه).
- Database Driver.

### Forbidden Dependencies
- Services Layer.
- Facebook Layer.
- Cache Layer (Repository لا تُدير Cache).
- Commands / Plugins.

### Public Interfaces
- كل Repository تُطبّق Interface مُعرَّفة في Core (`IUserRepository`، `ISessionRepository`).

### Internal Components
- `user.repository.ts`، `session.repository.ts`، إلخ.
- `schema/` — تعريفات Schema لـ ORM.
- `migrations/` — ملفات Migration.

### Communication Rules
- تُستدعى من Services فقط.
- تُعيد Domain Models — لا تُعيد Database Row Objects الخام.
- تُعلم بالأخطاء عبر Typed Errors لا عبر Null Returns الغامضة.

### Common Mistakes
- `if (user.credits > 0) { /* تحديث مشروط بمنطق أعمال */ }` داخل Repository.
- Repository تُطلق Event عند الحفظ بدلًا من الـ Service.
- تسريب ORM Objects خارج Repository بدلًا من تحويلها لـ Domain Models.

### Best Practices
- اسم Repository: `UserRepository`، `SessionRepository`.
- Methods واضحة الغرض: `findByMessengerId`، `updateLastSeen`، `deleteExpiredSessions`.
- Repository لا تتخذ قرارات — تنفّذ فقط ما يُطلب منها.

### Examples of Correct Responsibilities
- ✅ `async findByMessengerId(id: string): Promise<User | null>`
- ✅ `async updateUserProfile(userId: string, data: Partial<User>): Promise<User>`
- ✅ `async deleteExpiredSessions(before: Date): Promise<number>`

### Examples of Incorrect Responsibilities
- ❌ `if (user.type === 'admin') return adminData` داخل Repository.
- ❌ `await eventBus.emit('user.fetched', user)` داخل Repository.

---

## 10. Cache Layer

### Purpose
Cache Layer مسؤولة عن التخزين المؤقت للبيانات لتحسين الأداء وتقليل الضغط على قاعدة البيانات والخدمات الخارجية. لا تُقرر ما يُخزَّن أو لماذا — هذا قرار الـ Service التي تستخدمها.

### Primary Responsibilities
- تخزين واسترجاع القيم المؤقتة.
- إدارة TTL (Time To Live) للبيانات المُخزَّنة.
- إبطال (Invalidation) Cache عند الطلب.
- توفير Atomic Operations (مثل Increment لـ Rate Limiting).

### Secondary Responsibilities
- توفير Pattern-based Invalidation.
- إحصاءات Cache Hit/Miss للمراقبة.

### What This Layer Owns
- تطبيق ICacheClient Interface.
- إدارة الاتصال بـ Cache Server (Redis أو In-Memory).
- منطق Serialization/Deserialization للبيانات المُخزَّنة.

### What This Layer Must Never Do
- لا قرارات بما يجب تخزينه — هذا قرار من يستخدمها.
- لا Business Logic.
- لا استدعاء Database مباشرة.
- لا استدعاء Services.

### Allowed Dependencies
- Core Layer — للـ ICacheClient Interface.
- Cache Library (ioredis، node-cache، إلخ).

### Forbidden Dependencies
- Services Layer.
- Database Layer (لا تُقرر Cache هل تذهب لـ Database).
- Facebook Layer.

### Public Interfaces
- `ICacheClient` (معرّفة في Core، مُطبَّقة هنا).

### Internal Components
- `redis-cache.ts` أو `in-memory-cache.ts` — تطبيقات بديلة.

### Communication Rules
- تُستدعى من Services أو Repositories حين يقررون استخدام Cache.
- تُعيد `null` إذا لم يكن الـ Key موجودًا — لا تذهب لـ Database.

### Common Mistakes
- Cache تُقرر "إذا لم يوجد في Cache، اذهب لـ Database" — هذا Cache-Aside Pattern وهو مسؤولية الـ Service.
- تخزين كائنات معقدة بدون Serialization واضحة.
- عدم تحديد TTL (تتراكم البيانات إلى الأبد).

### Best Practices
- Keys تتبع نمطًا موحدًا: `void:{entity}:{id}`.
- TTL محددة دائمًا — لا Cache بدون انتهاء صلاحية.
- Cache تفشل بصمت وتُسجّل الخطأ — لا تُوقف النظام بسبب مشكلة Cache.

### Examples of Correct Responsibilities
- ✅ `await cache.set('void:user:123', userData, { ttl: 300 })`
- ✅ `const cached = await cache.get('void:user:123')`
- ✅ `await cache.invalidate('void:user:123')`

### Examples of Incorrect Responsibilities
- ❌ `if (!cached) return await userRepo.findById(id)` داخل Cache Layer.
- ❌ `if (data.type === 'premium') setLongerTTL()` — Business Logic في Cache.

---

## 11. Scheduler Layer

### Purpose
Scheduler مسؤول عن تعريف وتشغيل المهام الدورية والمجدولة (Cron Jobs) بشكل مستقل عن دورة Webhook. يضمن تنفيذ المهام في الأوقات المحددة ويتعامل مع حالات الفشل.

### Primary Responsibilities
- تعريف وتسجيل المهام المجدولة بجداول زمنية (Cron Expressions).
- ضمان تنفيذ المهام في وقتها المحدد.
- معالجة فشل المهام وإعادة المحاولة حسب السياسة.
- منع تشغيل نفس المهمة بشكل متزامن (Overlapping Prevention).

### Secondary Responsibilities
- تسجيل تاريخ تنفيذ المهام ونتائجها.
- إيقاف المهام بأمان عند Shutdown.

### What This Layer Owns
- تعريف Cron Schedules.
- منطق تشغيل المهام وإدارة توقيتها.
- سياسة الـ Retry وإدارة الفشل على مستوى الـ Scheduler.

### What This Layer Must Never Do
- لا Business Logic داخل Scheduler نفسه.
- المهام تُفوَّض للـ Services — Scheduler هو المُشغِّل لا المُنفِّذ.
- لا استدعاء مباشر لـ Facebook API.
- لا وصول مباشر لـ Database.

### Allowed Dependencies
- Core Layer.
- Service Interfaces — للتفويض.
- ILogger — لتسجيل نتائج المهام.
- Scheduling Library (node-cron أو ما شابه).

### Forbidden Dependencies
- Repository Implementations.
- Facebook Layer مباشرة.
- Commands / Plugins.

### Public Interfaces
- `IScheduler` (معرّفة في Core).
- Job Definition Interface.

### Internal Components
- `scheduler.ts` — تطبيق IScheduler.
- `jobs/` — تعريفات المهام (كل مهمة تُفوّض للـ Service).

### Communication Rules
- يُهيَّأ في نهاية Startup Sequence.
- كل Job تُعرَّف بـ Cron Expression وHandler.
- Job Handler يُفوّض فورًا للـ Service المناسب.
- يُوقَف في Shutdown بعد اكتمال المهام الجارية.

### Common Mistakes
- وضع منطق أعمال مباشرة في Job Handler بدلًا من التفويض للـ Service.
- Job تستدعي Facebook API مباشرة.
- Job تكتب مباشرة لقاعدة البيانات.
- تشغيل Job من داخل Command Handler.

### Best Practices
- كل Job لها اسم واضح وتوثيق لجدولها الزمني وسببها.
- Job Handler لا يتجاوز 5-10 سطور: تحقق + تفويض للـ Service + تسجيل.
- Overlapping Prevention مُفعَّل لمنع تراكم نسخ من نفس المهمة.

### Examples of Correct Responsibilities
- ✅ `scheduler.addJob('cleanup-sessions', '0 2 * * *', () => sessionService.cleanupExpired())`
- ✅ `scheduler.addJob('send-reminders', '0 9 * * *', () => reminderService.sendDailyReminders())`

### Examples of Incorrect Responsibilities
- ❌ Job Handler يحتوي 50 سطرًا من Business Logic بدلًا من استدعاء Service.
- ❌ `await facebookClient.broadcastMessage(...)` مباشرة في Job.

---

## 12. Utils Layer

### Purpose
Utils تحتوي أدوات مساعدة عامة تُستخدم عبر طبقات متعددة. لا تحتوي أي منطق خاص بالمشروع أو بـ Business Logic.

القاعدة الذهبية لـ Utils: إذا يمكن نقل هذا الكود لمشروع Node.js مختلف تمامًا ويظل منطقيًا ومفيدًا دون تعديل — فهو Utils. إذا كان مرتبطًا بالنطاق — فليس Utils.

### Primary Responsibilities
- توفير أدوات تنسيق وتحويل عامة (Date Formatting، String Manipulation).
- توفير أدوات تشفير وHash عامة.
- توفير Type Guards وType Helpers عامة.
- توفير أدوات Async Helpers (Retry، Delay، Timeout).

### Secondary Responsibilities
- توفير Validation Helpers عامة غير مرتبطة بـ Domain.

### What This Layer Owns
- دوال مساعدة عامة خالصة (Pure Functions يُفضَّل).
- Type Utilities.
- Generic Async Helpers.

### What This Layer Must Never Do
- لا Business Logic من أي نوع.
- لا معرفة بـ Domain Models أو Facebook أو Sessions.
- لا استدعاء Services أو Repositories.
- لا اعتماد على Application-specific Context.

### Allowed Dependencies
- مكتبات Utility عامة (date-fns، crypto).
- Core Layer فقط للـ Generic Types (إذا لزم).

### Forbidden Dependencies
- أي طبقة من طبقات التطبيق.
- Facebook Layer.
- Database / Cache.

### Public Interfaces
- دوال مُصدَّرة مباشرة — لا Classes معقدة لـ Utilities البسيطة.

### Common Mistakes
- وضع `formatMessengerMessage(event)` داخل Utils — هذا Domain-specific، ينتمي لـ Facebook Layer.
- وضع `calculateUserScore(user)` داخل Utils — هذا Business Logic.
- Utils تعتمد على Service أو Repository.

### Best Practices
- Utils تكون Pure Functions قدر الإمكان — نفس المدخل يُنتج دائمًا نفس المخرج.
- كل دالة في Utils قابلة للاختبار بمعزل كامل بدون أي Setup.
- الاسم يصف الوظيفة العامة: `formatDate`، `generateHash`، `withRetry`.

### Examples of Correct Responsibilities
- ✅ `formatDate(date: Date, format: string): string`
- ✅ `generateRandomToken(length: number): string`
- ✅ `withRetry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T>`
- ✅ `isNonEmptyString(value: unknown): value is string`

### Examples of Incorrect Responsibilities
- ❌ `validateUserSession(session, userId)` — Domain Logic.
- ❌ `buildFacebookPayload(event)` — Facebook-specific.
- ❌ `await userService.getUser(id)` داخل Utils.

---

## 13. Configs Layer

### Purpose
Configs مسؤولة عن تحميل إعدادات التطبيق من Environment Variables، والتحقق من صحتها ووجودها، وإتاحتها للنظام بطريقة منظمة ومكتوبة بالأنواع. تُقرأ مرة واحدة عند Startup وتصبح Immutable.

### Primary Responsibilities
- قراءة Environment Variables.
- التحقق من وجود جميع الإعدادات المطلوبة (Fail Fast إذا كان ناقصًا).
- تحويل القيم لأنواع صحيحة (String → Number، String → Boolean).
- توفير Config Object منظم ومكتوب بالأنواع.

### Secondary Responsibilities
- توفير Default Values للإعدادات الاختيارية.
- التحقق من صحة قيم الإعدادات (مثل: Port يجب أن يكون بين 1-65535).

### What This Layer Owns
- منطق تحميل الإعدادات.
- التحقق من صحة ووجود الإعدادات.
- تعريف هيكل Config Object.

### What This Layer Must Never Do
- لا Business Logic.
- لا استدعاء Services أو Repositories.
- لا قراءة Configs أثناء التشغيل (يُقرأ مرة واحدة عند Startup).
- لا تسجيل قيم الأسرار (Tokens، Passwords) في اللوغات.

### Allowed Dependencies
- Core Layer — للـ Types.
- Validation Library (Zod) للتحقق من شكل الإعدادات.

### Forbidden Dependencies
- أي طبقة من طبقات التطبيق.

### Public Interfaces
- `AppConfig` Type — هيكل الإعدادات الكامل.
- `loadConfig()` — دالة تُحمِّل وتُعيد الإعدادات.

### Internal Components
- `app-config.ts` — تعريف هيكل الإعدادات وتحميلها.
- `config.schema.ts` — Schema للتحقق من صحة الإعدادات.

### Communication Rules
- تُستدعى مرة واحدة في بداية `index.ts`.
- النتيجة (Config Object) تُحقَن في DI Container.
- أي مكون يحتاج إعدادًا يستقبله عبر DI — لا يستدعي `loadConfig()` مباشرة.

### Common Mistakes
- مكون يقرأ `process.env` مباشرة بدلًا من استخدام Config المُحقَن.
- Config تُحمَّل عدة مرات في أماكن مختلفة.
- تسجيل قيمة `config.facebookToken` في اللوغات.

### Best Practices
- Config Object يكون Immutable (readonly) بعد التحميل.
- خطأ واضح وفوري إذا كان إعداد مطلوب ناقص — لا افتراضات خاطئة.
- أسماء الإعدادات واضحة ومتسقة مع أسماء Environment Variables.

### Examples of Correct Responsibilities
- ✅ قراءة `PORT` من `process.env` والتحقق من أنه رقم صحيح.
- ✅ Fail Fast مع رسالة واضحة إذا كان `FACEBOOK_PAGE_ACCESS_TOKEN` غير موجود.
- ✅ `config.facebook.pageAccessToken` — وصول منظم ومكتوب بالأنواع.

### Examples of Incorrect Responsibilities
- ❌ `if (config.environment === 'production') { await enablePremiumFeatures() }` داخل Configs.
- ❌ Configs تُعيد Config مختلفة بناءً على منطق ديناميكي أثناء التشغيل.

---

## 14. Layer Boundary Violations

هذا القسم يُوثّق أكثر الانتهاكات المعمارية شيوعًا في مشاريع مماثلة، لمنع تكرارها في Void.

### الانتهاك الأول — Business Logic داخل Commands

**الخطأ:** Command Handler يحتوي على قرارات أعمال.
```
// ❌ خاطئ — Business Logic داخل Command
CommandHandler:
  if (user.credits < requiredCredits) {
    send("رصيدك غير كافٍ")
    return
  }
  await processOrder(user, item)
```
**الصحيح:** Command يستدعي Service وService تتخذ القرار وتُعيد النتيجة.

### الانتهاك الثاني — Business Logic داخل Managers

**الخطأ:** SessionManager يقرر ما يحدث للمستخدم بناءً على بيانات جلسته.
```
// ❌ خاطئ
SessionManager:
  if (session.step === 'payment' && session.amount > 1000) {
    triggerFraudCheck()
  }
```
**الصحيح:** SessionManager يُدير إنشاء الجلسات وانتهاءها. قرار الـ Fraud Check في Service.

### الانتهاك الثالث — Facebook API داخل Services

**الخطأ:** Service تستدعي Facebook API مباشرة.
```
// ❌ خاطئ
UserService:
  import axios from 'axios'
  await axios.post('https://graph.facebook.com/...', payload)
```
**الصحيح:** Service تستخدم `IFacebookClient` المُحقَن — لا معرفة بتفاصيل Facebook.

### الانتهاك الرابع — Database داخل Plugins

**الخطأ:** Plugin Handler تستعلم من قاعدة البيانات مباشرة.
```
// ❌ خاطئ
AnalyticsPlugin Handler:
  const results = await db.query('SELECT COUNT(*) FROM events WHERE ...')
```
**الصحيح:** Plugin تستدعي `analyticsService.getEventCount(params)`.

### الانتهاك الخامس — Cache داخل Core

**الخطأ:** Interface في Core تعتمد على Cache Implementation.
```
// ❌ خاطئ
interface IUserRepository {
  findById(id: string): Promise<User>
  getCachedUser(id: string): Promise<User>  // Cache logic داخل Core
}
```
**الصحيح:** Cache Aside Pattern في Service — Repository لا تعرف بوجود Cache.

### الانتهاك السادس — Scheduler داخل Commands

**الخطأ:** Command يُجدوَل مهمة مباشرة بدلًا من تفويضها.
```
// ❌ خاطئ
OrderCommand Handler:
  await scheduler.addOneTimeJob(() => sendReminder(userId), { delay: '1h' })
```
**الصحيح:** Command يستدعي Service، وService تستدعي Scheduler Interface إذا كان مصرحًا لها.

### الانتهاك السابع — الوصول المباشر للـ FacebookTransport من خارج Facebook Layer

**الخطأ:** أي مكون يستورد ويستخدم Facebook HTTP Client مباشرة.
```
// ❌ خاطئ — في أي طبقة غير Facebook Layer
import { facebookAxiosInstance } from '../facebook/http-client'
await facebookAxiosInstance.post('/me/messages', payload)
```
**الصحيح:** الإرسال يتم عبر `IFacebookClient` Interface المُحقَن فقط.

### الانتهاك الثامن — Circular Service Dependencies

**الخطأ:** ServiceA تعتمد على ServiceB التي تعتمد على ServiceA.
```
// ❌ خاطئ
UserService → OrderService → UserService
```
**الصحيح:** إعادة تصميم الحدود أو استخراج Shared Logic في Service ثالثة مستقلة.

---

## 15. Responsibility Decision Guide

قبل كتابة أي كود جديد، أجب عن هذه الأسئلة بالترتيب لتحديد الطبقة الصحيحة:

---

### السؤال الأول: هل هذا عقد (Interface) أو نوع بيانات (Type/Model) أو خطأ مخصص؟
**نعم** → ينتمي لـ **Core Layer**.

---

### السؤال الثاني: هل هذا يتعلق بالتواصل مع Facebook API (إرسال أو استقبال أو تحقق)؟
**نعم** → ينتمي لـ **Facebook Layer**.

---

### السؤال الثالث: هل هذا يحتوي قرارًا أو قاعدة أعمال؟
*(مثال: "إذا كان المستخدم X يجب فعل Y"، أو "تحقق من صحة X قبل السماح بـ Y")*
**نعم** → ينتمي لـ **Services Layer** — دون استثناء.

---

### السؤال الرابع: هل هذا يربط نمط رسالة مستخدم بـ Handler ويُفوّض للـ Service؟
**نعم** → ينتمي لـ **Commands Layer**.

---

### السؤال الخامس: هل هذا وظيفة اختيارية مستقلة يمكن تشغيلها أو إيقافها؟
**نعم** → ينتمي لـ **Plugins Layer**.

---

### السؤال السادس: هل هذا يُطبَّق على جميع الطلبات أفقيًا قبل وصولها للـ Handler؟
*(مثال: تحقق من التوقيع، تحميل Session، Rate Limiting)*
**نعم** → ينتمي لـ **Middleware Layer**.

---

### السؤال السابع: هل هذا يُدير دورة حياة نظام أو مورد، دون تنفيذ Business Logic؟
**نعم** → ينتمي لـ **Managers Layer**.

---

### السؤال الثامن: هل هذا يخزن أو يسترجع البيانات من قاعدة البيانات؟
**نعم** → ينتمي لـ **Database Layer** (Repository).

---

### السؤال التاسع: هل هذا يخزن أو يسترجع بيانات مؤقتة؟
**نعم** → ينتمي لـ **Cache Layer**.

---

### السؤال العاشر: هل هذا مهمة تعمل بشكل دوري بدون تدخل المستخدم؟
**نعم** → ينتمي لـ **Scheduler Layer**.

---

### السؤال الحادي عشر: هل هذا دالة مساعدة عامة لا تعرف شيئًا عن النطاق؟
*(مثال: تنسيق تاريخ، توليد رمز عشوائي، Retry Helper)*
**نعم** → ينتمي لـ **Utils Layer**.

---

### السؤال الثاني عشر: هل هذا يقرأ إعدادات من Environment Variables؟
**نعم** → ينتمي لـ **Configs Layer**.

---

### إذا لم تُجب بـ "نعم" على أي سؤال:
هناك احتمالان:
1. **الكود ينتمي لطبقة لم تُصنَّف بعد** — ناقش وأضف تصنيفًا جديدًا.
2. **الكود غير ضروري** — أعد النظر في الحاجة إليه.

لا تضع الكود في "أي مكان مناسب" — كل كود له مكان واحد صحيح.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
