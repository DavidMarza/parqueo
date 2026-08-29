import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatDurationFromMinutes, minutesBetween } from '@/lib/duration';
import type { ParkingRecord } from '@/types';
import { useAuth } from '@/hooks/useAuth';

type SortKey = 'entry_at' | 'plate' | 'owner_name' | 'vehicle_type';
type SortDir = 'asc' | 'desc';

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('entry_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [now, setNow] = useState(new Date());
  const [qrInput, setQrInput] = useState('');

  async function loadInside() {
    setLoading(true);
    const { data, error } = await supabase
      .from('parking_records')
      .select(
        `id, entry_at, exit_at, status, key_left, comments,
         vehicle:vehicles ( id, plate, owner:owners ( id, full_name ) ),
         vehicle_type:vehicle_types ( id, name )`
      )
      .eq('status', 'inside')
      .order('entry_at', { ascending: false });

    if (!error && data) {
      setRecords(data as unknown as ParkingRecord[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInside();
    const channel = supabase
      .channel('parking_records_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_records' },
        () => loadInside()
      )
      .subscribe();

    const clock = setInterval(() => setNow(new Date()), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(clock);
    };
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = records;
    if (q) {
      list = list.filter((r) => r.vehicle?.plate?.toLowerCase().includes(q));
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'entry_at':
          cmp = new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime();
          break;
        case 'plate':
          cmp = (a.vehicle?.plate ?? '').localeCompare(b.vehicle?.plate ?? '');
          break;
        case 'owner_name':
          cmp = (a.vehicle?.owner?.full_name ?? '').localeCompare(
            b.vehicle?.owner?.full_name ?? ''
          );
          break;
        case 'vehicle_type':
          cmp = (a.vehicle_type?.name ?? '').localeCompare(b.vehicle_type?.name ?? '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [records, search, sortKey, sortDir]);

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function handleQrSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = qrInput.trim();
    if (!code) return;
    // El QR contiene el id del parking_record; navegamos a la salida.
    window.location.href = `/salida/${encodeURIComponent(code)}`;
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-date">
            {now.toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="dashboard-time">
            {now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="inside-count">
          <span className="inside-count-number">{records.length}</span>
          <span>VEHÍCULOS DENTRO</span>
        </div>
      </header>

      <div className="dashboard-actions">
        {hasPermission('parking.entry') && (
          <Link className="btn btn-primary" to="/ingreso">
            Registrar ingreso
          </Link>
        )}
        {hasPermission('parking.exit') && (
          <Link className="btn" to="/salida">
            Registrar salida
          </Link>
        )}
        {hasPermission('parking.edit') && (
          <Link className="btn" to="/registros">
            Modificar registro
          </Link>
        )}
        {hasPermission('parking.ticket') && (
          <Link className="btn" to="/registros">
            Reimprimir ticket
          </Link>
        )}
      </div>

      <div className="dashboard-toolbar">
        <input
          className="search-input"
          placeholder="Buscar por placa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hasPermission('parking.exit') && (
          <form className="qr-form" onSubmit={handleQrSubmit}>
            <label htmlFor="qr-scan">Escanear QR</label>
            <input
              id="qr-scan"
              autoFocus
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Esperando lectura del QR…"
            />
          </form>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('plate')}>Placa{sortIndicator('plate')}</th>
              <th onClick={() => toggleSort('owner_name')}>Propietario{sortIndicator('owner_name')}</th>
              <th onClick={() => toggleSort('vehicle_type')}>Tipo{sortIndicator('vehicle_type')}</th>
              <th onClick={() => toggleSort('entry_at')}>Fecha ingreso{sortIndicator('entry_at')}</th>
              <th onClick={() => toggleSort('entry_at')}>Hora ingreso{sortIndicator('entry_at')}</th>
              <th>Tiempo transcurrido</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7}>Cargando…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7}>No hay vehículos dentro que coincidan con la búsqueda.</td>
              </tr>
            )}
            {filtered.map((r) => {
              const entryDate = new Date(r.entry_at);
              const minutes = minutesBetween(r.entry_at, now.toISOString());
              return (
                <tr key={r.id}>
                  <td>{r.vehicle?.plate}</td>
                  <td>{r.vehicle?.owner?.full_name}</td>
                  <td>{r.vehicle_type?.name}</td>
                  <td>{entryDate.toLocaleDateString('es-BO')}</td>
                  <td>{entryDate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{formatDurationFromMinutes(minutes)}</td>
                  <td>
                    {hasPermission('parking.exit') && (
                      <Link className="btn btn-small" to={`/salida/${r.id}`}>
                        Salida
                      </Link>
                    )}
                    {hasPermission('parking.edit') && (
                      <Link className="btn btn-small" to={`/registros/${r.id}`}>
                        Editar
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
