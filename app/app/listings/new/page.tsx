import Link from "next/link";

import { createListing } from "@/app/actions/listings";
import { ListingForm } from "@/components/listings/listing-form";
import { CardSurface } from "@/components/ui/card-surface";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function NewListingPage() {

  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/app/listings" className="hover:text-foreground">
            Оголошення
          </Link>
          <span aria-hidden="true"> / </span>
          Нове
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Нове оголошення
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Обов’язкова лише назва моделі. Кольори, опис і примітки — текстом.
        </p>
      </div>

      <CardSurface className="w-full max-w-lg">
        <ListingForm
          mode="create"
          action={createListing}
          submitLabel="Створити"
        />
      </CardSurface>
    </section>
  );
}
