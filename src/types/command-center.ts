export type CommandPlatform = 'meta' | 'google' | 'tiktok';

export interface UnifiedCampaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'review' | 'ended';
  channel: {
    platform: CommandPlatform;
    accountName: string;
    accountId: string;
    avatar?: string;
  };
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
    cpa: number;
  };
  creative: {
    type: 'video' | 'image' | 'carousel';
    thumbnail: string | null;
    studioProjectId?: string;
  };
  budget: {
    daily: number;
    total: number;
    spent: number;
    remaining: number;
  };
  schedule: {
    start: string;
    end: string;
  };
  actions: Array<'pause' | 'resume' | 'duplicate' | 'edit' | 'delete'>;
}

export interface ConnectedChannel {
  id: string;
  platform: CommandPlatform;
  accountName: string;
  accountId: string;
  connected: boolean;
  spendToday: number;
  activeCampaigns: number;
}

export interface UnifiedStatsResponse {
  campaigns: UnifiedCampaign[];
  channels: ConnectedChannel[];
  totals: {
    spendToday: number;
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
    cpa: number;
  };
}
