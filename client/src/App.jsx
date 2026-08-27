import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './i18n/I18nContext';

// One-time premium startup animation (pure visual overlay; see StartupSplash.jsx)
import StartupSplash from './components/StartupSplash';

// Welcome & Role Selection Landing Pages
import WelcomeScreen from './pages/WelcomeScreen';
import UserTypeSelection from './pages/UserTypeSelection';
import LoginSelector from './pages/LoginSelector';

// Customer Pages
import CustomerLayout from './components/CustomerLayout';
import CustomerLogin from './pages/CustomerLogin';
import CustomerHome from './pages/CustomerHome';
import CustomerRewards from './pages/CustomerRewards';
import CustomerWallet from './pages/CustomerWallet';
import CustomerHistory from './pages/CustomerHistory';
import CustomerProfile from './pages/CustomerProfile';
import CustomerMessages from './pages/CustomerMessages';
import CustomerChat from './pages/CustomerChat';

// Shop Merchant Pages
import ShopLayout from './components/ShopLayout';
import ShopLogin from './pages/shop/ShopLogin';
import MerchantRegister from './pages/shop/MerchantRegister';
import ShopChangePassword from './pages/shop/ShopChangePassword';
import ShopDashboard from './pages/shop/ShopDashboard';
import ShopOffers from './pages/shop/ShopOffers';
import ShopHistory from './pages/shop/ShopHistory';
import MerchantProducts from './pages/shop/MerchantProducts';
import MerchantBilling from './pages/shop/MerchantBilling';
import MerchantMessages from './pages/MerchantMessages';
import MerchantChat from './pages/MerchantChat';

// Admin Pages
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminQRVerification from './pages/admin/AdminQRVerification';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminShops from './pages/admin/AdminShops';
import AdminOffers from './pages/admin/AdminOffers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminMerchantVerification from './pages/admin/AdminMerchantVerification';

// Protected Route Wrapper for Customers
function CustomerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading application...</div>;
  if (!user || user.role !== 'customer') {
    return <Navigate to="/customer/login" replace />;
  }
  return children;
}

// Protected Route Wrapper for Shop Merchants
function ShopRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading shop dashboard...</div>;
  if (!user || user.role !== 'shop') {
    return <Navigate to="/shop/login" replace />;
  }
  return children;
}

// Protected Route Wrapper for Admins
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading admin dashboard...</div>;
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'shop') return <Navigate to="/shop/dashboard" replace />;
  if (user?.role === 'customer') return <Navigate to="/customer/home" replace />;
  return <Navigate to="/welcome" replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Plays once per app launch, then unmounts. Sibling of <Routes>,
              not a route, so it never re-appears during navigation. */}
          <StartupSplash />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/user-type-selection" element={<UserTypeSelection />} />
            <Route path="/portal" element={<LoginSelector />} />

            {/* Customer Auth & Protected Routes */}
            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route
              path="/customer"
              element={
                <CustomerRoute>
                  <CustomerLayout />
                </CustomerRoute>
              }
            >
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<CustomerHome />} />
              <Route path="rewards" element={<CustomerRewards />} />
              <Route path="wallet" element={<CustomerWallet />} />
              <Route path="history" element={<CustomerHistory />} />
              <Route path="messages" element={<CustomerMessages />} />
              <Route path="messages/:conversationId" element={<CustomerChat />} />
              <Route path="profile" element={<CustomerProfile />} />
            </Route>

            {/* Shop Merchant Auth & Protected Routes */}
            <Route path="/shop/login" element={<ShopLogin />} />
            <Route path="/merchant/register" element={<MerchantRegister />} />
            {/* Forced first-login password change. Guarded by role only (NOT by the
                must_change_password gate that ShopLayout applies), and deliberately
                OUTSIDE the /shop layout so the gate's redirect here cannot loop. */}
            <Route
              path="/shop/change-password"
              element={
                <ShopRoute>
                  <ShopChangePassword />
                </ShopRoute>
              }
            />
            <Route
              path="/shop"
              element={
                <ShopRoute>
                  <ShopLayout />
                </ShopRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ShopDashboard />} />
              <Route path="billing" element={<MerchantBilling />} />
              <Route path="products" element={<MerchantProducts />} />
              <Route path="offers" element={<ShopOffers />} />
              <Route path="messages" element={<MerchantMessages />} />
              <Route path="messages/:conversationId" element={<MerchantChat />} />
              <Route path="history" element={<ShopHistory />} />
            </Route>

            {/* Admin Auth & Protected Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="verify-qr" element={<AdminQRVerification />} />
              <Route path="merchant-verification" element={<AdminMerchantVerification />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="shops" element={<AdminShops />} />
              <Route path="offers" element={<AdminOffers />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="transactions" element={<AdminTransactions />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
