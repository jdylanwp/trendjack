import { Crown, ArrowRight } from 'lucide-react';

export default function UpgradePrompt({ feature, currentUsage, limit, targetTier = 'Pro' }) {
  return (
    <div className="terminal-card bg-gradient-to-r from-amber-900/20 to-orange-900/20 border-amber-500/30">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-900/30 rounded-lg flex-shrink-0">
          <Crown className="text-amber-400" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            Upgrade to {targetTier}
          </h3>
          <p className="text-slate-300 text-sm mb-4">
            {feature}
          </p>
          {currentUsage !== undefined && limit !== undefined && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Current Usage</span>
                <span className="text-slate-100 font-semibold">
                  {currentUsage} / {limit}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((currentUsage / limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
          <button
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium rounded-lg transition-all"
            onClick={() => {
              alert('Payment integration coming soon! Contact sales@trendjack.com for early access.');
            }}
          >
            View Plans
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
