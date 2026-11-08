import Link from "next/link";

import { cn } from "cn";

import type { SummaryPeriodKey } from "@/lib/summary/period";

const ITEMS: { key: SummaryPeriodKey; label: string }[] = [
  { key: "today", label: "Сьогодні" },
  { key: "week", label: "Тиждень" },
  { key: "month", label: "Місяць" },
];

export function PeriodPills({
  active,
  basePath = "/app",
  className,
}: {
  active: SummaryPeriodKey;
  basePath?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
      aria-label="Період підсумку"
    >
      {ITEMS.map((item) => {
        const href =
          item.key === "today" ? basePath : `${basePath}?period=${item.key}`;
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={href}
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
