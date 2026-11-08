# Публікація Лад (коротко)

Не містить секретів. Deploy / DNS / remote — лише за окремим дозволом.

## 1. Vercel
1. Імпортувати Git-репо в Vercel (Framework: Next.js).
2. Production domain: `lad.best` (+ за бажанням `www`).
3. Env (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (або publishable), `NEXT_PUBLIC_SITE_URL=https://lad.best`. Без `service_role` у Vercel для цього UI.
4. Deploy production. Перевірити `/login` і `/app` після входу.

## 2. DNS (lad.best)
1. У реєстратора: A/CNAME за інструкцією Vercel для домену.
2. Дочекатись TLS на Vercel. Не змінювати DNS, поки не готовий deploy.

## 3. Supabase Auth URLs (проєкт `lad`)
1. Site URL: `https://lad.best`
2. Redirect URLs: `https://lad.best/auth/callback`, за потреби `https://www.lad.best/auth/callback`, плюс локальні `http://localhost:3000/auth/callback`.
3. Email templates: посилання recovery через `/auth/callback?next=/auth/update-password`.
4. Публічного signup немає — користувачів створювати в Dashboard.

## 4. iPhone PWA
Safari → Поділитись → На початковий екран. Іконка / standalone з manifest.

## 5. Після виходу
Сесія знімається; приватні відповіді з no-store; клієнт чистить зайві caches. Offline-черги записів немає.
