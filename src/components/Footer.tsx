'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
        <div>
          <Link href="/" className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <span className="font-bold text-xl">Nexora</span>
          </Link>
          <p className="text-gray-400">La plataforma unificada para gestionar todos tus anuncios digitales.</p>
        </div>

        <div>
          <h4 className="font-bold mb-4">Producto</h4>
          <ul className="space-y-2 text-gray-400">
            <li><Link href="#features" className="hover:text-white transition">Características</Link></li>
            <li><Link href="#pricing" className="hover:text-white transition">Precios</Link></li>
            <li><Link href="#" className="hover:text-white transition">Roadmap</Link></li>
            <li><Link href="#" className="hover:text-white transition">API</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4">Compañía</h4>
          <ul className="space-y-2 text-gray-400">
            <li><Link href="#" className="hover:text-white transition">Blog</Link></li>
            <li><Link href="#" className="hover:text-white transition">Sobre Nosotros</Link></li>
            <li><Link href="#" className="hover:text-white transition">Carreras</Link></li>
            <li><Link href="#" className="hover:text-white transition">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4">Legal</h4>
          <ul className="space-y-2 text-gray-400">
            <li><Link href="#" className="hover:text-white transition">Privacidad</Link></li>
            <li><Link href="#" className="hover:text-white transition">Términos</Link></li>
            <li><Link href="#" className="hover:text-white transition">Cookies</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-8 flex justify-between items-center">
        <p className="text-gray-400">&copy; 2024 Nexora. Todos los derechos reservados.</p>
        <div className="flex space-x-4">
          <a href="#" className="text-gray-400 hover:text-white transition">Twitter</a>
          <a href="#" className="text-gray-400 hover:text-white transition">LinkedIn</a>
          <a href="#" className="text-gray-400 hover:text-white transition">Instagram</a>
        </div>
      </div>
    </footer>
  );
}
