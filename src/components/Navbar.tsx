'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <span className="font-bold text-xl text-gray-900">Nexora</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-600 hover:text-gray-900 transition">
              Características
            </Link>
            <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition">
              Precios
            </Link>
            <Link href="#faq" className="text-gray-600 hover:text-gray-900 transition">
              FAQ
            </Link>
            <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 transition">
              Inicia Sesión
            </Link>
            <Link href="/auth/signup" className="btn-primary">
              Comienza Gratis
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden flex flex-col space-y-1"
          >
            <span className="block w-8 h-0.5 bg-gray-900"></span>
            <span className="block w-8 h-0.5 bg-gray-900"></span>
            <span className="block w-8 h-0.5 bg-gray-900"></span>
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden pb-4 space-y-3">
            <Link href="#features" className="block text-gray-600 hover:text-gray-900">
              Características
            </Link>
            <Link href="#pricing" className="block text-gray-600 hover:text-gray-900">
              Precios
            </Link>
            <Link href="#faq" className="block text-gray-600 hover:text-gray-900">
              FAQ
            </Link>
            <Link href="/auth/login" className="block text-gray-600 hover:text-gray-900">
              Inicia Sesión
            </Link>
            <Link href="/auth/signup" className="block btn-primary w-full text-center">
              Comienza Gratis
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
