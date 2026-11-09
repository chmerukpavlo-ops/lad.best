import { createListing } from "@/app/actions/listings";
import { ListingForm } from "@/components/listings/listing-form";
import { CardSurface } from "@/components/ui/card-surface";
import { DetailBackNav } from "@/components/ui/detail-back-nav";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function NewListingPage() {

  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <DetailBackNav
          href="/app/listings"
          sectionLabel="Оголошення"
          currentLabel="Нове"
        />
        <h1 className="text-3xl font-semibold tracking-tight">
          Нове оголошення
        </h1>
        <p className="text-sm text-muted-foreground">
          Обов’язкова лише назва. Кольори, опис і примітки — текстом.
        </p>
      </div>

      <CardSurface className="w-full">
        <ListingForm
          mode="create"
          action={createListing}
          submitLabel="Створити"
        />
      </CardSurface>
    </section>
  );
}
