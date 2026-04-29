import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Dashboard from "./pages/Dashboard";
import SourceViewer from "./pages/SourceViewer";
import RiskDeltas from "./pages/RiskDeltas";
import TopNav from "./components/TopNav";
import { AppProvider, useAppShell } from "./AppContext";

function IngestRibbon() {
  const { ingestMessage, ingesting } = useAppShell();
  if (!ingesting) return null;

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed left-0 right-0 top-12 z-[35] shadow-sm">
      <div className="h-px animate-pulse bg-preview-accent opacity-80" aria-hidden />
      {ingestMessage ? (
        <div className="pointer-events-auto border-b border-preview-chromeBorder bg-preview-bg/95 px-4 py-2 text-center text-[12px] text-preview-textDim">
          {ingestMessage}
        </div>
      ) : null}
    </div>
  );
}

function Layout() {
  const location = useLocation();
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    setPageVisible(false);
    const t = window.requestAnimationFrame(() => setPageVisible(true));
    return () => window.cancelAnimationFrame(t);
  }, [location.pathname]);

  const contentClass = useMemo(
    () => `${pageVisible ? "opacity-100" : "opacity-0"} transition-opacity duration-200`,
    [pageVisible],
  );

  return (
    <div className="min-h-screen bg-preview-bg font-sans text-preview-text antialiased">
      <TopNav />
      <IngestRibbon />
      <div className={contentClass}>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/source/:filingId" element={<SourceViewer />} />
          <Route path="/risk-deltas" element={<RiskDeltas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
