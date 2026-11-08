import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RatingPage() {
  return (
    <SectionPlaceholder
      title="Рейтинг"
      description="Цей розділ ще не підключено. Бали й частки прибутку в обліку не ведуться."
    />
  );
}
