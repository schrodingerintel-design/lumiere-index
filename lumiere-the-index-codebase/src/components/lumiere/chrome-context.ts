import { createContext, useContext } from "react";

/**
 * Chrome actions.
 *
 * The header is rendered by Layout on every page except Home, where it is
 * rendered inside the luminous plane (see TopNav's `tone`). Either way it needs
 * the same two actions, so they live here rather than travelling as props
 * through the page tree.
 */
export interface Chrome {
  openSearch: () => void;
  openMenu: () => void;
}

const noop = () => {};

export const ChromeContext = createContext<Chrome>({ openSearch: noop, openMenu: noop });

export function useChrome(): Chrome {
  return useContext(ChromeContext);
}
