import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDurationFromMinutes, minutesBetween } from '@/lib/duration';
import type { ParkingRecord } from '@/types';

export default function Salida() {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('parking_records')
      .select(
        `id, entry_at,
         vehicle:vehicles ( id, plate, owner:owners ( id, full_name ) ),
         vehicle_type:vehicle_types ( id, name )`
      )
      .eq('status', 'inside')
      .order('entry_at', { ascending: false })
      .then(({ data }) => {
        setRecords((data as unknown as ParkingRecord[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.vehicle?.plate?.toLowerCase().includes(q));
  }, [records, search]);

  return (
    <div className="form-page">
      <h1>Registrar salida</h1>
      <p className="page-subtitle">Selecciona el vehículo que va a salir, o escanea el QR desde el panel principal.</p>

      <input
        className="search-input"
        placeholder="Buscar por placa..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="table-wrapper" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Propietario</th>
              <th>Tipo</th>
              <th>Tiempo transcurrido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Cargando…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5}>No hay vehículos dentro que coincidan.</td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.vehicle?.plate}</td>
                <td>{r.vehicle?.owner?.full_name}</td>
                <td>{r.vehicle_type?.name}</td>
                <td>{formatDurationFromMinutes(minutesBetween(r.entry_at, new Date().toISOString()))}</td>
                <td>
                  <Link className="btn btn-small btn-primary" to={`/salida/${r.id}`}>
                    Seleccionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
