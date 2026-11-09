import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type DetailBackNavProps = {
  href: string;
  /** e.g. «Оголошення» — used in breadcrumb and back label */
  sectionLabel: string;
  /** Current crumb after « / », e.g. title or «Нове» */
  currentLabel: string;
};

/**
 * Clear way back to the section list: primary «До списку» + visible breadcrumb.
 */
export function DetailBackNav({
  href,
  sectionLabel,
  currentLabel,
}: DetailBackNavProps) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={href}
        className="inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        До списку
      </Link>
      <p className="text-sm text-muted-foreground">
        <Link
          href={href}
          className="text-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          {sectionLabel}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-muted-foreground">{currentLabel}</span>
      </p>
    </div>
  );
}
