'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  buildTenantHeaders,
  clearStoredOrganizationId,
  isOrganizationSelectionRequired,
  isTenantAccessDenied,
  readStoredOrganizationId,
  resolveClientOrganizationSelection,
  writeStoredOrganizationId,
  type ClientOrganization,
} from '@/lib/tenancy/client-organization-selection';

export type TenantOrganizationStatus =
  | 'loading'
  | 'ready'
  | 'selection_required'
  | 'no_organization'
  | 'unauthenticated'
  | 'error';

type TenantOrganizationContextValue = {
  status: TenantOrganizationStatus;
  organizations: ClientOrganization[];
  selectedOrganization: ClientOrganization | null;
  selectedOrganizationId: string | null;
  /** True when tenant-scoped APIs may be called with a validated org. */
  selectionReady: boolean;
  /** Increments on org switch — use as remount/refetch key. */
  organizationEpoch: number;
  errorMessage: string | null;
  selectOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
  getTenantHeaders: (additionalHeaders?: HeadersInit) => Record<string, string> | null;
  /**
   * Handle tenant 409/403 from API responses.
   * Returns true when the caller should stop (selection reset / no org).
   * Never clears the auth token for ORGANIZATION_SELECTION_REQUIRED.
   */
  handleTenantResponse: (status: number, payload: unknown) => boolean;
  clearOrganizationPreferenceOnLogout: () => void;
};

const TenantOrganizationContext = createContext<TenantOrganizationContextValue | null>(null);

function normalizeOrganizations(raw: unknown): ClientOrganization[] {
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { organizations?: unknown }).organizations;
  if (!Array.isArray(list)) return [];
  const roles = new Set(['OWNER', 'ADMIN', 'MEMBER']);
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id || '').trim();
      const name = String(row.name || '').trim();
      const slug = String(row.slug || '').trim();
      const role = String(row.role || '').trim().toUpperCase();
      if (!id || !name || !slug || !roles.has(role)) return null;
      return {
        id,
        name,
        slug,
        role: role as ClientOrganization['role'],
      };
    })
    .filter((item): item is ClientOrganization => Boolean(item));
}

export function TenantOrganizationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TenantOrganizationStatus>('loading');
  const [organizations, setOrganizations] = useState<ClientOrganization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [organizationEpoch, setOrganizationEpoch] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applySelection = useCallback((orgs: ClientOrganization[], stored: string | null) => {
    const resolved = resolveClientOrganizationSelection(orgs, stored);
    if (resolved.discardedStalePreference) {
      clearStoredOrganizationId();
    }

    if (orgs.length === 0) {
      setSelectedOrganizationId(null);
      setStatus('no_organization');
      return;
    }

    if (resolved.selectedOrganizationId) {
      writeStoredOrganizationId(resolved.selectedOrganizationId);
      setSelectedOrganizationId(resolved.selectedOrganizationId);
      setStatus('ready');
      return;
    }

    setSelectedOrganizationId(null);
    setStatus('selection_required');
  }, []);

  const refreshOrganizations = useCallback(async () => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!token) {
      setOrganizations([]);
      setSelectedOrganizationId(null);
      setStatus('unauthenticated');
      return;
    }

    setErrorMessage(null);
    try {
      const response = await fetch('/api/tenant/organizations', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (response.status === 401) {
        setOrganizations([]);
        setSelectedOrganizationId(null);
        setStatus('unauthenticated');
        return;
      }

      if (!response.ok) {
        setErrorMessage('Unable to load workspaces');
        setStatus('error');
        return;
      }

      const payload = await response.json().catch(() => null);
      const orgs = normalizeOrganizations(payload);
      setOrganizations(orgs);
      applySelection(orgs, readStoredOrganizationId());
    } catch {
      setErrorMessage('Unable to load workspaces');
      setStatus('error');
    }
  }, [applySelection]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  const selectOrganization = useCallback(
    (organizationId: string) => {
      const trimmed = String(organizationId || '').trim();
      if (!trimmed) return;
      const match = organizations.find((org) => org.id === trimmed);
      if (!match) return;
      writeStoredOrganizationId(match.id);
      setSelectedOrganizationId((previous) => {
        if (previous !== match.id) {
          setOrganizationEpoch((epoch) => epoch + 1);
        }
        return match.id;
      });
      setStatus('ready');
      setErrorMessage(null);
    },
    [organizations]
  );

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId) || null,
    [organizations, selectedOrganizationId]
  );

  const selectionReady = status === 'ready' && Boolean(selectedOrganizationId);

  const getTenantHeaders = useCallback(
    (additionalHeaders?: HeadersInit) => {
      if (typeof window === 'undefined') return null;
      const token = window.localStorage.getItem('token');
      if (!token || !selectionReady || !selectedOrganizationId) return null;
      return buildTenantHeaders({
        token,
        organizationId: selectedOrganizationId,
        additionalHeaders,
      });
    },
    [selectionReady, selectedOrganizationId]
  );

  const handleTenantResponse = useCallback(
    (responseStatus: number, payload: unknown) => {
      const code =
        payload && typeof payload === 'object' && 'code' in payload
          ? (payload as { code?: unknown }).code
          : null;

      if (isOrganizationSelectionRequired(responseStatus, code)) {
        clearStoredOrganizationId();
        setSelectedOrganizationId(null);
        setStatus((current) =>
          organizations.length > 1 ? 'selection_required' : current === 'ready' ? 'selection_required' : current
        );
        if (organizations.length > 1) {
          setStatus('selection_required');
        } else {
          void refreshOrganizations();
        }
        return true;
      }

      if (isTenantAccessDenied(responseStatus, code)) {
        clearStoredOrganizationId();
        setSelectedOrganizationId(null);
        void refreshOrganizations();
        return true;
      }

      return false;
    },
    [organizations.length, refreshOrganizations]
  );

  const clearOrganizationPreferenceOnLogout = useCallback(() => {
    clearStoredOrganizationId();
    setSelectedOrganizationId(null);
    setOrganizations([]);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<TenantOrganizationContextValue>(
    () => ({
      status,
      organizations,
      selectedOrganization,
      selectedOrganizationId,
      selectionReady,
      organizationEpoch,
      errorMessage,
      selectOrganization,
      refreshOrganizations,
      getTenantHeaders,
      handleTenantResponse,
      clearOrganizationPreferenceOnLogout,
    }),
    [
      status,
      organizations,
      selectedOrganization,
      selectedOrganizationId,
      selectionReady,
      organizationEpoch,
      errorMessage,
      selectOrganization,
      refreshOrganizations,
      getTenantHeaders,
      handleTenantResponse,
      clearOrganizationPreferenceOnLogout,
    ]
  );

  return (
    <TenantOrganizationContext.Provider value={value}>{children}</TenantOrganizationContext.Provider>
  );
}

export function useTenantOrganization(): TenantOrganizationContextValue {
  const ctx = useContext(TenantOrganizationContext);
  if (!ctx) {
    throw new Error('useTenantOrganization must be used within TenantOrganizationProvider');
  }
  return ctx;
}

export function OrganizationSelector({
  language = 'es',
  compact = false,
}: {
  language?: 'es' | 'en';
  compact?: boolean;
}) {
  const { status, organizations, selectedOrganization, selectOrganization, refreshOrganizations } =
    useTenantOrganization();
  const en = language === 'en';

  if (status === 'loading') {
    return (
      <div className="rounded-full bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500">
        {en ? 'Loading workspace…' : 'Cargando espacio…'}
      </div>
    );
  }

  if (status === 'no_organization') {
    return (
      <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
        {en
          ? 'No active workspace is available for this account.'
          : 'No hay un espacio de trabajo activo disponible para esta cuenta.'}
        <button
          type="button"
          onClick={() => void refreshOrganizations()}
          className="ml-2 underline decoration-amber-300/40 underline-offset-2 hover:text-amber-100"
        >
          {en ? 'Retry' : 'Reintentar'}
        </button>
      </div>
    );
  }

  if (organizations.length === 0) return null;

  if (organizations.length === 1 && selectedOrganization) {
    return (
      <div
        className={`rounded-full bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-200 ${
          compact ? 'max-w-[180px] truncate' : ''
        }`}
        title={selectedOrganization.name}
      >
        ✦ {selectedOrganization.name}
      </div>
    );
  }

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="hidden text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:inline">
        {en ? 'Workspace' : 'Espacio'}
      </span>
      <select
        value={selectedOrganization?.id || ''}
        onChange={(event) => selectOrganization(event.target.value)}
        className="max-w-[220px] truncate rounded-full border-0 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-100 outline-none ring-1 ring-white/[0.06] focus:ring-cyan-500/30"
        aria-label={en ? 'Select organization' : 'Seleccionar organización'}
      >
        {status === 'selection_required' ? (
          <option value="" disabled>
            {en ? 'Select a workspace…' : 'Selecciona un espacio…'}
          </option>
        ) : null}
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} ({org.role})
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoOrganizationState({ language = 'es' }: { language?: 'es' | 'en' }) {
  const { refreshOrganizations } = useTenantOrganization();
  const en = language === 'en';
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080f] px-6 text-slate-100">
      <div className="max-w-md rounded-[28px] bg-[#040810] p-8 text-center ring-1 ring-white/[0.05]">
        <p className="text-lg text-white">
          {en
            ? 'No active workspace is available for this account.'
            : 'No hay un espacio de trabajo activo disponible para esta cuenta.'}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          {en
            ? 'Contact your workspace owner if you believe this is an error.'
            : 'Contacta al propietario del espacio si crees que esto es un error.'}
        </p>
        <button
          type="button"
          onClick={() => void refreshOrganizations()}
          className="mt-6 rounded-full bg-cyan-500/15 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/25"
        >
          {en ? 'Retry' : 'Reintentar'}
        </button>
      </div>
    </div>
  );
}

export function OrganizationChooserPanel({ language = 'es' }: { language?: 'es' | 'en' }) {
  const { organizations, selectOrganization } = useTenantOrganization();
  const en = language === 'en';
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080f] px-6 text-slate-100">
      <div className="w-full max-w-lg rounded-[28px] bg-[#040810] p-8 ring-1 ring-white/[0.05]">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">✦ Nexora</p>
        <h1 className="mt-3 text-2xl text-white">
          {en ? 'Choose a workspace' : 'Elige un espacio de trabajo'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {en
            ? 'Select the organization you want to work in. This only sets your session preference; access is always verified by the server.'
            : 'Selecciona la organización en la que quieres trabajar. Esto solo guarda una preferencia; el acceso siempre lo verifica el servidor.'}
        </p>
        <div className="mt-6 space-y-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => selectOrganization(org.id)}
              className="flex w-full items-center justify-between rounded-[20px] bg-white/[0.03] px-4 py-3 text-left transition hover:bg-cyan-500/10"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-white">{org.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{org.slug}</span>
              </span>
              <span className="ml-3 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-300">
                {org.role}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
