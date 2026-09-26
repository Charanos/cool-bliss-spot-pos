'use client';

import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

type Setter = (label: string | null) => void;
const CrumbContext = createContext<{ record: string | null; setRecord: Setter }>({ record: null, setRecord: () => undefined });

/**
 * The record a detail page is about ("Bill 142"), for the breadcrumb in the top bar. The top bar
 * sits outside the page, so the page names its record through this context.
 */
export function CrumbProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<string | null>(null);
  return <CrumbContext.Provider value={{ record, setRecord }}>{children}</CrumbContext.Provider>;
}

export function useRecordCrumb(): string | null {
  return useContext(CrumbContext).record;
}

/** Render on a detail page to name its record in the breadcrumb. Renders nothing itself. */
export function RecordCrumb({ label }: { label: string }) {
  const { setRecord } = useContext(CrumbContext);
  useEffect(() => {
    setRecord(label);
    return () => setRecord(null);
  }, [label, setRecord]);
  return null;
}
