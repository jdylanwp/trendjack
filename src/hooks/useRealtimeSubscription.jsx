import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSubscription(table, { event = '*', filter, onInsert, onUpdate, onDelete }) {
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });

  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  });

  useEffect(() => {
    const channelName = `realtime-${table}-${event}-${filter || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT' && callbacksRef.current.onInsert) {
            callbacksRef.current.onInsert(newRecord);
          } else if (eventType === 'UPDATE' && callbacksRef.current.onUpdate) {
            callbacksRef.current.onUpdate(newRecord, oldRecord);
          } else if (eventType === 'DELETE' && callbacksRef.current.onDelete) {
            callbacksRef.current.onDelete(oldRecord);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter]);
}
