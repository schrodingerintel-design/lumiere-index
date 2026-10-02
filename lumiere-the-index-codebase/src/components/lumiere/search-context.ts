import { createContext, useContext } from "react";

/**
 * Opens the search modal owned by Layout.
 *
 * Search state lives in Layout because the modal is mounted once for the whole
 * app. This context lets any surface rendered inside Layout — the home page's
 * destination chips, for instance — trigger it without prop drilling through
 * the router.
 */
export const OpenSearchContext = createContext<() => void>(() => {});

export function useOpenSearch() {
  return useContext(OpenSearchContext);
}
