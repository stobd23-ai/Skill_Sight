import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";

import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import EmployeeList from "./pages/EmployeeList";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeInterview from "./pages/EmployeeInterview";
import ManagerInterview from "./pages/ManagerInterview";
import AnalysisPage from "./pages/AnalysisPage";
import BootcampPage from "./pages/BootcampPage";
import StrategyHub from "./pages/StrategyHub";
import InternalReorg from "./pages/InternalReorg";
import SuccessionBoard from "./pages/SuccessionBoard";
import RolesPage from "./pages/RolesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Pages with sidebar layout */}
          <Route path="/dashboard" element={<AppLayout><ExecutiveDashboard /></AppLayout>} />
          <Route path="/employees" element={<AppLayout><EmployeeList /></AppLayout>} />
          <Route path="/employees/:id" element={<AppLayout><EmployeeProfile /></AppLayout>} />
          <Route path="/analysis" element={<AppLayout><AnalysisPage /></AppLayout>} />
          <Route path="/analysis/:id" element={<AppLayout><AnalysisPage /></AppLayout>} />
          <Route path="/bootcamp" element={<AppLayout><BootcampPage /></AppLayout>} />
          <Route path="/bootcamp/:id" element={<AppLayout><BootcampPage /></AppLayout>} />
          <Route path="/strategy" element={<AppLayout><StrategyHub /></AppLayout>} />
          <Route path="/reorg" element={<AppLayout><InternalReorg /></AppLayout>} />
          <Route path="/succession" element={<AppLayout><SuccessionBoard /></AppLayout>} />
          <Route path="/roles" element={<AppLayout><RolesPage /></AppLayout>} />

          {/* Fullscreen pages (no sidebar) */}
          <Route path="/interview/employee" element={<EmployeeInterview />} />
          <Route path="/interview/employee/:id" element={<EmployeeInterview />} />
          <Route path="/interview/manager" element={<ManagerInterview />} />
          <Route path="/interview/manager/:id" element={<ManagerInterview />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
