import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ModelsPage() {
  await requireVerifiedUser({ withUserRecord: true });
  return (
    <SectionPlaceholder
      title="Банк моделей"
      description="Цей розділ ще не підключено. Ідеї моделей тут не зберігаються."
    />
  );
}
