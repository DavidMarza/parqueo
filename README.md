# Sistema de Parqueo — Fase 1

React + TypeScript + Vite + Supabase (Auth, Postgres, Storage, RLS) + Netlify.
Sin backend propio, sin service_role, sin Edge Functions.

## Contenido de esta entrega (Fase 1)

- Estructura completa de carpetas (`components/pages/lib/routes/hooks/types`).
- `supabase/schema.sql`: script único con tablas, relaciones, índices, trigger
  de creación de perfiles, funciones, RLS y datos iniciales (permisos, tipos
  de vehículo, rangos de tiempo de ejemplo).
- Cliente Supabase (`src/lib/supabase.ts`) con la segunda instancia
  (`supabaseAdmin`, `persistSession: false`) reservada para crear usuarios.
- Autenticación completa (`useAuth`), perfil, permisos y `ProtectedRoute`.
- Router con **todas** las rutas del sistema (`/login`, `/`, `/ingreso`,
  `/salida`, `/salida/:id`, `/registros`, `/registros/:id`, `/ticket/:id`,
  `/reportes`, `/reportes/horas-pico`, `/reportes/recurrentes`,
  `/configuracion/*`). Las que aún no tienen lógica de negocio muestran una
  página placeholder — así la app ya es navegable end-to-end y desplegable.
- Dashboard **funcional**: vehículos actualmente dentro en tiempo real
  (Supabase Realtime), contador visible, búsqueda por placa, orden por
  columnas (placa/propietario/tipo/hora), campo de escaneo QR que redirige
  a `/salida/:id`, botones según permisos.
- `netlify.toml` y `public/_redirects` para el ruteo SPA.
- `.env.example` y `.gitignore`.

## Configuración manual (una sola vez)

1. **Base de datos**: en Supabase → SQL Editor, pega y ejecuta todo
   `supabase/schema.sql` una sola vez.
2. **Primer administrador**: Supabase → Authentication → Add user (crea el
   usuario). Luego, en SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where id = '<uuid-del-usuario>';
   ```
3. **Storage**: crea manualmente el bucket `parking-photos` (Storage →
   New bucket). Es el único recurso manual adicional.
4. **Variables de entorno en Netlify**: `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (Site settings → Environment variables), tomadas
   de Supabase → Project Settings → API.
5. Conecta el repo a Netlify (build command `npm run build`, publish `dist`,
   ya definido en `netlify.toml`) y prueba únicamente en la URL pública.

## Próximas fases (sobre esta misma base, sin romper nada de lo anterior)

- `/ingreso`: formulario completo (placa, tipo, propietario, cámara, dejó
  llave) + generación de ticket + QR + impresión automática.
- `/salida` y `/salida/:id`: cálculo de tiempo/monto, `calculated_amount`
  vs `charged_amount`, snapshot histórico de tarifa aplicada.
- `/configuracion/usuarios`: alta de usuarios con el segundo cliente
  Supabase (`supabaseAdmin.auth.signUp`) + asignación de rol/permisos por
  checkbox.
- `/configuracion/tipos`, `/rangos`, `/tarifas`: CRUD sobre las tablas ya
  creadas en el SQL.
- `/reportes`, `/reportes/horas-pico`, `/reportes/recurrentes`: filtros de
  fecha/hora, orden, totales (`SUM(charged_amount)`), exportación a Excel
  (`xlsx`, ya está en `package.json`).
