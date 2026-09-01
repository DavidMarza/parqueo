import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import CameraCapture from '@/components/CameraCapture';
import type { VehicleType } from '@/types';

export default function Ingreso() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [plate, setPlate] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerCi, setOwnerCi] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [comments, setComments] = useState('');
  const [keyLeft, setKeyLeft] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const [existingVehicleId, setExistingVehicleId] = useState<string | null>(null);
  const [existingOwnerId, setExistingOwnerId] = useState<string | null>(null);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('vehicle_types')
      .select('id, name, description, active')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        setVehicleTypes((data as VehicleType[]) ?? []);
        if (data && data.length > 0) setVehicleTypeId(data[0].id);
      });
  }, []);

  async function lookupPlate(rawPlate: string) {
    const normalized = rawPlate.trim().toUpperCase();
    setPlate(normalized);
    setExistingVehicleId(null);
    setExistingOwnerId(null);
    setLookupNotice(null);
    if (normalized.length < 3) return;

    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, owner:owners ( id, full_name, ci, phone )')
      .ilike('plate', normalized)
      .maybeSingle();

    if (data) {
      const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner;
      setExistingVehicleId(data.id);
      if (owner) {
        setExistingOwnerId(owner.id);
        setOwnerName(owner.full_name ?? '');
        setOwnerCi(owner.ci ?? '');
        setOwnerPhone(owner.phone ?? '');
      }
      setLookupNotice('Vehículo ya registrado — datos del propietario cargados automáticamente.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!plate.trim()) {
      setError('La placa es obligatoria.');
      return;
    }
    if (!vehicleTypeId) {
      setError('Selecciona el tipo de vehículo.');
      return;
    }
    const finalOwnerName = ownerName.trim() || 'S/N';

    setSubmitting(true);
    try {
      let ownerId = existingOwnerId;
      let vehicleId = existingVehicleId;

      if (ownerId) {
        await supabase
          .from('owners')
          .update({
            full_name: finalOwnerName,
            ci: ownerCi.trim() || null,
            phone: ownerPhone.trim() || null,
          })
          .eq('id', ownerId);
      } else {
        const { data: newOwner, error: ownerError } = await supabase
          .from('owners')
          .insert({
            full_name: finalOwnerName,
            ci: ownerCi.trim() || null,
            phone: ownerPhone.trim() || null,
          })
          .select('id')
          .single();
        if (ownerError || !newOwner) throw ownerError ?? new Error('No se pudo crear el propietario.');
        ownerId = newOwner.id;
      }

      if (!vehicleId) {
        const { data: newVehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .insert({ plate: plate.trim().toUpperCase(), owner_id: ownerId })
          .select('id')
          .single();
        if (vehicleError || !newVehicle) throw vehicleError ?? new Error('No se pudo crear el vehículo.');
        vehicleId = newVehicle.id;
      }

      let photoPath: string | null = null;
      if (photoBlob) {
        const fileName = `${vehicleId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('parking-photos')
          .upload(fileName, photoBlob, { contentType: 'image/jpeg' });
        if (!uploadError) {
          photoPath = fileName;
        }
      }

      const { data: record, error: recordError } = await supabase
        .from('parking_records')
        .insert({
          vehicle_id: vehicleId,
          vehicle_type_id: vehicleTypeId,
          comments: comments.trim() || null,
          key_left: keyLeft,
          photo_path: photoPath,
          status: 'inside',
          created_by: profile?.id ?? null,
        })
        .select('id')
        .single();

      if (recordError || !record) throw recordError ?? new Error('No se pudo crear el registro.');

      navigate(`/ticket/${record.id}`, { state: { autoPrint: true } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al registrar el ingreso.';
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Registrar ingreso</h1>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-grid">
          <label>
            Placa *
            <input
              value={plate}
              onChange={(e) => lookupPlate(e.target.value)}
              placeholder="ABC123"
              required
              autoFocus
            />
          </label>

          <label>
            Tipo de vehículo *
            <select value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)} required>
              {vehicleTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lookupNotice && <div className="form-notice">{lookupNotice}</div>}

        <fieldset>
          <legend>Propietario</legend>
          <div className="form-grid">
            <label>
              Nombre completo (o S/N si no se conoce)
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="S/N"
              />
            </label>
            <label>
              CI (opcional)
              <input value={ownerCi} onChange={(e) => setOwnerCi(e.target.value)} />
            </label>
            <label>
              Teléfono (opcional)
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <label className="checkbox-row">
          <input type="checkbox" checked={keyLeft} onChange={(e) => setKeyLeft(e.target.checked)} />
          Dejó llave
        </label>

        <label>
          Comentarios
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
        </label>

        <fieldset>
          <legend>Fotografía (opcional)</legend>
          <CameraCapture onCapture={setPhotoBlob} />
        </fieldset>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar y generar ticket'}
        </button>
      </form>
    </div>
  );
}
