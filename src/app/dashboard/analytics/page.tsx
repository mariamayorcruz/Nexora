'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  averageROI: number;
  averageCTR: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalSpend: 0,
    averageROI: 0,
    averageCTR: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setAnalytics({
        totalImpressions: 125000,
        totalClicks: 3500,
        totalConversions: 450,
        totalSpend: 2150,
        averageROI: 2.8,
        averageCTR: 2.8,
      });
      setLoading(false);
    }, 1000);
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
      <h2 className="text-3xl font-bold mb-8">Analíticas</h2>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Impresiones Totales</p>
          <p className="text-4xl font-bold text-primary">{analytics.totalImpressions.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">↑ 12% vs. mes anterior</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Clicks Totales</p>
          <p className="text-4xl font-bold text-primary">{analytics.totalClicks.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">CTR: {analytics.averageCTR}%</p>
        </div>
        <div className="card">
          <p className="text-gray-600 text-sm mb-2">Conversiones</p>
          <p className="text-4xl font-bold text-green-600">{analytics.totalConversions}</p>
          <p className="text-xs text-gray-500 mt-2">Tasa: 12.9%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-bold mb-6">Gasto y ROI</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 text-sm">Gasto Total</p>
              <p className="text-3xl font-bold">${analytics.totalSpend.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">ROI Promedio</p>
              <p className="text-3xl font-bold text-green-600">{analytics.averageROI.toFixed(1)}x</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-bold mb-6">Por Plataforma</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">📷 Instagram</span>
              <span className="text-sm text-gray-600">$850</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">f Facebook</span>
              <span className="text-sm text-gray-600">$750</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">🔍 Google</span>
              <span className="text-sm text-gray-600">$400</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">♪ TikTok</span>
              <span className="text-sm text-gray-600">$150</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-900 text-sm">
          📊 <span className="font-bold">Dato interesante:</span> Tu ROI promedio está 2.3x por encima de la industria. ¡Sigue así!
        </p>
      </div>
    </div>
  );
}
