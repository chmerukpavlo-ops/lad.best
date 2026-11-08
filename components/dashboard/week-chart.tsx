type WeekBar = {
  day: string;
  height: number;
  highlight?: boolean;
};

export function WeekChart({ bars }: { bars: readonly WeekBar[] }) {
  const data =
    bars.length > 0
      ? bars
      : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((day) => ({
          day,
          height: 12,
          highlight: day === "Нд",
        }));

  return (
    <div className="flex h-40 items-end justify-between gap-2">
      {data.map((bar) => (
        <div key={bar.day} className="flex flex-1 flex-col items-center gap-2">
          <div
            className={
              bar.highlight
                ? "w-full rounded-t-md bg-primary"
                : "w-full rounded-t-md bg-secondary"
            }
            style={{ height: `${bar.height}%` }}
            title={bar.day}
          />
          <span className="text-xs text-muted-foreground">{bar.day}</span>
        </div>
      ))}
    </div>
  );
}
