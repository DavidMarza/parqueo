import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS: { to: string; label: string; permission?: string }[] = [
  { to: '/', label: 'Panel principal' },
  { to: '/ingreso', label: 'Registrar ingreso', permission: 'parking.entry' },
  { to: '/reportes', label: 'Reportes', permission: 'reports.view' },
  { to: '/configuracion', label: 'Configuración' },
];

export default function Layout() {
  const { profile, hasPermission, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-title">Parqueo</div>
        <nav>
          {NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)).map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{profile?.full_name ?? '—'}</div>
          <div className="sidebar-user-role">{profile?.role}</div>
          <button className="link-button" onClick={() => signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
