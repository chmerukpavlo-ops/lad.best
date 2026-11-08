import { SectionPlaceholder } from "@/components/placeholder/section-placeholder";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function HistoryPage() {
  return (
    <SectionPlaceholder
      title="Історія"
      description="Повний журнал змін ще не підключено. Остання активність на головній — з робочих подій обліку."
    />
  );
}
