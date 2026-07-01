# 05 — Coding Standards

> **المرجع الرسمي لمعايير كتابة الكود في مشروع Void**
> يُقرأ هذا الملف قبل كتابة أي سطر كود داخل المشروع.
> الهدف: أن يبدو المشروع بالكامل وكأنه كُتب بواسطة شخص واحد، مهما تعدد المساهمون.

---

## Table of Contents

1. [Coding Philosophy](#1-coding-philosophy)
2. [Code Style Principles](#2-code-style-principles)
3. [Readability Rules](#3-readability-rules)
4. [Maintainability Rules](#4-maintainability-rules)
5. [Simplicity Rules](#5-simplicity-rules)
6. [File Organization Rules](#6-file-organization-rules)
7. [Folder Organization Rules](#7-folder-organization-rules)
8. [Class Design Rules](#8-class-design-rules)
9. [Interface Design Rules](#9-interface-design-rules)
10. [Function Design Rules](#10-function-design-rules)
11. [Variable Naming Rules](#11-variable-naming-rules)
12. [Constant Naming Rules](#12-constant-naming-rules)
13. [File Naming Rules](#13-file-naming-rules)
14. [Folder Naming Rules](#14-folder-naming-rules)
15. [Import Rules](#15-import-rules)
16. [Export Rules](#16-export-rules)
17. [Commenting Rules](#17-commenting-rules)
18. [Documentation Rules](#18-documentation-rules)
19. [Async Programming Rules](#19-async-programming-rules)
20. [Error Handling Rules](#20-error-handling-rules)
21. [Code Reuse Rules](#21-code-reuse-rules)
22. [Code Smells](#22-code-smells)
23. [Anti Patterns](#23-anti-patterns)
24. [Refactoring Rules](#24-refactoring-rules)
25. [Review Checklist](#25-review-checklist)

---

## 1. Coding Philosophy

### الكود يُقرأ أكثر مما يُكتب

الكود يُكتب مرة واحدة ويُقرأ مئات المرات — من قِبل المطور نفسه بعد أشهر، ومن مطورين آخرين، ومن أنظمة ذكاء اصطناعي. هذه الحقيقة يجب أن تُشكّل كل قرار في كيفية كتابة الكود.

### الوضوح فضيلة، الغموض عيب

الكود الواضح الذي يفهمه أي مطور مؤهل في دقيقة أفضل بكثير من الكود "الذكي" الذي يحتاج تحليلًا. الذكاء في حل المشكلة، لا في تشفير الكود.

### الكود يُعبّر عن النية

الكود الجيد يقرأ كالنثر — تفهم ما يحاول تحقيقه بمجرد القراءة. إذا احتجت لتتبع سلسلة من الاستدعاءات الغامضة لفهم ما يفعله سطر واحد، فالكود يفشل في التعبير عن نيته.

### الاتساق قيمة بذاتها

الكود المتسق يُقلل الجهد المعرفي. حين تتبع قاعدة بشكل موحد في كل المشروع، يعرف القارئ ما يتوقعه — لا يُصرف انتباهه بمفاجآت أسلوبية. الاتساق في الأسلوب أهم من اختيار "الأسلوب الأفضل" وتطبيقه بشكل متقطع.

---

## 2. Code Style Principles

### المبدأ الأول — الوضوح مقدّم على الاختصار

```
❌ const u = await db.find(id)
✅ const user = await userRepository.findByMessengerId(senderId)
```

حرف واحد إضافي في الاسم يوفر دقائق من التفسير لاحقًا.

### المبدأ الثاني — صريح لا ضمني

الكود الصريح يُفصح عن نيته بشكل مباشر. لا "Magic" غير مُوضَّح. لا آليات خفية. لا افتراضات غير معلنة.

### المبدأ الثالث — محدود، متخصص، مُركَّز

كل وحدة كود — سواء كانت دالة أو كلاس أو ملف — لها مسؤولية واحدة واضحة. الوحدة التي تحاول فعل كل شيء لا تفعل أي شيء جيدًا.

### المبدأ الرابع — قابل للحذف بأمان

الكود الجيد يمكن حذفه أو تعديله دون خوف. إذا كان التعديل مُخيفًا، فالتصميم يحتاج مراجعة.

### المبدأ الخامس — يثق به لأنه مُختبَر

لا سطر يُضاف للإنتاج دون تغطية اختبار معقولة. الكود غير المُختبَر كود غير موثوق بالتعريف.

---

## 3. Readability Rules

### القاعدة الأولى — الأسماء تُحكي قصة

اسم المتغير أو الدالة أو الكلاس يجب أن يُخبر القارئ بما هو عليه وما يفعله — دون الحاجة لقراءة تنفيذه.

```
❌ const d = new Date()
✅ const sessionExpiresAt = new Date()

❌ function proc(m)
✅ function processIncomingMessage(message: MessengerEvent)
```

### القاعدة الثانية — سطر واحد، فكرة واحدة

لا يجمع سطر واحد أكثر من فكرة منطقية واحدة. الكثافة المفرطة تُصعّب القراءة.

```
❌ const result = arr.filter(x=>x.active).map(x=>x.id).reduce((a,b)=>a+b,0)
✅ const activeItems = items.filter(item => item.isActive)
   const activeIds = activeItems.map(item => item.id)
   const totalActive = activeIds.length
```

### القاعدة الثالثة — التعشيش المحدود

الكود المُعشَّش كثيرًا (Deeply Nested) يُصعب القراءة ويُخفي المنطق. الحد الأقصى المقبول: **ثلاثة مستويات** من التعشيش في الحالات العادية.

**تقنيات تقليل التعشيش:**
- Early Return: أرجع مبكرًا عند الشروط السلبية بدلًا من تعشيش كل الكود في `if` إيجابي.
- Extract Function: استخرج الكود المُعشَّش في دالة منفصلة ذات اسم واضح.
- Guard Clauses: ضع الشروط الحدودية في البداية وأرجع أو ارمِ خطأً مبكرًا.

### القاعدة الرابعة — المسافة البيضاء تُنظّم

المسافات البيضاء بين الأقسام المنطقية في الكود ليست كمالية — هي توجيه بصري. مجموعة من الأسطر ذات الصلة تُفصَل عن التالية بسطر فارغ.

### القاعدة الخامسة — طول السطر معقول

الحد الأقصى لطول السطر: **120 حرفًا**. ما يتجاوز ذلك يُقسَّم على سطور متعددة بطريقة تُوضح البنية.

---

## 4. Maintainability Rules

### لا تكرار في الكود (DRY)

أي منطق يظهر في أكثر من مكانين يُستخرج في دالة أو كلاس مشترك. التكرار يعني أن أي تعديل يجب أن يتكرر في أماكن متعددة — مصدر للأخطاء المضمونة.

### كل وحدة لها سبب واحد للتغيير

إذا احتاجت الوحدة للتغيير بسبب أكثر من سبب مختلف، فهي تحمل مسؤوليات متعددة يجب تقسيمها.

### لا Magic Numbers ولا Magic Strings

الأرقام والنصوص المكتوبة مباشرة في الكود بدون سياق هي إشكالية مزدوجة: لا يعرف القارئ ما تعنيه، ولا يمكن تغييرها من مكان واحد.

```
❌ if (attempts > 3) retryWithDelay(5000)
✅ const MAX_RETRY_ATTEMPTS = 3
   const RETRY_DELAY_MS = 5_000
   if (attempts > MAX_RETRY_ATTEMPTS) retryWithDelay(RETRY_DELAY_MS)
```

### لا كود معطّل (Dead Code)

الكود المعلَّق بتعليقات، الـ Imports غير المستخدمة، المتغيرات المُعلَنة ولا تُستخدَم، الدوال التي لا تُستدعى — كلها ضجيج يُربك القارئ ويزيد الصيانة صعوبةً. تُحذف فورًا.

### كل تعديل يتوافق مع أسلوب المشروع

حين تُعدّل ملفًا موجودًا، اتبع أسلوبه القائم. لا تُدخل أسلوبًا مختلفًا في نفس الملف. الاتساق داخل الملف مقدَّم على تفضيلك الشخصي.

---

## 5. Simplicity Rules

### الحل الأبسط أولًا

حين تواجه مشكلة، ابدأ بأبسط حل يُعالجها بشكل صحيح. لا تُعقِّد قبل إثبات أن البساطة غير كافية.

### لا Abstraction مبكر

لا تُنشئ Abstraction قبل أن يتكرر النمط. الـ Abstraction المبكر يُخفي القصد ويُنشئ تعقيدًا بدون قيمة مثبتة. قاعدة الثلاثة: إذا تكرر النمط ثلاث مرات، افصله في Abstraction.

### لا تحسين مبكر

لا تُعقّد الكود لمكاسب أداء نظرية لم تُقَس. الكود الواضح البطيء قليلًا أفضل من الكود المعقد السريع — حتى يُثبَت القياس أن الأداء مشكلة حقيقية.

### البساطة لا تعني القصر

الكود البسيط ليس بالضرورة الأقصر. أحيانًا السطر الأطول أوضح. البساطة تعني أن القارئ لا يجهد ذهنه في التفسير.

---

## 6. File Organization Rules

### القاعدة الأولى — ملف واحد، مسؤولية واحدة

كل ملف يحتوي على مكون واحد رئيسي أو مجموعة صغيرة من الأشياء المترابطة ارتباطًا وثيقًا. الملف الذي يحتوي على كلاسات وأنواع وأدوات غير مترابطة يحتاج تقسيمًا.

### القاعدة الثانية — حجم الملف المعقول

الحد الأقصى المقبول لملف كود: **300 سطر كود فعلي** (باستثناء التعليقات والأسطر الفارغة). ما يتجاوز ذلك يُشير لمسؤوليات متعددة تستدعي التقسيم.

### القاعدة الثالثة — ترتيب المحتوى داخل الملف

الترتيب الموحّد داخل أي ملف:
1. Imports (مرتبة: External packages أولًا، ثم Internal modules).
2. Constants والـ Type Definitions المحلية.
3. الـ Class أو الـ Function الرئيسية.
4. Helper Functions الخاصة بهذا الملف.
5. Export.

### القاعدة الرابعة — لا ملفات Utility ضخمة مختلطة

ملف `utils.ts` يحتوي على 50 دالة لمسائل مختلفة هو ملف فوضوي. الأدوات تُنظَّم في ملفات متخصصة: `date.utils.ts`، `string.utils.ts`، `crypto.utils.ts`.

---

## 7. Folder Organization Rules

### القاعدة الأولى — الهيكل يعكس المعمارية

بنية المجلدات تعكس بنية الطبقات المعمارية المُعرَّفة في `02-architecture.md` و`03-layer-responsibilities.md`. القارئ الذي يفهم المعمارية يعرف أين يبحث عن أي شيء.

### القاعدة الثانية — الأسماء تصف المحتوى

اسم المجلد يصف ما يحتويه بدقة. `services/` يحتوي Services. `repositories/` يحتوي Repositories. `commands/` يحتوي Commands. لا مجلدات بأسماء غامضة مثل `helpers/` أو `misc/` أو `stuff/`.

### القاعدة الثالثة — تعشيش معقول

التعشيش العميق للمجلدات يُعقّد الـ Import Paths ويُصعّب التنقل. الحد المعقول: **ثلاثة إلى أربعة مستويات** من الـ Root.

### القاعدة الرابعة — Barrel Index

كل مجلد يُصدَّر محتواه الرسمي عبر `index.ts`. هذا يُوفر نقطة دخول واحدة ويُخفي التنظيم الداخلي عن المستهلكين.

---

## 8. Class Design Rules

### قاعدة المسؤولية الواحدة

كل Class لها سبب واحد للوجود وسبب واحد للتغيير. Class تُدير الجلسات أو تُرسل الرسائل أو تُحسب الأسعار — لا تفعل الثلاثة.

### الحجم المعقول للـ Class

Class تتجاوز **200 سطر كود فعلي** في معظم الحالات تُشير لمسؤوليات متعددة. يُراجَع تقسيمها.

### لا God Classes

Class تعرف كل شيء في النظام وتحتوي على جميع أنواع المنطق مرفوضة بشكل مطلق. كل Class تعرف ما تحتاجه فقط.

### Constructor نظيف

Constructor يُهيّئ الكائن ويحقن التبعيات فقط. لا Business Logic، لا استدعاءات Async، لا عمليات I/O في Constructor. إذا كانت التهيئة معقدة، تُستخدم `async initialize()` Method منفصلة.

### لا Inheritance بلا سبب

Inheritance يُستخدم فقط حين توجد علاقة "is-a" حقيقية وواضحة. الشك يُفضي دائمًا للـ Composition. تسلسلات Inheritance العميقة (أكثر من مستويين) مرفوضة إلا لأسباب استثنائية موثقة.

### الـ Access Modifiers صريحة دائمًا

كل Property وMethod لها `public`، `protected`، أو `private` صريحة. لا اعتماد على الـ Default. المبدأ: الخصوصية القصوى أولًا — كل شيء `private` حتى يثبت أنه يحتاج أن يكون `protected` أو `public`.

---

## 9. Interface Design Rules

### Interface صغير ومتخصص

Interface يُعرّف عقدًا واحدًا محددًا. Interface يجمع 20 Method من مسؤوليات مختلفة هو Interface سيئ التصميم يُخرق Interface Segregation Principle.

### أسماء الـ Interfaces تبدأ بـ I

الاتفاقية الموحدة: `IUserRepository`، `IFacebookClient`، `ISessionManager`. هذا يُمكّن من تمييز Interface عن Implementation بمجرد النظر للاسم.

### الـ Interface يُعرَّف قبل الـ Implementation

يُكتَب عقد الـ Interface أولًا، ثم يُفكَّر في التنفيذ. هذا يُرغم على التفكير في الاستخدام قبل التفاصيل.

### الـ Interface لا تتضمن تفاصيل التنفيذ

الـ Interface تصف "ماذا" لا "كيف". لا Generics معقدة تكشف تفاصيل التخزين. لا Parameters تكشف تفاصيل الـ ORM المستخدم.

### Optional Properties بحذر

الـ Property الاختيارية في Interface تُقلّل من وضوح العقد — من يُطبّق الـ Interface لا يعرف ما إذا كان يجب تطبيق هذه الـ Property أم لا. يُفضَّل Interface منفصل على Property اختيارية تُغيّر السلوك.

---

## 10. Function Design Rules

### دالة واحدة، مهمة واحدة

الدالة تفعل شيئًا واحدًا وتفعله جيدًا. إذا احتجت لـ "و" في وصف ما تفعله الدالة، فهي تفعل أكثر من شيء.

### الحجم المعقول للدالة

الحد المعقول لحجم الدالة: **20-30 سطرًا**. ما يتجاوز ذلك في معظم الحالات يُشير لمسؤوليات متعددة تستدعي الاستخراج.

### أسماء الدوال أفعال

اسم الدالة يبدأ بفعل يصف ما تفعله:
- `getUserById` لا `userById`.
- `sendWelcomeMessage` لا `welcomeMessage`.
- `validateSessionToken` لا `sessionToken`.
- `calculateTotalPrice` لا `totalPrice`.

### عدد Parameters معقول

الدالة التي تقبل أكثر من **3-4 Parameters** تحتاج مراجعة. البديل: تجميع الـ Parameters في Object منظم.

```
❌ createUser(name, email, senderId, language, timezone, isAdmin)
✅ createUser(userCreationData: CreateUserData)
```

### لا Side Effects خفية

الدالة التي يُوحي اسمها بأنها تقرأ بيانات لا يجب أن تُعدّل State. الـ Side Effects إذا كانت ضرورية يجب أن تكون واضحة من الاسم أو الـ Documentation.

### Return Type صريح دائمًا

كل دالة تُعلن Return Type صراحةً في TypeScript. لا اعتماد على Type Inference للـ Return Types في الدوال العامة.

### Guard Clauses أولًا

الشروط الحدودية والـ Validation تكون في بداية الدالة، تُوقف التنفيذ مبكرًا. هذا يُقلل التعشيش ويُوضح الـ Happy Path.

```
❌ function processOrder(order) {
     if (order) {
       if (order.isValid) {
         if (order.items.length > 0) {
           // الـ Happy Path هنا بعد ثلاثة مستويات تعشيش
         }
       }
     }
   }

✅ function processOrder(order: Order): void {
     if (!order) throw new VoidError(ErrorCode.InvalidOrder, 'Order is required')
     if (!order.isValid) throw new VoidError(ErrorCode.InvalidOrder, 'Order is invalid')
     if (order.items.length === 0) throw new VoidError(ErrorCode.EmptyOrder, 'Order has no items')
     // الـ Happy Path هنا بدون تعشيش
   }
```

---

## 11. Variable Naming Rules

### الاسم يُعبّر عن المحتوى والغرض

```
❌ const d = getDate()
❌ const temp = calculateResult()
❌ const val = userRepo.find(id)
✅ const registrationDate = getRegistrationDate()
✅ const discountedPrice = calculateDiscountedPrice(basePrice, coupon)
✅ const user = await userRepository.findByMessengerId(senderId)
```

### أسماء مُحظورة بدون سبب

الأسماء التالية محظورة إلا في السياقات الضيقة جدًا التي لا معنى لغيرها:
- `data` — ما هو هذا الـ data؟
- `temp` — مؤقت لماذا؟ ما هو؟
- `value` — قيمة ماذا؟
- `obj` — object ماذا؟
- `result` — نتيجة ماذا؟
- `info` — معلومات ماذا؟
- `item` — عنصر من ماذا؟ (مقبول داخل Array.map فقط)

### المتغيرات المنطقية (Boolean) تبدأ بـ is/has/can/should

```
❌ const active = user.status === 'active'
❌ const blocked = session.flags.includes('blocked')
✅ const isActive = user.status === 'active'
✅ const isBlocked = session.flags.includes('blocked')
✅ const hasUnreadMessages = messages.some(m => !m.isRead)
✅ const canProcessPayment = user.isVerified && !user.isBlocked
```

### المصفوفات بصيغة الجمع

```
❌ const user = await userRepository.findAll()
✅ const users = await userRepository.findAll()
✅ const activeUsers = users.filter(user => user.isActive)
```

### الاختصارات المقبولة

اختصارات مقبولة ومتعارف عليها: `id`، `url`، `api`، `db`، `err` (في catch)، `req`/`res` (في Express handlers فقط)، `i`/`j` (في حلقات بسيطة فقط). أي اختصار آخر يُوضح كاملًا.

### camelCase للمتغيرات والدوال

```
✅ const sessionExpiresAt
✅ function processIncomingEvent
```

### PascalCase للـ Classes والـ Types والـ Interfaces

```
✅ class UserService
✅ interface IUserRepository
✅ type MessengerEvent
```

---

## 12. Constant Naming Rules

### UPPER_SNAKE_CASE للثوابت المعلنة على مستوى Module

```
✅ const MAX_RETRY_ATTEMPTS = 3
✅ const SESSION_TTL_SECONDS = 3_600
✅ const FACEBOOK_API_VERSION = 'v18.0'
✅ const DEFAULT_LANGUAGE = 'ar'
```

### مجمَّعة في ملفات Constants منظمة

الثوابت ذات الصلة تُجمَّع في ملف Constants خاص بها، لا تُوزَّع عشوائيًا. الثوابت المتعلقة بـ Facebook في `facebook.constants.ts`، الثوابت العامة في `app.constants.ts`.

### لا Magic Numbers مباشرة في الكود

```
❌ if (messageLength > 2000) throw new Error('Too long')
✅ if (messageLength > FACEBOOK_MAX_MESSAGE_LENGTH) throw new VoidError(...)
```

---

## 13. File Naming Rules

### kebab-case للملفات

جميع الملفات تُسمى بـ kebab-case (كلمات صغيرة مفصولة بشرطة).

```
✅ user.service.ts
✅ session.repository.ts
✅ facebook-message.sender.ts
✅ signature-verifier.middleware.ts
```

### اللاحقة تصف نوع الملف

الملفات تتبع نمط `{name}.{type}.ts` حيث الـ type يصف دور الملف:
- `.service.ts` — Business Logic Service.
- `.repository.ts` — Database Repository.
- `.middleware.ts` — Middleware.
- `.command.ts` — Command Definition.
- `.plugin.ts` — Plugin Definition.
- `.manager.ts` — Manager.
- `.interface.ts` — Interface Definition (إذا كانت منفصلة).
- `.types.ts` — Type Definitions.
- `.constants.ts` — Constants.
- `.errors.ts` — Error Definitions.
- `.utils.ts` — Utility Functions.
- `.test.ts` أو `.spec.ts` — Test File.

### الـ Index Files

`index.ts` مخصص للـ Barrel Exports فقط. لا يحتوي على منطق.

---

## 14. Folder Naming Rules

### kebab-case للمجلدات

```
✅ services/
✅ facebook-layer/
✅ session-management/
```

### الجمع للمجلدات التي تحتوي مجموعة من نفس النوع

```
✅ services/      (تحتوي على services متعددة)
✅ commands/      (تحتوي على commands متعددة)
✅ repositories/  (تحتوي على repositories متعددة)
```

### المفرد للمجلدات التي تمثل وحدة منطقية واحدة

```
✅ core/       (وحدة منطقية واحدة)
✅ facebook/   (طبقة واحدة)
✅ config/     (نظام إعدادات واحد)
```

---

## 15. Import Rules

### الترتيب الموحد للـ Imports

ترتيب الـ Imports في كل ملف يتبع هذا التسلسل الإلزامي، مع سطر فارغ بين كل مجموعة:

1. **Node.js Built-ins** (`path`، `crypto`، إلخ).
2. **External npm Packages** (`express`، `zod`، إلخ).
3. **Internal Core Imports** (`../core/interfaces`، `../core/types`).
4. **Internal Layer Imports** (من طبقات أخرى عبر Interfaces).
5. **Local Imports** (من نفس المجلد أو المجلدات المجاورة).

### لا Imports غير مستخدمة

أي Import لا يُستخدَم في الملف يُحذَف فورًا. الـ Imports غير المستخدمة ضجيج ومُربِك.

### استخدام مسارات مطلقة أو Aliases

يُفضَّل استخدام TypeScript Path Aliases (`@core/`، `@services/`) على المسارات النسبية العميقة `../../../../../../core`. المسارات النسبية مقبولة للمستويين الأول والثاني فقط.

### لا Wildcard Imports

```
❌ import * as Services from '../services'
✅ import { UserService } from '../services'
✅ import type { IUserService } from '../core/interfaces'
```

### Type-Only Imports صريحة

عند استيراد Types فقط (لا تُستخدَم في Runtime)، يُستخدَم `import type`:

```
✅ import type { User, Session } from '../core/types'
✅ import type { IUserRepository } from '../core/interfaces'
```

---

## 16. Export Rules

### لا Default Exports

Default Exports تُنشئ تعارضًا في الأسماء عبر الملفات المختلفة ويُصعّب الاكتشاف التلقائي. جميع Exports تكون Named Exports.

```
❌ export default class UserService { }
✅ export class UserService { }
```

### يُصدَّر فقط ما يُحتاج

لا يُصدَّر كل شيء في الملف بشكل افتراضي. ما هو Helper داخلي يبقى غير مُصدَّر. يُصدَّر فقط ما يُستهلَك من خارج الملف.

### Barrel Index منظم

`index.ts` يُعيد تصدير فقط ما يجب أن يكون متاحًا من خارج الطبقة. التفاصيل الداخلية لا تظهر في الـ Barrel.

---

## 17. Commenting Rules

### التعليق يشرح "لماذا"، لا "ماذا"

الكود يشرح ماذا يفعل بنفسه إذا كان واضحًا. التعليق يُوجَد لشرح:
- لماذا اخترت هذا الأسلوب على البديل الأوضح.
- ما القيد أو السبب غير الواضح الذي يفرض هذا النهج.
- تحذير من مشكلة حدية غير بديهية.

```
❌ // زيادة عداد الرسائل بواحد
   messageCount++

✅ // Facebook API تتطلب تأخيرًا بين الرسائل المتتالية لنفس المستخدم
   // لمنع تفعيل Rate Limiting عند إرسال رسائل متعددة
   await delay(FACEBOOK_MESSAGE_INTERVAL_MS)
```

### التعليقات تُحدَّث مع الكود

تعليق قديم لا يصف الكود الحالي أسوأ من غياب التعليق — يُضلّل القارئ. أي تعديل على الكود يستلزم مراجعة التعليقات المتعلقة به.

### لا Commented-Out Code

الكود المعلَّق بتعليقات يجب حذفه — Git يحفظ التاريخ. إذا كنت تخشى الحذف، فهذا يُشير لمشكلة في الثقة بالـ Version Control، لا لحاجة للاحتفاظ بالكود.

### لا TODO بلا سياق

```
❌ // TODO: fix this
✅ // TODO: هذا القسم يفترض أن المستخدم موجود دائمًا.
   // يجب إضافة معالجة للحالة التي يكون فيها المستخدم غير موجود بعد إضافة
   // Guest User support في الإصدار التالي.
```

---

## 18. Documentation Rules

### JSDoc لكل Public API

كل Method وProperty وType في الـ Public API (ما يُصدَّر للاستخدام من خارج الطبقة) يُوثَّق بـ JSDoc يتضمن:
- وصفًا موجزًا لما يفعله.
- `@param` لكل Parameter مع وصف غرضه.
- `@returns` مع وصف ما تُعيده.
- `@throws` إذا كانت تُطلق Errors.

### الـ Interface الواجهة موثقة بالكامل

كل Interface في Core لها JSDoc يشرح العقد — ليس فقط ما تفعله كل Method، بل أيضًا الافتراضات والضمانات.

### README للطبقات الرئيسية

طبقات النظام الرئيسية (Facebook Layer، Services، إلخ) لها `README.md` مختصر يشرح الغرض وقائمة المكونات وكيفية إضافة مكون جديد.

---

## 19. Async Programming Rules

### async/await حصرًا — لا .then()/.catch()

جميع الكود الـ Async يستخدم `async/await`. لا `.then()` ولا `.catch()` سلاسل في الكود الإنتاجي. الاستثناء الوحيد: حين يكون الـ Promise Chaining أوضح بشكل استثنائي في سياق محدد، ويُوثَّق السبب.

```
❌ userRepository.findById(id)
     .then(user => sendMessage(user))
     .catch(err => logger.error(err))

✅ try {
     const user = await userRepository.findById(id)
     await sendMessage(user)
   } catch (err) {
     logger.error({ err }, 'Failed to find user or send message')
   }
```

### لا Async في Constructors

Constructor لا يكون `async`. إذا كانت التهيئة تتطلب عمليات Async، تُستخدم Static Factory Method أو `initialize()` Method منفصلة.

### Promise.all للعمليات المستقلة

حين يوجد عمليات Async متعددة مستقلة عن بعض، تُشغَّل بالتوازي:

```
❌ const user = await userRepo.findById(id)
   const session = await sessionRepo.findByUserId(id)

✅ const [user, session] = await Promise.all([
     userRepo.findById(id),
     sessionRepo.findByUserId(id),
   ])
```

### لا Floating Promises

كل Promise يُنتظَر بـ `await` أو يُعالَج صراحةً. Promise غير منتظَرة تتحول لأخطاء صامتة.

```
❌ eventBus.emit('user.created', user)  // إذا كانت emit تُعيد Promise
✅ await eventBus.emit('user.created', user)
   // أو إذا كانت Fire-and-Forget مقصودة:
   void eventBus.emit('user.created', user)  // void يوضح القصد
```

### Async Operations تُعالَج بـ try/catch

كل عملية Async محاطة بـ `try/catch` عند النقطة التي يمكنها التعامل مع الخطأ. لا Async بدون معالجة أخطاء.

---

## 20. Error Handling Rules

### لا Swallowing للأخطاء

```
❌ try {
     await riskyOperation()
   } catch (err) {
     // تجاهل
   }
```

كل `catch` يتخذ قرارًا واعيًا: يُعالج الخطأ بشكل مناسب، أو يُسجّله، أو يُعيد رميه لأعلى. لا `catch` فارغ أبدًا.

### Typed Errors

جميع الأخطاء المُطلَقة من الكود تكون من أنواع مُعرَّفة في Core، لا `new Error('string')` عامة.

```
❌ throw new Error('User not found')
✅ throw new VoidError(ErrorCode.UserNotFound, `User ${userId} not found`)
```

هذا يُتيح معالجة الأخطاء بناءً على النوع، لا على تحليل النص.

### الأخطاء تُسجَّل بسياق

عند تسجيل خطأ، يُسجَّل مع السياق الكامل الذي يُساعد على التشخيص:

```
❌ logger.error('Failed to process message')
✅ logger.error({ err, senderId, messageType, sessionId }, 'Failed to process incoming message')
```

### معالجة الأخطاء في المكان المناسب

الخطأ يُعالَج في أقرب مكان يملك السياق الكافي للتعامل معه بشكل صحيح. إذا لم يملك المكان السياق الكافي، يُرمى الخطأ للأعلى.

### لا Error Messages للمستخدم النهائي في الـ Core

رسائل الخطأ الظاهرة للمستخدم تُنشأ في الطبقات الخارجية (Handlers/Facebook Layer) بناءً على نوع الخطأ. الطبقات الداخلية تُطلق Typed Errors وليس رسائل مقروءة للمستخدم.

---

## 21. Code Reuse Rules

### استخرج المشترك حين يتكرر ثلاث مرات

لا Abstraction مبكر. لكن حين يظهر نفس المنطق في ثلاثة أماكن أو أكثر، يُستخرج في دالة أو Class مشترك.

### الاستخراج في المكان المناسب

الكود المشترك يُستخرج في الطبقة الأنسب له:
- منطق أعمال مشترك → Service مشتركة.
- أدوات عامة خالصة → Utils.
- Middleware مشتركة → Middleware منفصلة.
- Constants مشتركة → Constants File.

### الاستخراج لا يكسر الطبقات

استخراج كود مشترك لا يُنشئ اعتمادًا غير صحيح بين الطبقات. كود مشترك بين Service وRepository لا يُوضَع في Service ولا في Repository — يُعرَّف في مكان مشترك لكليهما (Core أو Utils حسب طبيعته).

---

## 22. Code Smells

علامات تُشير لوجود مشكلة في الكود وتستدعي المراجعة:

### الرائحة الأولى — الاسم الغامض

متغير أو دالة أو كلاس باسم لا يُعبّر عن مسؤوليته. إذا احتجت لقراءة تنفيذه لتعرف ما هو، فالاسم فاشل.

### الرائحة الثانية — الدالة الطويلة

دالة تتجاوز 30 سطرًا في معظم الحالات تفعل أكثر من شيء. الدوال الطويلة تُخفي المنطق وتُصعّب الاختبار.

### الرائحة الثالثة — قائمة Parameters طويلة

دالة تقبل أكثر من 4 Parameters تحتاج إما تجميع الـ Parameters في Object أو إعادة تصميم.

### الرائحة الرابعة — التعشيش العميق

أكثر من ثلاثة مستويات من الـ if/for/while يُشير لمنطق معقد يحتاج استخراجًا.

### الرائحة الخامسة — Comments تشرح الكود

إذا كانت التعليقات تشرح ما يفعله الكود لأن الكود غير واضح بنفسه، الحل هو تحسين الكود لا إضافة تعليقات.

### الرائحة السادسة — الكلاس الضخم

Class بعشرات الـ Methods من مسؤوليات مختلفة يحمل مسؤوليات متعددة يجب تقسيمها.

### الرائحة السابعة — الكود المكرر

نفس المنطق في أكثر من مكانين — استخراج فوري.

### الرائحة الثامنة — Feature Envy

دالة في Class A تستخدم بشكل مكثف بيانات Class B. هذا يُشير لأن الدالة ربما تنتمي لـ Class B.

### الرائحة التاسعة — Shotgun Surgery

تغيير بسيط يستلزم تعديل أماكن كثيرة متفرقة في الكود — يُشير لمسؤولية مُوزَّعة بشكل خاطئ.

### الرائحة العاشرة — Any الغامض

`any` بدون تعليق يشرح لماذا — يُشير إما لكسل في التحديد أو لمشكلة في التصميم.

---

## 23. Anti Patterns

### Spaghetti Code

الكود المتشابك الذي يقفز بشكل غير منطقي بين مسؤوليات مختلفة، التدفق لا يُتبَع بسهولة. العلاج: إعادة تنظيم وفق مبدأ Single Responsibility وتدفق واضح.

### God Class

Class واحد يعرف كل شيء ويفعل كل شيء في النظام. مؤشراته: عشرات الـ Dependencies في Constructor، مئات الـ Methods، عدة مئات من الأسطر. العلاج: تقسيمه لكلاسات متخصصة.

### God Function

دالة واحدة تتعامل مع كل حالات الـ Flow من البداية للنهاية بدون استخراج. مؤشراتها: مئات الأسطر، عمق تعشيش كبير، تعمل أشياء غير مترابطة. العلاج: استخراج الخطوات في دوال منفصلة.

### Copy-Paste Programming

نسخ كود من مكان ولصقه في مكان آخر بدلًا من استخراجه. كل bug في الأصل يتكرر في النسخة. العلاج: استخراج فوري للمشترك.

### Shotgun Surgery

منطق واحد مُوزَّع على ملفات كثيرة، بحيث أي تغيير يستلزم تعديل أماكن كثيرة. العلاج: تجميع المسؤولية المتعلقة في مكان واحد.

### Feature Envy

Class يستخدم بشكل مكثف بيانات Class آخر أكثر من بياناته الخاصة. مؤشره: دالة تستدعي `other.getX()`, `other.getY()`, `other.getZ()` كثيرًا. العلاج: نقل الدالة للـ Class الذي يحتوي البيانات.

### Primitive Obsession

استخدام أنواع بدائية (String، Number، Boolean) لتمثيل مفاهيم النطاق بدلًا من إنشاء Types مناسبة.

```
❌ function createUser(name: string, id: string, role: string)
   // ما هو شكل الـ id؟ ما القيم المقبولة لـ role؟
✅ function createUser(name: UserName, id: MessengerId, role: UserRole)
```

### Large Switch Statements

Switch كبير يتعامل مع عشرات الحالات يُشير غالبًا لحاجة لـ Strategy Pattern أو Command Pattern بدلًا من التعداد المباشر.

### Excessive Nesting

أكثر من ثلاثة مستويات من التعشيش داخل دالة. العلاج: Early Returns، Extract Functions، تبسيط الشروط.

### Hidden Side Effects

دالة تُعدّل State خارجية أو تُجري عملية I/O دون أن يكون ذلك واضحًا من اسمها. مثال: دالة تُسمى `validateUser` تُعدّل `lastValidatedAt` في قاعدة البيانات. العلاج: اجعل الـ Side Effect صريحًا في الاسم أو الـ Documentation، أو افصله في دالة منفصلة.

---

## 24. Refactoring Rules

### متى يُسمح بالـ Refactoring

**الحالة الأولى — Code Smell واضح:**
حين يكتشف المطور إحدى الـ Code Smells الموثقة في القسم السابق أثناء العمل على ملف ما، يُسمح بمعالجتها في نفس الوقت إذا كانت محدودة النطاق.

**الحالة الثانية — قبل إضافة ميزة:**
حين يكون الكود الحالي صعب التوسع لإضافة ميزة جديدة، يُجرى Refactoring أولًا ثم تُضاف الميزة.

**الحالة الثالثة — Refactoring مخطط له:**
Refactoring كبير يُخطَّط له كمهمة مستقلة، يُوثَّق نطاقه ومبرراته قبل البدء.

### متى يُمنع الـ Refactoring

**يُمنع تمامًا:**
- Refactoring لمجرد التفضيل الأسلوبي دون تحسين موضوعي.
- Refactoring مصحوب بإضافة ميزة جديدة في نفس الـ Commit — يجب الفصل بينهما.
- Refactoring في وقت ضيق بدون وقت كافٍ للاختبار.
- Refactoring يُغيّر السلوك الخارجي (هذا ليس Refactoring — هذا تغيير وظيفي).

### كيف يُنفَّذ الـ Refactoring بأمان

**الخطوة الأولى — اكتب الاختبارات أولًا:**
قبل أي Refactoring، تأكد من وجود اختبارات تُغطي السلوك الحالي. إذا لم تكن موجودة، أضفها. هذه الاختبارات هي الشبكة الأمان.

**الخطوة الثانية — تغيير صغير واحد في كل مرة:**
لا تُجري Refactoring ضخمًا دفعة واحدة. كل خطوة صغيرة تُنفَّذ وتُختبَر قبل الانتقال للتالية.

**الخطوة الثالثة — لا تغيير في السلوك الخارجي:**
Refactoring يُغيّر كيفية كتابة الكود داخليًا دون تغيير ما يفعله خارجيًا. إذا تغيّر السلوك، فهذا تغيير وظيفي يحتاج توثيقًا مختلفًا.

**الخطوة الرابعة — اختبر بعد كل خطوة:**
شغّل الاختبارات بعد كل تغيير صغير. اكتشاف المشكلة بعد خطوة واحدة أسهل بكثير من اكتشافها بعد عشرين خطوة.

**الخطوة الخامسة — Commit مستقل:**
الـ Refactoring يكون في Commit منفصل عن الـ Features. هذا يُسهّل فهم التاريخ وعزل المشاكل.

---

## 25. Review Checklist

قبل اعتبار أي كود جاهزًا، تُراجَع هذه القائمة كاملةً:

### الأسماء والوضوح
- [ ] جميع المتغيرات والدوال والكلاسات ذات أسماء تعبّر عن مسؤوليتها.
- [ ] لا أسماء عامة (`data`, `temp`, `value`, `obj`) إلا في سياقات محدودة ومبررة.
- [ ] المتغيرات المنطقية تبدأ بـ `is`/`has`/`can`/`should`.
- [ ] الدوال تبدأ بفعل.

### الحجم والتركيز
- [ ] لا دالة تتجاوز 30 سطرًا (إلا باستثناء موثق).
- [ ] لا ملف يتجاوز 300 سطر كود فعلي.
- [ ] لا Class تحمل مسؤوليات متعددة.

### النظافة
- [ ] لا كود معلَّق (Commented-Out Code).
- [ ] لا Imports غير مستخدمة.
- [ ] لا متغيرات معلنة ولا تُستخدَم.
- [ ] لا Magic Numbers أو Magic Strings.

### TypeScript
- [ ] لا `any` بدون تعليق يشرح السبب.
- [ ] جميع Return Types مُعلنة صراحةً.
- [ ] جميع Parameters مُكتوبة بالأنواع.

### Async والأخطاء
- [ ] كل Async operation تستخدم `async/await`.
- [ ] لا Floating Promises.
- [ ] لا `catch` فارغ.
- [ ] الأخطاء Typed من Core Error Types.

### البنية
- [ ] الـ Imports مرتبة بالترتيب الموحد.
- [ ] لا Default Exports.
- [ ] الـ Constants في UPPER_SNAKE_CASE ومُعرَّفة كـ Constants.

### التوافق مع الدستور
- [ ] الكود يتوافق مع قواعد الطبقات المُعرَّفة في `03-layer-responsibilities.md`.
- [ ] الـ Dependencies تتبع القواعد في `04-dependency-rules.md`.
- [ ] الأسلوب العام يتسق مع بقية المشروع.

### التوثيق
- [ ] الـ Public APIs موثقة بـ JSDoc.
- [ ] القرارات غير البديهية لها تعليقات تشرح "لماذا".
- [ ] الـ TODO تحمل سياقًا واضحًا.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
