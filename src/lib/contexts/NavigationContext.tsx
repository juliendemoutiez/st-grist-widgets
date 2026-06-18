import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ScreenEntry, ScreenName } from '../types';

interface NavigationContextValue {
  stack: ScreenEntry[];
  push: (screen: ScreenName, props?: Record<string, unknown>) => void;
  pop: (result?: unknown) => void;
  resetToRoot: () => void;
  popResult: unknown | undefined;
  clearPopResult: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}

interface NavigationProviderProps {
  initialScreen: ScreenName;
  children: ReactNode;
}

export function NavigationProvider({ initialScreen, children }: NavigationProviderProps) {
  const [stack, setStack] = useState<ScreenEntry[]>([{ screen: initialScreen }]);
  const [popResult, setPopResult] = useState<unknown>(undefined);

  const push = useCallback((screen: ScreenName, props?: Record<string, unknown>) => {
    setStack(prev => [...prev, { screen, props }]);
  }, []);

  const pop = useCallback((result?: unknown) => {
    setStack(prev => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
    if (result !== undefined) {
      setPopResult(result);
    }
  }, []);

  const resetToRoot = useCallback(() => {
    setStack(prev => prev.length <= 1 ? prev : [prev[0]]);
    setPopResult(undefined);
  }, []);

  const clearPopResult = useCallback(() => {
    setPopResult(undefined);
  }, []);

  return (
    <NavigationContext.Provider value={{ stack, push, pop, resetToRoot, popResult, clearPopResult }}>
      {children}
    </NavigationContext.Provider>
  );
}
