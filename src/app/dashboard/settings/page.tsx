'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8">Configuración</h2>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ Cambios guardados exitosamente
        </div>
      )}

      {/* Profile Settings */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Información de Perfil</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
            <input
              type="text"
              defaultValue={user?.name}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-2">El email no puede ser modificado</p>
          </div>
          <button onClick={handleSave} className="btn-primary">
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Notificaciones</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-primary rounded" />
            <span className="ml-3 text-gray-700">Alertas de campañas con bajo rendimiento</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-primary rounded" />
            <span className="ml-3 text-gray-700">Reportes semanales</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="w-4 h-4 text-primary rounded" />
            <span className="ml-3 text-gray-700">Ofertas y promociones</span>
          </label>
          <button onClick={handleSave} className="mt-4 btn-secondary">
            Guardar Preferencias
          </button>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h3 className="text-xl font-bold mb-6">Seguridad</h3>
        <div className="space-y-4">
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <p className="font-medium">Cambiar Contraseña</p>
            <p className="text-sm text-gray-600">Actualiza tu contraseña regularmente</p>
          </button>
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <p className="font-medium">Autenticación de Dos Factores</p>
            <p className="text-sm text-gray-600">Protege tu cuenta con 2FA</p>
          </button>
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            <p className="font-medium">Sesiones Activas</p>
            <p className="text-sm text-gray-600">Gestiona tus sesiones conectadas</p>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8">
        <h3 className="text-xl font-bold text-red-900 mb-6">Zona de Peligro</h3>
        <button className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition">
          Eliminar Cuenta
        </button>
        <p className="text-sm text-red-800 mt-2">Esta acción no se puede deshacer. Todos tus datos serán eliminados permanentemente.</p>
      </div>
    </div>
  );
}
