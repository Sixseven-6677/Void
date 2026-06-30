# 04 — Dependency Rules

> **المرجع الرسمي لقواعد الاعتماد داخل مشروع Void**
> يُقرأ هذا الملف قبل إضافة أي Dependency جديدة أو تعديل أي علاقة بين المكونات.
> أي اعتماد لا يتوافق مع هذه القواعد يُعدّ انتهاكًا معماريًا يجب تصحيحه.

---

## Table of Contents

1. [Dependency Philosophy](#1-dependency-philosophy)
2. [Dependency Direction](#2-dependency-direction)
3. [Allowed Dependencies](#3-allowed-dependencies)
4. [Forbidden Dependencies](#4-forbidden-dependencies)
5. [Dependency Inversion Principle](#5-dependency-inversion-principle)
6. [Dependency Injection Rules](#6-dependency-injection-rules)
7. [Interface-Based Design](#7-interface-based-design)
8. [Layer Communication Rules](#8-layer-communication-rules)
9. [Public APIs](#9-public-apis)
10. [Internal APIs](#10-internal-apis)
11. [Circular Dependency Prevention](#11-circular-dependency-prevention)
12. [Tight Coupling Prevention](#12-tight-coupling-prevention)
13. [Shared State Rules](#13-shared-state-rules)
14. [Module Isolation](#14-module-isolation)
15. [Package Boundaries](#15-package-boundaries)
16. [Dependency Decision Guide](#16-dependency-decision-guide)
17. [Dependency Review Checklist](#17-dependency-review-checklist)
18. [Common Dependency Mistakes](#18-common-dependency-mistakes)
19. [Best Practices](#19-best-practices)
20. [Future Expansion Rules](#20-future-expansion-rules)

---

## 1. Dependency Philosophy

في Void، الاعتماد بين المكونات ليس مجرد تفصيل تقني — هو قرار معماري يُحدد مدى قابلية النظام للتعديل والاختبار والصيانة على المدى البعيد.

### المبدأ الجوهري

**كل اعتماد هو التزام.** حين يعتمد مكون على مكون آخر، يصبح مقيدًا بتغييراته. كلما زادت الاعتمادات، زادت القيود، وقلت المرونة. لذلك:

- كل اعتماد يجب أن يكون ضروريًا، مُبرَّرًا، وأضيق ما يمكن.
- يُفضَّل الاعتماد على التجريد (Interface) على الاعتماد على التفاصيل (Implementation).
- يُفضَّل الاعتماد على القليل على الاعتماد على الكثير.
- كل اعتماد جديد يُضاف بوعي، لا بالعادة.

### الهدف من قواعد الاعتماد

**المرونة:** استبدال أي مكون لا يُعيق بقية النظام.
**الاختبارية:** عزل أي مكون وحقن Mocks بدلًا من الـ Real Implementations.
**الوضوح:** من يقرأ الـ Constructor أو الـ Imports يفهم فورًا ما يحتاجه المكون.
**الاستقرار:** تغيير التفاصيل لا يتسرب للطبقات الداخلية.

---

## 2. Dependency Direction

الاعتماد في Void يسير في اتجاه واحد صارم: **من الطبقات الخارجية للطبقات الداخلية**.

```
Entry Points (Commands, Plugins)
        │
        │  يعتمد على
        ▼
Coordination (Managers, Middleware, Events)
        │
        │  يعتمد على
        ▼
Application (Services)
        │
        │  يعتمد على
        ▼
Core Domain (Interfaces, Types, Errors)
        ▲
        │  تُطبَّق من قبل
Infrastructure (Database, Cache, Facebook Layer)
```

### القانون الذهبي

**لا طبقة داخلية تعتمد على طبقة خارجية.**

Core لا يعرف بوجود Services. Services لا تعرف بوجود Express. Interfaces في Core تصف الوظيفة، والـ Implementations في الطبقات الخارجية تُنفّذها.

### خرق الاتجاه

أي اعتماد يسير عكس الاتجاه هو **خرق معماري** يُرفض فورًا:

```
❌ Core يستورد من Service
❌ Service تستورد من Command
❌ Database Repository تستورد من Business Service
❌ Facebook Layer تستورد Business Logic من Service
```

---

## 3. Allowed Dependencies

### جدول الاعتمادات المسموح بها

| الطبقة | تعتمد على | تُستخدَم من |
|---|---|---|
| **Core** | لا شيء | جميع الطبقات |
| **Facebook Layer** | Core | Middleware, Entry Points |
| **Services** | Core (Interfaces فقط) | Commands, Plugins, Managers, Scheduler |
| **Commands** | Core, Service Interfaces | Router / Dispatcher |
| **Plugins** | Core, Service Interfaces, IEventBus | PluginLoader |
| **Events** | Core | جميع الطبقات (للإطلاق والاستماع) |
| **Middleware** | Core, ISessionService, ICacheClient | Express Pipeline |
| **Managers** | Core, Service Interfaces, Infrastructure Interfaces | Startup / Shutdown |
| **Database (Repos)** | Core, ORM Library | Services فقط |
| **Cache** | Core, Cache Library | Services, Middleware |
| **Scheduler** | Core, Service Interfaces, Scheduling Library | Startup / Shutdown |
| **Utils** | مكتبات عامة، Core (اختياري) | أي طبقة |
| **Configs** | Core (للـ Types)، Validation Library | DI Container, Startup |

---

## 4. Forbidden Dependencies

### جدول الاعتمادات الممنوعة

| الطبقة | ممنوع عليها الاعتماد على |
|---|---|
| **Core** | أي طبقة أخرى في المشروع، أي Runtime Library |
| **Services** | Express/HTTP, Facebook API مباشرة, Repository Implementations, Commands, Plugins |
| **Commands** | Repository Implementations, Database Layer, Cache Layer, Scheduler مباشرة, Facebook API مباشرة |
| **Plugins** | Plugins أخرى مباشرة, Core Implementations, Database Layer مباشرة |
| **Middleware** | Business Services مباشرة (إلا لتحميل سياق)، Facebook API |
| **Managers** | Commands, Plugins, Facebook API مباشرة, Repository Implementations |
| **Database (Repos)** | Services, Commands, Plugins, Cache, Scheduler, Facebook Layer |
| **Cache** | Database, Services, Commands, Plugins |
| **Scheduler** | Repository Implementations, Database مباشرة, Facebook API مباشرة |
| **Utils** | أي طبقة من طبقات التطبيق (Services, Repos, Facebook, إلخ) |
| **Configs** | أي طبقة من طبقات التطبيق |

---

## 5. Dependency Inversion Principle

### التعريف الذي يُحكم به Void

الطبقات العليا (High-Level Modules) لا تعتمد على الطبقات الدنيا (Low-Level Modules). كلاهما يعتمد على التجريدات (Abstractions). التجريدات لا تعتمد على التفاصيل. التفاصيل تعتمد على التجريدات.

### كيف يُطبَّق في Void

**الخطوة الأولى:** تُعرَّف Interface في Core تصف ما يحتاجه المكون.
**الخطوة الثانية:** الطبقة العليا (Service مثلًا) تعتمد على هذه الـ Interface.
**الخطوة الثالثة:** الطبقة الدنيا (Repository مثلًا) تُطبّق هذه الـ Interface.
**الخطوة الرابعة:** DI Container يربط الـ Interface بتطبيقها عند Runtime.

```
Service ──────────→ IUserRepository  (تعريف في Core)
                           ▲
                           │ تُطبّق
                PostgresUserRepository  (تنفيذ في Database Layer)
```

هذا يعني أن Service يمكن اختبارها بـ `MockUserRepository` بدون لمس الـ Service نفسها.

### متى تُطبَّق DIP

- عند الحاجة لعزل Business Logic عن Infrastructure.
- عند وجود إمكانية لتعدد Implementations (SQLite في الاختبار، Postgres في الإنتاج).
- عند الحاجة لاختبار مكون بمعزل.
- دائمًا لأي اعتماد يعبر حدود الطبقات.

---

## 6. Dependency Injection Rules

### القاعدة الأساسية

**لا يُنشئ مكون تبعياته بنفسه.** كل Dependency تأتي من الخارج. الـ Constructor يُعلن احتياجاته — لا يُشبعها.

### أنواع الحقن وقواعد استخدامها

#### Constructor Injection — الأساس المطلق

الحقن عبر الـ Constructor هو النمط الإلزامي لجميع مكونات النظام.

**يُستخدم دائمًا عندما:**
- التبعية ضرورية لعمل المكون (لا يمكن للمكون العمل بدونها).
- التبعية ثابتة طوال عمر المكون (لا تتغير بعد الإنشاء).
- الاختبار يتطلب حقن Mock بدلًا من الـ Real Implementation.

**القاعدة:** إذا لم يتوفر الـ Dependency، يفشل الإنشاء فورًا — لا Null Checks لاحقة، لا Lazy Initialization مخفية.

#### Factory — للإنشاء المشروط

يُستخدم Factory حين يختلف نوع الـ Dependency بناءً على شروط تُعرَف عند Runtime، لا عند Startup.

**يُستخدم عندما:**
- نوع الكائن يُحدَّد ديناميكيًا بناءً على بيانات Runtime.
- إنشاء الكائن مكلف ولا يجب أن يحدث إلا عند الحاجة الفعلية.

**لا يُستخدم لـ:**
- تجنب Constructor Injection الواضح.
- إخفاء الـ Dependencies عن المستهلك.

#### Provider — للاعتمادات ذات Scope محدد

يُستخدم Provider حين تحتاج الـ Dependency لتهيئة مرتبطة بـ Scope معين (مثل Request Scope).

**يُستخدم عندما:**
- Dependency تعيش طول فترة طلب واحد، لا طول عمر التطبيق.
- Dependency تحتاج معلومات من Context الطلب لإنشائها.

### قواعد Singleton

**متى يُستخدم Singleton:**
- عندما يجب أن يكون هناك نسخة واحدة فقط من المكون (Connection Pool، Logger، Config).
- عندما إنشاء نسخ متعددة يُهدر موارد أو يُنشئ تعارضًا.

**متى يُمنع Singleton:**
- حين يحمل المكون State مرتبطًا بـ Request أو User — Singleton في هذه الحالة يُنشئ تعارضًا بين الطلبات.
- حين الاختبار يحتاج عزل State بين حالات الاختبار.
- حين يجب أن يكون للمكون دورة حياة أقصر من دورة التطبيق.

**قاعدة ذهبية للـ Singleton:** Singleton المقبول هو Singleton يمكن تهيئته مرة واحدة ثم يتصرف بنفس الطريقة في كل استدعاء. Singleton مع Mutable State قابل للتعارض بين Requests هو خطر بالتعريف.

**أمثلة مقبولة للـ Singleton:** `Logger`، `Config`، `DatabaseConnectionPool`، `EventBus`.
**أمثلة مرفوضة للـ Singleton:** `UserSession`، `RequestContext`، أي شيء يحمل State خاص بمستخدم أو طلب.

---

## 7. Interface-Based Design

### متى يجب استخدام Interface

**القاعدة:** أي اعتماد يعبر حدود الطبقات يجب أن يكون عبر Interface.

**يجب استخدام Interface عندما:**
- مكون من طبقة يستخدم مكونًا من طبقة مختلفة.
- هناك احتمالية لتعدد Implementations الآن أو مستقبلًا.
- الاختبار يحتاج Mock بدلًا من الـ Real Implementation.
- الاستبدالية مطلوبة (مثل: استبدال Redis بـ In-Memory Cache في الاختبار).

**لا يلزم Interface عندما:**
- كلا المكونَين في نفس الطبقة ولن يُستبدَل أيٌّ منهما.
- المكون Helper صغير بسيط خالص (Pure Function في Utils) لا يحتاج استبدالًا.

### متى يُمنع الاعتماد على Implementation مباشرة

**يُمنع دائمًا الاعتماد على Implementation عبر حدود الطبقات:**

```
❌ Service تستورد PostgresUserRepository مباشرة
✅ Service تعتمد على IUserRepository (Interface في Core)

❌ Command تستورد FacebookMessageSender مباشرة
✅ Command تعتمد على IFacebookClient (Interface في Core)
```

### متى يُمرَّر Service ومتى يُمنع إنشاؤه داخليًا

**يُمرَّر Service دائمًا عبر Constructor Injection:**

```
❌ class OrderCommand {
     private service = new OrderService(new UserRepo(...))
   }

✅ class OrderCommand {
     constructor(private service: IOrderService) {}
   }
```

**يُمنع إنشاء Service داخل Class أخرى** لأنه:
- يُخفي التبعية عن المستهلك.
- يمنع الاختبار بـ Mock.
- يُنشئ Tight Coupling بين المكون والـ Implementation.
- يكسر Single Responsibility (المكون يُدير إنشاء تبعياته بدلًا من التركيز على مسؤوليته).

---

## 8. Layer Communication Rules

### القاعدة الأولى — العبور عبر Interface فقط

كل تواصل بين طبقات مختلفة يمر عبر Interface مُعرَّفة في Core. لا استيراد مباشر لـ Concrete Classes عبر حدود الطبقات.

### القاعدة الثانية — لا قفز على الطبقات

الاتصال يسير بشكل متدرج. Command → Service → Repository. لا يحق للـ Command تجاوز الـ Service للوصول مباشرة للـ Repository.

```
❌ Command → Repository (قفز على Service)
✅ Command → Service → Repository
```

### القاعدة الثالثة — البيانات بين الطبقات Domain Models فقط

ما يُبادَل بين الطبقات هو Domain Models المُعرَّفة في Core، لا:
- Raw HTTP Request Objects.
- Raw Database Row Objects.
- Raw Facebook Payloads.
- Framework-specific Objects.

كل طبقة تُحوّل ما تستقبله إلى Domain Model قبل تمريره للطبقة التالية.

### القاعدة الرابعة — الاتصال المتزامن عبر Direct Call، غير المتزامن عبر Events

- إذا كان مكون يحتاج نتيجة فورية من مكون آخر: Direct Call عبر Interface.
- إذا كان مكون يريد إخطار مكونات أخرى دون انتظار نتيجة: Event Bus.

لا يُستخدم Event Bus لنقل نتائج أو كبديل للـ Function Return Value.

---

## 9. Public APIs

Public API هو ما تُصدّره الطبقة للعالم الخارجي — الجزء الذي يُعتمد عليه من خارج الطبقة.

### خصائص Public API الجيد

- **مستقر:** لا يتغير بدون سبب وجيه ومراجعة.
- **واضح:** يعبّر عن القصد بدون معرفة التفاصيل الداخلية.
- **محدود:** يُصدَّر أقل ما يمكن — ما لا يُصدَّر لا يخلق التزامات.
- **مبني على Interfaces:** ما تُصدَّره الطبقة للخارج هو Interfaces لا Implementations.

### قاعدة الـ Public API

كل مكون يُحدد ما هو عام وما هو خاص. العام يظهر في Interface مُعرَّفة في Core. الخاص يبقى داخل الطبقة لا يُستورد من خارجها. إضافة شيء للـ Public API قرار يُفكَّر فيه ملياً — سهل الإضافة وصعب الإزالة.

---

## 10. Internal APIs

Internal API هو ما يُستخدَم داخل الطبقة ولا يُصدَّر للخارج.

### قاعدة الـ Internal API

- مكونات داخل نفس الطبقة تتواصل مباشرة دون الحاجة لـ Interfaces إذا كانت صغيرة ولن تتغير.
- ما هو Internal يجب ألا يُستورَد من خارج الطبقة. إذا احتاج خارجي لـ Internal، فهذا يُشير لأحد:
  1. الـ Internal يجب أن يُرفَّع لـ Public API عبر Interface في Core.
  2. الخارجي يطلب شيئًا خارج حدوده — وهذا خرق معماري.

---

## 11. Circular Dependency Prevention

### ما هي Circular Dependency

Circular Dependency تحدث حين مكون A يعتمد على مكون B الذي يعتمد — بشكل مباشر أو عبر سلسلة — على مكون A مرة أخرى.

```
A → B → C → A  ❌ دائري — خطأ
A → B → C      ✅ خطي — صحيح
```

### لماذا هي خطيرة

- تجعل الاختبار المعزول مستحيلًا — لا يمكن حقن Mock دون كسر الحلقة.
- تجعل الفهم صعبًا — لا نقطة بداية واضحة لتتبع التدفق.
- تخلق ترتيب تهيئة غير محدد — من يُهيَّأ أولًا؟
- تُشير دائمًا لمشكلة في تصميم الحدود.

### أسباب حدوث Circular Dependencies

**السبب الأول — حدود الطبقات غير واضحة:**
ServiceA تحتاج شيئًا من ServiceB، وServiceB تحتاج شيئًا من ServiceA، لأن الحد بينهما لم يُصمَّم بعناية.

**السبب الثاني — مسؤوليات متداخلة:**
مكونان يتشاركان مسؤولية واحدة ولم يُفصَلا بشكل صحيح.

**السبب الثالث — Imports مقلوبة:**
طبقة داخلية تستورد من طبقة خارجية (عكس الاتجاه الصحيح).

**السبب الرابع — God Service:**
Service واحدة كبيرة تعتمد على جميع Services الأخرى التي تعتمد عليها بشكل متشابك.

### كيفية الاكتشاف

- تحليل شجرة الـ Imports يدويًا أو بأدوات مثل `madge`.
- الـ TypeScript يُبلّغ أحيانًا عن Circular Imports وقت Compilation.
- إذا وجد المطور نفسه في حلقة من الـ Imports — الدائرية موجودة.

### كيفية المنع

**المنع الهيكلي:**
اتباع قاعدة الاتجاه الواحد يمنع الدائرية هيكليًا. إذا A في طبقة أعلى من B، فA يعتمد على B، لكن B لا يعتمد على A — وهذا يُستحيل معه الدائرية.

**عند ظهور الحاجة للدائرية، أحد هذه الحلول يُطبَّق:**

**الحل الأول — استخراج المشترك:**
استخراج الجزء الذي يحتاجه كلاهما في مكون C مستقل. A وB كلاهما يعتمدان على C.

**الحل الثاني — Event Bus:**
A يُطلق Event، B يستمع له. لا اعتماد مباشر بينهما في أي اتجاه.

**الحل الثالث — إعادة تصميم الحدود:**
ربما A وB يمثلان مسؤولية واحدة يجب دمجها في مكون واحد.

### أمثلة

```
❌ Circular:
UserService → OrderService → UserService

✅ الحل — استخراج المشترك:
UserService  →  IUserRepository  (Core)
OrderService →  IUserRepository  (Core)
لا اعتماد مباشر بين الـ Services
```

```
❌ Circular عبر Events:
SessionService تُطلق حدث → SessionCleanup Listener يستدعي SessionService

✅ الحل — فصل المسؤولية:
SessionService تُطلق حدث 'session.expired'
CleanupService (منفصلة) تستمع وتُنفّذ التنظيف
لا دائرية لأن CleanupService لا تعتمد على SessionService
```

---

## 12. Tight Coupling Prevention

### ما هو Tight Coupling

Tight Coupling يعني أن مكونًا يعرف تفاصيل تنفيذ مكون آخر، مما يجعل تغيير الثاني يُلزم تغيير الأول.

### الاستبدالية كمعيار

القاعدة الذهبية: **هل يمكن استبدال هذا المكون بآخر يُطبّق نفس الـ Interface دون تغيير أي مستهلك له؟** إذا كانت الإجابة "لا" — يوجد Tight Coupling يجب معالجته.

### Facebook Layer — قابلة للاستبدال بالكامل

Facebook Layer تُطبّق `IFacebookClient`. أي مكون يحتاج إرسال رسالة يعتمد على `IFacebookClient` لا على Facebook Layer نفسها. هذا يعني:

- يمكن استبدال Facebook Layer بـ Telegram Adapter دون تعديل أي Service.
- يمكن حقن Mock Facebook Client في الاختبار دون إرسال طلبات حقيقية.
- يمكن تغيير تفاصيل Facebook API داخليًا دون إخطار بقية النظام.

**كيف يُحقَّق:** لا أحد يستورد `FacebookMessageSender` مباشرة — يستوردون `IFacebookClient` من Core.

### Database — قابلة للاستبدال بالكامل

Repositories تُطبّق Interfaces مُعرَّفة في Core. Services تعتمد على هذه الـ Interfaces. هذا يعني:

- يمكن استبدال PostgreSQL بـ SQLite في بيئة الاختبار.
- يمكن استبدال Drizzle ORM بمكتبة أخرى دون تعديل Services.
- يمكن حقن In-Memory Repository في الاختبار.

**كيف يُحقَّق:** لا Service تستورد `PostgresUserRepository` — تستورد `IUserRepository` من Core.

### Cache — اختيارية

Cache يجب أن تكون طبقة إضافية يمكن إزالتها دون كسر النظام. Business Logic لا تعتمد على وجود Cache — النظام يعمل بدونها (ربما بأداء أقل).

**كيف يُحقَّق:** Cache-Aside Pattern في Service: تتحقق من Cache، وإذا لم تجد تذهب للـ Repository مباشرة. إزالة Cache لا تُوقف الـ Flow.

### Logger — قابل للاستبدال

Logger يُطبّق `ILogger` Interface. لا مكون يستورد مكتبة Logger مباشرة — يستقبل `ILogger` عبر DI.

**كيف يُحقَّق:** يمكن تغيير من `pino` لـ `winston` لـ Console Logger بسيط دون تعديل أي مكون يستخدم Logger.

### المكتبات الخارجية لا تنتشر

**القاعدة:** أي مكتبة خارجية تبقى محصورة في الطبقة المالكة لها. لا تُكشَف تفاصيلها للطبقات المستهلكة.

```
❌ Service تستقبل Drizzle ORM objects من Repository مباشرة
✅ Repository تُحوّل Drizzle results لـ Domain Models قبل إعادتها

❌ Command يستقبل Express Request object مباشرة
✅ Middleware تستخرج ما يلزم من Request وتُنشئ Context نظيف

❌ Plugin تستخدم Redis Client object مباشرة
✅ Plugin تستخدم ICacheClient Interface المُحقَنة
```

---

## 13. Shared State Rules

### الحالة المشتركة مصدر للمشاكل

الحالة (State) التي تُعدَّل من أماكن متعددة في نفس الوقت تُنشئ تعارضات يصعب اكتشافها وتشخيصها، خاصةً في بيئة Async.

### القواعد

**القاعدة الأولى — لا Global Mutable State**
لا `let globalState = {}` تُعدَّل من أي مكان. إذا احتاج مكونان لتبادل State، فإما أن تُمرَّر صراحةً أو تُدار بواسطة مكون متخصص (Manager أو Service).

**القاعدة الثانية — Singletons تحمل State ثابتة أو تُدير State بعناية**
Singleton يحمل Mutable State يُعدَّل من أماكن متعددة هو مشكلة في بيئة Async. Config Singleton مقبول لأنه Immutable. UserSession Singleton مرفوض لأنه يتغير مع كل حدث.

**القاعدة الثالثة — State الطلب تعيش في Context Object**
كل ما يخص طلبًا واحدًا يعيش في Context Object الخاص به — لا تُخزَّن في Module-level Variables.

**القاعدة الرابعة — State المشتركة بين Services تُدار عبر Database أو Cache**
إذا احتاجت ServiceA وServiceB لتبادل State، فكلتاهما تقرأ وتكتب من مصدر مشترك (Database أو Cache)، لا من Shared Memory Object.

---

## 14. Module Isolation

### مبدأ العزل

كل Module يجب أن يكون قادرًا على:
- الفهم بمعزل دون قراءة بقية النظام.
- الاختبار بمعزل بحقن Mocks.
- الاستبدال بمعزل دون تأثير على ما يعتمد عليه.

### كيف يُحقَّق العزل

**Barrel Exports:** كل Layer أو Module يُصدَّر عبر نقطة دخول واحدة (`index.ts`). المستهلك يستورد من نقطة الدخول، لا من الملفات الداخلية مباشرة.

```
❌ import { PostgresUserRepository } from '../database/repositories/user/postgres.repository'
✅ import { IUserRepository } from '../core/interfaces'
```

**لا Import مباشر من داخل Layer أخرى:**
إذا احتاج مكون لشيء من Layer أخرى، يستورده من نقطة الدخول الرسمية (عبر الـ Interface في Core)، لا من مسار ملف داخلي.

---

## 15. Package Boundaries

### مكتبات npm الخارجية

كل مكتبة خارجية تعيش في المنطقة المناسبة لها ولا تتسرب خارجها:

| المكتبة | طبقتها | لا تظهر خارج |
|---|---|---|
| Drizzle ORM | Database Layer | داخل Repositories فقط |
| Express | Entry Point / Middleware | لا تظهر في Services أو Core |
| ioredis | Cache Layer | داخل CacheClient Implementation فقط |
| node-cron | Scheduler Layer | داخل Scheduler Implementation فقط |
| Axios / fetch | Facebook Layer | داخل Facebook HTTP Client فقط |
| Zod | Middleware (Validation) + Configs | عند الحدود للتحقق، لا تنتشر في Core |
| Vitest | Test Files فقط | لا يُستخدم في Production Code |

### إضافة مكتبة خارجية جديدة

أي مكتبة خارجية جديدة تستلزم الإجابة على:
1. ما الطبقة المالكة لها؟ هل هي واضحة؟
2. هل ستتسرب خارج طبقتها؟ كيف نمنع ذلك؟
3. هل يمكن حل المشكلة بكود داخلي بسيط بدلًا منها؟
4. إذا أردنا استبدالها لاحقًا، ما الذي سيتأثر؟

---

## 16. Dependency Decision Guide

قبل إضافة أي Dependency جديدة، يُجيب المطور أو نظام الذكاء الاصطناعي على هذه الأسئلة بالترتيب:

---

### السؤال الأول: هل هذه الطبقة هي المكان الصحيح لهذا الاعتماد؟

هل الـ Dependency ذات صلة بمسؤولية هذه الطبقة؟
مثال: إضافة Redis Client في Service — لا، Redis ينتمي للـ Cache Layer. الـ Service تستخدم `ICacheClient` Interface.

**إذا كانت الإجابة "لا"** → لا تُضَف هنا. حدد الطبقة الصحيحة أولًا.

---

### السؤال الثاني: هل يوجد Interface بالفعل في Core يُغطي هذه الحاجة؟

قبل إضافة اعتماد جديد، تحقق من Interfaces في Core.

**إذا كانت الإجابة "نعم"** → استخدم الـ Interface الموجود.
**إذا كانت الإجابة "لا"** → هل يجب إنشاء Interface جديد في Core؟ نعم إذا كان الاعتماد يعبر حدود الطبقات.

---

### السؤال الثالث: هل يمكن إعادة استخدام Dependency موجودة؟

هل يوجد بالفعل Service أو Repository أو Utility يُوفر ما تحتاجه؟

**إذا كانت الإجابة "نعم"** → استخدمه. لا تُنشئ نسخة أخرى تفعل نفس الشيء.

---

### السؤال الرابع: هل سيؤدي هذا إلى Tight Coupling؟

هل المكون الذي تُضيف الاعتماد إليه سيعرف تفاصيل تنفيذ المكون الذي تعتمد عليه؟

**إذا كانت الإجابة "نعم"** → مرّر عبر Interface لا عبر Implementation.

---

### السؤال الخامس: هل يمكن استبدال هذا المكون مستقبلًا دون أثر واسع؟

إذا أردنا استبدال هذا الـ Dependency لاحقًا، كم سيتأثر النظام؟

**إذا كان التأثير يمتد لطبقات متعددة** → يوجد Tight Coupling. أعد التصميم بإضافة Interface.
**إذا كان التأثير محدودًا بطبقة واحدة** → الاعتماد معزول بشكل صحيح.

---

### السؤال السادس: هل هذا الاعتماد يكسر اتجاه الطبقات؟

هل الاعتماد الجديد يسير من الخارج للداخل (الاتجاه الصحيح)؟

**إذا كان يسير من الداخل للخارج** → هذا خرق معماري. لا يُضاف بأي حال.

---

### السؤال السابع: هل هذه مكتبة خارجية جديدة؟

**إذا كانت الإجابة "نعم"** → أجب على:
- ما المشكلة التي تحلها هذه المكتبة بالضبط؟
- هل يمكن حلها بكود بسيط داخلي؟
- هل المكتبة مُصانة وذات مجتمع نشط؟
- في أي طبقة ستعيش؟ هل ستتسرب خارجها؟

**إذا لم تكن الإجابات مُرضية** → لا تُضَف المكتبة.

---

## 17. Dependency Review Checklist

قبل دمج أي تغيير يُضيف أو يُعدّل Dependency، تُراجَع هذه القائمة:

### التحقق من الاتجاه
- [ ] الاعتماد يسير من الخارج للداخل.
- [ ] لا طبقة داخلية تعتمد على طبقة خارجية.

### التحقق من الـ Interface
- [ ] الاعتماد عبر Interface لا على Implementation (عند عبور الحدود).
- [ ] الـ Interface مُعرَّفة في Core.

### التحقق من Circular Dependencies
- [ ] لا دائرية جديدة ناتجة عن هذا الاعتماد.

### التحقق من العزل
- [ ] المكتبة الخارجية الجديدة لن تتسرب خارج طبقتها.
- [ ] Framework Objects لا تُمرَّر عبر الطبقات.

### التحقق من الاختبارية
- [ ] المكون المُضاف يمكن اختباره بمعزل بعد هذا التغيير.
- [ ] لا Singleton جديد يحمل Mutable State يُعرقل الاختبار.

### التحقق من الضرورة
- [ ] هذا الاعتماد ضروري — لا بديل أبسط.
- [ ] لا تكرار لاعتماد موجود يُغطي نفس الحاجة.

---

## 18. Common Dependency Mistakes

### الخطأ الأول — استيراد Implementation مباشرة عبر الطبقات

```
❌ import { PostgresUserRepository } from '../database/user.repository'
   في Service أو Command
```

**لماذا خطأ:** يُنشئ Tight Coupling. تغيير Repository يستلزم تغيير كل من يستورده.
**الحل:** استورد `IUserRepository` من Core وحقنها عبر DI Container.

### الخطأ الثاني — إنشاء Dependencies داخل الـ Class

```
❌ class UserService {
     private repo = new PostgresUserRepository(new DbConnection())
   }
```

**لماذا خطأ:** يُخفي التبعيات، يمنع الاختبار، يُنشئ Tight Coupling.
**الحل:** `constructor(private repo: IUserRepository) {}`.

### الخطأ الثالث — قراءة process.env مباشرة خارج Configs Layer

```
❌ const token = process.env.FACEBOOK_TOKEN  // في Service أو Command
```

**لماذا خطأ:** ينشر منطق تحميل الإعدادات. يجعل الاختبار صعبًا.
**الحل:** حقن `config.facebook.pageAccessToken` عبر DI.

### الخطأ الرابع — Singleton مع Mutable State

```
❌ export const globalSessionStore: Map<string, Session> = new Map()
   // تُعدَّل من أي مكان في النظام
```

**لماذا خطأ:** Shared Mutable State يُنشئ تعارضات في بيئة Async.
**الحل:** SessionManager يُدير الـ Store ويوفر Interface محكومة للوصول.

### الخطأ الخامس — تمرير Framework Objects عبر الطبقات

```
❌ async processOrder(req: express.Request): Promise<void>
   // في Service
```

**لماذا خطأ:** يُقيّد Service بـ Express. تغيير Framework يستلزم تغيير Service.
**الحل:** Middleware تستخرج البيانات وتُنشئ Domain Object نظيف. Service تستقبل Domain Object فقط.

### الخطأ السادس — اعتماد دائري بين Services

```
❌ UserService → OrderService → UserService
```

**لماذا خطأ:** كما شُرح في قسم Circular Dependency Prevention — يمنع الاختبار ويخفي التصميم الخاطئ.
**الحل:** استخراج المشترك أو استخدام Event Bus.

### الخطأ السابع — تسريب مكتبة خارجية عبر الطبقات

```
❌ Service تستقبل Drizzle ORM QueryResult object مباشرة من Repository
```

**لماذا خطأ:** Service تصبح مرتبطة بـ Drizzle. تغيير ORM يستلزم تغيير Service.
**الحل:** Repository تُحوّل إلى Domain Model قبل الإعادة.

---

## 19. Best Practices

### ممارسة أولى — اجعل الاعتمادات صريحة

الـ Constructor هو جدول محتويات الاحتياجات. من يقرأه يفهم فورًا ما يحتاجه المكون دون الحاجة لقراءة الكود كله. لا اعتمادات خفية عبر Module-level Imports أو Global State.

### ممارسة ثانية — أقل عدد من الاعتمادات هو الأفضل

مكون يحتاج أكثر من 5 اعتمادات عبر Constructor يُشير غالبًا لمسؤوليات متعددة. الحل: تقسيمه لمكونات أصغر أو استخراج Logic مشترك في Service منفصلة.

### ممارسة ثالثة — اختبر الاعتمادية بسؤال الاستبدال

اسأل: "إذا أردت استبدال هذا الـ Dependency بـ Mock في الاختبار، ما الذي يمنعني؟" إذا كان هناك ما يمنع — يوجد Tight Coupling يجب معالجته.

### ممارسة رابعة — راجع شجرة الاعتمادات دوريًا

مع مرور الوقت، تتراكم الاعتمادات غير الضرورية بصمت. مراجعة دورية لشجرة الـ Imports تكشف تسربات تحتاج معالجة.

### ممارسة خامسة — وثّق الاعتمادات غير البديهية

إذا كان الاعتماد على مكون ما ليس واضح السبب للوهلة الأولى، أضف تعليقًا يشرح "لماذا". هذا يمنع إزالته عن طريق الخطأ لاحقًا.

### ممارسة سادسة — Interface في Core أولًا

حين تحتاج لإضافة اعتماد يعبر حدودًا، ابدأ بكتابة الـ Interface في Core قبل كتابة أي Implementation. هذا يُرغم على التفكير في العقد قبل التفاصيل.

---

## 20. Future Expansion Rules

### إضافة طبقة جديدة

إذا احتاج المشروع لطبقة جديدة:
1. يُحدَّد موقعها في الهرم المعماري (بين أي طبقتين).
2. تُعرَّف Interfaces الخاصة بها في Core.
3. تُحدَّد قواعد اعتمادها في جدول الاعتمادات بهذه الوثيقة.
4. تُحدَّد قواعد ما يُمنع عليها.
5. لا يُنفَّذ الكود قبل اكتمال الخطوات السابقة.

### دعم منصات إضافية

إذا أُضيفت منصة Messaging جديدة:
- تُنشأ Layer جديدة تُطبّق نفس `IMessagingClient` Interface الموجودة في Core.
- لا تُعدَّل Services أو Core.
- DI Container يُكوَّن لحقن الـ Implementation المناسبة.
- الاعتمادات الداخلية لا تتغير.

### تغيير Infrastructure

إذا قُرِّر تغيير قاعدة البيانات أو Cache:
- تُكتَب Implementation جديدة تُطبّق نفس الـ Interface.
- تُسجَّل في DI Container بدلًا من القديمة.
- Services لا تعرف بحدوث التغيير.

هذا هو المؤشر الأمثل لنجاح قواعد الاعتماد: تغيير Infrastructure يُحدث في طبقة واحدة ولا يتسرب للباقي.

### الـ Interface ينمو بحذر

Interfaces تبدأ صغيرة وتنمو بحذر شديد. إضافة Method لـ Interface تستلزم مراجعة جميع Implementations وتحديثها. الـ Interface الكبير عبء — يُحافَظ عليه صغيرًا ومتخصصًا. إزالة Method من Interface أصعب من إضافتها — التفكير يسبق الإضافة.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
