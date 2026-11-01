import { createContext } from 'preact';

/**
 * True inside a subtree the server never rendered (see `Hydrated`). There, stores can hand out
 * the saved value on the very first render: there is no server HTML to match, and starting from
 * defaults would paint one frame of someone else's numbers before the real ones arrive.
 */
export const ClientOnly = createContext(false);
