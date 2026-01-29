import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

const CRON_SCHEDULES = {
  'Trend Fetch': { cron: '0 * * * *', description: 'Every hour at :00' },
  'Reddit Fetch': { cron: '15 * * * *', description: 'Every hour at :15' },
  'Trend Score': { cron: '30 */2 * * *', description: 'Every 2 hours at :30' },
  'Lead Score': { cron: '45 */2 * * *', description: 'Every 2 hours at :45' }
};

function getNextCronTime(cronExpression) {
  const [minute, hour, , , ] = cronExpression.split(' ');
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();

  let targetMinute = parseInt(minute.replace('*/', ''));
  let targetHour = currentHour;

  if (hour.includes('*/')) {
    const interval = parseInt(hour.replace('*/', ''));
    const nextHourSlot = Math.ceil((currentHour + 1) / interval) * interval;

    if (currentMinute >= targetMinute) {
      targetHour = nextHourSlot;
    } else {
      const currentSlot = Math.floor(currentHour / interval) * interval;
      targetHour = currentSlot;
      if (currentHour > targetHour || (currentHour === targetHour && currentMinute >= targetMinute)) {
        targetHour = nextHourSlot;
      }
    }
  } else if (hour === '*') {
    if (currentMinute >= targetMinute) {
      targetHour = (currentHour + 1) % 24;
    }
  }

  const nextRun = new Date(now);
  nextRun.setUTCHours(targetHour, targetMinute, 0, 0);

  if (nextRun <= now) {
    nextRun.setUTCHours(nextRun.getUTCHours() + (hour.includes('*/2') ? 2 : 1));
  }

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
        All functions run automatically on schedule. No manual triggers needed.
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
                    width: `${Math.max(0, 100 - (data.remaining / (2 * 60 * 60 * 1000)) * 100)}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-slate-900/30 border border-emerald-500/20 rounded-lg">
        <p className="text-xs text-slate-400">
          <span className="text-emerald-400 font-semibold">Cost Protection Active:</span> Duplicate posts are automatically skipped to prevent redundant AI calls.
        </p>
      </div>
    </div>
  );
}
