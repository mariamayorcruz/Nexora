export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  subscription?: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
  };
}

export interface AdAccount {
  id: string;
  platform: 'instagram' | 'facebook' | 'google' | 'tiktok';
  accountName: string;
  accountId: string;
  connected: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  budget: number;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  platform: string;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
