import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbifnqradvbvuuqvymji.supabase.co';
// Usar a chave anon (legacy) para garantir compatibilidade com autenticação
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWZucXJhZHZidnV1cXZ5bWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTE2OTMsImV4cCI6MjA4MTQ4NzY5M30.E5e4jFqhioAmBFRgt2bCKeS8Zv_0nHnseJ27EYibICI';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

// Cliente Supabase para operações do usuário (usa anon key)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'sb-pbifnqradvbvuuqvymji-auth-token'
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
});

// Cliente Supabase Admin (para operações administrativas - usar apenas no servidor)
// NOTA: Nunca exponha a service_role_key no cliente!
// export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

