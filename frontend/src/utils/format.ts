export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function roasClass(roas: number) {
  if (roas >= 1) return 'good';
  if (roas >= 0.7) return 'weak';
  return 'poor';
}

export function assessmentClass(assessment: string) {
  if (assessment === 'Strong' || assessment === 'Good') return 'good';
  if (assessment === 'Needs improvement' || assessment === 'Need more data') return 'weak';
  return 'poor';
}
