import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRealtimeSubscription } from './useRealtimeSubscription';

function getLeadPriority(lead) {
  const fury = lead.fury_score || 0;
  const intent = lead.intent_score || 0;

  if (intent >= 85 && fury >= 75) return 'red_zone';
  if (intent >= 85) return 'high_intent';
  if (fury >= 75) return 'high_fury';
  return 'standard';
}

function formatNotification(lead) {
  const priority = getLeadPriority(lead);
  const painPoint = lead.pain_point
    ? lead.pain_point.substring(0, 80) + (lead.pain_point.length > 80 ? '...' : '')
    : 'New opportunity detected';

  switch (priority) {
    case 'red_zone':
      return {
        title: 'RED ZONE Lead Detected',
        description: painPoint,
        type: 'error',
      };
    case 'high_intent':
      return {
        title: 'High Intent Lead',
        description: painPoint,
        type: 'success',
      };
    case 'high_fury':
      return {
        title: 'High Fury Lead',
        description: painPoint,
        type: 'warning',
      };
    default:
      return {
        title: 'New Lead',
        description: painPoint,
        type: 'info',
      };
  }
}

export function useLeadNotifications() {
  const handleNewLead = useCallback((newRecord) => {
    const notification = formatNotification(newRecord);

    switch (notification.type) {
      case 'error':
        toast.error(notification.title, {
          description: notification.description,
          duration: 8000,
        });
        break;
      case 'success':
        toast.success(notification.title, {
          description: notification.description,
          duration: 6000,
        });
        break;
      case 'warning':
        toast.warning(notification.title, {
          description: notification.description,
          duration: 6000,
        });
        break;
      default:
        toast.info(notification.title, {
          description: notification.description,
          duration: 5000,
        });
    }
  }, []);

  useRealtimeSubscription('leads', {
    event: 'INSERT',
    onInsert: handleNewLead,
  });
}
