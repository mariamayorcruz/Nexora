'use client';

import { useState, useEffect } from 'react';

type IntegrationStatus = {
  metaConnected: boolean;
  metaAppId: string;
  aiProvider: string;
  aiConnected: boolean;
};

export default function SettingsPage() {
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);
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
      const parsed = JSON.parse(raw) as { campaignAlerts?: boolean; weeklyReports?: boolean };
      if (typeof parsed.campaignAlerts === 'boolean') setCampaignAlerts(parsed.campaignAlerts);
      if (typeof parsed.weeklyReports === 'boolean') setWeeklyReports(parsed.weeklyReports);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      setLoadingIntegration(true);
      try {
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        const s = data.settings || {};
        const metaConnected = Boolean(s.metaAppId && s.metaAppId.length > 10 && !s.metaAppId.includes('example'));
        let aiProvider = '';
        let aiConnected = false;
        if (s.anthropicApiKey && s.anthropicApiKey.length > 10) { aiProvider = 'Claude (Anthropic)'; aiConnected = true; }
        else if (s.openRouterApiKey && s.openRouterApiKey.length > 10) { aiProvider = 'OpenRouter'; aiConnected = true; }
        else if (s.geminiApiKey && s.geminiApiKey.length > 10) { aiProvider = 'Gemini'; aiConnected = true; }
        setIntegrationStatus({ metaConnected, metaAppId: s.metaAppId || '', aiProvider, aiConnected });
      } catch {
        setIntegrationStatus(null);
      } finally {
        setLoadingIntegration(false);
      }
    };

    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        setUser(data.user);
        setProfileName(data.user?.name || '');
        setOffers(Boolean(data.user?.marketingOptIn));
        if (data.user?.id) loadNotificationPreferences(data.user.id);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchIntegrationStatus();
    void fetchUser();
  }, []);

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleSaveProfile = async () => {
    const cleanName = profileName.trim();
    if (!cleanName) { showStatus('El nombre no puede estar vacío.'); return; }
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el perfil.');
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
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketingOptIn: offers }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudieron guardar preferencias.');
      localStorage.setItem(`nexora-notifications-${user.id}`, JSON.stringify({ campaignAlerts, weeklyReports }));
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
    const newPassword = window.prompt('Escribe tu nueva contraseña (mínimo 8 caracteres, mayúscula, minúscula y número)');
    if (!newPassword) return;
    setProcessingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
      showStatus('Contraseña actualizada correctamente.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setProcessingPassword(false);
    }
  };

  const handleTwoFactor = () => {
    const token = localStorage.getItem('token');
    if (!token) { showStatus('Tu sesión expiró. Inicia sesión nuevamente.'); return; }
    localStorage.setItem(`nexora-2fa-request-${user?.id || 'anonymous'}`, new Date().toISOString());
    showStatus('Solicitud de activación 2FA registrada. Mantén contraseña robusta y revisa sesiones activas.');
  };

  const handleSessions = () => {
    const token = localStorage.getItem('token');
    if (!token) { showStatus('No se detectaron sesiones activas en este navegador.'); return; }
    setSessionsVisible((current) => !current);
    if (!sessionsVisible) void fetchSessions();
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/sessions', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar las sesiones.');
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
      const response = await fetch('/api/users/sessions', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudieron cerrar las otras sesiones.');
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
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelSubscription: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo cancelar la suscripción.');
      setUser((current: any) => ({ ...current, subscription: data.subscription || current?.subscription }));
      showStatus(data.message || 'Suscripción cancelada al final del período actual.');
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'No se pudo cancelar la suscripción.');
    } finally {
      setProcessingCancelSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-b-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[#040810] px-6 py-7 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">✦ Configuración</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">
          Configuración de Cuenta
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Preferencias personales, notificaciones y seguridad en una sola vista.
        </p>
      </section>

      {statusMessage && (
        <div className="rounded-[22px] bg-cyan-500/10 p-4 text-sm text-cyan-300">
          {statusMessage}
        </div>
      )}

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Integraciones</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Conexiones activas</h2>
        {loadingIntegration ? (
          <p className="mt-4 text-sm text-slate-400">Cargando estado de integraciones...</p>
        ) : !integrationStatus ? (
          <p className="mt-4 text-sm text-rose-400">No se pudo obtener el estado de las integraciones.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-[22px] bg-[#030610] px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">Meta (Facebook / Instagram)</p>
                {integrationStatus.metaAppId && (
                  <p className="mt-0.5 text-xs text-slate-500">{integrationStatus.metaAppId}</p>
                )}
              </div>
              {integrationStatus.metaConnected ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">Conectado</span>
              ) : (
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">No conectado</span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-[22px] bg-[#030610] px-5 py-4">
              <p className="text-sm font-medium text-white">Proveedor IA</p>
              {integrationStatus.aiConnected ? (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{integrationStatus.aiProvider} conectado</span>
              ) : (
                <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">No conectado</span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Perfil</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Información de Perfil</h2>
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Nombre completo</span>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full rounded-2xl bg-[#030610] px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Email</span>
            <input
              type="email"
              defaultValue={user?.email}
              disabled
              className="w-full cursor-not-allowed rounded-2xl bg-[#030610] px-4 py-3 text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">El email no puede ser modificado</p>
          </label>
          <button
            onClick={() => void handleSaveProfile()}
            disabled={savingProfile}
            className="rounded-[18px] bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
          >
            {savingProfile ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Notificaciones</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Preferencias</h2>
        <div className="mt-6 space-y-3">
          {[
            { label: 'Alertas de campañas con bajo rendimiento', checked: campaignAlerts, onChange: setCampaignAlerts },
            { label: 'Reportes semanales', checked: weeklyReports, onChange: setWeeklyReports },
            { label: 'Ofertas y promociones', checked: offers, onChange: setOffers },
          ].map(({ label, checked, onChange }) => (
            <label key={label} className="flex cursor-pointer items-center gap-4 rounded-[22px] bg-[#030610] px-5 py-4">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 rounded accent-cyan-400"
              />
              <span className="text-sm text-slate-300">{label}</span>
            </label>
          ))}
          <button
            onClick={() => void handleSaveNotifications()}
            disabled={savingNotifications}
            className="rounded-[18px] bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-[#041018] transition-all duration-150 hover:-translate-y-[1px] hover:bg-cyan-400 disabled:opacity-50"
          >
            {savingNotifications ? 'Guardando...' : 'Guardar preferencias'}
          </button>
        </div>
      </section>

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Seguridad</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Acceso y privacidad</h2>
        <div className="mt-6 space-y-3">
          <button
            onClick={() => void handlePasswordChange()}
            disabled={processingPassword}
            className="w-full rounded-[22px] bg-[#030610] px-5 py-4 text-left transition-all duration-150 hover:bg-white/[0.04] disabled:opacity-50"
          >
            <p className="text-sm font-semibold text-white">Cambiar Contraseña</p>
            <p className="mt-0.5 text-xs text-slate-400">Actualiza tu contraseña regularmente</p>
          </button>
          <button
            onClick={handleTwoFactor}
            className="w-full rounded-[22px] bg-[#030610] px-5 py-4 text-left transition-all duration-150 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Autenticación de Dos Factores</p>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">Solicitar</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Registra tu solicitud de activación de 2FA para esta cuenta.</p>
          </button>
          <button
            onClick={handleSessions}
            className="w-full rounded-[22px] bg-[#030610] px-5 py-4 text-left transition-all duration-150 hover:bg-white/[0.04]"
          >
            <p className="text-sm font-semibold text-white">Sesiones Activas</p>
            <p className="mt-0.5 text-xs text-slate-400">Gestiona tus sesiones conectadas</p>
          </button>

          {sessionsVisible && (
            <div className="rounded-[22px] bg-[#030610] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">Dispositivos con sesión</p>
                <button
                  onClick={() => void handleCloseOtherSessions()}
                  disabled={closingSessions}
                  className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 disabled:opacity-50"
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
                        <tr key={session.id} className="border-t border-white/6">
                          <td className="px-2 py-2">{session.userAgent}</td>
                          <td className="px-2 py-2">{session.ip}</td>
                          <td className="px-2 py-2">{new Date(session.lastSeenAt).toLocaleString('es-ES')}</td>
                          <td className="px-2 py-2">
                            {session.current ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Actual</span>
                            ) : (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Otra</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] bg-[#040810] p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-rose-400">Zona de peligro</p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-white">Cancelar Suscripción</h2>
        <p className="mt-2 text-sm text-slate-400">Tu cuenta y datos se mantienen. La cancelación aplica al cierre del período vigente.</p>
        <button
          onClick={() => void handleCancelSubscription()}
          disabled={processingCancelSubscription}
          className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-6 py-3 text-sm font-semibold text-rose-300 transition hover:border-rose-400/40 hover:text-rose-200 disabled:opacity-50"
        >
          {processingCancelSubscription ? 'Cancelando...' : 'Cancelar Suscripción'}
        </button>
      </section>
    </div>
  );
}
