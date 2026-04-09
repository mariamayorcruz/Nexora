'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  name: string;
  adAccount: { platform: string; accountName: string };
  budget: number;
  status: string;
  startDate: string;
  analytics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Tus Campañas</h2>
        <button className="btn-primary">+ Nueva Campaña</button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-3xl mb-4">📭</p>
          <p className="text-gray-600 mb-6">No tienes campañas aún</p>
          <button className="btn-primary">Crear Primera Campaña</button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="card flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                <p className="text-sm text-gray-600">
                  {campaign.adAccount?.platform} • {campaign.adAccount?.accountName}
                </p>
                <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Presupuesto</p>
                    <p className="font-bold">${campaign.budget}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Impresiones</p>
                    <p className="font-bold">{campaign.analytics?.impressions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Clicks</p>
                    <p className="font-bold">{campaign.analytics?.clicks || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Conversiones</p>
                    <p className="font-bold">{campaign.analytics?.conversions || 0}</p>
                  </div>
                </div>
              </div>
              <div className="ml-4 text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  campaign.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : campaign.status === 'paused'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {campaign.status === 'active' ? '▶ Activa' : campaign.status === 'paused' ? '⏸ Pausada' : '✓ Completada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
