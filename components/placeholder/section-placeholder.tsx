import { CardSurface } from "@/components/ui/card-surface";

type SectionPlaceholderProps = {
  title: string;
  description: string;
};

/** Honest empty state for розділи without live business logic. */
export function SectionPlaceholder({
  title,
  description,
}: SectionPlaceholderProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <CardSurface className="gap-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardSurface>
    </section>
  );
}
