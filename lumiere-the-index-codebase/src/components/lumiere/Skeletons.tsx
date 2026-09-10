import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-foreground/10", className)} />;
}

/** Skeleton rows for ranking lists — mirrors the RankRow shape. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <li key={i} className="flex items-center gap-3 py-3 sm:gap-4 sm:py-3.5">
          <Skeleton className="h-6 w-7 shrink-0 sm:w-8" />
          <Skeleton className="h-16 w-11 shrink-0 sm:h-[72px] sm:w-12" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6 w-14 shrink-0" />
        </li>
      ))}
    </>
  );
}

export function FilmCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="mt-2 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Homepage Top 10 skeleton. */
export function TopTenSkeleton() {
  return (
    <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
      <ListSkeleton rows={10} />
    </ul>
  );
}

/** Skeleton row for the full-width chart tables (Top 100, Weekly Index). */
export function FilmRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <Skeleton className="h-12 w-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-6 w-10 shrink-0" />
    </li>
  );
}
