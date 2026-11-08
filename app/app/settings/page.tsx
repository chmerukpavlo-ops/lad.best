import { SignOutButton } from "@/components/pwa/sign-out-button";
import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function SettingsPage() {
  const user = await requireVerifiedUser({ withUserRecord: true });

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">Налаштування</h1>

      <CardSurface className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Акаунт</p>
          <p className="truncate text-base font-medium">
            {user.email ?? "учасник"}
          </p>
        </div>
        <SignOutButton />
      </CardSurface>
    </section>
  );
}
