export function getIntentScoreColor(score) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-blue-400';
  if (score >= 75) return 'text-yellow-400';
  return 'text-slate-400';
}

export function getFuryScoreColor(score) {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 30) return 'text-yellow-400';
  return 'text-slate-400';
}

export function getQuadrantLabel(intentScore, furyScore) {
  if (intentScore >= 85 && furyScore >= 75) {
    return { label: 'RED ZONE', color: 'bg-red-600', textColor: 'text-white' };
  }
  if (intentScore >= 85 && furyScore < 75) {
    return { label: 'High Intent', color: 'bg-emerald-600', textColor: 'text-white' };
  }
  if (intentScore < 85 && furyScore >= 75) {
    return { label: 'High Fury', color: 'bg-orange-600', textColor: 'text-white' };
  }
  return { label: 'Standard', color: 'bg-slate-600', textColor: 'text-slate-300' };
}
