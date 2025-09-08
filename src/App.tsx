import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/layout/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerSchedule from "./pages/worker/WorkerSchedule";
import WorkerSubstitute from "./pages/worker/WorkerSubstitute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminWorkers from "./pages/admin/AdminWorkers";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminReport from "./pages/admin/AdminReport";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Worker Routes */}
            <Route 
              path="/worker/dashboard" 
              element={
                <ProtectedRoute requiredRole="worker">
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/worker/schedule" 
              element={
                <ProtectedRoute requiredRole="worker">
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/worker/substitute" 
              element={
                <ProtectedRoute requiredRole="worker">
                  <Layout>
                    <WorkerSubstitute />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Admin Routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/workers" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <AdminWorkers />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/requests" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <AdminRequests />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/attendance" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <AdminAttendance />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route
              path="/admin/reports"
              element={<ProtectedRoute requiredRole="admin">
                  <Layout>
                    <AdminReport />
                  </Layout>
                </ProtectedRoute>} />
            
            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
