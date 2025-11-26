import { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  jobId: string | null;
  pdbId: string | null;
  selectedAtomIndex: number | null;
  setJobId: (jobId: string | null) => void;
  setPdbId: (pdbId: string | null) => void;
  setSelectedAtomIndex: (index: number | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [pdbId, setPdbId] = useState<string | null>(null);
  const [selectedAtomIndex, setSelectedAtomIndex] = useState<number | null>(null);

  return (
    <AppContext.Provider
      value={{
        jobId,
        pdbId,
        selectedAtomIndex,
        setJobId,
        setPdbId,
        setSelectedAtomIndex,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
