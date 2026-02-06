import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

const COLUMN_STYLES = {
  new: {
    border: 'border-emerald-700/50',
    badge: 'bg-emerald-900/30 text-emerald-400 border-emerald-700',
    dot: 'bg-emerald-400',
  },
  reviewed: {
    border: 'border-blue-700/50',
    badge: 'bg-blue-900/30 text-blue-400 border-blue-700',
    dot: 'bg-blue-400',
  },
  contacted: {
    border: 'border-amber-700/50',
    badge: 'bg-amber-900/30 text-amber-400 border-amber-700',
    dot: 'bg-amber-400',
  },
  ignored: {
    border: 'border-slate-600/50',
    badge: 'bg-slate-700 text-slate-400 border-slate-600',
    dot: 'bg-slate-400',
  },
};

export default function KanbanColumn({ id, title, leads, onStatusChange }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const style = COLUMN_STYLES[id] || COLUMN_STYLES.new;
  const leadIds = leads.map((l) => l.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[400px] rounded-xl border ${style.border} ${
        isOver ? 'bg-slate-700/30 ring-2 ring-emerald-500/30' : 'bg-slate-800/50'
      } transition-all duration-200`}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <span className={`px-2 py-0.5 text-xs font-bold rounded border ${style.badge}`}>
          {leads.length}
        </span>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard key={lead.id} lead={lead} onStatusChange={onStatusChange} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}
