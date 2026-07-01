# 06 — TypeScript Guidelines

> **المرجع الرسمي لقواعد استخدام TypeScript في مشروع Void**
> يُقرأ هذا الملف قبل كتابة أي كود TypeScript داخل المشروع.
> TypeScript أداة أمان — يجب استغلالها بالكامل، لا التحايل عليها.

---

## Table of Contents

1. [TypeScript Philosophy](#1-typescript-philosophy)
2. [Compiler Configuration Philosophy](#2-compiler-configuration-philosophy)
3. [Strict Mode Policy](#3-strict-mode-policy)
4. [Type Safety Principles](#4-type-safety-principles)
5. [Interface Design Rules](#5-interface-design-rules)
6. [Type Alias Rules](#6-type-alias-rules)
7. [Generic Design Rules](#7-generic-design-rules)
8. [Utility Types Guidelines](#8-utility-types-guidelines)
9. [Enum Policy](#9-enum-policy)
10. [Literal Types Policy](#10-literal-types-policy)
11. [Union and Intersection Types](#11-union-and-intersection-types)
12. [Optional Properties Policy](#12-optional-properties-policy)
13. [Readonly Policy](#13-readonly-policy)
14. [Immutable Design](#14-immutable-design)
15. [Function Typing Rules](#15-function-typing-rules)
16. [Async Function Typing](#16-async-function-typing)
17. [Class Typing Rules](#17-class-typing-rules)
18. [Abstract Classes vs Interfaces](#18-abstract-classes-vs-interfaces)
19. [Composition over Inheritance](#19-composition-over-inheritance)
20. [Dependency Injection Typing](#20-dependency-injection-typing)
21. [Module Export Rules](#21-module-export-rules)
22. [Module Import Rules](#22-module-import-rules)
23. [Null and Undefined Policy](#23-null-and-undefined-policy)
24. [Error Typing](#24-error-typing)
25. [any Usage Policy](#25-any-usage-policy)
26. [unknown Usage Policy](#26-unknown-usage-policy)
27. [never Usage Policy](#27-never-usage-policy)
28. [Type Narrowing Rules](#28-type-narrowing-rules)
29. [Custom Type Guards](#29-custom-type-guards)
30. [Performance Considerations](#30-performance-considerations)
31. [Forbidden TypeScript Practices](#31-forbidden-typescript-practices)
32. [Recommended TypeScript Practices](#32-recommended-typescript-practices)
33. [AI Decision Rules](#33-ai-decision-rules)
34. [Common TypeScript Mistakes](#34-common-typescript-mistakes)
35. [Anti Patterns](#35-anti-patterns)
36. [Review Checklist](#36-review-checklist)

---

## 1. TypeScript Philosophy

### TypeScript ليس اختياريًا

Void مكتوب بـ TypeScript وليس JavaScript. هذا قرار معماري غير قابل للنقاش. TypeScript ليس مجرد إضافة على JavaScript — هو اللغة الأساسية للمشروع بكل ما تعنيه من نظام أنواع، وأدوات ثابتة، وأمان وقت التطوير.

### الهدف من TypeScript

TypeScript في Void يُحقق هدفًا واحدًا: **اكتشاف الأخطاء في وقت التطوير لا في وقت التشغيل.** كل قرار يتعلق باستخدام TypeScript يُقاس بهذا المعيار — هل يُعزز الأمان أم يُضعفه؟

### نظام الأنواع وثيقة حية

أنواع TypeScript في Void ليست مجرد تعليقات توضيحية — هي توثيق قابل للتحقق. من يقرأ `IUserRepository` يفهم عقد التخزين. من يقرأ `MessengerEvent` يفهم بنية الحدث. الأنواع تُوثّق وتُقيّد في آن واحد.

### الاستسلام لنظام الأنواع ليس ضعفًا

حين يُصعّب TypeScript تنفيذ شيء ما، الاستجابة الصحيحة ليست التحايل على الـ Type System — هي التوقف والتفكير: "هل التصميم صحيح؟" في أغلب الأحيان، مقاومة الـ Type System تُشير لمشكلة في التصميم، لا في TypeScript.

---

## 2. Compiler Configuration Philosophy

### Tsconfig هو العقد

ملف `tsconfig.json` هو العقد الرسمي لإعدادات TypeScript. لا يُعدَّل دون مراجعة أثر التغيير على المشروع كله. كل تخفيف لـ Strict Mode يستلزم مبررًا موثقًا في الدستور.

### مبدأ أقصى صرامة ممكنة

إعدادات المترجم تُضبَط على أعلى مستوى من الصرامة الذي يبقى عمليًا. لا يُخفَّف إعداد إلا إذا أثبت أنه يُعيق التطوير بدون قيمة مقابلة.

### الإعدادات الأساسية غير القابلة للتفاوض

الإعدادات التالية مُفعَّلة دائمًا بلا استثناء:

- `strict: true` — يُفعّل مجموعة من الفحوصات الصارمة.
- `noImplicitAny: true` — يمنع الـ any الضمني.
- `strictNullChecks: true` — يجعل `null` و`undefined` غير متوافقين مع باقي الأنواع.
- `noUnusedLocals: true` — يمنع المتغيرات المعلنة وغير المستخدمة.
- `noUnusedParameters: true` — يمنع الـ Parameters غير المستخدمة.
- `noImplicitReturns: true` — يضمن أن كل مسار تنفيذ يُعيد قيمة.
- `noFallthroughCasesInSwitch: true` — يمنع التسقط التلقائي في Switch.
- `exactOptionalPropertyTypes: true` — يُميّز بين `undefined` والغياب.
- `forceConsistentCasingInFileNames: true` — يمنع مشاكل الـ Casing.

### لا تعطيل للفحوصات بـ Directives

```
❌ // @ts-ignore
❌ // @ts-nocheck
```

هذان المُوجِّهان يُعطّلان حماية TypeScript محليًا. استخدامهما في كود الإنتاج مرفوض. الحالة الوحيدة التي يُقبل فيها `// @ts-expect-error` هي حين يوجد Bug معروف في مكتبة خارجية أو تعريفاتها، مع تعليق واضح يشرح السبب.

---

## 3. Strict Mode Policy

### Strict Mode إلزامي وغير قابل للتعطيل

`strict: true` في tsconfig هو القانون الأساسي. يُفعّل:
- `strictNullChecks` — يمنع تمرير `null` أو `undefined` حيث لا يُتوقع.
- `strictFunctionTypes` — يُشدّد فحص أنواع الدوال.
- `strictBindCallApply` — يُشدّد فحص `bind`, `call`, `apply`.
- `strictPropertyInitialization` — يضمن تهيئة Properties في Constructor.
- `noImplicitThis` — يمنع `this` غير الصريح.
- `useUnknownInCatchVariables` — يجعل متغير `catch` من نوع `unknown`.

### Strict Mode لا يُشل التطوير

الشكوى الشائعة: "Strict Mode يجعل الكود أطول." الإجابة: نعم، ويجعله أيضًا أكثر وضوحًا وأمانًا. الأسطر الإضافية التي يستلزمها Strict Mode هي توثيق للقصد، لا عبء.

---

## 4. Type Safety Principles

### المبدأ الأول — كل قيمة لها نوع صريح

TypeScript يُستخدَم لتوثيق الأنواع، لا لتخمينها. الاعتماد على Type Inference مقبول داخل الدوال لمتغيرات محلية واضحة، لكن الـ Public APIs دائمًا تُعلن أنواعها صراحةً.

### المبدأ الثاني — الأنواع تعكس الواقع

النوع يجب أن يصف بدقة القيم الممكنة — لا أوسع ولا أضيق. نوع أوسع من الواقع يُفقد الأمان. نوع أضيق يُنشئ خطأ في وقت التشغيل.

```
❌ type Status = string         // واسع جدًا — أي string مقبول
✅ type Status = 'active' | 'inactive' | 'blocked'  // دقيق
```

### المبدأ الثالث — لا افتراضات ضمنية

الكود لا يفترض نوع قيمة لم يُعلَن. إذا كانت قيمة `unknown`، تُضيَّق أولًا قبل الاستخدام. إذا كانت قد تكون `null`، يُعالَج ذلك صراحةً.

### المبدأ الرابعا — الأنواع توثيق قابل للتحقق

الفائدة الثانوية لنظام الأنواع هي التوثيق. `findByMessengerId(id: MessengerId): Promise<User | null>` تُخبر القارئ بكل ما يحتاجه دون رؤية التنفيذ.

---

## 5. Interface Design Rules

### Interface للعقود

`interface` يُستخدَم عند تعريف عقد — ما يجب أن يُطبّقه مكون آخر، أو ما يصف شكل بيانات تتبادله الطبقات.

```
✅ interface IUserRepository {
     findByMessengerId(id: MessengerId): Promise<User | null>
     save(user: User): Promise<User>
   }
```

### Interface قابل للتوسع

`interface` يدعم `extends` مما يُتيح التركيب الهرمي النظيف عند الحاجة الحقيقية.

```
✅ interface IReadableRepository<T> {
     findById(id: string): Promise<T | null>
   }
   interface IWritableRepository<T> extends IReadableRepository<T> {
     save(entity: T): Promise<T>
     delete(id: string): Promise<void>
   }
```

### Interface صغير ومتخصص

Interface لا يجمع مسؤوليات متعددة. Interface كبير يُخرق Interface Segregation Principle.

### لا Implementation في الـ Interface

Interface تصف الشكل فقط — لا قيم افتراضية، لا منطق، لا Static Members. هذه للـ Class.

### Declaration Merging بوعي

`interface` يدعم Declaration Merging. هذه الميزة لا تُستخدَم إلا بوعي كامل بتأثيرها. الإساءة في استخدامها تُنشئ أنواعًا غامضة.

---

## 6. Type Alias Rules

### Type Alias للتركيبات والـ Unions

`type` يُستخدَم لـ:
- Union Types: `type UserId = string | number`
- Intersection Types: `type AdminUser = User & { adminLevel: number }`
- Tuple Types: `type Coordinates = [number, number]`
- Mapped Types والـ Conditional Types.
- أسماء مختصرة للأنواع المعقدة.

```
✅ type MessengerId = string
✅ type EventHandler<T> = (event: T) => Promise<void>
✅ type ApiResponse<T> = { data: T; status: number; message: string }
```

### Interface للعقود، Type للبيانات

القاعدة العملية: `interface` للعقود التي تُطبّقها Classes. `type` لتعريف شكل البيانات والتركيبات.

### لا Type Alias غير ضروري

```
❌ type StringType = string   // لا قيمة — استخدم string مباشرة
❌ type MyObject = object      // غير مفيد
```

---

## 7. Generic Design Rules

### Generic لتعميم المنطق على أنواع متعددة

Generics تُستخدَم حين يُطبَّق نفس المنطق على أنواع مختلفة دون معرفة النوع المسبقة. لا تُستخدَم Generics إذا كان المنطق خاصًا بنوع واحد.

```
✅ interface IRepository<T, ID = string> {
     findById(id: ID): Promise<T | null>
     save(entity: T): Promise<T>
   }
```

### أسماء الـ Type Parameters واضحة

تجنب أسماء الحرف الواحد عدا `T` في الحالات البسيطة جدًا. الأسماء الواضحة أفضل:

```
❌ function transform<A, B, C>(input: A, ...): C
✅ function transform<TInput, TOutput>(input: TInput, transformer: (i: TInput) => TOutput): TOutput
```

استثناء مقبول: `T`, `K`, `V` في Generics قصيرة ومعروفة الغرض.

### Generic Constraints تُحدَّد عند الحاجة

```
✅ function getProperty<TObject, TKey extends keyof TObject>(
     obj: TObject,
     key: TKey
   ): TObject[TKey]
```

### لا Generics معقدة بدون قيمة واضحة

Generics المعقدة ذات 4-5 Type Parameters وConditions متداخلة تُصعّب القراءة أكثر مما تُبسّط الكود. إذا كانت الـ Generic أكثر تعقيدًا من المشكلة التي تحلها، أعد النظر في التصميم.

### لا Premature Generification

لا تُحوَّل الدالة لـ Generic قبل الحاجة. إذا كانت تعمل مع نوع واحد محدد، ابقها كذلك. Generic تُضاف حين يظهر الاستخدام مع أنواع مختلفة فعليًا.

---

## 8. Utility Types Guidelines

### الـ Utility Types المُوصى باستخدامها

**`Partial<T>`** — حين تكون جميع Properties اختيارية (مثل Update DTOs).
**`Required<T>`** — حين يجب ضمان وجود جميع Properties.
**`Readonly<T>`** — لتحديد Immutability صراحةً.
**`Pick<T, Keys>`** — لاستخراج مجموعة فرعية من Properties.
**`Omit<T, Keys>`** — لحذف Properties من نوع.
**`Record<K, V>`** — لتعريف Dictionaries ذات أنواع محددة.
**`ReturnType<T>`** — لاستخراج نوع القيمة المُعادة.
**`Parameters<T>`** — لاستخراج أنواع الـ Parameters.
**`NonNullable<T>`** — لإزالة `null` و`undefined` من النوع.

### لا تركيب مفرط للـ Utility Types

```
❌ type ComplexType = Partial<Omit<Required<Pick<User, 'id' | 'name'>>, 'id'>>
```

حين يصبح التركيب صعب القراءة، يُعرَّف Named Type جديد بدلًا منه.

---

## 9. Enum Policy

### Enums للحالات الثابتة المعروفة في وقت التطوير

Enums تُستخدَم لمجموعات من القيم الثابتة ذات المعنى الدلالي.

```
✅ enum EventType {
     Message = 'message',
     Postback = 'postback',
     QuickReply = 'quick_reply',
   }
```

### String Enums إلزامية

لا Numeric Enums — القيم العددية غير دلالية في السجلات وصعبة التشخيص. جميع Enums تستخدم String Values.

```
❌ enum Status { Active, Inactive, Blocked }   // 0, 1, 2 — غير دلالي
✅ enum Status { Active = 'active', Inactive = 'inactive', Blocked = 'blocked' }
```

### Const Enums بحذر

`const enum` يُنتج كودًا أكثر كفاءة لكنه لا يعمل مع بعض أدوات البناء وModular Systems. يُستخدَم فقط حين الضرورة واضحة ومُختبَرة.

### بديل الـ Enum — As Const Object

في بعض الحالات، `as const` Object يُوفر نفس فوائد Enum مع مرونة أكبر:

```
✅ const ErrorCode = {
     UserNotFound: 'USER_NOT_FOUND',
     SessionExpired: 'SESSION_EXPIRED',
   } as const
   type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]
```

---

## 10. Literal Types Policy

### Literal Types للقيم المعروفة المحدودة

```
✅ type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
✅ type Locale = 'ar' | 'en' | 'fr'
✅ type LogLevel = 'debug' | 'info' | 'warn' | 'error'
```

### Template Literal Types للأنماط المُركَّبة

```
✅ type EventName = `${string}.${string}`          // domain.action
✅ type CacheKey = `void:${string}:${string}`      // void:entity:id
```

### لا Widening غير مقصود

```
❌ const status = 'active'    // يُعطى type: string (Widened)
✅ const status = 'active' as const   // type: 'active'
✅ const status: Status = 'active'    // محدد بوضوح
```

---

## 11. Union and Intersection Types

### Union Types للأنواع البديلة

```
✅ type ApiResult<T> = { success: true; data: T } | { success: false; error: VoidError }
✅ type IdType = string | number
```

### Discriminated Unions للتمييز الآمن

حين يوجد Union من Objects، يُضاف discriminant field واضح:

```
✅ type Event =
     | { type: 'message'; text: string; senderId: string }
     | { type: 'postback'; payload: string; senderId: string }
     | { type: 'quick_reply'; payload: string; text: string; senderId: string }
```

TypeScript يستطيع التضييق (Narrowing) تلقائيًا بناءً على `type` field.

### Intersection Types للتركيب

```
✅ type AuthenticatedRequest = Request & { user: User; session: Session }
```

### لا تعقيد زائد في الـ Unions

Union من أكثر من 5-6 أنواع مختلفة يُشير غالبًا لمشكلة في التصميم. فكّر في إعادة هيكلة بدلًا من توسيع الـ Union.

---

## 12. Optional Properties Policy

### Optional Property تعني "قد تكون موجودة"

`property?: Type` تعني أن الـ Property قد لا تكون موجودة أصلًا في الـ Object. هذا مختلف عن `property: Type | undefined` التي تعني أن الـ Property موجودة لكن قيمتها `undefined`.

مع `exactOptionalPropertyTypes: true` هذا الفرق مُفعَّل ويُفرض.

### Optional بتحفظ

كل Optional Property تُضيف تعقيدًا لمكان الاستهلاك — يجب التحقق من وجودها قبل الاستخدام. لا تُجعَل Property اختيارية إلا إذا كانت بالفعل اختيارية وجودًا.

```
❌ interface User {
     id: string
     name?: string          // هل الاسم حقًا اختياري؟ أم أنك لا تعرف قيمته؟
     email?: string
   }

✅ interface UserCreationData {
     id: string
     name: string           // مطلوب دائمًا
     email?: string         // مطلوب فقط إذا اختار المستخدم تقديمه
   }
```

### Optional مقابل Default Value

إذا كانت الـ Property اختيارية لكن لها قيمة افتراضية، أعلن ذلك:

```
✅ interface PaginationOptions {
     page?: number          // Default: 1
     pageSize?: number      // Default: 20
   }
```

---

## 13. Readonly Policy

### Readonly للبيانات التي لا يجب تعديلها

```
✅ interface Config {
     readonly facebookToken: string
     readonly port: number
   }
```

### Readonly Arrays

مصفوفات لا يجب أن تُعدَّل تُعلَن `ReadonlyArray<T>` أو `readonly T[]`.

```
✅ function processCommands(commands: ReadonlyArray<ICommand>): void
```

### Readonly Deep بحذر

TypeScript's `Readonly<T>` سطحي — لا يُجمّد الـ Nested Objects. للتجميد العميق، استخدم نوعًا مخصصًا أو مكتبة، مع توثيق ذلك.

---

## 14. Immutable Design

### الأفضلية للـ Immutability

حين يكون لديك خيار بين تصميم Mutable وImmutable، اختر Immutable. البيانات الـ Immutable أسهل في التتبع والاختبار وأقل عرضة لأخطاء الـ Shared State.

### لا تعديل على Objects المُمرَّرة

الدالة لا تُعدّل Object مُمرَّر إليها — تُنشئ Object جديدًا بالتعديل إذا لزم.

```
❌ function updateUser(user: User, name: string): void {
     user.name = name   // تعديل على المُمرَّر
   }

✅ function updateUser(user: User, name: string): User {
     return { ...user, name }   // إنشاء جديد
   }
```

### `const` للجميع

جميع الإعلانات تبدأ بـ `const`. تُحوَّل لـ `let` فقط إذا كانت هناك حاجة فعلية لإعادة التعيين. لا `var` أبدًا.

---

## 15. Function Typing Rules

### كل دالة لها Return Type صريح

Return Types تُعلَن صراحةً في جميع الدوال المُصدَّرة وأي دالة غير بديهية.

```
❌ function getUser(id: string) { ... }      // يعتمد على Type Inference
✅ function getUser(id: string): Promise<User | null> { ... }
```

الاستثناء المقبول: دوال Arrow Functions البسيطة جدًا داخل Map/Filter/Reduce حيث النوع واضح من السياق.

### كل Parameter له نوع صريح

```
❌ function process(event, context) { ... }
✅ function process(event: MessengerEvent, context: RequestContext): Promise<void>
```

### الدوال النقية تُشار إليها بالتوقيع

الدالة التي لا تُعيد قيمة تُعلَن `void`. الدالة التي لا يمكن أن تنتهي بشكل طبيعي تُعلَن `never`.

### Function Overloads للتعددية

حين تتصرف الدالة بشكل مختلف بناءً على أنواع المدخلات، تُستخدَم Function Overloads:

```
✅ function sendMessage(recipientId: string, text: string): Promise<void>
   function sendMessage(recipientId: string, template: ButtonTemplate): Promise<void>
   function sendMessage(recipientId: string, content: string | ButtonTemplate): Promise<void> {
     // التنفيذ
   }
```

---

## 16. Async Function Typing

### كل Async دالة Return Type صريح

```
❌ async function findUser(id: string) { ... }
✅ async function findUser(id: string): Promise<User | null> { ... }
```

### لا `Promise<any>`

```
❌ async function fetch(url: string): Promise<any>
✅ async function fetch<T>(url: string): Promise<T>
// أو أفضل:
✅ async function fetchUserProfile(userId: string): Promise<UserProfile>
```

### Promise Rejection Types

TypeScript لا يُقيّد أنواع الـ Rejected Promises. الاتفاق في Void: الـ Rejection دائمًا من نوع `VoidError` أو Subclass منه، ويُوثَّق ذلك في JSDoc بـ `@throws`.

---

## 17. Class Typing Rules

### كل Class Member مُكتوب صراحةً

```
✅ class UserService {
     private readonly userRepository: IUserRepository
     private readonly logger: ILogger

     constructor(
       userRepository: IUserRepository,
       logger: ILogger,
     ) {
       this.userRepository = userRepository
       this.logger = logger
     }
   }
```

### Parameter Properties بانتباه

TypeScript يُتيح اختصار `constructor(private readonly repo: IUserRepository)`. مقبول للمشاريع الصغيرة، لكن في Void يُفضَّل الإعلان الصريح لأنه أوضح ويُبقي الـ Constructor قابلًا للإضافة مستقبلًا.

### Access Modifiers دائمًا

```
✅ private readonly userRepository: IUserRepository
✅ protected readonly logger: ILogger
✅ public async findUser(id: string): Promise<User | null>
```

لا Member بدون Access Modifier.

### Generic Classes حيث يلزم

```
✅ abstract class BaseRepository<T, ID = string> implements IRepository<T, ID> {
     abstract findById(id: ID): Promise<T | null>
   }
```

---

## 18. Abstract Classes vs Interfaces

### متى تُستخدَم Interface

- لتعريف عقد تُطبّقه Classes متعددة بدون أي تنفيذ مشترك.
- للعقود بين الطبقات (الحالة الأكثر شيوعًا في Void).
- حين لا يوجد سلوك مشترك يُرث.

**الاختيار الافتراضي في Void هو Interface.**

### متى تُستخدَم Abstract Class

- حين يوجد تنفيذ مشترك حقيقي يُوزَّع على Subclasses.
- حين هناك Template Method Pattern واضح.
- حين يجب ضمان أن المكون يُطبّق جزءًا من السلوك لكن يُخصّص جزءًا آخر.

```
✅ abstract class BaseCommand {
     // تنفيذ مشترك لجميع Commands
     protected abstract execute(context: RequestContext): Promise<CommandResult>
     async handle(context: RequestContext): Promise<void> {
       const result = await this.execute(context)
       await this.respond(context, result)
     }
     private async respond(...): Promise<void> { /* مشترك */ }
   }
```

### لا Abstract Class لمجرد المشاركة اللفظية

إذا كانت المشاركة مجرد Interface بدون تنفيذ مشترك حقيقي — استخدم Interface.

---

## 19. Composition over Inheritance

### الـ Inheritance في TypeScript يُقيّد

Inheritance Class يعني اقترانًا وثيقًا. تغيير الـ Parent يؤثر على جميع الـ Children. في TypeScript، الـ Composition عبر Interfaces والـ Dependency Injection يُتيح مرونة أكبر.

### تركيب الأنواع بالـ Intersection

```
✅ type AdminContext = UserContext & { adminLevel: AdminLevel }
```

### تركيب السلوك بالـ Composition

بدلًا من `class AdminService extends UserService`:
```
✅ class AdminService {
     constructor(
       private readonly userService: IUserService,    // Composition
       private readonly auditService: IAuditService,   // Composition
     ) {}
   }
```

---

## 20. Dependency Injection Typing

### كل Dependency مُكتوبة بـ Interface

```
✅ class OrderService {
     constructor(
       private readonly userRepo: IUserRepository,        // Interface من Core
       private readonly orderRepo: IOrderRepository,       // Interface من Core
       private readonly facebookClient: IFacebookClient,  // Interface من Core
       private readonly logger: ILogger,                  // Interface من Core
     ) {}
   }
```

### لا Constructor Calls لـ Concrete Classes

```
❌ class OrderService {
     private readonly repo = new PostgresOrderRepository()  // Concrete Class
   }
```

### Token-Based Injection

في DI Container، يُستخدَم Symbol أو String Token لربط الـ Interface بالـ Implementation:

```
✅ const TOKENS = {
     UserRepository: Symbol('IUserRepository'),
     Logger: Symbol('ILogger'),
   } as const
```

---

## 21. Module Export Rules

### لا Default Exports

```
❌ export default class UserService
✅ export class UserService
✅ export { UserService }
```

### Type-Only Re-exports

عند إعادة تصدير Types فقط:
```
✅ export type { User, Session } from './types'
✅ export type { IUserRepository } from './interfaces'
```

### تُصدَّر فقط ما يُحتاج

```
❌ export class InternalHelper  // مساعد داخلي لا يحتاج تصديرًا
✅ // يبقى unexported
```

### Barrel Exports منظمة وصريحة

`index.ts` يُصدَّر فيه فقط ما يمثل الـ Public API للطبقة. لا `export * from './internal-file'` — تُصدَّر الأشياء بأسمائها صراحةً.

---

## 22. Module Import Rules

### Type-Only Imports صريحة

```
✅ import type { User } from '../core/types'
✅ import type { IUserRepository } from '../core/interfaces'
```

هذا يُحسّن أداء الـ Build ويُوضح ما يُستخدَم فعليًا في Runtime.

### لا Wildcard Imports

```
❌ import * as Types from '../core/types'
✅ import type { User, Session, MessengerEvent } from '../core/types'
```

### مسارات منظمة

يُستخدَم TypeScript Path Aliases (`@core/`, `@services/`) لمنع المسارات النسبية العميقة.

---

## 23. Null and Undefined Policy

### `null` تعني "قيمة فارغة مقصودة"

`null` يُستخدَم حين القيمة الفارغة هي حالة صالحة ومقصودة — مثل "لا يوجد مستخدم بهذا الـ ID."

### `undefined` تعني "غير موجود أصلًا"

`undefined` يُستخدَم للـ Optional Properties حين الـ Property لم يُعطَ قيمة.

### لا Optional Chaining لإخفاء مشاكل

`?.` أداة مفيدة لكنها قد تُخفي حالات لا يجب إخفاؤها. إذا كانت قيمة لا يجب أن تكون `null` في سياق معين، تُعالَج بـ Guard Clause بدلًا من `?.`.

```
❌ const name = user?.profile?.name ?? 'مجهول'
   // إذا كانت user يجب أن تكون موجودة في هذا السياق:
✅ if (!user) throw new VoidError(ErrorCode.UserNotFound, '...')
   const name = user.profile?.name ?? 'مجهول'
```

### لا Non-Null Assertion إلا عند الضرورة

`!` يُعطّل Null Check ويُخفي خطرًا محتملًا. يُستخدَم فقط حين يكون المطور متيقنًا تمامًا أن القيمة لن تكون `null` ولا يستطيع إثبات ذلك للـ Compiler، مع تعليق يشرح السبب.

```
❌ const user = findUser(id)!    // بدون سبب واضح
✅ // هنا نعرف أن getUserOrThrow سترمي خطأً إذا لم يوجد المستخدم
   const user = await getUserOrThrow(id)  // أفضل بكثير من !
```

---

## 24. Error Typing

### Custom Error Types في Core

جميع الأخطاء في Void من نوع `VoidError` أو Subclass منه:

```
✅ class VoidError extends Error {
     constructor(
       public readonly code: ErrorCode,
       message: string,
       public readonly context?: Record<string, unknown>,
     ) {
       super(message)
       this.name = 'VoidError'
     }
   }
```

### Typed Error Codes

```
✅ enum ErrorCode {
     UserNotFound = 'USER_NOT_FOUND',
     SessionExpired = 'SESSION_EXPIRED',
     FacebookApiError = 'FACEBOOK_API_ERROR',
   }
```

### Catch Variables تُضيَّق

مع `useUnknownInCatchVariables: true`، متغير `catch` يكون `unknown`:

```
✅ try {
     await riskyOperation()
   } catch (err) {
     if (err instanceof VoidError) {
       logger.warn({ code: err.code }, err.message)
     } else {
       logger.error({ err }, 'Unexpected error')
       throw err
     }
   }
```

---

## 25. any Usage Policy

### `any` مرفوض في الكود الإنتاجي

`any` يُعطّل TypeScript تمامًا لتلك القيمة. استخدامه يتعارض مع الهدف الأساسي من TypeScript.

### الاستثناءات الوحيدة المقبولة

1. **تعريف Type Guards:** حين يكون الغرض هو التحقق من نوع قيمة مجهولة.
2. **تعارض أنواع مكتبة خارجية:** حين تكون تعريفات مكتبة خارجية خاطئة أو ناقصة بشكل موثق.

### كل `any` يحمل تعليقًا إلزاميًا

```
❌ function parsePayload(raw: any): MessengerEvent { }
✅ // eslint-disable-next-line @typescript-eslint/no-explicit-any
   // السبب: Facebook Webhook payload يأتي بهيكل غير محدد النوع في المكتبة
   // يُحوَّل لـ MessengerEvent بعد التحقق اليدوي من الهيكل
   function parsePayload(raw: any): MessengerEvent { }
```

---

## 26. unknown Usage Policy

### `unknown` البديل الآمن لـ `any`

`unknown` يعني "لا أعرف النوع، لكن لن أستخدمه بشكل غير آمن." يُستخدَم:

- لأي قيمة خارجية (Webhook Payload، API Response، User Input).
- لقيم `catch`.
- لأي شيء لا يمكن معرفة نوعه مسبقًا.

### قبل استخدام `unknown` يجب التضييق

```
✅ function processExternalData(data: unknown): User {
     if (!isValidUserPayload(data)) {
       throw new VoidError(ErrorCode.InvalidPayload, 'Invalid user payload structure')
     }
     return data   // TypeScript يعرف الآن أن data هو UserPayload
   }
```

---

## 27. never Usage Policy

### `never` لحالات المستحيل

`never` يُمثّل قيمة لا يمكن أن توجد أبدًا:

**Exhaustive Checks في Switch:**
```
✅ function handleEventType(type: EventType): void {
     switch (type) {
       case EventType.Message: return handleMessage()
       case EventType.Postback: return handlePostback()
       default: {
         const exhaustiveCheck: never = type
         throw new VoidError(ErrorCode.UnknownEventType, `Unknown type: ${exhaustiveCheck}`)
       }
     }
   }
```

**الدوال التي لا تعود:**
```
✅ function fail(message: string): never {
     throw new VoidError(ErrorCode.FatalError, message)
   }
```

### `never` يُثبت الاكتمال

استخدام `never` في Exhaustive Switch يضمن أن إضافة قيمة جديدة للـ Enum ستنتج خطأ Compile-Time حتى يُعدَّل الـ Switch.

---

## 28. Type Narrowing Rules

### استخدم الأدوات المدمجة للتضييق

- `typeof` للأنواع البدائية.
- `instanceof` للـ Classes.
- `in` للتحقق من وجود Property.
- Discriminated Union field للتمييز.
- Type Guard Functions.

### لا تضييق بالـ Type Assertion

```
❌ const user = data as User      // لا تحقق حقيقي
✅ if (isUser(data)) {
     // data الآن من نوع User بشكل مؤكد
   }
```

### Narrowing محلي وواضح

التضييق يكون في أقرب نقطة لاستخدام القيمة. التضييق بعيدًا عن الاستخدام يُصعّب التتبع.

---

## 29. Custom Type Guards

### Type Guard Functions للتضييق الآمن

```
✅ function isVoidError(err: unknown): err is VoidError {
     return err instanceof VoidError
   }

✅ function isMessengerEvent(data: unknown): data is MessengerEvent {
     return (
       typeof data === 'object' &&
       data !== null &&
       'type' in data &&
       'senderId' in data
     )
   }
```

### Type Guards تُوثَّق وتُختبَر

Type Guards بمثابة حدود الأمان — يجب أن تكون شاملة وصحيحة. Type Guard ناقص يُنشئ وهم الأمان.

### Assertion Functions للـ Validation

```
✅ function assertIsUser(value: unknown): asserts value is User {
     if (!isUser(value)) {
       throw new VoidError(ErrorCode.InvalidData, 'Expected User object')
     }
   }
```

---

## 30. Performance Considerations

### الأنواع لا تُنتج كود Runtime

معظم أنواع TypeScript تختفي بعد Compilation. الـ Type Safety مجانية في Runtime. الاستثناء: `enum` يُنتج كود JavaScript، و`class` كذلك.

### لا Type Computations مفرطة

Conditional Types وMapped Types المعقدة قد تُبطئ Compiler Type Checking. الأنواع البسيطة الواضحة أسرع في الفحص وأوضح للقراءة.

### الـ Generic Constraints تُسرّع الفحص

Constraints محددة جيدًا تُسرّع Type Inference مقارنةً بالـ Generics غير المحددة.

---

## 31. Forbidden TypeScript Practices

الممارسات التالية ممنوعة في Void بشكل مطلق:

### `any` بدون تعليق واضح
```
❌ function process(data: any): any
```

### `// @ts-ignore` و`// @ts-nocheck`
```
❌ // @ts-ignore
   someTypedCall()
```

### Type Assertion لإخفاء أخطاء
```
❌ const user = unsafeValue as User   // بدون Type Guard فعلي
```

### Non-Null Assertion بلا مبرر
```
❌ const name = user!.profile!.name
```

### `var`
```
❌ var sessionId = generateId()
```

### Default Exports
```
❌ export default class UserService
```

### Numeric Enums
```
❌ enum Priority { Low, Medium, High }
```

### Implicit Return Types لـ Public APIs
```
❌ export function getUser(id: string) { ... }
```

### Unused Type Parameters
```
❌ interface IService<T> {   // T لا يُستخدَم
     execute(): void
   }
```

### Empty Interfaces
```
❌ interface IMarker {}   // لا معنى لـ Interface فارغ
```

### `object` كنوع عام
```
❌ function merge(a: object, b: object): object
✅ function merge<T extends Record<string, unknown>>(a: T, b: Partial<T>): T
```

---

## 32. Recommended TypeScript Practices

### استخدام `satisfies` للتحقق الجزئي
```
✅ const config = {
     port: 3000,
     host: 'localhost',
   } satisfies Partial<ServerConfig>
```

### استخدام `as const` للقيم الثابتة
```
✅ const ALLOWED_EVENT_TYPES = ['message', 'postback', 'quick_reply'] as const
   type AllowedEventType = typeof ALLOWED_EVENT_TYPES[number]
```

### Template Literal Types للـ Type-Safe Strings
```
✅ type CacheKey = `void:${string}:${string}`
   function buildCacheKey(entity: string, id: string): CacheKey {
     return `void:${entity}:${id}`
   }
```

### Discriminated Unions لأنواع الأحداث
```
✅ type MessengerEvent =
     | MessageEvent
     | PostbackEvent
     | QuickReplyEvent
```

### Exhaustive Type Checking
```
✅ // استخدام never في default case للتأكد من شمول جميع الحالات
   default: {
     const _exhaustive: never = eventType
     throw new VoidError(ErrorCode.UnknownEventType, `Unhandled: ${_exhaustive}`)
   }
```

### `ReturnType` و`Parameters` للاستخراج

```
✅ type ServiceResult = ReturnType<typeof userService.findById>
```

---

## 33. AI Decision Rules

هذا القسم يُحدد كيف يجب على أي نظام ذكاء اصطناعي اتخاذ قرارات TypeScript عند كتابة كود جديد لمشروع Void.

### قرار: هل أنشئ Interface أم Type?

```
إذا كان الغرض هو تعريف عقد تُطبّقه Class:
    → أنشئ Interface (IUserRepository, IFacebookClient, إلخ)

إذا كان الغرض هو تسمية Union أو Intersection:
    → استخدم Type Alias

إذا كان الغرض هو تعريف شكل بيانات بسيط (Data Transfer Object):
    → يمكن استخدام Interface أو Type — اختر Interface للاتساق

إذا لم يكن هناك حاجة لـ implements أو extends:
    → Type Alias مقبول
```

### قرار: هل أستخدم Generic?

```
إذا كان نفس المنطق يُطبَّق على أنواع متعددة مختلفة:
    → أضف Generic

إذا كان هناك نوع واحد محدد:
    → لا تُضف Generic — اجعلها محددة

إذا كان Generic يُعقّد الكود أكثر مما يُبسّطه:
    → لا تُضف Generic
```

### قرار: هل أستخدم `any`?

```
في جميع الحالات → لا

الاستثناء الوحيد:
    إذا كانت المكتبة الخارجية لا توفر Types صحيحة
    وكان استخدام unknown مستحيلًا عمليًا
    وتم توثيق السبب بتعليق واضح
    → يمكن استخدام any مع eslint-disable وتعليق تفصيلي

في كل حالة أخرى → استخدم unknown ثم ضيّق
```

### قرار: هل أضيف Return Type صريح?

```
إذا كانت الدالة Public (مُصدَّرة أو Method في Class):
    → نعم، إلزامي

إذا كانت Arrow Function داخل map/filter/reduce:
    → TypeScript يستنتجه — مقبول بدون

إذا كان الاستنتاج واضحًا من السطر نفسه:
    → مقبول للمتغيرات المحلية البسيطة
    → إلزامي للدوال العامة
```

### قرار: هل أستخدم `null` أم `undefined`?

```
إذا كانت القيمة الفارغة مقصودة ومعبّرة (مثل "لا يوجد مستخدم"):
    → null

إذا كانت Property قد لا تُمرَّر (Optional Parameter):
    → undefined (أو Optional Property)

في قواعد البيانات (DB nulls):
    → null يُوافق SQL NULL
```

### قرار: هل أستخدم `Readonly`?

```
إذا كانت البيانات تمثل إعدادات أو قيمًا لا يجب تعديلها:
    → نعم، أضف Readonly

إذا كانت Array أو Object يُمرَّر ولا يجب أن تُعدَّل:
    → نعم، ReadonlyArray أو Readonly<T>

إذا كانت الـ Class Property تُعيَّن في Constructor ولا تتغير:
    → نعم، readonly
```

### قرار: هل أستخدم Enum أم Literal Types?

```
إذا كانت القيم مجموعة ثابتة مُعرَّفة في وقت التطوير:
    وكانت تُستخدَم في Runtime (تُسجَّل، تُقارَن، تُرسَل):
    → String Enum

إذا كانت القيم مُستخدَمة في Types فقط ولا تحتاج Runtime value:
    → Literal Union Type ('active' | 'inactive')

لا Numeric Enums في أي حالة.
```

---

## 34. Common TypeScript Mistakes

### الخطأ الأول — Type Assertion بدون تحقق

```
❌ const user = payload as User
   // لا تحقق من أن payload فعلًا User
✅ if (!isUser(payload)) throw new VoidError(...)
   const user = payload   // TypeScript يعرف الآن
```

### الخطأ الثاني — Widening غير مقصود

```
❌ const eventType = 'message'   // type: string
✅ const eventType = 'message' as const   // type: 'message'
```

### الخطأ الثالث — Optional Chaining تُغطي مشكلة

```
❌ const result = user?.session?.data?.value
   // إذا كان user يجب أن يكون موجودًا: هذا خطأ منطقي مُخفي
✅ assertIsUser(user)
   const result = user.session?.data?.value
```

### الخطأ الرابع — Implicit any من JSON.parse

```
❌ const data = JSON.parse(rawString)   // type: any
✅ const data: unknown = JSON.parse(rawString)
   if (!isExpectedShape(data)) throw new VoidError(...)
```

### الخطأ الخامس — نسيان readonly على Arrays المُمرَّرة

```
❌ function process(items: string[]): void
   // المستدعي لا يعرف أن items قد تُعدَّل
✅ function process(items: ReadonlyArray<string>): void
```

---

## 35. Anti Patterns

### Type Gymnastics

كتابة Conditional Types وMapped Types معقدة جدًا لحل مشكلة بسيطة. الأنواع يجب أن تكون مساعدة لا عقبة.

### Type Island

جزء من الكود يستخدم `any` ويُصبح "جزيرة" خارج نظام الأنواع. كل شيء يتعامل مع تلك الجزيرة يُصبح غير آمن.

### Type Aliasing بلا قيمة

```
❌ type StringArray = string[]   // لا قيمة مضافة
❌ type VoidFunction = () => void   // استخدمها مباشرة
```

### Structural Typing Abuse

الاعتماد الضمني على التوافق الهيكلي دون إعلان `implements`. إذا كانت Class تُطبّق Interface، يُصرَّح بذلك.

```
❌ class UserRepo {
     findById(id: string): Promise<User | null> { ... }
     // لم يُعلَن أنها تُطبّق IUserRepository
   }
✅ class UserRepo implements IUserRepository { ... }
```

### Interface Pollution

إضافة كل شيء لـ Interface واحدة كبيرة بدلًا من تقسيمها لـ Interfaces صغيرة متخصصة.

---

## 36. Review Checklist

قبل اعتبار أي كود TypeScript جاهزًا، تُراجَع هذه القائمة:

### الأنواع والأمان
- [ ] لا `any` بدون تعليق مُبرَّر.
- [ ] لا `// @ts-ignore` أو `// @ts-nocheck`.
- [ ] لا Type Assertions بدون Type Guard فعلي.
- [ ] لا Non-Null Assertion بدون تعليق.

### الإعلانات
- [ ] جميع Functions العامة لها Return Type صريح.
- [ ] جميع Parameters لها أنواع صريحة.
- [ ] جميع Class Members لها Access Modifiers.
- [ ] لا `var` — `const` أو `let` فقط.

### الـ Interfaces والـ Types
- [ ] العقود مُعلنة كـ `interface`.
- [ ] الـ Interfaces تبدأ بـ I.
- [ ] لا Numeric Enums.
- [ ] لا Type Aliases غير ذات قيمة.

### الـ Null Handling
- [ ] الأنواع التي قد تكون `null` معالجة صراحةً.
- [ ] لا Optional Chaining تُخفي مشاكل منطقية.

### التصدير والاستيراد
- [ ] لا Default Exports.
- [ ] Types يُستورَد بـ `import type`.
- [ ] لا Wildcard Imports.
- [ ] لا Exports غير مستخدمة.

### Generics
- [ ] Generics ضرورية — لا Generics للزينة.
- [ ] Type Parameters لها أسماء واضحة.
- [ ] Constraints محددة عند الحاجة.

---

*آخر تحديث: 2026-06-30 — يجب تحديث هذا التاريخ عند تعديل أي قسم في هذه الوثيقة.*
