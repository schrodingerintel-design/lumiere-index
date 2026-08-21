import { Search } from "lucide-react";

export function SearchBox({
  className,
  onOpen,
}: {
  className?: string;
  /** Called when the user clicks the search trigger to open the modal. */
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex items-center gap-2 rounded-full border border-foreground/15 bg-background/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground cursor-pointer ${className}`}
      aria-label="Search films"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate">Search films&hellip;</span>
    </button>
  );
}
