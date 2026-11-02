import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.104.1/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('ISI-PROJECT') && !SUPABASE_ANON_KEY.includes('ISI-ANON');

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'stok-gudang-auth' }
});

// klien sementara untuk membuat akun pegawai tanpa mengganti sesi owner
export function tempClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tmp-' + Date.now() }
  });
}

const MESSAGES = [
  [/Invalid login credentials/i, 'Email atau password salah.'],
  [/Email not confirmed/i, 'Email belum dikonfirmasi. Matikan "Confirm email" di Supabase atau buka email konfirmasi.'],
  [/User already registered/i, 'Email ini sudah terdaftar.'],
  [/Password should be at least/i, 'Password minimal 6 karakter.'],
  [/rate limit/i, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Tidak ada koneksi internet / server tidak terjangkau.'],
  [/JWT expired/i, 'Sesi habis, silakan login ulang.'],
  [/schema cache|Could not find the function/i, 'Database belum diperbarui ke versi aplikasi ini. Buka Supabase › SQL Editor, jalankan ulang seluruh isi supabase/schema.sql (aman, data tidak hilang), lalu coba lagi.']
];
export function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Terjadi kesalahan');
  for (const [re, t] of MESSAGES) if (re.test(m)) return t;
  return m;
}

export async function rpc(name, args = {}) {
  const { data, error } = await supa.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw error;
  return count !== undefined && count !== null && data === null ? count : data;
}
