import { supabase } from '@/lib/supabase';

export interface RateMatch {
  rate_id: string;
  amount: number;
  time_range_id: string;
  time_range_name: string;
  min_minutes: number;
  max_minutes: number | null;
}

/**
 * Busca, entre las tarifas activas de un tipo de vehículo, el rango de
 * tiempo que corresponde a los minutos transcurridos. Si los minutos
 * exceden todos los rangos definidos, se aplica el rango de mayor
 * min_minutes (se asume que el último tramo configurado sigue vigente
 * como "cobro máximo/continuado") en vez de fallar sin monto.
 */
export async function calculateAmountForType(
  vehicleTypeId: string,
  minutes: number
): Promise<RateMatch | null> {
  const { data, error } = await supabase
    .from('rates')
    .select(
      `id, amount, active,
       time_range:time_ranges ( id, name, min_minutes, max_minutes, active )`
    )
    .eq('vehicle_type_id', vehicleTypeId)
    .eq('active', true);

  if (error || !data || data.length === 0) return null;

  type Row = {
    id: string;
    amount: number;
    time_range: {
      id: string;
      name: string;
      min_minutes: number;
      max_minutes: number | null;
      active: boolean;
    } | null;
  };

  const rows = (data as unknown as Row[]).filter((r) => r.time_range?.active);
  if (rows.length === 0) return null;

  const exact = rows.filter(
    (r) =>
      r.time_range!.min_minutes <= minutes &&
      (r.time_range!.max_minutes === null || minutes <= r.time_range!.max_minutes)
  );

  const chosen =
    exact.length > 0
      ? exact.sort((a, b) => b.time_range!.min_minutes - a.time_range!.min_minutes)[0]
      : [...rows].sort((a, b) => b.time_range!.min_minutes - a.time_range!.min_minutes)[0];

  if (!chosen || !chosen.time_range) return null;

  return {
    rate_id: chosen.id,
    amount: Number(chosen.amount),
    time_range_id: chosen.time_range.id,
    time_range_name: chosen.time_range.name,
    min_minutes: chosen.time_range.min_minutes,
    max_minutes: chosen.time_range.max_minutes,
  };
}
