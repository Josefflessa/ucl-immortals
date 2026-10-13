const BANNER_TIME_ZONE = 'America/Sao_Paulo';

/** Banner date-only values represent midnight in São Paulo, while timestamps are instants. */
export function formatBannerRotation(value: string | number) {
  const date = typeof value === 'number'
    ? new Date(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T03:00:00.000Z`)
      : new Date(value);

  if (Number.isNaN(date.getTime())) return { date: 'Data indisponível', time: '' };

  return {
    date: new Intl.DateTimeFormat('pt-BR', {
      timeZone: BANNER_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
    time: `${new Intl.DateTimeFormat('pt-BR', {
      timeZone: BANNER_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)} · Brasília`,
  };
}
