import { Link } from 'react-router-dom';

export default function EmptyState({ title, description, action, icon: Icon }) {
  return (
    <div className="terminal-card text-center py-16">
      {Icon && (
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-slate-800 rounded-lg">
            <Icon className="text-slate-400" size={48} />
          </div>
        </div>
      )}
      <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Link
          to={action.href}
          className="inline-flex items-center gap-2 terminal-button"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
