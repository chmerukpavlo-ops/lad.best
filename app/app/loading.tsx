export default function AppLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 animate-pulse">
      <div className="h-9 w-48 rounded-lg bg-secondary" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-secondary" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-secondary" />
      <div className="h-28 rounded-2xl bg-secondary" />
    </div>
  );
}
