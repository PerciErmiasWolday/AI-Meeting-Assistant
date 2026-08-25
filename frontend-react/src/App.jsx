import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Calls from "./pages/Calls";
import CRM from "./pages/CRM";
import CRMProfile from "./pages/CRMProfile";
import AskAI from "./pages/AskAI";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="calls" element={<Calls />} />
        <Route path="crm" element={<CRM />} />
        <Route path="crm/:contactId" element={<CRMProfile />} />
        <Route path="ask-ai" element={<AskAI />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
