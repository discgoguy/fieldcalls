import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

// Cache role permissions so we don't refetch on every render
let cachedPermissions = null;
let cacheUserId = null;

export function usePermissions() {
  const [permissions, setPermissions] = useState(cachedPermissions);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(!cachedPermissions);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Use cache if same user
        if (cacheUserId === user.id && cachedPermissions) {
          setPermissions(cachedPermissions);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles').select('role, role_id').eq('id', user.id).maybeSingle();

        // Admins have full access — no need to load role permissions
        if (profile?.role === 'admin') {
          const fullAccess = { pages: {}, actions: {}, isAdmin: true };
          cachedPermissions = fullAccess;
          cacheUserId = user.id;
          setPermissions(fullAccess);
          setRole('admin');
          setLoading(false);
          return;
        }

        // Load role permissions if role_id is set
        if (profile?.role_id) {
          const { data: roleData } = await supabase
            .from('roles').select('*').eq('id', profile.role_id).maybeSingle();
          if (roleData) {
            cachedPermissions = { ...roleData.permissions, isAdmin: false, roleName: roleData.name };
            cacheUserId = user.id;
            setPermissions(cachedPermissions);
            setRole(roleData.name);
            setLoading(false);
            return;
          }
        }

        // Fallback: no custom role assigned — grant full access
        setRole(profile?.role || 'technician');
        setPermissions({ pages: {}, actions: {}, isAdmin: true });
      } catch(e) {
        console.error('Permission load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const canAccessPage = (pageKey) => {
    if (!permissions) return true; // Loading — show page by default
    if (permissions.isAdmin) return true;
    const level = permissions.pages?.[pageKey];
    return level && level !== 'none';
  };

  const getPageLevel = (pageKey) => {
    if (permissions?.isAdmin) return 'full';
    return permissions?.pages?.[pageKey] || 'none';
  };

  const canEdit = (pageKey) => {
    if (permissions?.isAdmin) return true;
    const level = permissions?.pages?.[pageKey];
    return level === 'edit' || level === 'full';
  };

  const canDelete = (pageKey) => {
    if (permissions?.isAdmin) return true;
    return permissions?.pages?.[pageKey] === 'full';
  };

  // Clear cache on sign out
  const clearCache = () => {
    cachedPermissions = null;
    cacheUserId = null;
  };

  return { permissions, role, loading, canAccessPage, getPageLevel, canEdit, canDelete, clearCache };
}

// Helper to invalidate cache when role changes
export function invalidatePermissionCache() {
  cachedPermissions = null;
  cacheUserId = null;
}
