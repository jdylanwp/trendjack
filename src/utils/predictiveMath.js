export function calculateTrendDynamics(historicalData) {
  if (!historicalData || historicalData.length < 3) {
    return { velocity: 0, acceleration: 0, gForce: 0, confidence: 0, currentVolume: 0 };
  }

  const sorted = [...historicalData].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.slice(-14);

  if (recent.length < 3) {
    return { velocity: 0, acceleration: 0, gForce: 0, confidence: 0, currentVolume: 0 };
  }

  const velocities = [];
  for (let i = 1; i < recent.length; i++) {
    velocities.push(recent[i].count - recent[i - 1].count);
  }

  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;

  const accelerations = [];
  for (let i = 1; i < velocities.length; i++) {
    accelerations.push(velocities[i] - velocities[i - 1]);
  }

  const avgAcceleration = accelerations.length > 0
    ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
    : 0;

  const currentVolume = recent[recent.length - 1].count;
  const safeVolume = currentVolume === 0 ? 1 : currentVolume;

  let gForce = 0;
  if (avgAcceleration > 0) {
    gForce = (avgAcceleration * 100) / Math.sqrt(safeVolume);
  }

  const positiveAccels = accelerations.filter(a => a > 0).length;
  const confidence = accelerations.length > 0
    ? Math.round((positiveAccels / accelerations.length) * 100)
    : 0;

  return {
    velocity: parseFloat(avgVelocity.toFixed(2)),
    acceleration: parseFloat(avgAcceleration.toFixed(2)),
    gForce: parseFloat(gForce.toFixed(2)),
    confidence,
    currentVolume,
  };
}

export function calculateSnapMetric(data) {
  if (!data || data.length < 5) {
    return { snapScore: 0, acceleration: 0, signal: 'Insufficient Data', signalColor: 'text-slate-500' };
  }

  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  const counts = sorted.map(d => d.count);

  const velocities = counts.slice(1).map((c, i) => c - counts[i]);
  const accels = velocities.slice(1).map((v, i) => v - velocities[i]);
  const jerks = accels.slice(1).map((a, i) => a - accels[i]);

  if (jerks.length === 0 || accels.length === 0 || velocities.length === 0) {
    return { snapScore: 0, acceleration: 0, signal: 'Insufficient Data', signalColor: 'text-slate-500' };
  }

  const latestJerk = jerks[jerks.length - 1];
  const latestAccel = accels[accels.length - 1];
  const latestVelocity = velocities[velocities.length - 1];

  let signal = 'Neutral';
  let signalColor = 'text-slate-400';

  if (latestJerk > 0 && latestAccel > 0) {
    signal = 'Pre-Explosion';
    signalColor = 'text-orange-400';
  } else if (latestJerk < 0 && latestAccel > 0) {
    signal = 'Topping Out';
    signalColor = 'text-amber-400';
  } else if (latestJerk > 0 && latestVelocity < 0) {
    signal = 'Potential Reversal';
    signalColor = 'text-cyan-400';
  } else if (latestJerk < 0 && latestAccel < 0) {
    signal = 'Fading';
    signalColor = 'text-red-400';
  } else if (latestJerk > 0 && latestVelocity > 0) {
    signal = 'Accelerating';
    signalColor = 'text-emerald-400';
  }

  return {
    snapScore: latestJerk,
    acceleration: latestAccel,
    signal,
    signalColor,
  };
}

export function getPredictionLabel(gForce) {
  if (gForce >= 20) return { label: 'IMMINENT BREAKOUT', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/40' };
  if (gForce >= 10) return { label: 'HIGH G-FORCE', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/40' };
  if (gForce >= 5) return { label: 'BUILDING MOMENTUM', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/40' };
  if (gForce > 0) return { label: 'EARLY SIGNAL', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/40' };
  return null;
}
