import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Ingreso from '@/pages/Ingreso';
import Salida from '@/pages/Salida';
import SalidaDetalle from '@/pages/SalidaDetalle';
import Registros from '@/pages/Registros';
import RegistroDetalle from '@/pages/RegistroDetalle';
import Ticket from '@/pages/Ticket';
import Reportes from '@/pages/Reportes';
import ReportesHorasPico from '@/pages/ReportesHorasPico';
import ReportesRecurrentes from '@/pages/ReportesRecurrentes';
import Configuracion from '@/pages/Configuracion';
import ConfiguracionTipos from '@/pages/ConfiguracionTipos';
import ConfiguracionRangos from '@/pages/ConfiguracionRangos';
import ConfiguracionTarifas from '@/pages/ConfiguracionTarifas';
import ConfiguracionUsuarios from '@/pages/ConfiguracionUsuarios';
import ConfiguracionPermisos from '@/pages/ConfiguracionPermisos';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingreso" element={<Ingreso />} />
        <Route path="/salida" element={<Salida />} />
        <Route path="/salida/:id" element={<SalidaDetalle />} />
        <Route path="/registros" element={<Registros />} />
        <Route path="/registros/:id" element={<RegistroDetalle />} />
        <Route path="/ticket/:id" element={<Ticket />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/reportes/horas-pico" element={<ReportesHorasPico />} />
        <Route path="/reportes/recurrentes" element={<ReportesRecurrentes />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/configuracion/tipos" element={<ConfiguracionTipos />} />
        <Route path="/configuracion/rangos" element={<ConfiguracionRangos />} />
        <Route path="/configuracion/tarifas" element={<ConfiguracionTarifas />} />
        <Route path="/configuracion/usuarios" element={<ConfiguracionUsuarios />} />
        <Route path="/configuracion/permisos" element={<ConfiguracionPermisos />} />
      </Route>
    </Routes>
  );
}
