import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

const CRON_SCHEDULES = {
  'Trend Fetch': { cron: '*/10 * * * *', description: 'Every 10 minutes' },
  'Reddit Fetch': { cron: '5,15,25,35,45,55 * * * *', description: 'Every 10 minutes (offset)' },
  'Trend Score': { cron: '*/30 * * * *', description: 'Every 30 minutes' },
  'Lead Score': { cron: '15,45 * * * *', description: 'Every 30 minutes (offset)' }
};

function getNextCronTime(cronExpression) {
  const [minute, hour, , , ] = cronExpression.split(' ');
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();

  let targetMinutes = [];

  if (minute.includes(',')) {
    targetMinutes = minute.split(',').map(m => parseInt(m));
  } else if (minute.includes('*/')) {
    const interval = parseInt(minute.replace('*/', ''));
    for (let i = 0; i < 60; i += interval) {
      targetMinutes.push(i);
    }
  } else if (minute === '*') {
    targetMinutes = Array.from({ length: 60 }, (_, i) => i);
  } else {
    targetMinutes = [parseInt(minute)];
  }

  const nextRun = new Date(now);
  nextRun.setUTCSeconds(0, 0);

  for (const targetMinute of targetMinutes.sort((a, b) => a - b)) {
    if (targetMinute > currentMinute) {
      nextRun.setUTCMinutes(targetMinute);
      return nextRun;
    }
  }

  nextRun.setUTCHours(currentHour + 1);
  nextRun.setUTCMinutes(targetMinutes[0]);

  return nextRun;
}

function formatTimeRemaining(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export default function CronTimer() {
  const [timers, setTimers] = useState({});

  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();
      const newTimers = {};

      Object.entries(CRON_SCHEDULES).forEach(([name, config]) => {
        const nextRun = getNextCronTime(config.cron);
        const remaining = nextRun - now;
        newTimers[name] = {
          nextRun,
          remaining,
          description: config.description
        };
      });

      setTimers(newTimers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="terminal-card bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-emerald-500/20">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="text-emerald-400" size={20} />
        <h3 className="text-lg font-semibold text-slate-100">Automated Updates</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Functions process keywords in batches every 10-30 minutes. Your keywords cycle through automatically.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(timers).map(([name, data]) => (
          <div
            key={name}
            className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-slate-200">{name}</p>
                <p className="text-xs text-slate-500">{data.description}</p>
              </div>
              <Clock className="text-emerald-400 flex-shrink-0" size={16} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-400">Next in:</span>
              <span className="text-sm font-mono font-semibold text-emerald-400">
                {formatTimeRemaining(data.remaining)}
              </span>
            </div>
            <div className="mt-1">
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
                  style={{
                    width: `${Math.max(0, 100 - (data.remaining / (30 * 60 * 1000)) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-slate-900/30 border border-emerald-500/20 rounded-lg">
        <p className="text-xs text-slate-400">
          <span className="text-emerald-400 font-semibold">Smart Processing:</span> Usage limits enforced automatically. Duplicate analysis prevented to protect costs.
        </p>
      </div>
    </div>
  );
}
