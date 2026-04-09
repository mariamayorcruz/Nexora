'use client';

export default function Features() {
  const features = [
    {
      icon: '📊',
      title: 'Dashboard Unificado',
      description: 'Visualiza todas tus campañas de diferentes plataformas en un solo lugar.',
    },
    {
      icon: '🔗',
      title: 'Integraciones Conectadas',
      description: 'Sincroniza con Instagram, Facebook, Google Ads y TikTok de forma segura.',
    },
    {
      icon: '📈',
      title: 'Análisis Profundos',
      description: 'Obtén métricas en tiempo real: ROI, CPC, CTR, conversiones y más.',
    },
    {
      icon: '⚙️',
      title: 'Automatización Inteligente',
      description: 'Automatiza cambios de presupuesto y pausas según reglas personalizadas.',
    },
    {
      icon: '🎯',
      title: 'Segmentación Avanzada',
      description: 'Crea segmentos y auditorías para optimizar tu objetivo de audiencia.',
    },
    {
      icon: '💡',
      title: 'Recomendaciones IA',
      description: 'Recibe sugerencias inteligentes para mejorar el rendimiento de tus anuncios.',
    },
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Características Poderosas</h2>
          <p className="text-xl text-gray-600">Todo lo que necesitas para dominar tus campañas publicitarias</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="card">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
