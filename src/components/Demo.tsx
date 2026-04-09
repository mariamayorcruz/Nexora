'use client';

export default function Demo() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-dark text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Demo en Vivo</h2>
          <p className="text-xl text-gray-300">Mira cómo funciona Nexora en 3 minutos</p>
        </div>

        <div className="relative">
          <div className="aspect-video bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Nexora Platform Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="font-bold mb-2">Conexión Rápida</h3>
            <p className="text-gray-300">Conecta tus redes en menos de 5 minutos</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-bold mb-2">Análisis Inmediato</h3>
            <p className="text-gray-300">Ve todos tus datos en el dashboard unificado</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="font-bold mb-2">Optimización Automática</h3>
            <p className="text-gray-300">Deja que la IA trabaje por ti</p>
          </div>
        </div>
      </div>
    </section>
  );
}
