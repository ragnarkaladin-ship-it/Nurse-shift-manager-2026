import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'admin' | 'cno' | 'ward_admin' | 'hr' | 'staff';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  nckRegistrationNumber?: string;
  licenseExpiryDate?: string;
  role: UserRole;
  wardId?: string;
  isDefaultPassword?: boolean;
}

interface AuthContextType {
  user: any | null; // Can be FirebaseUser or custom user object
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  login: async () => {},
  logout: async () => {},
  changePassword: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }

    const { token, user: userData } = await response.json();
    localStorage.setItem('hospital_auth_token', token);
    setUser(userData);
    setProfile(userData);
  };

  const logout = async () => {
    localStorage.removeItem('hospital_auth_token');
    await auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = localStorage.getItem('hospital_auth_token') || await auth.currentUser?.getIdToken();
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to change password');
    }
  };

  useEffect(() => {
    const fetchProfile = async (token: string) => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setProfile(userData);
        } else {
          localStorage.removeItem('hospital_auth_token');
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Fetch profile failed:", error);
      } finally {
        setIsAuthReady(true);
        setLoading(false);
      }
    };

    const token = localStorage.getItem('hospital_auth_token');
    if (token) {
      fetchProfile(token);
    } else {
      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          const idToken = await firebaseUser.getIdToken();
          fetchProfile(idToken);
        } else {
          setIsAuthReady(true);
          setLoading(false);
        }
      });
      return () => unsubscribeAuth();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
