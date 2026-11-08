import { cn } from "cn";

type CardSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
};

/** Shared dark card surface matching the mockup (rounded, bordered). */
export function CardSurface({
  as: Comp = "div",
  className,
  ...props
}: CardSurfaceProps) {
  return (
    <Comp
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
