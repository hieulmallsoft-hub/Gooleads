export type CustomDateRange = {
  startDate: string;
  endDate: string;
};

export function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayInputDate() {
  return toInputDate(new Date());
}

export function getLastDaysRange(days: number): CustomDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(days - 1, 0));
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

export function parseCustomDateRange(value: string): CustomDateRange | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { startDate: match[1], endDate: match[2] };
}

export function serializeCustomDateRange(range: CustomDateRange) {
  return `${range.startDate},${range.endDate}`;
}

export function countRangeDays(range: CustomDateRange) {
  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function formatTimeRangeLabel(value: string) {
  const customRange = parseCustomDateRange(value);
  if (!customRange) return value;

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const start = formatter.format(new Date(`${customRange.startDate}T00:00:00`));
  const end = formatter.format(new Date(`${customRange.endDate}T00:00:00`));
  return `${start} - ${end}`;
}
