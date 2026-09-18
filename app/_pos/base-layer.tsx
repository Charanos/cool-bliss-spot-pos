'use client';

import { type ReactNode, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * The base layer never scrolls and nothing ever covers it. Pages place their primary action into the
 * right side of it, so the action always sits in the same place under the waiter's thumb.
 */
export const BaseLayerContext = createContext<HTMLElement | null>(null);

export function BaseAction({ children }: { children: ReactNode }) {
  const target = useContext(BaseLayerContext);
  return target ? createPortal(children, target) : null;
}
