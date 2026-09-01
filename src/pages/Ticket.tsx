import { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import type { ParkingRecord } from '@/types';

export default function Ticket() {
  const { id } = useParams();
  const location = useLocation();
  const autoPrint = Boolean((location.state as { autoPrint?: boolean } | null)?.autoPrint);

  const [record, setRecord] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('parking_records')
      .select(
        `id, entry_at, key_left, comments,
         vehicle:vehicles ( id, plate, owner:owners ( id, full_name ) ),
         vehicle_type:vehicle_types ( id, name )`
      )
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setRecord(data as unknown as ParkingRecord | null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (record && autoPrint && !printed) {
      setPrinted(true);
      // Pequeño delay para asegurar que el QR terminó de renderizarse.
      setTimeout(() => window.print(), 300);
    }
  }, [record, autoPrint, printed]);

  if (loading) return <div className="page-loading">Cargando ticket…</div>;
  if (!record) return <div className="page-loading">Registro no encontrado.</div>;

  const entryDate = new Date(record.entry_at);

  return (
    <div className="ticket-page">
      <div className="ticket-toolbar no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          Reimprimir ticket
        </button>
        <Link className="btn" to="/">
          Volver al panel
        </Link>
      </div>

      <div className="ticket-print-area">
        <div className="ticket">
          <div className="ticket-title">PARQUEO</div>
          <div className="ticket-row">
            <span>Placa:</span>
            <strong>{record.vehicle?.plate}</strong>
          </div>
          <div className="ticket-row">
            <span>Tipo:</span>
            <strong>{record.vehicle_type?.name}</strong>
          </div>
          <div className="ticket-row">
            <span>Propietario:</span>
            <strong>{record.vehicle?.owner?.full_name}</strong>
          </div>
          <div className="ticket-row">
            <span>Fecha ingreso:</span>
            <strong>{entryDate.toLocaleDateString('es-BO')}</strong>
          </div>
          <div className="ticket-row">
            <span>Hora ingreso:</span>
            <strong>
              {entryDate.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
          {record.key_left && <div className="ticket-row">🔑 Dejó llave</div>}
          <div className="ticket-qr">
            <QRCodeSVG value={record.id} size={140} />
          </div>
          <div className="ticket-footer">Conserve este ticket para retirar su vehículo</div>
        </div>
      </div>
    </div>
  );
}
