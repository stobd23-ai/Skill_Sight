import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { EmployeeLayout } from "@/components/EmployeeLayout";
import { PipelineProvider } from "@/contexts/PipelineContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import EmployeeList from "./pages/EmployeeList";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeeInterview from "./pages/EmployeeInterview";
import ManagerInterview from "./pages/ManagerInterview";
import AnalysisPage from "./pages/AnalysisPage";
import StrategyHub from "./pages/StrategyHub";
import InternalReorg from "./pages/InternalReorg";
import SuccessionBoard from "./pages/SuccessionBoard";
import RolesPage from "./pages/RolesPage";
import LoginPage from "./pages/LoginPage";
import MyProfile from "./pages/MyProfile";
import MyInterview from "./pages/MyInterview";
import MyResults from "./pages/MyResults";
import InterviewAccess from "./pages/InterviewAccess";
import InterviewExternal from "./pages/InterviewExternal";
import AnalysisExternal from "./pages/AnalysisExternal";
import ApplyPage from "./pages/ApplyPage";
import ExternalCandidateProfile from "./pages/ExternalCandidateProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === "manager" ? "/dashboard" : "/my-profile"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PipelineProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<RootRedirect />} />

              {/* Manager routes */}
              <Route path="/dashboard" element={<ProtectedRoute role="manager"><AppLayout><ExecutiveDashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute role="manager"><AppLayout><EmployeeList /></AppLayout></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute role="manager"><AppLayout><EmployeeProfile /></AppLayout></ProtectedRoute>} />
              <Route path="/analysis" element={<ProtectedRoute role="manager"><AppLayout><AnalysisPage /></AppLayout></ProtectedRoute>} />
              <Route path="/analysis/:id" element={<ProtectedRoute role="manager"><AppLayout><AnalysisPage /></AppLayout></ProtectedRoute>} />
              <Route path="/strategy" element={<ProtectedRoute role="manager"><AppLayout><StrategyHub /></AppLayout></ProtectedRoute>} />
              <Route path="/reorg" element={<ProtectedRoute role="manager"><AppLayout><InternalReorg /></AppLayout></ProtectedRoute>} />
              <Route path="/succession" element={<ProtectedRoute role="manager"><AppLayout><SuccessionBoard /></AppLayout></ProtectedRoute>} />
              <Route path="/roles" element={<ProtectedRoute role="manager"><AppLayout><RolesPage /></AppLayout></ProtectedRoute>} />

              {/* Fullscreen manager interview pages */}
              <Route path="/interview/employee" element={<ProtectedRoute role="manager"><EmployeeInterview /></ProtectedRoute>} />
              <Route path="/interview/employee/:id" element={<ProtectedRoute role="manager"><EmployeeInterview /></ProtectedRoute>} />
              <Route path="/interview/manager" element={<ProtectedRoute role="manager"><ManagerInterview /></ProtectedRoute>} />
              <Route path="/interview/manager/:id" element={<ProtectedRoute role="manager"><ManagerInterview /></ProtectedRoute>} />

              {/* Employee routes */}
              <Route path="/my-profile" element={<ProtectedRoute role="employee"><EmployeeLayout><MyProfile /></EmployeeLayout></ProtectedRoute>} />
              <Route path="/my-interview" element={<ProtectedRoute role="employee"><EmployeeLayout><MyInterview /></EmployeeLayout></ProtectedRoute>} />
              <Route path="/my-analysis" element={<ProtectedRoute role="employee"><EmployeeLayout><MyResults /></EmployeeLayout></ProtectedRoute>} />

              {/* Public routes — no auth */}
              <Route path="/interview-access" element={<InterviewAccess />} />
              <Route path="/interview-external/:interviewId" element={<InterviewExternal />} />
              <Route path="/apply" element={<ApplyPage />} />

              {/* Manager route for external analysis */}
              <Route path="/analysis-external/:id" element={<ProtectedRoute role="manager"><AppLayout><AnalysisExternal /></AppLayout></ProtectedRoute>} />
              <Route path="/external-candidate/:id" element={<ProtectedRoute role="manager"><AppLayout><ExternalCandidateProfile /></AppLayout></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </PipelineProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
