import { useState } from "react";
import { CATALOG_PAGE_SIZES } from "@/lib/catalog";
export function CatalogPager({
  page,
  pages,
  size,
  busy,
  onPage,
  onSize,
}: {
  page: number;
  pages: number;
  size: number;
  busy: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const [jump, setJump] = useState("");
  return (
    <div className="catalog-pagination catalog-pagination-expanded">
      <button className="soft-button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {Math.max(1, pages)}
      </span>
      <button
        className="soft-button"
        disabled={busy || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next page
      </button>
      <label>
        Per page{" "}
        <select
          aria-label="Results per page"
          value={size}
          disabled={busy}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {CATALOG_PAGE_SIZES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const target = Number(jump);
          if (Number.isInteger(target) && target >= 1 && target <= pages) {
            onPage(target);
            setJump("");
          }
        }}
      >
        <label>
          Go to page{" "}
          <input
            aria-label="Go to page"
            type="number"
            min="1"
            max={pages}
            value={jump}
            onChange={(event) => setJump(event.target.value)}
          />
        </label>
        <button className="soft-button" disabled={busy || !jump}>
          Go
        </button>
      </form>
    </div>
  );
}
