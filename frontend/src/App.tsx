import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavigationHistoryProvider } from "@/contexts/NavigationHistoryContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NavigationHistoryProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/portfolios" element={<Portfolios />} />
            <Route path="/portfolios/:id" element={<PortfolioDetail />} />
            <Route path="/portfolios/:portfolioId/accounts/:accountId" element={<PortfolioAccounts />} />
            <Route path="/portfolios/:id/performance" element={<PortfolioPerformance />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/structured-notes" element={<StructuredNotes />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/advisors" element={<Advisors />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/basic-data" element={<BasicData />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </NavigationHistoryProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
