import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function HistoryPage() {
  await requireVerifiedUser({ withUserRecord: true });
  return (
    <SectionPlaceholder
      title="Історія"
      description="Повний журнал змін ще не підключено. Остання активність на головній — з робочих подій обліку."
    />
  );
}
