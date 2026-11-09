# Лад — прогрес MVP v1.1

## Поточний стан
**Gate 0–7 ✅.** Publish на `lad.best`; користувач підтвердив вхід/вихід/PWA на Mac і **iPhone (Add to Home Screen)**.  
**Perf-pass + Settings + частки/рейтинг (знімок, без виплат)** — у коді; міграція finance/rating на `lad` ✅.  
**Calendar v2 (2026-11-09):** міграція на `lad` ✅; ядро + тести ✅; CRUD + UI ✅; **Realtime client** (`useCalendarRealtime` → `router.refresh`, filter `workspace_id`) ✅ у коді. Gate 6 таблиці unused у UI.

## Gate 7 — закрито (користувач, 2026-11-09)
| Перевірка | Результат |
|---|---|
| `npm run lint` / `typecheck` / `build` | ✅ |
| Manifest + icons, no-store, SW | ✅ |
| Deploy `lad.best` + Auth URLs | ✅ |
| MacBook PWA UX | ✅ (користувач) |
| iPhone Add to Home Screen | ✅ (користувач) |
| Повторний повний RLS/фінансовий аудит | ⚠️ не окремий прогін; базові gate-тести раніше |

## Gate 6 (v1) — на remote
Разові `availability_events` + `workspace_schedule_settings`; soft-delete / audit / outsider — ✅ `[TEST Gate6]`.

## Calendar v2 — у роботі
- Модель: локальні `date` + хвилини доби (Europe/Kyiv), правило повторення одним рядком, винятки по датах, `availability_rules`, типи подій (class/work/shared_work/free/personal).
- Спільне вікно: free = availability − busy; shared = перетин ≥ 60 хв (налаштування пізніше). `fallbackWindow` (години з Settings) **завжди** union у availability — розширення меж дня розширює shared навіть при старих rules. Контраст блоків/сітки піднято (перевірено unit + typecheck).
- Міграція на `lad` ✅: `calendar_events`, `calendar_event_exceptions`, `availability_rules` (+ enum, RLS, realtime publication). Локальний файл `20261109103903_…`.
- Ядро: `local-intervals`, `recurrence`, `day-model` — `test:unit` ✅.
- CRUD: `app/actions/calendar-v2.ts` (create / update scope / delete scope / ensure rules).
- UI: `CalendarApp` тиждень+день, `EventEditor` з live «Перевірка».
- Realtime: `use-calendar-realtime.ts` на events/exceptions/rules; publication уже в міграції.
- `tsc`/`eslint` ✅ (Realtime).

## Оголошення UI + поля (2026-11-09)
- Міграція `listings_brand_price` на `lad` ✅: опційні `brand`, `list_price`.
- Список: Назва / Бренд / Ціна / Статус (сигнал реклами: свіжа / пора через **1 день** / без реклами / архів).
- Фільтр «Пора рекламувати». Без розміру й автора.
- Форма: назва, бренд, орієнтовна ціна. `tsc`/`test:unit`/`eslint` ✅.

## Наступна дія
Ручна перевірка списку оголошень; commit/push за запитом (календар v2 + оголошення, якщо ще не запушено).
