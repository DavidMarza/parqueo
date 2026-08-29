import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Configúralas en Netlify (Site settings → Environment variables).'
  );
}

/**
 * Cliente principal: mantiene la sesión del usuario que inició sesión
 * (operador/admin trabajando en el panel).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Segundo cliente: se usa EXCLUSIVAMENTE para crear usuarios nuevos
 * (signUp) desde /configuracion/usuarios sin reemplazar la sesión
 * del administrador que está logueado con `supabase`.
 * No persiste sesión. No usa service_role. No usa Edge Functions.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
