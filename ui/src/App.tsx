import { Route, Routes } from "react-router-dom";
import { Layout } from "./Layout.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Learnings } from "./pages/Learnings.tsx";
import { Potential } from "./pages/Potential.tsx";
import { History } from "./pages/History.tsx";
import { Runs } from "./pages/Runs.tsx";
import { Settings } from "./pages/Settings.tsx";

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/learnings" element={<Learnings />} />
        <Route path="/potential" element={<Potential />} />
        <Route path="/history" element={<History />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
