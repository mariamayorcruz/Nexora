'use client';

import { useCallback, useEffect, useState } from 'react';

export type AutomationConfig = {
  id: string;
  userId: string;
  whatsappPhoneNumberId: string | null;
  whatsappAccessToken: string | null;
  metaAdsAccountId: string | null;
  metaAdsToken: string | null;
  openPhoneApiKey: string | null;
  openPhoneNumberId: string | null;
  whatsappConnected: boolean;
  metaConnected: boolean;
  openPhoneConnected: boolean;
  instagramConnected: boolean;
  businessName: string | null;
  welcomeMessage: string | null;
  qualificationPrompt: string | null;
  aiTone: string;
  language: string;
  hotLeadAction: string;
  warmLeadAction: string;
  coldLeadAction: string;
  followupDays: number;
  automationActive: boolean;
  n8nWebhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationConfigInput = Partial<
  Pick<
    AutomationConfig,
    | 'whatsappPhoneNumberId'
    | 'whatsappAccessToken'
    | 'metaAdsAccountId'
    | 'metaAdsToken'
    | 'openPhoneApiKey'
    | 'openPhoneNumberId'
    | 'whatsappConnected'
    | 'metaConnected'
    | 'openPhoneConnected'
    | 'instagramConnected'
    | 'businessName'
    | 'welcomeMessage'
    | 'qualificationPrompt'
    | 'aiTone'
    | 'language'
    | 'hotLeadAction'
    | 'warmLeadAction'
    | 'coldLeadAction'
    | 'followupDays'
    | 'automationActive'
    | 'n8nWebhookUrl'
  >
>;

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useAutomationConfig() {
  const [data, setData] = useState<AutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/automation/config', {
        headers: getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load automation config');
      }

      setData(payload.config);
      return payload.config as AutomationConfig | null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load automation config';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (updates: AutomationConfigInput) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/automation/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update automation config');
      }

      setData(payload.config);
      return payload.config as AutomationConfig;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update automation config';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    loading,
    error,
    data,
    updateConfig,
    refetch: fetchConfig,
  };
}
