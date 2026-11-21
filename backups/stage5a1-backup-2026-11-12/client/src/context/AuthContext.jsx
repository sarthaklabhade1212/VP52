import React, { createContext, useState, useEffect, useContext } from 'react';
import { signOutWithGoogle } from '../utils/googleAuth';
import { parseApiResponse } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('rewards_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('rewards_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => parseApiResponse(res))
        .then(parsed => {
          const data = parsed.data;
          if (parsed.ok && data && data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('rewards_user', JSON.stringify(data.user));
          } else if (parsed.status === 401 || parsed.status === 403 || (parsed.isJson && data && !data.success)) {
            logout();
          }
        })
        .catch(() => {
          // If server offline or transient error, preserve current cached session state safely
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const safeFetchJson = async (url, options = {}) => {
    const method = (options && options.method) ? options.method.toUpperCase() : 'GET';
    let res;

    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      console.error(`[AuthContext Network Error] ${method} ${url} failed to connect:`, networkErr.message || networkErr);
      const enhancedError = new Error(
        `Unable to reach server at ${url}. Please verify that the backend is running and reachable.`
      );
      enhancedError.code = 'network';
      enhancedError.originalError = networkErr;
      throw enhancedError;
    }

    const parsed = await parseApiResponse(res);
    if (!parsed.isJson || !parsed.data) {
      console.error(`[AuthContext Parse Error] ${method} ${url} returned ${parsed.isHtml ? 'HTML' : 'non-JSON'} (HTTP ${parsed.status})`);
      const jsonError = new Error(
        parsed.status === 404
          ? 'This service is temporarily unavailable on the server. Please try again later.'
          : `Server returned an unexpected response (HTTP ${parsed.status}). Please try again shortly.`
      );
      jsonError.status = parsed.status;
      throw jsonError;
    }

    const data = parsed.data;
    if (!res.ok || !data.success) {
      const errMsg = parsed.serverMessage || `Request failed with HTTP ${res.status}`;
      console.warn(`[AuthContext HTTP Error] ${method} ${url} -> HTTP ${res.status}:`, errMsg);
      const httpError = new Error(errMsg);
      httpError.status = res.status;
      httpError.data = data;
      throw httpError;
    }

    return data;
  };

  const loginCustomer = async (email, password) => {
    const data = await safeFetchJson('/api/auth/customer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('rewards_token', data.token);
    localStorage.setItem('rewards_user', JSON.stringify(data.user));
    return data.user;
  };

  const registerCustomer = async (formData) => {
    const data = await safeFetchJson('/api/auth/customer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('rewards_token', data.token);
    localStorage.setItem('rewards_user', JSON.stringify(data.user));
    return data.user;
  };

  // Customer Google sign-in: the caller passes a Google ID token obtained via the
  // native plugin. The backend verifies it and returns the SAME token/user shape
  // as email/password login, so session handling is identical (role stays customer).
  const loginCustomerGoogle = async (idToken) => {
    const data = await safeFetchJson('/api/auth/customer/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('rewards_token', data.token);
    localStorage.setItem('rewards_user', JSON.stringify(data.user));
    return data.user;
  };

  const completeCustomerProfile = async ({ full_name, mobile_number, password, confirm_password }) => {
    const currentToken = token || localStorage.getItem('rewards_token');
    const data = await safeFetchJson('/api/auth/customer/complete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify({ full_name, mobile_number, password, confirm_password })
    });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('rewards_token', data.token);
    localStorage.setItem('rewards_user', JSON.stringify(data.user));
    return data.user;
  };

  const forgotPassword = async (email) => {
    return await safeFetchJson('/api/auth/customer/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
  };

  const resetPassword = async ({ token: resetToken, password, confirm_password }) => {
    return await safeFetchJson('/api/auth/customer/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password, confirm_password })
    });
  };

  const loginAdmin = async (email, password) => {
    const data = await safeFetchJson('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('rewards_token', data.token);
    localStorage.setItem('rewards_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem('rewards_token');
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch (e) {}
    }

    // Cleanly wipe native Google Credential Manager & plugin cached tokens
    try {
      await signOutWithGoogle();
    } catch (e) {}

    setUser(null);
    setToken(null);
    localStorage.removeItem('rewards_user');
    localStorage.removeItem('rewards_token');
  };

  const updateUserBalance = (newBalance) => {
    if (user) {
      const updated = { ...user, balance: newBalance };
      setUser(updated);
      localStorage.setItem('rewards_user', JSON.stringify(updated));
    }
  };

  const updateUserPhoto = (photoUrl) => {
    if (user) {
      const updated = { ...user, profile_photo: photoUrl };
      setUser(updated);
      localStorage.setItem('rewards_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginCustomer,
      registerCustomer,
      loginCustomerGoogle,
      completeCustomerProfile,
      forgotPassword,
      resetPassword,
      loginAdmin,
      logout,
      updateUserBalance,
      updateUserPhoto,
      refreshUser: () => {
        if (token) {
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => parseApiResponse(r))
            .then(parsed => {
              const d = parsed.data;
              if (parsed.ok && d && d.success && d.user) {
                setUser(d.user);
                localStorage.setItem('rewards_user', JSON.stringify(d.user));
              }
            })
            .catch(() => {});
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
