import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    } else {
      setSubscription(null);
      setLimits(null);
      setLoading(false);
    }
  }, [user]);

  const fetchSubscriptionData = async () => {
    try {
      const [tiersRes, limitsRes] = await Promise.all([
        supabase.from('subscription_tiers').select('*').order('sort_order'),
        supabase.rpc('get_user_tier_limits')
      ]);

      if (tiersRes.data) {
        setTiers(tiersRes.data);
      }

      if (limitsRes.data && limitsRes.data.length > 0) {
        setLimits(limitsRes.data[0]);
      }

      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('user_id', user.id)
        .maybeSingle();

      setSubscription(subData);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshLimits = async () => {
    try {
      const { data } = await supabase.rpc('get_user_tier_limits');
      if (data && data.length > 0) {
        setLimits(data[0]);
      }
    } catch (error) {
      console.error('Error refreshing limits:', error);
    }
  };

  const canAddKeyword = () => {
    if (!limits) return false;
    return limits.current_keywords < limits.max_keywords;
  };

  const canPerformAIAnalysis = () => {
    if (!limits) return false;
    return limits.current_ai_analyses < limits.max_ai_analyses_per_month;
  };

  const canPerformManualRun = () => {
    if (!limits) return false;
    return limits.current_manual_runs < limits.max_manual_runs_per_month;
  };

  const getUsagePercentage = (type) => {
    if (!limits) return 0;

    switch (type) {
      case 'keywords':
        return (limits.current_keywords / limits.max_keywords) * 100;
      case 'ai_analyses':
        return (limits.current_ai_analyses / limits.max_ai_analyses_per_month) * 100;
      case 'leads':
        return (limits.current_leads / limits.max_leads_per_month) * 100;
      case 'manual_runs':
        return (limits.current_manual_runs / limits.max_manual_runs_per_month) * 100;
      default:
        return 0;
    }
  };

  const trackUsage = async (type) => {
    try {
      await supabase.rpc('increment_usage', { p_usage_type: type });
      await refreshLimits();
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  };

  const value = {
    subscription,
    tiers,
    limits,
    loading,
    canAddKeyword,
    canPerformAIAnalysis,
    canPerformManualRun,
    getUsagePercentage,
    trackUsage,
    refreshLimits,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
