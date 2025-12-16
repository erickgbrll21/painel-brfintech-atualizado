import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Customers from './pages/Customers';
import CustomerSales from './pages/CustomerSales';
import CieloTransactions from './pages/CieloTransactions';
import TerminalDashboard from './pages/TerminalDashboard';
import Transfers from './pages/Transfers';
import Layout from './components/Layout';
import { Shield } from 'lucide-react';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="bg-white border-2 border-red-200 rounded-lg p-8 text-center max-w-md">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-black mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-4">
            Apenas administradores podem acessar esta página.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-black text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route
          path="customers"
          element={
            <AdminRoute>
              <Customers />
            </AdminRoute>
          }
        />
        <Route path="customers/:customerId/sales" element={<CustomerSales />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="cielo" element={<CieloTransactions />} />
        <Route path="terminal/:terminalId" element={<TerminalDashboard />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

