import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadDashboardWithIngestFallback, reIngestAndLoadDashboard } from "./api";
import type { DashboardPayload, FilingMetadata } from "./types";
import type { Industry } from "./components/IndustryDropdown";

type AppContextValue = {
  ticker: string;
  setTicker: (ticker: string) => void;
  industry: Industry;
  setIndustry: (industry: Industry) => void;
  data: DashboardPayload | null;
  /** When non-null (e.g. Source viewer mounted), overrides `data?.filing` for TopNav filing strip */
  viewedFiling: FilingMetadata | null;
  setViewedFiling: (f: FilingMetadata | null) => void;
  loading: boolean;
  ingesting: boolean;
  ingestMessage: string | null;
  error: string | null;
  analyze: (nextTicker?: string, nextIndustry?: Industry) => Promise<void>;
  reIngest: () => Promise<void>;
  notifyIngest: (active: boolean, message?: string | null) => void;
  clearError: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ticker, setTicker] = useState("PGR");
  const [industry, setIndustry] = useState<Industry>("Insurance");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [viewedFiling, setViewedFiling] = useState<FilingMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notifyIngest = useCallback((active: boolean, message?: string | null) => {
    setIngesting(active);
    if (message !== undefined) setIngestMessage(message);
  }, []);

  const analyze = useCallback(
    async (nextTicker: string = ticker, nextIndustry: Industry = industry) => {
      const safeTicker = nextTicker.trim().toUpperCase() || "PGR";
      setLoading(true);
      setError(null);
      setIngesting(false);
      setIngestMessage(null);

      try {
        const payload = await loadDashboardWithIngestFallback(safeTicker, nextIndustry, (msg) => {
          setIngesting(true);
          setIngestMessage(msg);
        });
        setTicker(safeTicker);
        setIndustry(nextIndustry);
        setData(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
        setData(null);
      } finally {
        setLoading(false);
        setIngesting(false);
        setIngestMessage(null);
      }
    },
    [industry, ticker],
  );

  const reIngest = useCallback(async () => {
    const sym = ticker.trim().toUpperCase() || "PGR";
    setLoading(true);
    setIngesting(true);
    setError(null);

    try {
      const payload = await reIngestAndLoadDashboard(sym, industry, (msg) => {
        setIngestMessage(msg ?? null);
      });
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setLoading(false);
      setIngesting(false);
      setIngestMessage(null);
    }
  }, [industry, ticker]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    void analyze("PGR", "Insurance");
    // Initial auto-load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      ticker,
      setTicker,
      industry,
      setIndustry,
      data,
      viewedFiling,
      setViewedFiling,
      loading,
      ingesting,
      ingestMessage,
      error,
      analyze,
      reIngest,
      notifyIngest,
      clearError,
    }),
    [
      analyze,
      clearError,
      data,
      error,
      industry,
      ingestMessage,
      ingesting,
      loading,
      notifyIngest,
      reIngest,
      ticker,
      viewedFiling,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppContext must be used inside AppProvider");
  return ctx;
}
