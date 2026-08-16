import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Env is passed through untouched so a misconfigured deployment fails loudly at
// startup instead of silently sending traffic to the wrong place.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Invoke a Vercel serverless API route with auth token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response shape varies per serverless function (JSON or PDF Blob)
export async function invokeApi(functionName: string, payload: Record<string, unknown> = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`/api/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  // Handle binary responses (e.g. PDF)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    return res.blob();
  }

  return res.json();
}

/**
 * Upload a file to Supabase Storage and return the public URL.
 */
export async function uploadFile(file: File, bucket = 'attachments'): Promise<{ file_url: string }> {
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { file_url: publicUrl };
}
