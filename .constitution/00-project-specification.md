# 00 — Project Specification

> **الوثيقة الرسمية لتعريف مشروع Void**
> المرجع الأساسي الذي يجب قراءته قبل تنفيذ أي قرار تطويري.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Vision](#2-vision)
3. [Mission](#3-mission)
4. [Goals](#4-goals)
5. [Non-Goals](#5-non-goals)
6. [Project Scope](#6-project-scope)
7. [Target Platform](#7-target-platform)
8. [Technology Stack](#8-technology-stack)
9. [Architectural Style](#9-architectural-style)
10. [Design Principles](#10-design-principles)
11. [Quality Attributes](#11-quality-attributes)
12. [Functional Requirements](#12-functional-requirements)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Supported Features](#14-supported-features)
15. [Unsupported Features](#15-unsupported-features)
16. [Long-Term Objectives](#16-long-term-objectives)
17. [Project Constraints](#17-project-constraints)
18. [Terminology](#18-terminology)
19. [Directory Philosophy](#19-directory-philosophy)
20. [Development Philosophy](#20-development-philosophy)
21. [Future Expansion Strategy](#21-future-expansion-strategy)

---

## 1. Project Overview

**Void** هو Framework احترافي مفتوح المصدر لبناء بوتات Facebook Messenger، مكتوب بالكامل بـ Node.js وTypeScript.

الهدف الجوهري من Void ليس بناء بوت محدد، بل توفير **منصة هندسية متكاملة** يمكن لأي مطور الاعتماد عليها لبناء بوتات Messenger معقدة، قابلة للتوسع، وسهلة الصيانة على المدى البعيد.

يعالج Void المشكلة الجذرية في مشاريع بوتات Messenger التقليدية: غياب البنية المعمارية الواضحة، وتداخل المسؤوليات، وصعوبة الاختبار والتوسع مع نمو المشروع. يفرض Void نمطًا هندسيًا صارمًا من البداية يضمن أن المشروع يبقى قابلًا للفهم والصيانة بصرف النظر عن حجمه أو عمره.

Void ليس مكتبة مساعدة للتعامل مع Facebook API، وليس Wrapper بسيط فوق Axios أو Express. هو **Framework معماري متكامل** يفرض نمط تطوير واضح ومثبت.

---

## 2. Vision

أن يكون Void المعيار الصناعي لبناء بوتات Facebook Messenger الاحترافية في بيئة Node.js/TypeScript — الخيار الأول الذي يختاره المطورون الذين يعطون الأولوية للجودة والاستدامة على السرعة السطحية.

Void يرى أن بناء بوت Messenger **مشروع هندسي جاد** يستحق نفس المستوى من الانضباط المعماري الذي يُطبَّق على تطبيقات الويب الكبيرة أو أنظمة الخدمات المصغرة. الاختصارات مقبولة في النماذج الأولية، لكنها ليست مقبولة في المشاريع المصممة للبقاء.

---

## 3. Mission

بناء Framework يجعل تطوير بوتات Facebook Messenger:

- **منظمًا هندسيًا** — كل مكون له مكانه الواضح وحدوده المحددة.
- **قابلًا للاختبار بشكل كامل** — كل طبقة يمكن اختبارها بمعزل عن باقي النظام.
- **قابلًا للتوسع بأمان** — إضافة ميزات جديدة لا تكسر الميزات القائمة.
- **قابلًا للصيانة على المدى البعيد** — مطور جديد يستطيع فهم الكود بسرعة دون توجيه يدوي.
- **محميًا من التدهور التدريجي** — البنية تقاوم الانحراف عن المبادئ مع مرور الوقت.

---

## 4. Goals

### G1 — Framework معماري واضح
توفير بنية معمارية متعددة الطبقات بحدود واضحة وصارمة بين كل طبقة. لا يوجد مكان في المشروع يمكن فيه وضع الكود "في أي مكان" — كل قطعة كود لها مكان واحد صحيح.

### G2 — استقلالية Facebook Layer
تمركز جميع عمليات التواصل مع Facebook Messenger API داخل طبقة مستقلة ومعزولة تمامًا. باقي النظام لا يعرف شيئًا عن تفاصيل Facebook API ولا يتعامل معها مباشرة.

### G3 — Business Logic نقية ومعزولة
تعيش Business Logic داخل Services فقط. الـ Commands والـ Plugins والـ Handlers لا تحتوي على منطق أعمال — تفوض فقط إلى الـ Services.

### G4 — نظام Plugin قابل للتوسع
توفير نظام Plugins مرن يسمح بإضافة وظائف جديدة دون تعديل النواة الأساسية للـ Framework. الإضافات مستقلة، معزولة، وتتبع عقدًا واضحًا.

### G5 — اختبارية عالية
كل طبقة وكل Service يجب أن يكون قابلًا للاختبار بالكامل بمعزل عن باقي النظام بالاعتماد على Dependency Injection والـ Interfaces. لا يوجد كود لا يمكن اختباره بدون تشغيل النظام كاملًا.

### G6 — TypeScript صارم
كل كود في المشروع مكتوب بـ TypeScript بإعدادات صارمة. لا يوجد `any` غير مبرر. الأنواع ليست اختيارية.

### G7 — توثيق يعكس الكود
التوثيق جزء من المشروع وليس ملاحظة جانبية. أي تغيير في الكود يستلزم تحديث التوثيق ذي الصلة في نفس الـ Pull Request.

### G8 — Developer Experience ممتاز
الـ Framework يجب أن يكون سهل الاستخدام والتوجيه. رسائل الخطأ مفيدة وواضحة. الـ Interfaces بديهية. المطور الجديد يستطيع بناء أول Command في دقائق.

---

## 5. Non-Goals

### NG1 — ليس بوتًا جاهزًا للاستخدام
Void لا يأتي مع بوت مُعدّ مسبقًا أو مجموعة commands جاهزة. هو Framework لبناء البوتات وليس بوتًا بحد ذاته.

### NG2 — ليس Wrapper لـ Facebook API
Void لا يهدف إلى تغليف كل نقطة نهاية في Facebook API بدوال مساعدة. هو يتعامل مع ما يحتاجه Messenger Bot فقط.

### NG3 — ليس Serverless Framework
Void مصمم للعمل كتطبيق Node.js طويل الأمد (Long-Running Process) على خادم أو Container. دعم بيئات Serverless كـ AWS Lambda أو Cloudflare Workers ليس ضمن الأهداف الحالية.

### NG4 — ليس متعدد المنصات
Void متخصص في Facebook Messenger. لا توجد خطط لدعم Telegram، WhatsApp، Discord، أو منصات مراسلة أخرى ضمن نفس الـ Framework في الإصدارات الأولى.

### NG5 — ليس No-Code أو Low-Code
Void موجه للمطورين الذين يكتبون TypeScript. لا توجد واجهة مرئية أو أداة لبناء البوت بدون كود.

### NG6 — ليس منافسًا لـ NestJS أو Express
Void لا يعيد اختراع مكتبات الويب الموجودة. يعتمد عليها ويبني فوقها طبقة متخصصة لعالم Messenger Bots.

### NG7 — ليس Framework عام للـ Chatbots
Void متخصص في Facebook Messenger ويستخدم مفاهيمه وقيوده بشكل مباشر. لا يهدف إلى أن يكون Framework عامًا لكل أنواع الـ Chatbots.

---

## 6. Project Scope

### In Scope — ما يشمله المشروع حاليًا

- استقبال ومعالجة Webhook events من Facebook Messenger.
- نظام Routing لتوزيع الرسائل على الـ Handlers المناسبة.
- نظام Command قائم على الأنماط (Pattern-based Command System).
- نظام Session لحفظ حالة المحادثة لكل مستخدم.
- نظام Plugin لتوسيع وظائف الـ Framework.
- نظام Event داخلي للتواصل بين المكونات.
- طبقة Facebook معزولة تتعامل مع Messenger API.
- نظام Dependency Injection.
- طبقة Services لاحتواء Business Logic.
- نظام Middleware للمعالجة الأفقية.
- نظام Logging احترافي.
- نظام Error Handling موحد.
- نظام Scheduler للمهام المجدولة.
- دعم قواعد البيانات عبر طبقة Repository.
- نظام Cache.
- توثيق كامل للـ API.
- مجموعة اختبارات شاملة.

### Out of Scope — ما لا يشمله المشروع حاليًا

- واجهة مستخدم لإدارة البوت.
- نظام Dashboard أو Analytics مدمج.
- دعم منصات Messaging أخرى.
- نظام Deploy أو CI/CD مدمج.
- دعم Serverless environments.
- نظام Billing أو Rate Limiting مدمج مع Facebook.
- Bot Builder بدون كود.

---

## 7. Target Platform

### Runtime Environment
- **Node.js** — الإصدار 20 LTS أو أحدث.
- **Operating System** — Linux (Primary). macOS مدعوم للتطوير. Windows غير مضمون.
- **Deployment** — خادم عادي أو Container (Docker). VPS أو Cloud VM.

### Facebook Messenger Platform
- **Messenger Platform API** — النسخة الحالية المدعومة من Meta.
- **Webhook** — التكامل مع Facebook عبر HTTPS Webhook.
- **Page Access Token** — المصادقة تتم عبر Page Access Token.

### المتطلبات الخارجية
- حساب Meta for Developers مع تطبيق مُعد.
- صفحة Facebook مرتبطة بالتطبيق.
- خادم HTTPS مع شهادة SSL صالحة لاستقبال Webhook events.

---

## 8. Technology Stack

### Core
| المكون | التقنية | السبب |
|---|---|---|
| Language | TypeScript 5.x | الأنواع الصارمة، الصيانة، Developer Experience |
| Runtime | Node.js 20 LTS | الاستقرار، النظام البيئي الواسع |
| Web Framework | Express 5.x | النضج، المرونة، المجتمع الكبير |
| Validation | Zod | Type-safe validation مع inference |

### Database (اختياري — قابل للتخصيص)
| المكون | التقنية الافتراضية |
|---|---|
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Cache | Redis |

### Testing
| المكون | التقنية |
|---|---|
| Test Runner | Vitest |
| Mocking | Vitest built-in mocks |
| HTTP Testing | Supertest |

### Development Tools
| المكون | التقنية |
|---|---|
| Linter | ESLint + TypeScript ESLint |
| Formatter | Prettier |
| Build | tsc + esbuild |
| Package Manager | pnpm |

### قواعد الاختيار التقني
- لا يُضاف أي Dependency جديد بدون مبرر واضح وموثق.
- يُفضل دائمًا المكتبة الأقل تعقيدًا على الأكثر ميزات.
- أي تغيير في Stack الرئيسي يستلزم تحديث هذه الوثيقة.

---

## 9. Architectural Style

### النمط المعماري الأساسي: Clean Architecture
يعتمد Void على مبادئ Clean Architecture التي تضمن أن:

- **الاستقلالية من الخارج للداخل** — الطبقات الداخلية لا تعرف شيئًا عن الطبقات الخارجية.
- **Business Logic محمية** — Services لا تعتمد على تفاصيل التقنية (Express, Facebook API).
- **قابلية الاستبدال** — يمكن استبدال قاعدة البيانات، أو مكتبة HTTP، دون تغيير Business Logic.

### طبقات النظام (من الداخل للخارج)

```
┌─────────────────────────────────────────────────────────────┐
│                        Core Domain                          │
│            (Interfaces, Types, Domain Models)               │
├─────────────────────────────────────────────────────────────┤
│                       Application                           │
│                (Services, Use Cases, DI)                    │
├─────────────────────────────────────────────────────────────┤
│                      Infrastructure                         │
│         (Database, Cache, Scheduler, External APIs)         │
├─────────────────────────────────────────────────────────────┤
│                    Facebook Layer                           │
│       (Webhook, Message Sending, Event Mapping)             │
├─────────────────────────────────────────────────────────────┤
│                    Entry Points                             │
│          (Express Server, Commands, Plugins)                │
└─────────────────────────────────────────────────────────────┘
```

### قاعدة الاعتماد (Dependency Rule)
الاعتماد يسير دائمًا من الخارج للداخل فقط. لا طبقة داخلية تعرف بوجود طبقة خارجية. هذه القاعدة غير قابلة للاستثناء.

### الأنماط المعمارية المدعومة

**Dependency Injection (DI)**
جميع التبعيات تُحقن من الخارج. لا يوجد `new` مباشر لإنشاء Dependencies داخل الـ Classes الجوهرية. هذا يجعل الاختبار ممكنًا دون تشغيل خدمات خارجية.

**Repository Pattern**
جميع عمليات قاعدة البيانات تمر عبر Repositories. الـ Services لا تعرف تفاصيل قاعدة البيانات — تتعامل مع Interfaces فقط.

**Plugin System**
وظائف اختيارية أو قابلة للتبديل تُبنى كـ Plugins مستقلة. الـ Core لا يعرف بوجود أي Plugin محدد — يتعامل معها عبر واجهة موحدة.

**Event-Driven Communication**
التواصل الداخلي بين المكونات يتم عبر Event Bus. هذا يقلل الاقتران المباشر بين المكونات ويجعل النظام أكثر مرونة.

**Middleware Pipeline**
المعالجة الأفقية (Authentication، Logging، Rate Limiting) تُطبَّق عبر Middleware Pipeline قبل وصول الطلب للـ Handler.

---

## 10. Design Principles

### P1 — Single Responsibility Principle (SRP)
كل Class، كل Function، كل Module له مسؤولية واحدة فقط. عندما تحتاج إلى تغيير شيء ما، يجب أن يكون هناك سبب واحد فقط يدفعك لتغيير كل ملف.

### P2 — Open/Closed Principle (OCP)
النظام مفتوح للتوسع ومغلق للتعديل. إضافة ميزة جديدة تتم بإضافة Plugin أو Command جديد — لا بتعديل الكود الموجود.

### P3 — Liskov Substitution Principle (LSP)
أي Implementation لـ Interface يجب أن يكون قابلًا للاستخدام بدلًا من أي Implementation آخر لنفس الـ Interface دون كسر النظام.

### P4 — Interface Segregation Principle (ISP)
الـ Interfaces صغيرة ومتخصصة. لا يُجبر أي مكون على تنفيذ Methods لا يحتاجها. بدلًا من Interface كبير، عدة Interfaces صغيرة.

### P5 — Dependency Inversion Principle (DIP)
الوحدات عالية المستوى لا تعتمد على الوحدات منخفضة المستوى — كلاهما يعتمد على Abstractions. الـ Services لا تعتمد على Repositories المحددة، تعتمد على Interfaces.

### P6 — Separation of Concerns
كل قسم من النظام معني بمجال واحد فقط. Facebook Layer معنية بـ Facebook. Database Layer معنية بالبيانات. Services معنية بالمنطق. الحدود واضحة ولا تُخترق.

### P7 — Explicit over Implicit
الكود الصريح أفضل من الكود الضمني. Magic غير المفسر مرفوض. كل سلوك يجب أن يكون واضحًا من قراءة الكود دون الاضطرار إلى تتبع سلسلة طويلة من الاستدعاءات.

### P8 — Fail Fast
النظام يكشف الأخطاء مبكرًا ويرفضها بصراحة. لا Silent Failures. لا Fallbacks خفية تخفي مشاكل حقيقية.

---

## 11. Quality Attributes

### Stability (الاستقرار) — الأولوية الأولى
النظام يعمل بشكل موثوق على مدار الساعة. الأخطاء غير المتوقعة لا تُسقط العملية. كل حالة خطأ محتملة موثقة ومعالجة.

### Maintainability (قابلية الصيانة) — الأولوية الثانية
المطور الجديد يستطيع فهم أي جزء من الكود في وقت معقول دون توجيه مباشر. التغييرات محصورة في المكان المناسب ولا تنتشر عبر الكود.

### Testability (قابلية الاختبار) — الأولوية الثالثة
كل طبقة وكل Service قابل للاختبار بمعزل. لا يوجد Singletons مخفية أو Global State لا يمكن التحكم فيها في الاختبارات.

### Extensibility (قابلية التوسع) — الأولوية الرابعة
إضافة ميزات جديدة لا تتطلب تعديل الكود الموجود. نظام Plugin وCommand مصمم للتوسع الآمن.

### Clarity (الوضوح) — الأولوية الخامسة
المسؤوليات واضحة والحدود مُعرَّفة. لا غموض في "أين يذهب هذا الكود".

### Performance (الأداء) — أولوية ثانوية
الأداء مهم لكنه ليس الأولوية الأولى. النظام يجب أن يكون كافيًا للاستخدام الفعلي. التحسينات تأتي بعد التأكد من الصحة والوضوح — لا قبلهما.

---

## 12. Functional Requirements

### FR1 — استقبال Webhook Events
يجب على الـ Framework استقبال ومعالجة جميع أنواع Webhook Events من Facebook Messenger:
- `messages` — الرسائل النصية والمرفقات.
- `messaging_postbacks` — ضغطات الأزرار.
- `messaging_referrals` — الروابط المرجعية.
- `message_reactions` — ردود الفعل على الرسائل.
- `message_reads` — إشعارات القراءة.
- `message_deliveries` — إشعارات التسليم.
- `messaging_optins` — موافقات الاشتراك.
- `messaging_optouts` — إلغاء الاشتراكات.

### FR2 — التحقق من Webhook
يجب التحقق من صحة كل طلب وارد من Facebook عبر `X-Hub-Signature-256` قبل المعالجة.

### FR3 — إرسال الرسائل
يجب دعم جميع أنواع الرسائل الصادرة:
- رسائل نصية بسيطة.
- رسائل مع أزرار (Button Templates).
- Generic Templates (البطاقات).
- Quick Replies.
- الصور، الفيديو، الصوت، الملفات.
- Persistent Menu.

### FR4 — نظام Command
يجب توفير نظام لتعريف الأوامر وربطها بأنماط رسائل محددة (النص، Postbacks، Quick Replies). كل Command يُعالَج بواسطة Handler محدد.

### FR5 — إدارة الجلسات
يجب حفظ حالة كل محادثة مستقلة بحيث يمكن استئناف المحادثة من حيث توقفت عبر جلسات متعددة.

### FR6 — نظام Plugin
يجب أن يتمكن المطور من إضافة وظائف عبر Plugins مستقلة دون تعديل الـ Framework نفسه.

### FR7 — نظام Middleware
يجب دعم تطبيق Middlewares قبل وصول الحدث للـ Handler (مثال: التحقق من المستخدم، Rate Limiting، Logging).

### FR8 — معالجة الأخطاء
يجب معالجة جميع الأخطاء بشكل مركزي. الأخطاء غير المعالجة لا تُسقط العملية. يُرسل رد مناسب للمستخدم عند الفشل.

### FR9 — نظام Scheduler
يجب دعم تنفيذ مهام مجدولة (Cron Jobs) بشكل مستقل عن دورة الـ Webhook.

### FR10 — نظام Logging
يجب تسجيل كل حدث مهم في النظام بمستويات مناسبة (debug, info, warn, error) بتنسيق منظم قابل للقراءة والبحث.

---

## 13. Non-Functional Requirements

### NFR1 — الأداء
- معالجة حدث Webhook واحد في أقل من 500ms في الظروف الطبيعية.
- يجب الاستجابة لـ Facebook Webhook في أقل من 5 ثوانٍ (حد Facebook الأقصى).
- العمليات المكلفة (استعلامات قاعدة البيانات، استدعاءات API) تكون غير متزامنة (async/await).

### NFR2 — الاستقرار
- الـ Framework يعمل بدون انقطاع في بيئة الإنتاج.
- أخطاء Handler مفردة لا تؤثر على معالجة الأحداث الأخرى.
- الذاكرة المستخدمة مستقرة ولا تتصاعد مع مرور الوقت (No Memory Leaks).

### NFR3 — الأمان
- التحقق من صحة كل Webhook request.
- عدم تسجيل البيانات الحساسة (الرموز، البيانات الشخصية للمستخدمين).
- التحقق من صحة جميع المدخلات قبل المعالجة باستخدام Zod.
- الأسرار تُقرأ من Environment Variables فقط.

### NFR4 — قابلية الصيانة
- تغطية اختبارات لا تقل عن 80% للـ Services و الـ Core Logic.
- لا يوجد ملف يتجاوز 300 سطر كود فعلي (باستثناء الملفات التعريفية).
- كل Public Method موثقة بـ JSDoc.

### NFR5 — قابلية التوسع الأفقي
- الـ Framework يجب أن يعمل بشكل صحيح خلف Load Balancer مع نسخ متعددة.
- الـ Session يجب أن يكون خارج الذاكرة (External Storage) في بيئة الإنتاج.

---

## 14. Supported Features

### الإصدار الأول (v1.0)
- ✅ معالجة Webhook Events الأساسية.
- ✅ نظام Command بأنماط نصية وPostback وQuick Reply.
- ✅ Session Management مع دعم External Storage.
- ✅ إرسال جميع أنواع رسائل Messenger الأساسية.
- ✅ نظام Plugin مع واجهة تسجيل.
- ✅ نظام Middleware.
- ✅ نظام Logging احترافي.
- ✅ معالجة الأخطاء المركزية.
- ✅ نظام DI.
- ✅ Repository Pattern لقاعدة البيانات.
- ✅ نظام Scheduler أساسي.
- ✅ نظام Cache.
- ✅ مجموعة اختبارات.

---

## 15. Unsupported Features

### غير مدعوم في v1.0 — قد يُدعم لاحقًا
- ❌ معالجة الرسائل المشفرة (End-to-End Encryption).
- ❌ Handover Protocol بين Bots.
- ❌ Pass Thread Control.
- ❌ Facebook Pay Integration.
- ❌ Natural Language Processing مدمج.
- ❌ Multi-language routing تلقائي.
- ❌ Dashboard مرئي.
- ❌ Hot Reload للـ Plugins في بيئة الإنتاج.

### غير مدعوم بشكل دائم
- ❌ منصات Messaging غير Facebook Messenger.
- ❌ Serverless Environments.
- ❌ No-Code / Low-Code interface.
- ❌ Browser-side execution.

---

## 16. Long-Term Objectives

### المرحلة الأولى — الأساس (v1.0)
بناء البنية المعمارية الكاملة مع جميع الطبقات والأنظمة الأساسية، ومجموعة اختبارات شاملة، وتوثيق كامل للـ API.

### المرحلة الثانية — النضج (v1.x)
تحسين الأداء، توسيع دعم أنواع رسائل Messenger، وإضافة Plugins رسمية مدمجة (مثال: Plugin للتحقق من المستخدم، Plugin لـ NLP، Plugin لـ Analytics).

### المرحلة الثالثة — النظام البيئي (v2.0)
- CLI Tool لإنشاء مشاريع Void جديدة بسهولة.
- Plugin Registry لمشاركة الـ Plugins بين المطورين.
- Starter Templates لحالات استخدام شائعة.
- توثيق تفاعلي.

### المرحلة الرابعة — التوسع (v3.0)
- النظر في دعم منصات مراسلة إضافية عبر Adapter Pattern (مع الحفاظ على تخصص Messenger).
- أدوات Monitoring ومراقبة مدمجة.

---

## 17. Project Constraints

### C1 — قيود تقنية
- Node.js 20+ مطلوب. الإصدارات الأقدم غير مدعومة.
- TypeScript strict mode إلزامي. لا يمكن تعطيله.
- ESM (ES Modules) هو تنسيق الوحدات الافتراضي.

### C2 — قيود Facebook Platform
- الـ Framework مقيد بما يسمح به Facebook Messenger Platform API.
- Rate Limits تفرضها Facebook ويجب التعامل معها بشكل صحيح.
- يجب الاستجابة لـ Webhook في أقل من 5 ثوانٍ وإلا يعيد Facebook الإرسال.
- أي تغيير في Facebook API قد يتطلب تحديث Facebook Layer.

### C3 — قيود الجودة
- لا يُقبل كود بدون اختبارات للـ Services.
- لا يُقبل `any` في TypeScript بدون تعليق يبرره.
- لا تُقبل Pull Requests التي تكسر الاختبارات الموجودة.

### C4 — قيود المعمارية
- لا يمكن لأي طبقة الوصول إلى Facebook API مباشرة خارج Facebook Layer.
- لا يمكن لـ Commands وPlugins تضمين Business Logic.
- لا يمكن للـ Services معرفة بوجود Express أو تفاصيل HTTP.

---

## 18. Terminology

| المصطلح | التعريف |
|---|---|
| **Framework** | الإطار العام لـ Void الذي يوفر البنية والأنظمة الأساسية. |
| **Core** | النواة الجوهرية للـ Framework التي لا تُعدَّل من المطورين. |
| **Plugin** | وحدة اختيارية مستقلة تضيف وظائف للـ Framework. |
| **Command** | وحدة تربط نمط رسالة بـ Handler محدد. |
| **Handler** | الدالة أو الكلاس المسؤول عن معالجة حدث أو Command محدد. |
| **Service** | الكلاس الذي يحتوي على Business Logic. |
| **Repository** | الكلاس الذي يتعامل مع قاعدة البيانات وفق Repository Pattern. |
| **Manager** | الكلاس المسؤول عن إدارة دورة حياة مكون أو نظام كامل. |
| **Facebook Layer** | الطبقة المعزولة التي تحتوي على جميع عمليات Facebook API. |
| **Webhook** | نقطة نهاية HTTP تستقبل Events من Facebook. |
| **Session** | كائن يحفظ حالة المحادثة لمستخدم معين. |
| **Event** | حدث داخلي يُطلَق داخل النظام للتواصل بين المكونات. |
| **Middleware** | دالة تُطبَّق على الطلب قبل وصوله للـ Handler. |
| **DI** | Dependency Injection — حقن التبعيات من الخارج. |
| **Interface** | TypeScript Interface يُعرِّف العقد بين المكونات. |
| **Context** | كائن يحمل معلومات الحدث الحالي ويُمرَّر عبر Pipeline المعالجة. |
| **Postback** | حدث يُطلَق عند ضغط المستخدم على زر في Messenger. |
| **Quick Reply** | أزرار اختيار سريعة تظهر أسفل الرسالة. |
| **Constitution** | مجلد `.constitution` ومحتواه — المرجع الأعلى للمشروع. |

---

## 19. Directory Philosophy

هيكل المجلدات في Void ليس تنظيمًا اعتباطيًا — هو تعبير مباشر عن البنية المعمارية.

### مبادئ التنظيم

**المبدأ الأول: المكان يعكس الدور**
اسم المجلد يخبرك بمسؤولية ما يحتويه. `services/` تحتوي Services فقط. `plugins/` تحتوي Plugins فقط. لا توجد مجلدات `utils/` عامة تكون مكبًا للكود عديم التصنيف.

**المبدأ الثاني: العمق محدود**
الهيكل لا يتعمق أكثر من اللازم. ثلاثة مستويات هي الحد المعقول في معظم الحالات.

**المبدأ الثالثة: Feature Isolation**
الـ Features المستقلة لها مجلداتها الخاصة التي تحتوي على كل ما تحتاجه.

**المبدأ الرابع: لا مجلدات `helpers/` أو `misc/`**
إذا لم يكن للكود مكان واضح، فهذا يعني أن التصنيف المعماري غير مكتمل. الحل هو تصنيف الكود بشكل صحيح، لا إنشاء مجلد عشوائي.

### الهيكل المتوقع (سيُكتمل في وثيقة Architecture)
```
src/
├── core/           # Interfaces, Types, Domain Models
├── facebook/       # Facebook Layer — معزولة تمامًا
├── services/       # Business Logic
├── commands/       # Command Definitions
├── plugins/        # Plugins
├── managers/       # System Managers
├── repositories/   # Database Repositories
├── middlewares/    # Middleware Pipeline
├── scheduler/      # Scheduled Jobs
├── cache/          # Cache Layer
├── events/         # Event System
└── config/         # Configuration
```

---

## 20. Development Philosophy

### الأولويات بالترتيب (من الأعلى للأدنى)

1. **الصحة** — الكود يعمل بشكل صحيح في جميع الحالات.
2. **الوضوح** — الكود واضح وسهل الفهم.
3. **الاختبارية** — الكود يمكن اختباره بمعزل.
4. **الصيانة** — الكود يمكن تعديله بأمان.
5. **الأداء** — الكود يعمل بكفاءة.

### ما يُقدَّم دائمًا

- **الحلول الصحيحة** على الحلول السريعة.
- **المسؤولية الواضحة** على المرونة الزائدة.
- **الفشل الصريح** على الـ Silent Fallbacks.
- **البنية المحافَظ عليها** على إضافة ميزات بدون تصميم.

### ما يُرفض دائمًا

- الكود الذي يعمل لكن لا أحد يفهمه.
- الـ Shortcuts التي تكسر الحدود المعمارية.
- تضمين Business Logic خارج الـ Services.
- استدعاء Facebook API خارج Facebook Layer.
- إضافة State عالمي (Global State) بدون مبرر قوي.
- تجاهل معالجة الأخطاء.

### موقف المشروع من التعقيد
التعقيد البسيط (Simple Design) مُفضَّل دائمًا على الحلول الذكية (Clever Solutions). كود يستغرق 30 سطرًا لكنه واضح أفضل من كود يستغرق 5 سطور لكنه يتطلب خبيرًا لفهمه.

### موقف المشروع من الميزات الجديدة
قبل إضافة أي ميزة جديدة، يجب الإجابة عن السؤال: "هل هذه الميزة تتناسب مع المبادئ المعمارية للـ Framework؟" إذا كانت الإجابة لا، فالميزة لا تُضاف.

---

## 21. Future Expansion Strategy

### مبدأ التوسع الآمن
Void مصمم للتوسع عبر نقاط امتداد محددة وليس عبر تعديل الكود الأساسي. النقاط المتاحة للتوسع:

- **Plugins** — للوظائف الاختيارية أو القابلة للتبديل.
- **Commands** — لأنواع جديدة من التفاعل.
- **Middlewares** — للمعالجة الأفقية الجديدة.
- **Repositories** — لأنواع قواعد بيانات جديدة.
- **Services** — للـ Business Logic الجديد.

### قاعدة الاستقرار
كل ما هو معرَّف في `core/` (الـ Interfaces والـ Types الأساسية) يُعدّ مستقرًا ويجب الحفاظ على التوافق الرجعي قدر الإمكان. التغييرات في `core/` تستلزم رفع إصدار رئيسي (Major Version).

### كيف تُضاف المنصات المستقبلية (إن قُرِّر ذلك)
الطبقة الخاصة بـ Facebook (`facebook/`) مُصممة كـ Adapter. في المستقبل، إذا أُريد دعم منصة أخرى، يُنشأ Adapter جديد يُطبّق نفس الـ Interfaces دون تعديل أي طبقة داخلية. هذا ممكن دون كسر أي كود موجود.

### مبدأ عدم كسر التوافق
أي تغيير في الـ Public API للـ Framework يجب أن يكون:
1. متوافقًا مع الإصدارات السابقة في حالة إصلاح الأخطاء أو التحسينات الصغيرة.
2. تغييرًا في الإصدار الثانوي (Minor) في حالة إضافة ميزات جديدة.
3. تغييرًا في الإصدار الرئيسي (Major) في حالة كسر التوافق.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
