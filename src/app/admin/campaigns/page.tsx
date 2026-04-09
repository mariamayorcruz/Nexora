'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Play, Pause, Square } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  user: {
    name: string;
    email: string;
  };
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/admin/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (campaignId: string, action: string) => {
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchCampaigns(); // Refresh the list
      }
    } catch (error) {
      console.error('Error performing campaign action:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      paused: 'secondary',
      stopped: 'destructive',
      draft: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campaign Management</h1>
        <div className="text-sm text-muted-foreground">
          Total Campaigns: {campaigns.length}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-sm text-muted-foreground">ID: {campaign.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{campaign.platform}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{campaign.user.name}</div>
                      <div className="text-sm text-muted-foreground">{campaign.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>${campaign.budget}</TableCell>
                  <TableCell>${campaign.spent}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Impressions: {campaign.impressions.toLocaleString()}</div>
                      <div>Clicks: {campaign.clicks.toLocaleString()}</div>
                      <div>Conversions: {campaign.conversions}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(campaign.id, 'view')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {campaign.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(campaign.id, 'pause')}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(campaign.id, 'resume')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(campaign.id, 'stop')}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
