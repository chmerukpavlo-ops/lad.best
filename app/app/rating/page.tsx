import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RatingPage() {
  await requireVerifiedUser({ withUserRecord: true });
  return (
    <SectionPlaceholder
      title="Рейтинг"
      description="Цей розділ ще не підключено. Бали й частки прибутку в обліку не ведуться."
    />
  );
}
