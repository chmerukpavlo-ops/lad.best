import Link from "next/link";

import { CardSurface } from "@/components/ui/card-surface";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { WORKSPACE_NAV, navLabel } from "@/lib/app/nav";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function MorePage() {
  await requireVerifiedUser({ withUserRecord: true });
  const items = WORKSPACE_NAV.filter((item) => item.mobileMore);

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">Ще</h1>
      <CardSurface className="gap-0 p-0">
        <ul>
          {items.map((item, index) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 px-4 py-3 text-sm font-medium text-foreground",
                  index < items.length - 1 ? "border-b border-border" : "",
                )}
              >
                <span
                  className="size-1.5 shrink-0 rounded-[2px] bg-[#3a3d46]"
                  aria-hidden
                />
                <span className="flex-1">{navLabel(item, "mobile")}</span>
                {item.status === "soon" ? (
                  <span className="text-xs text-muted-foreground">
                    Ще ні
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardSurface>
    </section>
  );
}
