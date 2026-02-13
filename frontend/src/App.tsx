import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavigationHistoryProvider } from "@/contexts/NavigationHistoryContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Index from "./pages/Index";
import Portfolios from "./pages/Portfolios";
import PortfolioDetail from "./pages/PortfolioDetail";
import PortfolioAccounts from "./pages/PortfolioAccounts";
import PortfolioPerformance from "./pages/PortfolioPerformance";
import Transactions from "./pages/Transactions";
import Positions from "./pages/Positions";
import Assets from "./pages/Assets";
import Advisors from "./pages/Advisors";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import BasicData from "./pages/BasicData";
import Admin from "./pages/Admin";
import CRM from "./pages/CRM";
import StructuredNotes from "./pages/StructuredNotes";
import IBKRDashboard from "./pages/IBKRDashboard";
import PershingDashboard from "./pages/PershingDashboard";
import ETLJobDetails from "./pages/ETLJobDetails";
import PerformanceConfiguration from "./pages/PerformanceConfiguration.tsx";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <NotificationsProvider>
            <Toaster />
            <Sonner />
            <NavigationHistoryProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/portfolios" element={<ProtectedRoute><Portfolios /></ProtectedRoute>} />
                <Route path="/portfolios/:id" element={<ProtectedRoute><PortfolioDetail /></ProtectedRoute>} />
                <Route path="/portfolios/:portfolioId/accounts/:accountId" element={<ProtectedRoute><PortfolioAccounts /></ProtectedRoute>} />
                <Route path="/portfolios/:id/performance" element={<ProtectedRoute><PortfolioPerformance /></ProtectedRoute>} />
                <Route path="/portfolios/:id/performance-configuration" element={<ProtectedRoute><PerformanceConfiguration /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
                <Route path="/structured-notes" element={<ProtectedRoute><StructuredNotes /></ProtectedRoute>} />
                <Route path="/positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
                <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
                <Route path="/advisors" element={<ProtectedRoute><Advisors /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/basic-data" element={<ProtectedRoute><BasicData /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />

                {/* ETL Routes */}
                <Route path="/etl/ibkr" element={<ProtectedRoute><IBKRDashboard /></ProtectedRoute>} />
                <Route path="/etl/pershing" element={<ProtectedRoute><PershingDashboard /></ProtectedRoute>} />
                <Route path="/etl-job/:jobId" element={<ProtectedRoute><ETLJobDetails /></ProtectedRoute>} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </NavigationHistoryProvider>
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;