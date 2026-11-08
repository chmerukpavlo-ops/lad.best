# Лад — прогрес MVP v1.1

## Поточний стан
**Gate 2–6 на `lad` застосовані.** Gate 7 + publish на `lad.best` (користувач підтвердив вхід/вихід/PWA).  
**Perf-pass (код, 2026-11-08):** claims-first auth + React `cache` для member gate; без подвійного `getUser` на навігації; `listListings('all')` одним запитом; nav pending bar + `loading.tsx`. `tsc`/`eslint` ✅. Production redeploy — за дозволом.

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
