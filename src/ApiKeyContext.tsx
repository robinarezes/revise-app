import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "revise:anthropic_api_key";

type ApiKeyContextValue = {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    setApiKeyState(localStorage.getItem(STORAGE_KEY));
  }, []);

  function setApiKey(key: string) {
    const trimmed = key.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    setApiKeyState(trimmed);
  }

  function clearApiKey() {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  }

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, clearApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error("useApiKey must be used within an ApiKeyProvider");
  return ctx;
}
