/** Formatea minutos transcurridos como "02h 35m" o "1 día 04h 20m". */
export function formatDurationFromMinutes(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  if (days > 0) {
    return `${days} día${days > 1 ? 's' : ''} ${hh}h ${mm}m`;
  }
  return `${hh}h ${mm}m`;
}

export function minutesBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}
