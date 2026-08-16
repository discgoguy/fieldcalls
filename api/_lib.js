import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

export function getServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Decode JWT payload without verifying signature (Supabase already verified it).
 */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function requireAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) throw { status: 401, error: 'Missing authorization token' };

  // Verify token with Supabase
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) {
    console.error('Auth verify error:', error?.message);
    throw { status: 401, error: 'Invalid or expired token' };
  }

  // Try service role profile lookup first
  let profile = null;
  try {
    const db = getServiceClient();
    const { data, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (!profileError) profile = data;
    else console.error('Profile lookup error:', profileError.message);
  } catch (e) {
    console.error('Profile exception:', e.message);
  }

  // Fallback: use anon client (respects RLS but user can read own profile)
  if (!profile) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data } = await userClient.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = data;
    } catch (e) {
      console.error('Fallback profile error:', e.message);
    }
  }

  const result = {
    id: user.id,
    email: user.email,
    role: profile?.role || 'customer',
    full_name: profile?.full_name || user.email,
    is_customer: profile?.role === 'customer',
    ...(profile || {}),
  };

  console.log(`Auth: ${user.email} role=${result.role} profile=${profile ? 'found' : 'missing'}`);
  return result;
}

export function errorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}
