import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/** A block of loading on the plane: a slow sweep of light, never a grey slab. */
export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn("ix-skel", className)} style={style} />;
}

/** Skeleton rows for ranked lists — mirrors the chart row shape. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <li key={i} className="ix-row">
          <Skeleton className="h-5 w-7" />
          <Skeleton className="h-4 w-6" />
          <div className="ix-row__main">
            <Skeleton className="ix-row__art" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </li>
      ))}
    </>
  );
}

/** A grid of loading poster cards. */
export function FilmCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[2/3] w-full" style={{ borderRadius: 14 }} />
      <div className="mt-2.5 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Skeleton for the scan table (Top 100, Weekly Index). */
export function FilmRowSkeleton() {
  return (
    <li className="ix-row">
      <Skeleton className="h-5 w-8" />
      <Skeleton className="h-4 w-6" />
      <div className="ix-row__main">
        <Skeleton className="ix-row__art" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="ml-auto h-3 w-16" />
    </li>
  );
}
