import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  permissions: Set<string>;
  loading: boolean;
  hasPermission: (code: string) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function loadProfileAndPermissions(userId: string) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    setProfile(profileData as Profile | null);

    if (profileData?.role === 'admin') {
      // admin tiene acceso implícito a todo; no necesitamos cargar la tabla
      setPermissions(new Set(['*']));
      return;
    }

    const { data: permsData } = await supabase
      .from('profile_permissions')
      .select('permission_code')
      .eq('profile_id', userId);

    setPermissions(new Set((permsData ?? []).map((p) => p.permission_code)));
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      await loadProfileAndPermissions(session.user.id);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) {
        await loadProfileAndPermissions(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        await loadProfileAndPermissions(newSession.user.id);
      } else {
        setProfile(null);
        setPermissions(new Set());
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function hasPermission(code: string) {
    if (!profile?.active) return false;
    if (profile.role === 'admin') return true;
    return permissions.has(code);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, permissions, loading, hasPermission, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
