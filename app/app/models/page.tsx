import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ModelsPage() {
  return (
    <SectionPlaceholder
      title="Банк моделей"
      description="Цей розділ ще не підключено. Ідеї моделей тут не зберігаються."
    />
  );
}
