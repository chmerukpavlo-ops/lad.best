import { getSharedAvailabilityPreview } from "@/app/actions/calendar";
import { getWorkspacePeriodReport } from "@/app/actions/summary";
import { DesktopDashboard } from "@/components/dashboard/desktop-dashboard";
import { MobileDashboard } from "@/components/dashboard/mobile-dashboard";
import { parseSummaryPeriod } from "@/lib/summary/period";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Promise<{ period?: string }>;

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const periodKey = parseSummaryPeriod(params.period);
  const [report, availabilityRes] = await Promise.all([
    getWorkspacePeriodReport(periodKey),
    getSharedAvailabilityPreview(),
  ]);
  const availability = availabilityRes.preview;

  return (
    <section className="mx-auto w-full max-w-6xl">
      <DesktopDashboard
        report={report}
        periodKey={periodKey}
        availability={availability}
      />
      <MobileDashboard
        report={report}
        periodKey={periodKey}
        availability={availability}
      />
    </section>
  );
}
