# Лад — прогрес MVP v1.1

## Поточний стан
**Gate 2–6 на `lad` застосовані.** Gate 7 (код): PWA manifest/іконки/SW без кешу `/app` і API; вихід чистить клієнтські caches; `docs/PUBLISH.md`. Deploy/DNS/Supabase Auth remote — не змінювались.

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
1. Встановлення PWA на iPhone і перевірка після виходу на пристрої.
2. Повторний security/RLS/фінансовий обхід перед реальними даними.
3. Production deploy + Auth redirect URLs на `lad.best` (лише за дозволом).

## Наступна дія
За дозволом: Vercel + DNS + Supabase Auth URLs за `docs/PUBLISH.md`; ручна PWA-перевірка на iPhone.
