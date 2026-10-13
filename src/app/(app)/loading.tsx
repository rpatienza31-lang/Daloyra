import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy";

/** Shown while any app page loads: the shape of a title, figure cards and a list. */
export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{copy.status.loading}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-card border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
