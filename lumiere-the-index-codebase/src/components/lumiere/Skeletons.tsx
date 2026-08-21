import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-foreground/10", className)} />;
}

export function FilmCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function FilmRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-foreground/5">
      <Skeleton className="h-10 w-10 rounded-md shrink-0" />
      <Skeleton className="h-10 w-10 rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <section className="relative w-full overflow-hidden rounded-2xl px-4 lg:px-6 mt-4 max-w-full animate-pulse">
      <div className="absolute inset-0 bg-foreground/10" />
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 lg:p-10 min-h-[420px] lg:min-h-[520px]">
        <div className="flex flex-col justify-center lg:col-span-7 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
          <Skeleton className="h-16 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
        </div>
        <div className="hidden lg:flex lg:col-span-5 items-center justify-end">
          <div className="flex items-end gap-5">
            <Skeleton className="w-56 aspect-[2/3] rounded-xl" />
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-16 w-[180px] rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PulseRowSkeleton() {
  return (
    <section className="mt-12 grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="rounded-2xl h-64" />
      ))}
    </section>
  );
}

export function TopicsSkeleton() {
  return (
    <div className="space-y-4 mt-10 px-4 lg:px-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="glass rounded-2xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
