# 02 — Architecture

> **المرجع الرسمي لمعمارية مشروع Void**
> يجب قراءة هذه الوثيقة قبل كتابة أي مكون جديد أو اتخاذ أي قرار تصميمي.
> هذه الوثيقة تصف الهيكل العام — مسؤولية كل طبقة بالتفصيل موجودة في `03-layer-responsibilities.md`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Architecture Goals](#2-architecture-goals)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Layered Architecture](#4-layered-architecture)
5. [Dependency Flow](#5-dependency-flow)
6. [Dependency Inversion Strategy](#6-dependency-inversion-strategy)
7. [Dependency Injection Strategy](#7-dependency-injection-strategy)
8. [Component Communication](#8-component-communication)
9. [Startup Sequence](#9-startup-sequence)
10. [Application Lifecycle](#10-application-lifecycle)
11. [Request Lifecycle](#11-request-lifecycle)
12. [Event Flow](#12-event-flow)
13. [Command Flow](#13-command-flow)
14. [Plugin Flow](#14-plugin-flow)
15. [Service Flow](#15-service-flow)
16. [Manager Flow](#16-manager-flow)
17. [Error Flow](#17-error-flow)
18. [Configuration Flow](#18-configuration-flow)
19. [Data Flow](#19-data-flow)
20. [Facebook Communication Flow](#20-facebook-communication-flow)
21. [Extension Strategy](#21-extension-strategy)
22. [Scalability Strategy](#22-scalability-strategy)
23. [Maintainability Strategy](#23-maintainability-strategy)
24. [Testability Strategy](#24-testability-strategy)
25. [Replaceability Strategy](#25-replaceability-strategy)
26. [Architecture Constraints](#26-architecture-constraints)
27. [Architecture Anti-Patterns](#27-architecture-anti-patterns)
28. [Future Architecture Vision](#28-future-architecture-vision)

---

## 1. Architecture Overview

معمارية Void مبنية على مجموعة متماسكة من المبادئ الهندسية المثبتة:

- **Clean Architecture** — الطبقات الداخلية لا تعرف بالطبقات الخارجية. الاعتماد دائمًا من الخارج للداخل.
- **Layered Architecture** — كل طبقة لها مسؤولية محددة وحدود واضحة لا تُخترق.
- **SOLID Principles** — تُطبَّق على كل مكون في النظام دون استثناء.
- **Dependency Injection** — التبعيات تُحقن من الخارج، لا تُنشأ داخليًا.
- **Composition over Inheritance** — المكونات تتركب ولا تتوارث إلا لأسباب واضحة.
- **Modular Design** — كل وحدة مستقلة وذاتية الكفاية قدر الإمكان.

هذه المبادئ لا تعمل بشكل منفصل — هي نظام متكامل يُعزز بعضه البعض. Clean Architecture تُحدد الحدود. Layered Architecture تُوضح التسلسل. SOLID يُحكم التصميم الداخلي لكل مكون. Dependency Injection يجعل الحدود قابلة للاختبار. Composition يُبقي التصميم مرنًا. Modular Design يُضمن الاستقلالية.

النتيجة هي نظام يمكن فهمه بالقراءة، تعديله بأمان، اختباره بمعزل، وتوسعته دون خوف من كسر ما هو قائم.

---

## 2. Architecture Goals

### الهدف الأول — حدود معمارية غير قابلة للاختراق
كل طبقة تعرف ما هي مسؤوليتها وتلتزم بها. لا طبقة تتجاوز حدودها باتجاه أخرى. الانتهاك المعماري أخطر من الخطأ البرمجي لأنه يتضاعف مع مرور الوقت.

### الهدف الثاني — اختبارية كاملة بالمعزل
كل طبقة وكل مكون يجب أن يكون قابلًا للاختبار دون تشغيل النظام كاملًا. هذا يتحقق عبر Dependency Injection والاعتماد على Interfaces لا على Implementations.

### الهدف الثالث — استبدالية المكونات
أي تنفيذ داخلي يمكن استبداله بتنفيذ آخر دون تغيير الطبقات المستهلكة. Repository يمكن استبداله. Cache يمكن استبداله. حتى طبقة Facebook يمكن تغيير تفاصيل تنفيذها دون أن تعرف الطبقات الداخلية.

### الهدف الرابع — مسار واحد لكل نوع من البيانات
كل نوع من البيانات أو العمليات له مسار واحد واضح عبر النظام. لا عمليات Facebook خارج Facebook Layer. لا Business Logic خارج Services. لا تخمين في "أين يذهب هذا الكود".

### الهدف الخامس — نقاط امتداد محددة
التوسع يحدث عبر نقاط محددة في المعمارية: Plugins، Commands، Services. لا يحتاج المطور لتعديل الـ Core لإضافة وظيفة جديدة.

---

## 3. High-Level Architecture

على المستوى الأعلى، Void عبارة عن نظام يستقبل أحداثًا من Facebook Messenger ويُجري عليها معالجة متدرجة عبر طبقات متخصصة قبل الاستجابة.

```
┌──────────────────────────────────────────────────────────────────┐
│                      Facebook Messenger                          │
│                   (Webhook Events / API)                         │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Entry Point Layer                          │
│              (Express Server / Webhook Endpoint)                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Facebook Layer                                │
│   (Signature Verification / Payload Parsing / Event Mapping)    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Normalized Internal Events
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Middleware Pipeline                           │
│        (Auth / Rate Limiting / Session Loading / Logging)       │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Enriched Context
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Router / Dispatcher                          │
│           (Command Matching / Plugin Routing / Events)          │
└─────────────┬─────────────────────────────────────┬─────────────┘
              │                                     │
              ▼                                     ▼
┌─────────────────────────┐             ┌───────────────────────┐
│    Command Handlers     │             │    Plugin Handlers    │
│   (Entry Points Only)   │             │   (Entry Points Only) │
└─────────────┬───────────┘             └───────────┬───────────┘
              │                                     │
              └──────────────┬──────────────────────┘
                             │ Delegates To
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Services                                 │
│                    (Business Logic Only)                         │
└─────────────┬────────────────────────────────────┬──────────────┘
              │                                    │
              ▼                                    ▼
┌─────────────────────────┐           ┌────────────────────────┐
│      Repositories       │           │    External Services   │
│   (Database Access)     │           │  (Cache / Scheduler)   │
└─────────────┬───────────┘           └────────────┬───────────┘
              │                                    │
              ▼                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Infrastructure                              │
│              (PostgreSQL / Redis / File System)                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Layered Architecture

يتكون Void من ست طبقات رئيسية مرتبة من الأكثر عمومية للأكثر تخصصًا:

### الطبقة الأولى — Core Domain Layer
الطبقة الداخلية الأعمق والأكثر استقرارًا. تحتوي على:
- **Interfaces** — العقود التي تحكم جميع التبعيات في النظام.
- **Types والـ Domain Models** — هياكل البيانات الأساسية التي تتدفق عبر النظام.
- **Constants** — القيم الثابتة على مستوى النظام.

هذه الطبقة **لا تعتمد على أي طبقة أخرى**. لا تعرف بوجود Express، لا تعرف بوجود Facebook، لا تعرف بوجود قاعدة البيانات. هي الحقيقة المجردة للنظام.

### الطبقة الثانية — Application Layer
تحتوي على Business Logic المُجسَّدة في Services. هذه الطبقة:
- تعتمد على Core Domain Layer عبر Interfaces.
- لا تعرف تفاصيل التنفيذ لأي Infrastructure.
- تعبّر عن "ماذا يفعل النظام" بدون "كيف يتواصل مع العالم الخارجي".

### الطبقة الثالثة — Infrastructure Layer
تحتوي على:
- **Repositories** — التطبيق الفعلي لعمليات قاعدة البيانات.
- **Cache** — إدارة التخزين المؤقت.
- **Scheduler** — إدارة المهام المجدولة.

تعتمد على Core Layer (تُطبّق الـ Interfaces) وعلى Libraries الخارجية (Drizzle، Redis).

### الطبقة الرابعة — Facebook Layer
الطبقة المسؤولة عن كل تواصل مع Facebook Messenger API. هي:
- المكان الوحيد الذي يعرف تفاصيل Facebook API.
- تحوّل Events الخام من Facebook إلى نماذج داخلية مُعيَّرة.
- تُرسل الردود لـ Facebook بصيغتها الصحيحة.
- تُطبّق التحقق من التوقيع (Signature Verification).

**لا يحق لأي طبقة أخرى التواصل مع Facebook API مباشرة.**

### الطبقة الخامسة — Coordination Layer
تحتوي على:
- **Managers** — تُنسّق العمل بين المكونات وتُدير دورة حياة الأنظمة. لا تحتوي Business Logic.
- **Event System** — يُتيح التواصل غير المباشر بين المكونات.
- **Middleware Pipeline** — المعالجة الأفقية قبل وصول الحدث للـ Handler.

### الطبقة السادسة — Entry Points Layer
أعلى الطبقات وأقلها قربًا من الـ Core. تحتوي على:
- **Express Server** — نقطة الدخول الشبكية.
- **Commands** — تُعرّف أنماط الرسائل وتُفوّض للـ Services.
- **Plugins** — تُضيف وظائف اختيارية وتُفوّض للـ Services.

**Commands وPlugins هي نقاط دخول فقط. لا تحتوي على Business Logic.**

---

## 5. Dependency Flow

الاعتماد في Void يسير في اتجاه واحد فقط: **من الخارج للداخل**.

```
Entry Points
    │ يعتمد على
    ▼
Coordination Layer
    │ يعتمد على
    ▼
Facebook Layer
    │ يعتمد على
    ▼
Application Layer (Services)
    │ يعتمد على
    ▼
Core Domain (Interfaces & Types)
    ▲
    │ تُطبَّق بواسطة
Infrastructure Layer (Repositories, Cache)
```

**القواعد الصارمة لتدفق الاعتماد:**

**القاعدة الأولى:** لا طبقة داخلية تعتمد على طبقة خارجية. Core لا يعرف بوجود Services. Services لا تعرف بوجود Express.

**القاعدة الثانية:** الاعتماد يتم عبر Interfaces لا عبر Implementations. Service لا تعتمد على `PostgresUserRepository` — تعتمد على `IUserRepository`.

**القاعدة الثالثة:** لا اعتماد دائري. إذا ظهر اعتماد دائري، فهذا يُشير إلى خطأ في تصميم الحدود يجب معالجته.

**القاعدة الرابعة:** Facebook Layer تعتمد على Core لتحويل البيانات، لكن Core لا يعرف بوجود Facebook Layer.

---

## 6. Dependency Inversion Strategy

Dependency Inversion Principle (DIP) هو الآلية التي تُجعل Clean Architecture ممكنة عمليًا في Void.

### الآلية

بدلًا من أن تعتمد Service على Repository مباشرة، يُعرَّف Interface في Core Layer:

```
Core Layer يُعرِّف: IUserRepository
Application Layer تستخدم: IUserRepository
Infrastructure Layer تُطبّق: PostgresUserRepository implements IUserRepository
```

هذا يعني أن Application Layer (الداخل) لا تعتمد على Infrastructure Layer (الخارج). كلاهما يعتمدان على التجريد (Interface) في Core Layer.

### أين تُعرَّف الـ Interfaces

جميع Interfaces الأساسية تُعرَّف في Core Domain Layer. هذا يضمن أن:
- التجريدات مستقرة ومركزية.
- أي Implementation يمكن استبداله دون تعديل المستهلك.
- الاختبار يكون بـ Mock Implementations بدلًا من Implementations الحقيقية.

### الأنواع التي تتطلب Interfaces

- Repositories (للاستبدالية والاختبار).
- Cache (للتبديل بين Implementations).
- External Services (للعزل عن التبعيات الخارجية).
- Facebook Client (للاختبار دون استدعاءات حقيقية).
- Logger (للاختبار دون مخرجات جانبية).

---

## 7. Dependency Injection Strategy

التبعيات في Void لا تُنشأ داخل المكونات — تُحقن من الخارج. هذا يُحقق:
- إمكانية حقن Mock Implementations في الاختبار.
- المرونة في تغيير Implementation دون تعديل المستهلك.
- وضوح التبعيات — كل ما يحتاجه المكون يظهر في constructor.

### نمط الحقن المعتمد

**Constructor Injection** هو النمط الأساسي. كل تبعية تُحقن عبر الـ Constructor. هذا يجعل التبعيات صريحة وغير قابلة للتجاهل.

```
MyService يحتاج: IUserRepository, ISessionManager, ILogger
→ تُحقن جميعها عبر constructor
→ لا new داخل MyService
→ لا Global Singleton يُوصل إليه مباشرة
```

### Container الـ DI

يوجد DI Container مركزي يُسجَّل فيه كل Binding:
- كل Interface ماذا يُحوَّل عند الطلب.
- Scopes الـ Lifecycle: Singleton، Transient، أو Scoped per Request.

الـ Container يُهيَّأ في بداية التطبيق ويُوزَّع من خلاله بناء التبعيات. لا مكان في النظام يُنشئ مباشرة كائنات لها تبعيات بدون المرور بالـ Container.

### Scope الـ Lifecycle

- **Singleton** — ينشأ مرة واحدة ويعيش طوال عمر التطبيق. مثال: ConfigManager، Logger، Database Connection Pool.
- **Scoped** — ينشأ مرة واحدة لكل طلب أو حدث. مثال: Session Context.
- **Transient** — ينشأ في كل مرة يُطلب فيها. مثال: Helper Utilities.

---

## 8. Component Communication

المكونات في Void تتواصل بثلاثة أنماط فقط:

### النمط الأول — Direct Call عبر Interfaces
الأكثر شيوعًا. Command يستدعي Service عبر Interface. Service تستدعي Repository عبر Interface. المرور الكامل عبر الـ Interfaces يضمن الاستبدالية والاختبارية.

```
CommandHandler → IUserService.doSomething()
IUserService ← UserService (تنفيذ فعلي)
```

### النمط الثاني — Event System
للتواصل غير المتزامن بين مكونات لا يجب أن تعرف بعضها. مكون يُطلق Event، مكون آخر يستمع إليه. المُطلِق لا يعرف من سيستمع.

مثال: حين يكتمل Command بنجاح، يُطلق Event `command.completed`. Plugin للتحليل يستمع لهذا الـ Event ويُسجّل البيانات. الـ Command لا يعرف بوجود Plugin التحليل.

### النمط الثالث — Context Propagation
الـ Context كائن يحمل معلومات الحدث الجاري ويُمرَّر عبر Pipeline المعالجة. لا يُعدَّل بشكل عشوائي — كل طبقة تُضيف ما تعرفه وتُمرر الـ Context لمن يليها.

---

## 9. Startup Sequence

عند تشغيل التطبيق من `index.ts`، تجري المراحل التالية بالترتيب الصارم:

### المرحلة الأولى — تحميل الإعدادات
قراءة Environment Variables والتحقق من وجود جميع الإعدادات المطلوبة. الفشل هنا يُوقف التطبيق فورًا برسالة خطأ واضحة. لا يبدأ التطبيق بإعدادات ناقصة.

### المرحلة الثانية — إنشاء DI Container
تسجيل جميع Bindings في الـ Container: الـ Interfaces مع تنفيذاتها، الـ Singletons مع إعداداتها. هذا يحدث قبل إنشاء أي مكون لأن جميع المكونات تعتمد على الـ Container.

### المرحلة الثالثة — تهيئة Infrastructure
إنشاء Database Connection Pool والتحقق من الاتصال. إنشاء Cache Client (Redis أو In-Memory). تهيئة Logger.

### المرحلة الرابعة — تهيئة Managers
إنشاء وتشغيل الـ Managers بالترتيب الصحيح لتبعياتها. كل Manager يُنفّذ منطق التهيئة الخاص به قبل الانتقال للتالي.

### المرحلة الخامسة — تسجيل Commands والـ Plugins
تُسجَّل جميع Commands في الـ CommandRegistry. تُحمَّل Plugins وتُنفَّذ منطق التهيئة الخاص بها. الـ Plugin يمكنه تسجيل Commands أو Middlewares أو Event Listeners.

### المرحلة السادسة — إنشاء Middleware Pipeline
تُجمَّع Middlewares بالترتيب الصحيح: التحقق من التوقيع، الـ Logging، تحميل الـ Session، المصادقة، Rate Limiting.

### المرحلة السابعة — تشغيل Express Server
يُبدأ تشغيل الخادم على المنفذ المُعيَّن. يُسجَّل Webhook Endpoint. يُسجَّل Verification Endpoint.

### المرحلة الثامنة — تشغيل Scheduler
تُبدأ المهام المجدولة. هذا يأتي آخرًا لأن المهام قد تحتاج لجميع المكونات الأخرى جاهزة.

```
index.ts
   │
   ├── 1. loadConfig()
   ├── 2. buildDIContainer()
   ├── 3. initializeInfrastructure()
   ├── 4. initializeManagers()
   ├── 5. registerCommandsAndPlugins()
   ├── 6. buildMiddlewarePipeline()
   ├── 7. startExpressServer()
   └── 8. startScheduler()
        │
        └── ✓ System Ready
```

---

## 10. Application Lifecycle

### مراحل الحياة الكاملة

```
INITIALIZING → READY → RUNNING → SHUTTING_DOWN → STOPPED
```

**INITIALIZING:** المراحل الثماني للـ Startup Sequence تجري.

**READY:** جميع المكونات جاهزة. النظام يقبل الطلبات.

**RUNNING:** النظام في عمل طبيعي يعالج Events.

**SHUTTING_DOWN:** استُقبل إشارة إيقاف (SIGTERM/SIGINT). النظام يُكمل الطلبات الجارية ويرفض الجديدة. يُغلق الاتصالات بترتيب عكسي للفتح.

**STOPPED:** جميع الاتصالات مغلقة. العملية تنتهي.

### Graceful Shutdown

الإيقاف لا يحدث بشكل مفاجئ. حين يستقبل النظام SIGTERM:
1. يتوقف عن قبول طلبات جديدة.
2. ينتظر اكتمال الطلبات الجارية حتى Timeout معيّن.
3. يُغلق الـ Scheduler.
4. يُغلق اتصالات قاعدة البيانات.
5. يُغلق Cache Client.
6. ينهي العملية.

---

## 11. Request Lifecycle

رحلة Webhook Event من لحظة وصوله لحظة الاستجابة:

```
[Facebook Messenger]
        │
        │ POST /webhook
        ▼
[Express Server]
        │
        │ يُمرّر للـ Middleware Pipeline
        ▼
[Signature Verification Middleware]
        │ يتحقق من X-Hub-Signature-256
        │ إذا فشل → 401 Unauthorized
        ▼
[Logging Middleware]
        │ يُسجّل الطلب الوارد
        ▼
[Facebook Layer — Payload Parser]
        │ يُحوّل Payload الخام لـ Internal Events
        ▼
[Facebook Layer — Event Mapper]
        │ يُنشئ Normalized Event Objects
        ▼
[Session Middleware]
        │ يُحمّل أو يُنشئ Session للمستخدم
        ▼
[Context Builder]
        │ يُنشئ Context كامل يحمل الـ Event + Session + Meta
        ▼
[Router / Dispatcher]
        │ يُحدد الـ Handler المناسب
        ├── Command Match → Command Handler
        ├── Plugin Match → Plugin Handler
        └── Fallback Handler
        ▼
[Handler]
        │ يُفوّض للـ Service المناسب
        ▼
[Service]
        │ يُنفّذ Business Logic
        │ يستدعي Repositories إذا لزم
        │ يُطلق Events إذا لزم
        ▼
[Facebook Layer — Message Sender]
        │ يُرسل الرد لـ Facebook API
        ▼
[Facebook Messenger]
        │ يعرض الرد للمستخدم
```

---

## 12. Event Flow

### أنواع الأحداث

**External Events:** أحداث قادمة من Facebook Messenger (رسائل، Postbacks، Quick Replies، إلخ).

**Internal Events:** أحداث داخلية بين مكونات النظام عبر Event Bus. لا تصل لـ Facebook.

### دورة حياة External Event

1. يصل Facebook Event كـ JSON Payload في طلب POST.
2. Facebook Layer تُحوّله لـ Normalized Internal Object يحمل نوع الحدث وبيانات المستخدم والمحتوى.
3. يُمرَّر عبر Middleware Pipeline مع إضافة السياق.
4. يصل للـ Router الذي يُحدد الـ Handler.
5. Handler يُعالج ويُنتج استجابة.
6. Facebook Layer تُرسل الاستجابة.

### دورة حياة Internal Event

1. مكون يُطلق Event عبر Event Bus: `eventBus.emit('user.created', userData)`.
2. Event Bus يُوزع الحدث على جميع Listeners المسجلين.
3. كل Listener يعالج الحدث باستقلالية.
4. لا علاقة مباشرة بين المُطلِق والمستمعين.

### ضمانات Event System

- الـ Event لا يُعالَج بشكل متزامن قبل اكتمال Handler الأصلي إذا كان غير ضروري.
- فشل Listener واحد لا يُوقف بقية الـ Listeners.
- الـ Events ليست قناة لتمرير State — هي إشعارات فقط.

---

## 13. Command Flow

Command هو نقطة دخول تربط نمطًا (Pattern) من الرسائل بـ Handler محدد.

### تسجيل الـ Command

```
CommandRegistry ← تُسجَّل فيه جميع Commands عند Startup
كل Command يُعرِّف:
  - Pattern: النص، Postback، أو Quick Reply الذي يُطلقه
  - Handler: الكلاس أو الدالة المسؤولة عن المعالجة
  - Middleware: اختياري، يُطبَّق قبل Handler هذا Command تحديدًا
```

### معالجة الـ Command

```
Router يُطابق Event مع Command Patterns
        │
        │ Match وُجد
        ▼
Command Middleware تُطبَّق (إن وُجدت)
        │
        ▼
Command Handler يُستدعى مع Context
        │
        │ Command Handler يُفوّض فقط — لا يحتوي Logic
        ▼
Service يُستدعى لتنفيذ العمل الفعلي
        │
        ▼
Handler يُنسّق الاستجابة
        │
        ▼
Facebook Layer تُرسل الرد
```

**قاعدة ذهبية:** Command Handler لا يحتوي على أي Business Logic. مسؤوليته الوحيدة: استخراج البيانات من Context وتفويضها للـ Service المناسب، ثم تنسيق الاستجابة.

---

## 14. Plugin Flow

Plugin هو وحدة اختيارية مستقلة تُضيف وظيفة للـ Framework دون تعديل الـ Core.

### دورة حياة الـ Plugin

```
التهيئة (Startup):
PluginLoader يكتشف الـ Plugins المسجلة
        │
        ▼
كل Plugin يُنفّذ initialize():
  - يُسجّل Commands (اختياري)
  - يُسجّل Middleware (اختياري)
  - يُسجّل Event Listeners (اختياري)
  - يُجري تهيئة خاصة به
        │
        ▼
Plugin جاهز
```

### تشغيل Plugin Handler

```
Router يُحدد أن هذا الـ Event يتعلق بـ Plugin
        │
        ▼
Plugin Handler يُستدعى مع Context
        │
        │ Plugin Handler يُفوّض للـ Service — لا Logic داخله
        ▼
Service يُنفّذ العمل
        │
        ▼
Plugin يُنسّق الرد
```

### عزل الـ Plugin

كل Plugin مستقل ولا يعرف بوجود Plugins أخرى. التواصل بين Plugins — إن احتاج — يتم عبر Event Bus فقط، لا عبر استدعاءات مباشرة.

---

## 15. Service Flow

Services هي قلب Business Logic في Void. كل العمل المعرفي يجري هنا.

### دور الـ Service

```
Service يستقبل: بيانات نظيفة من Handler
Service يُنفّذ: Business Logic (التحقق، الحسابات، القرارات)
Service يستدعي: Repositories للبيانات، وServices أخرى إذا لزم
Service يُطلق: Internal Events إذا لزم
Service يُعيد: نتيجة نظيفة للـ Handler
```

### ما تعرفه الـ Service وما لا تعرفه

**تعرفه:**
- الـ Domain Models والـ Types.
- الـ Repository Interfaces.
- الـ Service Interfaces الأخرى.
- قواعد Business Logic.

**لا تعرفه:**
- Express أو أي HTTP Framework.
- Facebook API أو تفاصيل أي API خارجي.
- كيفية إرسال الرد النهائي للمستخدم.
- تفاصيل قاعدة البيانات أو نوعها.

### تعاون الـ Services

Service يمكنه استدعاء Service آخر عبر Interface. لكن الاستدعاء الدائري ممنوع: A لا تستدعي B التي تستدعي A.

---

## 16. Manager Flow

Managers هي المنسقون — يُديرون الأنظمة ودورات الحياة ولا يحتوون Business Logic.

### دور الـ Manager

```
Manager يُدير:
  - دورة حياة نظام كامل (مثل: Session Manager يُدير إنشاء وانتهاء الجلسات)
  - تنسيق عمل مكونات متعددة دون امتلاك منطق الأعمال نفسه
  - تهيئة وإيقاف الأنظمة بشكل منظم
```

### الفرق بين Manager وService

| Manager | Service |
|---|---|
| يُنسّق ولا يُنفّذ | يُنفّذ Business Logic |
| يعيش طول عمر النظام | يُستدعى عند الحاجة |
| يُدير Lifecycle | لا يهتم بـ Lifecycle |
| مثال: SessionManager | مثال: UserService |

---

## 17. Error Flow

الأخطاء في Void تُعالَج بشكل مركزي ومنظم.

### تصنيف الأخطاء

**Operational Errors:** أخطاء متوقعة في سير العمل. مستخدم غير موجود، قاعدة البيانات بطيئة، صلاحيات غير كافية. هذه أخطاء طبيعية تُعالَج بشكل لطيف.

**Programming Errors:** أخطاء في الكود نفسه. استخدام قيمة غير معرّفة، منطق خاطئ. هذه يجب اكتشافها في الاختبار وليس في الإنتاج.

**External Errors:** أخطاء من Facebook API، قاعدة البيانات، الشبكة. تُعالَج مع آليات Retry إذا كانت مؤقتة.

### مسار الخطأ

```
خطأ يحدث في أي طبقة
        │
        │ يُرمى كـ Typed Error
        ▼
يصعد عبر Call Stack
        │
        │ إذا كان الـ Handler يعرف كيف يُعالجه → يُعالجه
        │ إذا لم يكن → يستمر في الصعود
        ▼
Global Error Handler يستقبل الخطأ
        │
        ├── يُسجّل الخطأ مع السياق الكامل
        ├── يُصنّف الخطأ (Operational / Programming)
        ├── يُرسل رسالة مناسبة للمستخدم عبر Facebook Layer
        └── إذا كان Programming Error → يُنبّه للمراجعة الفورية
```

### ضمانات معالجة الأخطاء

- لا خطأ يسقط العملية (إلا في حالات لا يمكن الاسترداد منها).
- كل خطأ يُسجَّل مع السياق الكامل (من أين جاء، ما السياق، ما البيانات).
- المستخدم يتلقى دائمًا ردًا (حتى لو كان "حدث خطأ").
- لا تفاصيل تقنية تُرسَل للمستخدم النهائي.

---

## 18. Configuration Flow

### مصدر الإعدادات

جميع الإعدادات تأتي من Environment Variables. لا إعدادات صلبة (Hardcoded) في الكود. لا ملفات إعدادات مُلتزَم بها في Git (باستثناء الـ Templates).

### تدفق الإعدادات

```
Environment Variables
        │
        ▼
Config Loader (عند Startup فقط)
        │ يقرأ ويُحقق من وجود جميع الإعدادات المطلوبة
        │ يفشل مبكرًا إذا كان هناك إعداد ناقص
        ▼
Config Object (Immutable)
        │
        ▼
DI Container (يُحقن في من يحتاجه)
        │
        ▼
المكونات التي تحتاج إعدادات تستقبلها عبر DI
```

### قواعد الإعدادات

- الإعدادات تُقرأ مرة واحدة عند بدء التطبيق.
- الإعدادات تُصبح Immutable بعد التحميل — لا تتغير أثناء التشغيل.
- لا مكون يقرأ `process.env` مباشرة — يستقبل الإعداد المحتاج عبر DI.
- الأسرار (Tokens، Passwords) لا تُسجَّل في اللوغات مطلقًا.

---

## 19. Data Flow

### اتجاه تدفق البيانات

```
بيانات خارجية (Facebook Payload)
        │
        │ تحويل وتطبيع (Facebook Layer)
        ▼
Domain Models (نماذج داخلية نظيفة)
        │
        │ تمر عبر Middleware وتُثري بالسياق
        ▼
Services (معالجة وتحويل)
        │
        │ تحفظ/تقرأ من
        ▼
Repositories (قاعدة البيانات)
        │
        │ نتائج ترجع كـ Domain Models
        ▼
Services تُنشئ استجابة
        │
        ▼
Facebook Layer تحوّلها لـ Facebook API Format
        │
        ▼
ترسل لـ Facebook
```

### قواعد تدفق البيانات

**البيانات الخارجية لا تدخل مباشرة للـ Services.** تمر دائمًا عبر Facebook Layer التي تُنظّفها وتُحوّلها.

**الـ Domain Models هي العملة الداخلية.** كل ما يتبادله المكونات داخليًا هو Domain Models نظيفة، ليست Raw Payloads.

**البيانات المُتحقَّق منها فقط تُعالَج.** Zod يُستخدم عند نقاط الدخول للتحقق قبل المعالجة.

**لا Shared Mutable State.** البيانات تُمرَّر بين المكونات، لا تُعدَّل بشكل مشترك.

---

## 20. Facebook Communication Flow

### لماذا Facebook Layer معزولة

Facebook Messenger API تتغير. تُضاف أنواع رسائل جديدة، تُعدَّل هياكل البيانات، تتغير القيود. إذا كانت تفاصيل Facebook منتشرة في الكود، كل تغيير في API يُعني تغييرات في أماكن متعددة. مع العزل الكامل، تغيير API يستلزم تعديل Facebook Layer فقط.

### اتجاه الاتصال

```
الاتجاه الوارد (Incoming):
Facebook API → Facebook Layer → Internal Domain Events

الاتجاه الصادر (Outgoing):
Services → Facebook Layer → Facebook API
```

### ما تفعله Facebook Layer فقط

- التحقق من توقيع Webhook.
- تحليل (Parsing) Webhook Payload الخام.
- تحويل Facebook Event Types إلى Internal Event Types.
- إنشاء Domain Objects من بيانات Facebook.
- إرسال Messages بجميع أنواعها لـ Send API.
- معالجة Rate Limits والـ Retry Logic الخاص بـ Facebook API.

### ما لا تفعله Facebook Layer

- لا Business Logic من أي نوع.
- لا استدعاء مباشر للـ Services.
- لا معرفة بالـ Session أو المستخدم بشكل معمّق.
- لا قرارات تتعلق بمحتوى الرد.

---

## 21. Extension Strategy

### نقاط الامتداد الرسمية

Void يوفر أربع نقاط امتداد رسمية:

**1 — Commands:** لإضافة أنماط تفاعل جديدة مع المستخدمين.
**2 — Plugins:** للوظائف الاختيارية المستقلة.
**3 — Middlewares:** للمعالجة الأفقية على جميع الطلبات.
**4 — Services:** للـ Business Logic الجديد.

### مبدأ الامتداد الآمن

أي امتداد يجب أن:
- يلتزم بالـ Interface المحدد لنقطة الامتداد.
- لا يُعدّل الـ Core.
- لا يخلق تبعيات على مكونات لا يجب أن يعرفها.
- يُسجَّل عبر الآلية الرسمية (Registry، Container).

### امتداد غير رسمي

أي محاولة لامتداد النظام خارج النقاط الرسمية — بتعديل Core مباشرة، أو بالاعتماد المباشر على تفاصيل تنفيذية — هو خرق معماري يُرفض.

---

## 22. Scalability Strategy

### التوسع الأفقي (Horizontal Scaling)

النظام مُصمَّم للعمل بنسخ متعددة خلف Load Balancer بشرط:
- الـ Session يُخزَّن خارجيًا (Redis لا In-Memory).
- لا اعتماد على Local State يختلف بين النسخ.
- الـ Scheduler يُدار بحيث لا تتعارض المهام بين النسخ.

### التوسع الوظيفي (Functional Scaling)

إضافة Commands وPlugins وServices جديدة لا تتطلب تعديل النظام الحالي — فقط إضافة الجديد واستخدامه وتسجيله.

### التوسع الرأسي (Vertical Scaling)

الطبيعة غير المتزامنة للنظام (async/await، non-blocking I/O) تُتيح استخدام أمثل للموارد عند زيادة الـ CPU أو الذاكرة.

---

## 23. Maintainability Strategy

### ما يجعل النظام قابلًا للصيانة معماريًا

**الحدود الواضحة** — مطور جديد يعرف أين يذهب كل نوع من الكود دون حاجة للسؤال.

**الطبقات القصيرة المتخصصة** — كل طبقة صغيرة الحجم ومتخصصة المسؤولية.

**الـ Interfaces كعقود** — إذا احتجت لفهم كيف يتفاعل مكونان، اقرأ الـ Interface بينهما.

**التوثيق المعماري المحدَّث** — هذه الوثيقة ووثائق الدستور الأخرى تُحدَّث مع كل تغيير معماري.

---

## 24. Testability Strategy

### المعمارية التي تُمكّن الاختبار

**Dependency Injection** — يُتيح حقن Mock Implementations في الاختبار دون تغيير الكود المُنتَج.

**Interfaces** — يُتيح إنشاء Mock Objects تُطبّق نفس الـ Interface دون الاتصال بالخدمات الحقيقية.

**Isolated Layers** — كل طبقة يمكن اختبارها بمعزل تام عن بقية النظام.

**No Global State** — لا Singletons مخفية، لا Global Variables تؤثر على الاختبار.

### استراتيجية الاختبار بالطبقات

| الطبقة | نوع الاختبار | ما يُسخَّر |
|---|---|---|
| Services | Unit Tests | Repositories وExternal Services مُسخَّرة بـ Mocks |
| Repositories | Integration Tests | قاعدة بيانات اختبار حقيقية |
| Facebook Layer | Unit Tests | HTTP Client مُسخَّر |
| Commands / Plugins | Unit Tests | Services مُسخَّرة |
| Middleware | Unit Tests | Context مُنشأ يدويًا |
| End-to-End | E2E Tests | نظام كامل مع Facebook API مُسخَّرة |

---

## 25. Replaceability Strategy

### ما يمكن استبداله دون تغيير الـ Core

**قاعدة البيانات:** بتغيير Repository Implementations وإعادة تسجيلها في الـ Container.

**Cache:** بتغيير Cache Implementation وإعادة تسجيلها.

**Logger:** بتغيير Logger Implementation.

**Facebook Client (في الاختبار):** بحقن Mock Client.

### ما لا يمكن استبداله

تفاصيل Domain Models ومنطق Business Logic هي مملوكة للمشروع ولا تُستبدل — تُطوَّر وتُحسَّن بمرور الوقت.

---

## 26. Architecture Constraints

القيود التالية غير قابلة للكسر. أي كود يخرقها يُرفض بصرف النظر عن أي مبرر:

### القيد الأول — عزل Facebook Layer
لا يوجد استدعاء مباشر لـ Facebook API خارج طبقة `facebook/`. إذا احتاجت Service لإرسال رسالة، تُفوّض لـ Interface يُطبّقه Facebook Layer — لا تستدعي Facebook API مباشرة.

### القيد الثاني — Business Logic في Services فقط
لا Business Logic في Commands، Plugins، Handlers، Middlewares، Managers، أو Repositories. إذا وجد منطق أعمال خارج Services، فهو في المكان الخطأ.

### القيد الثالث — الاعتماد في اتجاه واحد
Core لا يعرف بوجود Infrastructure. Application لا تعرف بوجود Entry Points. الاعتماد من الخارج للداخل فقط.

### القيد الرابع — لا Circular Dependencies
إذا ظهرت Circular Dependency، فهذا خطأ في تصميم الحدود يجب حله بإعادة التصميم، لا بالتحايل.

### القيد الخامس — الـ Interfaces تُعرَّف في Core
جميع Interfaces التي تُستخدم كحدود بين الطبقات تُعرَّف في Core Layer. لا Interface يُعرَّف في Infrastructure ثم يُستهلَك من Application.

### القيد السادس — لا Global Mutable State
لا `global` variables، لا Singletons تحمل State قابل للتغيير. State تُدار داخل المكونات المناسبة ويُمرَّر عبر DI.

### القيد السابع — لا Access مباشر للـ Infrastructure من Entry Points
Commands وPlugins لا تستدعي Repositories مباشرة. تستدعي Services التي تستدعي Repositories.

---

## 27. Architecture Anti-Patterns

الأنماط التالية ممنوعة في Void بشكل مطلق:

### Circular Dependencies
```
❌ ServiceA → ServiceB → ServiceA
```
الحل دائمًا يكون في إعادة تصميم الحدود أو استخراج مكون مشترك.

### Tight Coupling
```
❌ class MyService { private repo = new PostgresUserRepo() }
✅ class MyService { constructor(private repo: IUserRepository) }
```
لا مكون يعرف تفاصيل تنفيذ مكون آخر.

### God Objects
```
❌ BotManager يفعل كل شيء: يُدير Sessions، يُرسل رسائل، يُنفّذ Business Logic
✅ كل مسؤولية في مكونها المناسب
```

### Spaghetti Code
```
❌ تدفق لا يمكن تتبعه: A يستدعي B يستدعي C يستدعي A ويُعدّل D
✅ تدفق واضح وخطي من الخارج للداخل
```

### Shared Mutable State
```
❌ let globalUserState = {} يُعدَّل من أي مكان
✅ State محلية ومُدارة داخل المكون المناسب ومُمرَّرة بشكل صريح
```

### Layer Bypass
```
❌ Command Handler يستدعي Repository مباشرة
✅ Command Handler → Service → Repository
```

### Business Logic خارج Services
```
❌ Plugin Handler: if (user.credits > 10) { ... تنفيذ منطق أعمال ... }
✅ Plugin Handler يُفوّض: userService.processIfEligible(userId)
```

### Facebook API خارج Facebook Layer
```
❌ Service تستدعي fetch('https://graph.facebook.com/...') مباشرة
✅ Service تستدعي IFacebookClient.sendMessage() والـ Interface يُطبّقه Facebook Layer
```

### Premature Abstraction
```
❌ إنشاء Interface لكل شيء حتى قبل وجود سبب للتجريد
✅ Abstraction يُنشأ حين تظهر الحاجة الواضحة إليه
```

### Silent Failures
```
❌ try { ... } catch (e) { /* تجاهل */ }
✅ كل خطأ يُعالَج بوعي أو يُرمى لأعلى
```

---

## 28. Future Architecture Vision

### المرحلة القريبة — تعميق الطبقات
مع نمو المشروع، قد تحتاج بعض الطبقات لتقسيمات داخلية. مثلًا: Application Layer يمكن تقسيمها لـ Use Cases Layer وServices Layer. هذا التقسيم ممكن دون تغيير مبادئ التدفق الحالية.

### المرحلة المتوسطة — Plugin Ecosystem
تطوير نظام Plugin أكثر قوة يُتيح:
- اكتشاف Plugins تلقائي دون تسجيل يدوي.
- Plugin versioning ومنع تعارضات الإصدارات.
- Plugin marketplace بمعنى تقني: مستودع مشاركة Plugins.

### المرحلة البعيدة — Multi-Adapter Architecture
إذا قُرِّر دعم منصات Messaging أخرى، تُضاف Adapter Layer فوق Facebook Layer:
```
Application Layer (لا تتغير)
        ↑
IMessagingAdapter (Interface في Core)
        ↑
FacebookAdapter / TelegramAdapter / ...
```
هذا ممكن هندسيًا الآن بفضل عزل Facebook Layer — التغيير مستقبلي لن يلمس الـ Core.

### مبدأ ثبات المركز
مهما تطورت الطبقات الخارجية وامتدت الـ Plugins ونمت القدرات، Core Domain Layer يبقى ثابتًا ومستقرًا. هو قلب النظام وعقده الأساسية لا تتغير إلا لأسباب جوهرية مع تغيير الإصدار الرئيسي.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
