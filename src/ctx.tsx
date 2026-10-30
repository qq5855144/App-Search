import React, { createContext, useContext } from 'react';

type SessionContextType = { session: null; isLoading: false };
const SessionContext = createContext<SessionContextType>({ session: null, isLoading: false });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionContext.Provider value={{ session: null, isLoading: false }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
