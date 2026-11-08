# Лад — прогрес MVP v1.1

## Поточний стан
**Gate 2–6 на `lad` застосовані.** Gate 7 + publish на `lad.best` (користувач підтвердив вхід/вихід/PWA).  
**Perf-pass (код):** claims-first auth + `cache`; nav pending + loading.  
**Налаштування (код+БД, 2026-11-09):** профіль, учасники, робочі межі, спільні фінанси (toggle+% → знімок на продаж), рейтинг (ваги + events). Міграція `workspace_finance_rating_settings` на `lad` ✅ (remote version `20261108235219`; локальний файл `20261108234217_…`). Таблиці: `workspace_finance_settings`, `sale_profit_splits`, `workspace_rating_settings`, `rating_events`. Без виплат/боргів. `tsc`/`eslint` ✅.

## Gate 7 — перевірено локально (2026-11-08)
| Перевірка | Результат |
|---|---|
| `npm run lint` | ✅ |
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ (один прогін) |
| Manifest + icons у `public/` | ✅ код |
| no-store headers `/app`, `/api` | ✅ код |
| SW не кешує private/navigate | ✅ код |
| iPhone Add to Home Screen | ❌ не перевірено на пристрої |
| MacBook Safari/Chrome PWA UX | ❌ |
| Повторний повний RLS/фінансовий аудит | ❌ (не запускався) |
| Vercel deploy / DNS lad.best / Auth URLs remote | ❌ (навмисно) |

## Gate 6 — перевірено remote (раніше)
Міграція calendar applied; soft-delete / audit / outsider JWT — ✅ на `[TEST Gate6]`.

## Невиконані критичні перевірки (коротко)
1. Redeploy production після perf-pass (щоб `lad.best` підхопив).
2. Повторна перевірка TTFB у Network після deploy.

## Наступна дія
За дозволом: commit + push + Vercel redeploy perf-pass.
