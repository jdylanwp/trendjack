import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

const COLUMNS = [
  { id: 'new', title: 'New' },
  { id: 'reviewed', title: 'Reviewed' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'ignored', title: 'Ignored' },
];

export default function KanbanBoard({ leads, onStatusChange }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getLeadsByStatus = useCallback(
    (status) => leads.filter((lead) => lead.status === status),
    [leads]
  );

  const findLead = useCallback(
    (id) => leads.find((lead) => lead.id === id),
    [leads]
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeLeadId = active.id;
      const activeLead = findLead(activeLeadId);
      if (!activeLead) return;

      let targetStatus = null;

      const isColumn = COLUMNS.some((col) => col.id === over.id);
      if (isColumn) {
        targetStatus = over.id;
      } else {
        const overLead = findLead(over.id);
        if (overLead) {
          targetStatus = overLead.status;
        }
      }

      if (targetStatus && targetStatus !== activeLead.status) {
        onStatusChange(activeLeadId, targetStatus);
      }
    },
    [findLead, onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeLead = activeId ? findLead(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            leads={getLeadsByStatus(column.id)}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="rotate-2 scale-105">
            <KanbanCard lead={activeLead} onStatusChange={onStatusChange} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
