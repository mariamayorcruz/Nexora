'use client';

import { useState } from 'react';

export default function ConnectPage() {
  const [connecting, setConnecting] = useState<string | null>(null);

  const platforms = [
    {
      name: 'Instagram Ads',
      icon: '📷',
      description: 'Sincroniza tus campañas de Instagram y Facebook',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Facebook Ads',
      icon: 'f',
      description: 'Gestiona tus anuncios de Facebook',
      color: 'from-blue-600 to-blue-400',
    },
    {
      name: 'Google Ads',
      icon: '🔍',
      description: 'Conecta con Google Ads y optimiza tus campañas',
      color: 'from-red-500 to-yellow-500',
    },
    {
      name: 'TikTok Ads',
      icon: '♪',
      description: 'Lanza campañas en TikTok directamente',
      color: 'from-gray-900 to-gray-700',
    },
  ];

  const handleConnect = (platform: string) => {
    setConnecting(platform);
    // Aquí iría la lógica OAuth para cada plataforma
    setTimeout(() => {
      alert(`Integración con ${platform} será implementada soon. Ahora redireccionando a OAuth...`);
      setConnecting(null);
    }, 1500);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-2">Conectar Redes Publicitarias</h2>
      <p className="text-gray-600 mb-8">Autoriza el acceso a tus cuentas publicitarias para comenzar a gestionar tus campañas</p>

      <div className="grid md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <div key={platform.name} className="card">
            <div className={`inline-block w-12 h-12 rounded-lg bg-gradient-to-r ${platform.color} text-white text-2xl flex items-center justify-center mb-4`}>
              {platform.icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{platform.name}</h3>
            <p className="text-gray-600 mb-6">{platform.description}</p>
            <button
              onClick={() => handleConnect(platform.name)}
              disabled={connecting === platform.name}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {connecting === platform.name ? 'Conectando...' : 'Conectar Ahora'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h4 className="font-bold text-amber-900 mb-2">⚠️ Importante</h4>
        <p className="text-amber-800 text-sm">
          Nexora nunca almacena tus contraseñas. Usamos OAuth 2.0 para establecer conexiones seguras. Solo necesitamos permisos para leer tus campañas y datos de análisis.
        </p>
      </div>
    </div>
  );
}
