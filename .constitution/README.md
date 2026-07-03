# Void — Project Constitution

هذا المجلد هو الدستور الرسمي لمشروع Void.

---

## ما هو الدستور؟

الدستور هو المرجع الأعلى الذي يحكم جميع قرارات التطوير في هذا المشروع.
كل ملف داخله يمثل باباً رسمياً يُعبّر عن قاعدة أو سياسة أو مبدأ يجب الالتزام به طوال عمر المشروع.

**لا يُقبل أي كود يخالف ما هو موثَّق هنا، بصرف النظر عن صحته التقنية.**

---

## للمطورين وأدوات الذكاء الاصطناعي

قبل تنفيذ أي تعديل، إضافة Feature، أو كتابة أي كود، يجب قراءة الملفات ذات الصلة.
لا يُقبل "لم أكن أعرف" كمبرر — الدستور موجود ومتاح دائماً.

**ترتيب القراءة الإلزامي عند بدء أي مهمة:**
1. `25-ai-development-rules.md` ← أول ما يُقرأ دائماً
2. `00-project-specification.md` ← ما هو المشروع وما هدفه
3. `02-architecture.md` ← الهيكل العام والطبقات
4. `03-layer-responsibilities.md` ← مسؤولية كل طبقة
5. `04-dependency-rules.md` ← من يعتمد على من
6. الملف المتخصص في الطبقة المعنية بالمهمة ← حسب الحاجة

---

## ⚠️ توضيح مهم — مفهوم "Session" في Void

يستخدم هذا المشروع كلمة "Session" للإشارة إلى **مفهومين مختلفين كلياً**:

| المصطلح | المعنى | الموقع في الكود | المرجع |
|---|---|---|---|
| **FacebookSession** | AppState + Cookies + Access Token — حالة المصادقة مع Facebook | داخل Facebook Layer حصراً | `10-facebook-architecture.md`, `11-session-management.md` |
| **ConversationSession** | currentStep + data — حالة المحادثة مع المستخدم | Application Layer | `27-roadmap.md` المرحلة 4 |

عند قراءة أي ملف يذكر "Session"، حدِّد أولاً: أي نوع من الـ Session يقصد.

---

## فهرس الملفات

| الملف | العنوان | الوصف |
|---|---|---|
| `00-project-specification.md` | Project Specification | تعريف المشروع وهدفه والـ Non-Goals والمصطلحات الأساسية |
| `01-project-philosophy.md` | Project Philosophy | المبادئ الجوهرية التي تحكم كل قرار — ما نفعله دائماً وما لا نفعله أبداً |
| `02-architecture.md` | Architecture | الهيكل العام للطبقات وعلاقاتها ومخططات التدفق |
| `03-layer-responsibilities.md` | Layer Responsibilities | مسؤولية كل طبقة بالتفصيل مع دليل قرار "أين يذهب هذا الكود" |
| `04-dependency-rules.md` | Dependency Rules | اتجاه الاعتماد بين المكونات والقواعد المُلزِمة لتجنب الدوائر |
| `05-coding-standards.md` | Coding Standards | معايير كتابة الكود — وضوح، اتساق، قابلية القراءة |
| `06-typescript-guidelines.md` | TypeScript Guidelines | قواعد TypeScript الخاصة بالمشروع — strict mode، types، generics |
| `07-error-handling.md` | Error Handling | هرمية الأخطاء، Typed Errors، تصنيف الأخطاء لكل طبقة |
| `08-logging-policy.md` | Logging Policy | ما يُسجَّل وما لا يُسجَّل — Sensitive Data، Log Levels، Audit Logs |
| `09-security-policy.md` | Security Policy | السياسة الأمنية الشاملة — AppState، Tokens، Secrets، Threat Model |
| `10-facebook-architecture.md` | Facebook Layer Architecture | البنية الداخلية للـ Facebook Layer — 15 مكوناً، Lifecycles، Reconnect |
| `11-session-management.md` | Facebook Session Management | إدارة **FacebookSession** (AppState/Cookies/Token) — دورة الحياة والتشفير |
| `12-plugin-system.md` | Plugin System | نظام الإضافات — Lifecycle، Isolation، Context، Permissions |
| `13-command-system.md` | Command System | نظام الأوامر — Parsing، Pipeline، Lifecycle، Permission |
| `14-event-system.md` | Event System | نظام الأحداث الداخلي — IEventBus، EventDispatcher، Dead Letter |
| `15-service-rules.md` | Service Rules | قواعد كتابة Services — Single Authority، Testability Boundary |
| `16-manager-rules.md` | Manager Rules | قواعد كتابة Managers — Coordination Without Decision |
| `17-database-policy.md` | Database Policy | Repository Pattern، Migrations، Zero-Downtime، Data Lifecycle |
| `18-cache-policy.md` | Cache Policy | Cache-Aside، Key Versioning، TTL Policy، Eviction Strategy |
| `19-scheduler-policy.md` | Scheduler Policy | Job Lifecycle، Retry، Dead Letter Queue، Cron Support |
| `20-middleware-policy.md` | Middleware Policy | Pipeline Order، No-Business-Logic Rule، Signature Verification |
| `21-testing-policy.md` | Testing Policy | Behavioral Testing، Coverage Thresholds، Regression Policy |
| `22-performance-policy.md` | Performance Policy | Stability-First، Measure Before Optimize، Performance Contract |
| `23-documentation-policy.md` | Documentation Policy | Documentation as Deliverable، Architectural Decision Mandate |
| `24-code-review-checklist.md` | Code Review Checklist | بوابة المراجعة — 16 قسماً، نظام 🔴/🟡/🟢 |
| `25-ai-development-rules.md` | AI Development Rules | القواعد الملزمة لكل AI يعمل على المشروع — أول ما يُقرأ دائماً |
| `26-release-policy.md` | Release Policy | SemVer، Release Checklist، Rollback Strategy |
| `27-roadmap.md` | Roadmap | خارطة الطريق — 12 مرحلة من Foundation إلى Production |

---

## هرمية الوثائق

```
الدستور (.constitution/)     ← أعلى سلطة — يفوز عند التعارض
       │
       ▼
تعليقات الكود (JSDoc)         ← يشرح النية المحلية
       │
       ▼
أسماء المتغيرات والدوال       ← يعبّر عن المعنى مباشرة
```

عند وجود تعارض بين الكود والدستور، **الدستور يكسب دائماً**.
الكود يُعدَّل ليتوافق مع الدستور — لا العكس.

---

## حالة الدستور

| الوضع | التفاصيل |
|---|---|
| **الملفات** | 28 ملف — جميعها مكتملة وموثَّقة رسمياً |
| **الحالة** | Official — معتمد للاستخدام في التطوير |
| **آخر تحديث** | 2026-07-03 |
