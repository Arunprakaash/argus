"use client";

import { createContext, useContext, useEffect, useState } from "react";

const Ctx = createContext<{ tail: string | null; setTail: (s: string | null) => void }>({
  tail: null,
  setTail: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [tail, setTail] = useState<string | null>(null);
  return <Ctx.Provider value={{ tail, setTail }}>{children}</Ctx.Provider>;
}

export function useBreadcrumbTail() {
  return useContext(Ctx);
}

// Set the breadcrumb tail (e.g. the room name) for the current page.
export function useSetBreadcrumbTail(value: string | null) {
  const { setTail } = useContext(Ctx);
  useEffect(() => {
    setTail(value);
    return () => setTail(null);
  }, [value, setTail]);
}
