'use client';

import Link from 'next/link';

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
            <Link href="/auth/signup" className="btn-primary text-center">
              Comienza tu prueba gratis
            </Link>
            <Link href="#demo" className="btn-outline bg-transparent hover:bg-white hover:text-dark text-center">
              Ver demo
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-6">✓ 7 días de prueba gratis • ✓ Sin tarjeta requerida • ✓ Acceso completo</p>
        </div>

        <div className="lg:w-1/2 mt-12 lg:mt-0 animate-slideInRight">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-3xl opacity-20"></div>
            <div className="relative bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-400">Dashboard</div>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-900 border border-gray-700 p-3">
                    <p className="text-xs text-gray-400">ROI Global</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">+38%</p>
                  </div>
                  <div className="rounded-xl bg-gray-900 border border-gray-700 p-3">
                    <p className="text-xs text-gray-400">Gasto Hoy</p>
                    <p className="text-xl font-bold text-cyan-400 mt-1">$1,240</p>
                  </div>
                </div>

                <div className="rounded-xl bg-gray-900 border border-gray-700 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Campañas activas</span>
                    <span className="text-gray-300">12 en ejecución</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full w-[78%] bg-cyan-400"></div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full w-[62%] bg-emerald-400"></div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div className="h-full w-[89%] bg-indigo-400"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="h-10 rounded-lg bg-gray-700/60"></div>
                  <div className="h-10 rounded-lg bg-gray-700/50"></div>
                  <div className="h-10 rounded-lg bg-gray-700/40"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
