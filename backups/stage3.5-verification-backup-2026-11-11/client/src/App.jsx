import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';

// One-time premium startup animation (pure visual overlay; see StartupSplash.jsx)
import StartupSplash from './components/StartupSplash';

// Welcome & Role Selection Landing Pages
import WelcomeScreen from './pages/WelcomeScreen';
import UserTypeSelection from './pages/UserTypeSelection';
import LoginSelector from './pages/LoginSelector';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DeleteAccount from './pages/DeleteAccount';


// Customer Pages
import CustomerLayout from './components/CustomerLayout';
import CustomerLogin from './pages/CustomerLogin';
import CustomerCompleteProfile from './pages/CustomerCompleteProfile';
import CustomerForgotPassword from './pages/CustomerForgotPassword';
import CustomerHome from './pages/CustomerHome';
import CustomerShopDetail from './pages/CustomerShopDetail';
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
import MerchantPhotos from './pages/shop/MerchantPhotos';
import MerchantReviews from './pages/shop/MerchantReviews';
import MerchantOrders from './pages/shop/MerchantOrders';
import MerchantBilling from './pages/shop/MerchantBilling';
import MerchantMessages from './pages/MerchantMessages';
import MerchantChat from './pages/MerchantChat';

// Admin Pages
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminShops from './pages/admin/AdminShops';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCoinManagement from './pages/admin/AdminCoinManagement';
import AdminOffers from './pages/admin/AdminOffers';
import AdminOrders from './pages/admin/AdminOrders';
import AdminPayments from './pages/admin/AdminPayments';
import AdminReferrals from './pages/admin/AdminReferrals';
import AdminMemberships from './pages/admin/AdminMemberships';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminAdvertisements from './pages/admin/AdminAdvertisements';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminReports from './pages/admin/AdminReports';
import AdminSecurity from './pages/admin/AdminSecurity';
import AdminQRVerification from './pages/admin/AdminQRVerification';
import AdminMerchantVerification from './pages/admin/AdminMerchantVerification';

// Protected Route Wrapper for Customers
function CustomerRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 700 }}>
        {t('loadingVp52')}
      </div>
    );
  }
  if (!user || user.role !== 'customer') {
    return <Navigate to="/customer/login" replace />;
  }
  // Enforce profile completion before allowing access to customer portal
  if (user.profile_completed === false) {
    return <Navigate to="/customer/complete-profile" replace />;
  }
  return children;
}

// Protected Route Wrapper for Shop Merchants
function ShopRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 700 }}>
        {t('loadingMerchantPortal')}
      </div>
    );
  }
  if (!user || user.role !== 'shop') {
    return <Navigate to="/shop/login" replace />;
  }
  return children;
}

// Protected Route Wrapper for Admins
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: 700 }}>
        {t('loadingAdminPanel')}
      </div>
    );
  }
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
  if (user?.role === 'customer') {
    if (user.profile_completed === false) {
      return <Navigate to="/customer/complete-profile" replace />;
    }
    return <Navigate to="/customer/home" replace />;
  }
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
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/delete-account" element={<DeleteAccount />} />

            {/* Customer Auth & Protected Routes */}
            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route path="/customer/complete-profile" element={<CustomerCompleteProfile />} />
            <Route path="/customer/forgot-password" element={<CustomerForgotPassword />} />
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
              <Route path="shops/:id" element={<CustomerShopDetail />} />
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
              <Route path="photos" element={<MerchantPhotos />} />
              <Route path="reviews" element={<MerchantReviews />} />
              <Route path="orders" element={<MerchantOrders />} />
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
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="shops" element={<AdminShops />} />
              <Route path="merchants" element={<Navigate to="/admin/shops" replace />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="coins" element={<AdminCoinManagement />} />
              <Route path="transactions" element={<Navigate to="/admin/coins" replace />} />
              <Route path="offers" element={<AdminOffers />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="referrals" element={<AdminReferrals />} />
              <Route path="memberships" element={<AdminMemberships />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="advertisements" element={<AdminAdvertisements />} />
              <Route path="complaints" element={<AdminComplaints />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="settings" element={<Navigate to="/admin/security" replace />} />
              <Route path="verify-qr" element={<AdminQRVerification />} />
              <Route path="merchant-verification" element={<AdminMerchantVerification />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
