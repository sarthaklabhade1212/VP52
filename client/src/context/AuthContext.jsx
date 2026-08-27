import React, { createContext, useState, useEffect, useContext } from 'react';

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
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('rewards_user', JSON.stringify(data.user));
          } else {
            logout();
          }
        })
        .catch(() => {
          // If server offline or token invalid
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const safeFetchJson = async (url, options = {}) => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error('Invalid response from server. Please ensure backend is running.');
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Request failed');
      }
      return data;
    } catch (err) {
      if (err.message && err.message.includes('pattern')) {
        throw new Error('Network error connecting to API server.');
      }
      throw err;
    }
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

  const logout = () => {
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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginCustomer,
      registerCustomer,
      loginCustomerGoogle,
      loginAdmin,
      logout,
      updateUserBalance,
      refreshUser: () => {
        if (token) {
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => d && d.success && setUser(d.user))
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
