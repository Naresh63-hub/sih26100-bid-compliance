import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const isSupabaseConfigured = () => {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-supabase-project.supabase.co' &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadDocumentToStorage(bucket: 'tender-documents' | 'bidder-documents', path: string, file: File) {
  if (!isSupabaseConfigured()) {
    return { path, error: null, fallback: true };
  }
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });
  return { data, error, fallback: false };
}

export async function getDocumentSignedUrl(bucket: 'tender-documents' | 'bidder-documents' | 'generated-reports', path: string) {
  if (!isSupabaseConfigured()) {
    return { signedUrl: null };
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return { signedUrl: data?.signedUrl || null, error };
}
