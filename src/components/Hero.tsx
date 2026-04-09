'use client';

export default function Hero() {
  return (
    <section className="min-h-screen bg-gradient-dark text-white pt-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between py-20">
        <div className="lg:w-1/2 animate-fadeInUp">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Gestiona todos tus anuncios
            <span className="text-transparent bg-clip-text bg-gradient-primary"> en un lugar</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Conecta Instagram, Facebook, Google y TikTok Ads. Optimiza tus campañas, analiza resultados y maximiza tu ROI desde una única plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="btn-primary">
              Comienza tu prueba gratis
            </button>
            <button className="btn-outline bg-transparent hover:bg-white hover:text-dark">
              Ver demo
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-6">✓ 14 días de prueba gratis • ✓ Sin tarjeta requerida • ✓ Acceso completo</p>
        </div>

        <div className="lg:w-1/2 mt-12 lg:mt-0 animate-slideInRight">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-3xl opacity-20"></div>
            <div className="relative bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-400">Dashboard</div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="h-16 bg-gray-700 rounded"></div>
                    <div className="h-16 bg-gray-700 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
