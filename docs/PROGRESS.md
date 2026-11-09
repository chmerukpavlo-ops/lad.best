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
- Спільне вікно: free = availability − busy; shared = перетин ≥ 60 хв (налаштування пізніше).
- Міграція на `lad` ✅: `calendar_events`, `calendar_event_exceptions`, `availability_rules` (+ enum, RLS, realtime publication). Локальний файл `20261109103903_…`.
- Ядро: `local-intervals`, `recurrence`, `day-model` — `test:unit` ✅.
- CRUD: `app/actions/calendar-v2.ts` (create / update scope / delete scope / ensure rules).
- UI: `CalendarApp` тиждень+день, `EventEditor` з live «Перевірка».
- Realtime: `use-calendar-realtime.ts` на events/exceptions/rules; publication уже в міграції.
- `tsc`/`eslint` ✅ (Realtime).

## Наступна дія
Ручна перевірка: два клієнти / дві вкладки — зміна календаря з’являється без F5; потім commit/push за запитом.
