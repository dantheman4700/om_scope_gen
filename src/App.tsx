import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import ListingDetail from "./pages/ListingDetail";
import AdminCreate from "./pages/AdminCreate";
import Dashboard from "./pages/Dashboard";
import ListingProfile from "./pages/ListingProfile";
import ListingSettings from "./pages/ListingSettings";
import ProspectsManagement from "./pages/ProspectsManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TriggerUpdate from "./pages/TriggerUpdate";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/listings" element={<Navigate to="/" replace />} />
            <Route path="/listing/:id" element={<ListingDetail />} />
            <Route path="/admin/create" element={<AdminCreate />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/listing/:id" element={<ListingProfile />} />
            <Route path="/dashboard/listing/:id/settings" element={<ListingSettings />} />
            <Route path="/dashboard/listing/:id/prospects" element={<ProspectsManagement />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/trigger-chipfoundry-update" element={<TriggerUpdate />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
