# Лад — прогрес MVP v1.1

## Поточний стан
Виконано локально **Gate 1.2 A+B**: код підключення Supabase SSR/Auth UI + файл міграції основи. **Віддалений** проєкт `lad`, Auth settings, акаунти й apply SQL **не** змінювались. Recovery / сторонній доступ / RLS на живій БД — ще не перевірені фактично.

## Зроблено
- Gate 1.1: scaffold, темна UA-оболонка, rules (lint/typecheck/build OK).
- **Gate 1.2 A+B (2026-11-07), лише локально:**
  - Пакети `@supabase/ssr`, `@supabase/supabase-js`.
  - Клієнти `lib/supabase/{env,client,server,middleware}.ts`; кореневий `middleware.ts` оновлює сесію через `getClaims()`.
  - Серверний захист: `requireVerifiedUser()` з `getClaims()` (+ опційно `getUser()`); middleware не замінює перевірку в `/app`.
  - UI: `/login`, `/forgot-password`, `/auth/callback`, `/auth/update-password`, `/auth/error`, приватний `/app` + logout; `Cache-Control: private, no-store` для `/app`.
  - Recovery redirect у коді: `{origin}/auth/callback?next=/auth/update-password` (див. `lib/auth/paths.ts`, `.env.example`).
  - Міграція (review only): `supabase/migrations/20261107214533_gate12_foundation.sql`.
  - Приклад bootstrap SQL (не застосований): `supabase/seed/gate12_bootstrap.example.sql` — без `service_role` у застосунку.
  - Перевірено локально: `npm run lint` ✅, `npm run typecheck` ✅, `npm run build` ✅.

## Погоджені рішення (актуально)
- Проєкт БД: постійний Supabase **`lad`** (не окремий «тестовий» проєкт).
- Вхід: email + пароль; recovery email; без публічної реєстрації.
- Один workspace, максимум 2 учасники — обмеження в міграції (unique singleton + trigger+lock).
- Бізнес-таблиці — на наступних gate.
- До перевірки безпеки — вигадані бізнес-дані; для recovery потрібні реальні скриньки (адреси/паролі не в docs).

## Не зроблено / неперевірене
- Apply SQL у віддалену БД.
- Auth settings / створення акаунтів у Dashboard.
- Фактичний вхід, вихід, recovery з реальною поштою.
- Прямі API-тести RLS (anon / сторонній user / підробка audit).
- `.env.local` у репозиторії агентом не створювався (секрети лише локально у користувача).

## Наступна дія
Після review міграції — окремий дозвіл на apply SQL + налаштування Auth + два акаунти + bootstrap memberships, далі фактичні перевірки доступу.

## Журнал
| Дата | Завдання | Файли | Тести | Неперевірене | Далі |
|---|---|---|---|---|---|
| 2026-11-07 | Gate 1.1 scaffold | app shell, AGENTS, rules | lint/tsc/build OK | UI вручну | — |
| 2026-11-07 | Gate 1.2 A+B local | `lib/supabase/*`, `lib/auth/*`, auth routes, `middleware.ts`, migration + bootstrap example | lint/tsc/build OK | remote SQL/Auth/RLS/recovery | review SQL → дозвіл apply |
