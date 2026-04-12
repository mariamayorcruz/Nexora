'use client';

import { useState, useEffect } from 'react';

type IntegrationStatus = {
  metaConnected: boolean;
  metaAppId: string;
  aiProvider: string;
  aiConnected: boolean;
};
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
  // Carga estado de integraciones (Meta y AI)
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      setLoadingIntegration(true);
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        const s = data.settings || {};
        // Meta
        const metaConnected = Boolean(s.metaAppId && s.metaAppId.length > 10 && !s.metaAppId.includes('example'));
        // AI
        let aiProvider = '';
        let aiConnected = false;
        if (s.anthropicApiKey && s.anthropicApiKey.length > 10) {
          aiProvider = 'Claude (Anthropic)';
          aiConnected = true;
        } else if (s.openRouterApiKey && s.openRouterApiKey.length > 10) {
          aiProvider = 'OpenRouter';
          aiConnected = true;
        } else if (s.geminiApiKey && s.geminiApiKey.length > 10) {
          aiProvider = 'Gemini';
          aiConnected = true;
        }
        setIntegrationStatus({
          metaConnected,
          metaAppId: s.metaAppId || '',
          aiProvider,
          aiConnected,
        });
      } catch {
        setIntegrationStatus(null);
      } finally {
        setLoadingIntegration(false);
      }
    };
    fetchIntegrationStatus();
  }, []);

export default function SettingsPage() {
  const [sessions, setSessions] = useState<Array<{
    id: string;
    userAgent: string;
    ip: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    current: boolean;
  }>>([]);
  const [sessionsVisible, setSessionsVisible] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [closingSessions, setClosingSessions] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [campaignAlerts, setCampaignAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [offers, setOffers] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [processingPassword, setProcessingPassword] = useState(false);
  const [processingCancelSubscription, setProcessingCancelSubscription] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadNotificationPreferences = (userId: string) => {
    try {
      const raw = localStorage.getItem(`nexora-notifications-${userId}`);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        campaignAlerts?: boolean;
        weeklyReports?: boolean;
      };

      if (typeof parsed.campaignAlerts === 'boolean') setCampaignAlerts(parsed.campaignAlerts);
      if (typeof parsed.weeklyReports === 'boolean') setWeeklyReports(parsed.weeklyReports);
    } catch {
      // Ignore malformed local preference payloads.
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setUser(data.user);
        setProfileName(data.user?.name || '');
        setOffers(Boolean(data.user?.marketingOptIn));
        if (data.user?.id) {
          loadNotificationPreferences(data.user.id);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleSaveProfile = async () => {
    const cleanName = profileName.trim();
    if (!cleanName) {
      showStatus('El nombre no puede estar vacío.');
      return;
    }

    setSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: cleanName }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar el perfil.');
      }

      setUser((current: any) => ({ ...current, name: cleanName }));
      showStatus('Perfil actualizado correctamente.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudo guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user?.id) return;

    setSavingNotifications(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ marketingOptIn: offers }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron guardar preferencias.');
      }

      localStorage.setItem(
        `nexora-notifications-${user.id}`,
        JSON.stringify({ campaignAlerts, weeklyReports })
      );
      setUser((current: any) => ({ ...current, marketingOptIn: offers }));
      showStatus('Preferencias guardadas.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudieron guardar preferencias.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handlePasswordChange = async () => {
    const currentPassword = window.prompt('Escribe tu contraseña actual');
    if (!currentPassword) return;

    const newPassword = window.prompt(
      'Escribe tu nueva contraseña (mínimo 8 caracteres, mayúscula, minúscula y número)'
    );
    if (!newPassword) return;

    setProcessingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cambiar la contraseña.');
      }

      showStatus('Contraseña actualizada correctamente.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setProcessingPassword(false);
    }
  };

  const handleTwoFactor = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showStatus('Tu sesión expiró. Inicia sesión nuevamente.');
      return;
    }

    localStorage.setItem(`nexora-2fa-request-${user?.id || 'anonymous'}`, new Date().toISOString());
    showStatus(
      'Solicitud de activación 2FA registrada. Mientras tanto, mantén contraseña robusta y revisa sesiones activas.'
    );
  };

  const handleSessions = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showStatus('No se detectaron sesiones activas en este navegador.');
      return;
    }

    setSessionsVisible((current) => !current);
    if (!sessionsVisible) {
      void fetchSessions();
    }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cargar las sesiones.');
      }

      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudieron cargar las sesiones.');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCloseOtherSessions = async () => {
    setClosingSessions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/sessions', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cerrar las otras sesiones.');
      }

      await fetchSessions();
      showStatus(`Se cerraron ${Number(data.removed || 0)} sesión(es) en otros dispositivos.`);
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudieron cerrar las otras sesiones.');
    } finally {
      setClosingSessions(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm('Se cancelará tu suscripción al final del período actual. ¿Deseas continuar?');
    if (!confirmed) return;

    setProcessingCancelSubscription(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelSubscription: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cancelar la suscripción.');
      }

      setUser((current: any) => ({
        ...current,
        subscription: data.subscription || current?.subscription,
      }));
      showStatus(data.message || 'Suscripción cancelada al final del período actual.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudo cancelar la suscripción.');
    } finally {
      setProcessingCancelSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500" />
      </div>
    );
  }

  // Sección de estado de integraciones
  const renderIntegrationStatus = () => {
    if (loadingIntegration) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
          <h3 className="mb-2 text-lg font-bold text-white">Integraciones</h3>
          <p className="text-slate-400">Cargando estado de integraciones...</p>
        </div>
      );
    }
    if (!integrationStatus) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
          <h3 className="mb-2 text-lg font-bold text-white">Integraciones</h3>
          <p className="text-rose-400">No se pudo obtener el estado de las integraciones.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 mb-6">
        <h3 className="mb-2 text-lg font-bold text-white">Integraciones</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-300">Meta (Facebook/Instagram)</span>
            {integrationStatus.metaConnected ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">Conectado</span>
            ) : (
              <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-300">No conectado</span>
            )}
            {integrationStatus.metaAppId && (
              <span className="ml-2 text-xs text-slate-500">{integrationStatus.metaAppId}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-300">Proveedor IA</span>
            {integrationStatus.aiConnected ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">{integrationStatus.aiProvider} conectado</span>
            ) : (
              <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-300">No conectado</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-200">
      {renderIntegrationStatus()}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-2xl font-bold text-white">Configuración de Cuenta</h2>
        <p className="mt-2 text-sm text-slate-400">Preferencias personales, notificaciones y seguridad en una sola vista.</p>
      </section>

      {statusMessage ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-200">{statusMessage}</div>
      ) : null}

      {/* Profile Settings */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-6 text-lg font-bold text-white">Información de Perfil</h3>
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">Nombre Completo</label>
            <input
              type="text"
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-400">Email</label>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500">El email no puede ser modificado</p>
          </div>
          <button
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-6 text-lg font-bold text-white">Notificaciones</h3>
        <div className="space-y-4">
          <label className="flex items-center rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-3">
            <input
              type="checkbox"
              checked={campaignAlerts}
              onChange={(event) => setCampaignAlerts(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="ml-3 text-slate-300">Alertas de campañas con bajo rendimiento</span>
          </label>
          <label className="flex items-center rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-3">
            <input
              type="checkbox"
              checked={weeklyReports}
              onChange={(event) => setWeeklyReports(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="ml-3 text-slate-300">Reportes semanales</span>
          </label>
          <label className="flex items-center rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-3">
            <input
              type="checkbox"
              checked={offers}
              onChange={(event) => setOffers(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="ml-3 text-slate-300">Ofertas y promociones</span>
          </label>
          <button
            onClick={() => void handleSaveNotifications()}
            disabled={savingNotifications}
            className="mt-4 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            {savingNotifications ? 'Guardando...' : 'Guardar Preferencias'}
          </button>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="mb-6 text-lg font-bold text-white">Seguridad</h3>
        <div className="space-y-4">
          <button onClick={() => void handlePasswordChange()} className="w-full rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 text-left transition hover:bg-slate-800 disabled:opacity-60" disabled={processingPassword}>
            <p className="font-medium text-white">Cambiar Contraseña</p>
            <p className="text-sm text-slate-400">Actualiza tu contraseña regularmente</p>
          </button>
          <button onClick={handleTwoFactor} className="w-full rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 text-left transition hover:bg-slate-800">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-white">Autenticación de Dos Factores</p>
              <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-300">Solicitar</span>
            </div>
            <p className="text-sm text-slate-400">Registra tu solicitud de activación de 2FA para esta cuenta.</p>
          </button>
          <button onClick={handleSessions} className="w-full rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3 text-left transition hover:bg-slate-800">
            <p className="font-medium text-white">Sesiones Activas</p>
            <p className="text-sm text-slate-400">Gestiona tus sesiones conectadas</p>
          </button>
          {sessionsVisible ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">Dispositivos con sesión</p>
                <button
                  onClick={() => void handleCloseOtherSessions()}
                  disabled={closingSessions}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-200 disabled:opacity-60"
                >
                  {closingSessions ? 'Cerrando...' : 'Cerrar otras sesiones'}
                </button>
              </div>
              {loadingSessions ? (
                <p className="text-xs text-slate-400">Cargando sesiones...</p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-slate-400">No hay sesiones registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-slate-300">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-1">Dispositivo</th>
                        <th className="px-2 py-1">IP</th>
                        <th className="px-2 py-1">Última actividad</th>
                        <th className="px-2 py-1">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id} className="border-t border-slate-800">
                          <td className="px-2 py-2">{session.userAgent}</td>
                          <td className="px-2 py-2">{session.ip}</td>
                          <td className="px-2 py-2">{new Date(session.lastSeenAt).toLocaleString('es-ES')}</td>
                          <td className="px-2 py-2">
                            {session.current ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Actual</span>
                            ) : (
                              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">Otra</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Subscription Action */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h3 className="mb-6 text-lg font-bold text-rose-300">Suscripción</h3>
        <button onClick={() => void handleCancelSubscription()} disabled={processingCancelSubscription} className="rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60">
          {processingCancelSubscription ? 'Cancelando...' : 'Cancelar Suscripción'}
        </button>
        <p className="mt-2 text-sm text-rose-200">Tu cuenta y datos se mantienen. La cancelación aplica al cierre del período vigente.</p>
      </div>
    </div>
  );
}
