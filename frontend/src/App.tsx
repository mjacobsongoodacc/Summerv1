import { Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SourceViewer from "./pages/SourceViewer";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/source/:filingId" element={<SourceViewer />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
