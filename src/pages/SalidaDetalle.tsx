import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDurationFromMinutes, minutesBetween } from '@/lib/duration';
import { calculateAmountForType, type RateMatch } from '@/lib/rates';
import type { ParkingRecord } from '@/types';

export default function SalidaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, hasPermission } = useAuth();

  const [record, setRecord] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(new Date());

  const [rateMatch, setRateMatch] = useState<RateMatch | null>(null);
  const [chargedAmount, setChargedAmount] = useState<string>('');
  const [overrideEnabled, setOverrideEnabled] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  async function loadRecord() {
    if (!id) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('parking_records')
      .select(
        `id, entry_at, exit_at, status, key_left, comments, photo_path,
         calculated_amount, charged_amount, vehicle_type_id,
         vehicle:vehicles ( id, plate, owner:owners ( id, full_name, ci, phone ) ),
         vehicle_type:vehicle_types ( id, name )`
      )
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const rec = data as unknown as ParkingRecord;
    setRecord(rec);
    setLoading(false);

    if (rec.photo_path) {
      const { data: signed } = await supabase.storage
        .from('parking-photos')
        .createSignedUrl(rec.photo_path, 3600);
      if (signed?.signedUrl) setPhotoUrl(signed.signedUrl);
    }
  }

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(clock);
  }, []);

  const minutes = useMemo(() => {
    if (!record) return 0;
    return minutesBetween(record.entry_at, now.toISOString());
  }, [record, now]);

  useEffect(() => {
    if (!record || record.status !== 'inside') return;
    calculateAmountForType(record.vehicle_type_id, minutes).then((match) => {
      setRateMatch(match);
      if (!overrideEnabled) {
        setChargedAmount(match ? String(match.amount) : '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, minutes]);

  async function handleConfirm() {
    if (!record) return;
    setError(null);

    const calculated = rateMatch?.amount ?? null;
    const charged = chargedAmount.trim() === '' ? calculated : Number(chargedAmount);

    if (charged !== null && Number.isNaN(charged)) {
      setError('El monto cobrado no es un número válido.');
      return;
    }

    setConfirming(true);
    const exitAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('parking_records')
      .update({
        exit_at: exitAt,
        calculated_amount: calculated,
        charged_amount: charged,
        status: 'completed',
        closed_by: profile?.id ?? null,
        applied_rate_snapshot: rateMatch
          ? {
              rate_id: rateMatch.rate_id,
              amount: rateMatch.amount,
              time_range_id: rateMatch.time_range_id,
              time_range_name: rateMatch.time_range_name,
              min_minutes: rateMatch.min_minutes,
              max_minutes: rateMatch.max_minutes,
              minutes_elapsed: minutes,
              calculated_at: exitAt,
            }
          : null,
      })
      .eq('id', record.id)
      .eq('status', 'inside'); // evita cerrar dos veces el mismo registro

    setConfirming(false);

    if (updateError) {
      setError('No se pudo confirmar la salida. Intenta nuevamente.');
      return;
    }

    navigate('/');
  }

  if (loading) return <div className="page-loading">Cargando…</div>;
  if (notFound || !record) {
    return (
      <div className="page-loading">
        No se encontró el registro. <Link to="/salida">Volver a la lista</Link>
      </div>
    );
  }

  if (record.status === 'completed') {
    return (
      <div className="form-page">
        <h1>Salida ya registrada</h1>
        <p>Este vehículo ya salió del parqueo.</p>
        <Link className="btn" to="/">
          Volver al panel
        </Link>
      </div>
    );
  }

  const entryDate = new Date(record.entry_at);
  const canOverride = hasPermission('parking.amount_override');

  return (
    <div className="form-page">
      <h1>Salida — {record.vehicle?.plate}</h1>

      <div className="summary-grid">
        <div>
          <span className="summary-label">Propietario</span>
          <div>{record.vehicle?.owner?.full_name}</div>
        </div>
        <div>
          <span className="summary-label">CI</span>
          <div>{record.vehicle?.owner?.ci ?? '—'}</div>
        </div>
        <div>
          <span className="summary-label">Teléfono</span>
          <div>{record.vehicle?.owner?.phone ?? '—'}</div>
        </div>
        <div>
          <span className="summary-label">Tipo de vehículo</span>
          <div>{record.vehicle_type?.name}</div>
        </div>
        <div>
          <span className="summary-label">Fecha ingreso</span>
          <div>{entryDate.toLocaleDateString('es-BO')}</div>
        </div>
        <div>
          <span className="summary-label">Hora ingreso</span>
          <div>{entryDate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div>
          <span className="summary-label">Tiempo transcurrido</span>
          <div>{formatDurationFromMinutes(minutes)}</div>
        </div>
        <div>
          <span className="summary-label">Llave</span>
          <div>{record.key_left ? 'Sí, dejó llave' : 'No'}</div>
        </div>
        {record.comments && (
          <div className="summary-full">
            <span className="summary-label">Comentarios</span>
            <div>{record.comments}</div>
          </div>
        )}
        {photoUrl && (
          <div className="summary-full">
            <span className="summary-label">Fotografía</span>
            <img src={photoUrl} alt="Vehículo" className="summary-photo" />
          </div>
        )}
      </div>

      <div className="amount-card">
        <div className="amount-row">
          <span>Monto calculado</span>
          <strong>Bs {rateMatch ? rateMatch.amount.toFixed(2) : '—'}</strong>
        </div>
        {rateMatch && (
          <div className="amount-hint">Tarifa aplicada: {rateMatch.time_range_name}</div>
        )}
        {!rateMatch && (
          <div className="amount-hint">
            No hay una tarifa configurada para este tipo de vehículo y tiempo transcurrido.
          </div>
        )}

        <div className="amount-row">
          <span>Monto cobrado</span>
          {canOverride ? (
            <input
              type="number"
              step="0.01"
              min="0"
              value={chargedAmount}
              onChange={(e) => {
                setOverrideEnabled(true);
                setChargedAmount(e.target.value);
              }}
              className="amount-input"
            />
          ) : (
            <strong>Bs {chargedAmount || '0.00'}</strong>
          )}
        </div>
        {!canOverride && (
          <div className="amount-hint">No tienes permiso para modificar el monto cobrado.</div>
        )}
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="dashboard-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
          {confirming ? 'Confirmando…' : 'Confirmar salida'}
        </button>
        <Link className="btn" to="/salida">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
