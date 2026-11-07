import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function AppHomePage() {
  // Middleware is not enough — verify claims (+ Auth user record) here.
  const user = await requireVerifiedUser({ withUserRecord: true });
  const supabase = await createClient();

  let workspaceName: string | null = null;
  let membershipNote: string | null = null;

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("profile_id", user.id)
    .limit(1);

  if (membershipError) {
    membershipNote =
      "Не вдалося прочитати членство (міграція ще не застосована або RLS).";
  } else if (!memberships?.length) {
    membershipNote = "Членство у workspace ще не призначене.";
  } else {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", memberships[0].workspace_id)
      .maybeSingle();

    if (workspaceError) {
      membershipNote = "Не вдалося прочитати workspace.";
    } else {
      workspaceName = workspace?.name ?? null;
    }
  }

  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="space-y-3">
        <p className="font-heading text-4xl font-semibold tracking-tight">
          Лад
        </p>
        <h1 className="text-xl font-medium">Приватний простір</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Сесію підтверджено на сервері через getClaims()/getUser(). Бізнес-модулі
          ще не підключені.
        </p>
      </div>

      <dl className="grid max-w-lg gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Користувач</dt>
          <dd className="text-foreground">{user.email ?? user.id}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Workspace</dt>
          <dd className="text-foreground">
            {workspaceName ?? membershipNote ?? "—"}
          </dd>
        </div>
      </dl>

      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="min-h-11 min-w-[11rem] px-5 text-base"
        >
          Вийти
        </Button>
      </form>
    </section>
  );
}
