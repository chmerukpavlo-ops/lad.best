import { cn } from "cn";

import type { SharedWindowPreview } from "@/app/actions/calendar";

export function AvailabilityCard({ preview }: { preview: SharedWindowPreview }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-base font-medium text-foreground">{preview.label}</h2>
      <div className="flex flex-1 flex-col justify-center gap-3">
        {preview.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{preview.detail}</p>
        ) : (
          preview.rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[5.5rem_1fr] items-center gap-3"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <div className="relative h-3 overflow-hidden rounded-full bg-[#1c1e24]">
                {row.segments.map((seg, i) => {
                  if (seg.width <= 0) return null;
                  return (
                    <span
                      key={`${row.label}-${i}`}
                      className={cn(
                        "absolute top-0 h-full rounded-full",
                        seg.shared ? "bg-primary" : "bg-[#3a3d46]",
                      )}
                      style={{ left: `${seg.start}%`, width: `${seg.width}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <p className="text-sm font-semibold tabular-nums text-primary">
        {preview.rangeText
          ? `Найближче: ${preview.rangeText}`
          : preview.detail}
      </p>
    </div>
  );
}
