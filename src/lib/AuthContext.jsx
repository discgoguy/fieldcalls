import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import posthog from '@/lib/posthog';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({});

  useEffect(() => {
    // Check current session on mount (initial load only)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user, true);
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    });

    // Listen for auth state changes
    // TOKEN_REFRESHED fires on every tab refocus — ignore it to prevent
    // the loading spinner from mounting and unmounting the current page
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (session?.user) {
        loadUserProfile(session.user, false);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // initialLoad=true shows the spinner; false silently updates the user object
  const loadUserProfile = async (authUser, initialLoad = false) => {
    try {
      if (initialLoad) setIsLoadingAuth(true);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) console.error('Profile load error:', error);

      const fullUser = {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || authUser.email,
        role: profile?.role || 'admin',
        is_customer: profile?.role === 'customer',
        department: profile?.department || null,
        ...(profile || {}),
      };

      setUser(fullUser);
      setIsAuthenticated(true);
      posthog.identify(fullUser.id, {
        email: fullUser.email,
        name: fullUser.full_name,
        role: fullUser.role,
        department: fullUser.department,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      setUser({ id: authUser.id, email: authUser.email, role: 'admin' });
      setIsAuthenticated(true);
      posthog.identify(authUser.id, { email: authUser.email });
    } finally {
      if (initialLoad) setIsLoadingAuth(false);
    }
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    posthog.reset();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkAppState = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await loadUserProfile(session.user, false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
