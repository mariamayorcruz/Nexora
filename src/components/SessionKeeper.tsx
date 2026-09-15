'use client';

import { useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps the short-lived access token fresh while the dashboard is open.
 * The server only renews it while the session record is still alive, so
 * closing a session from security settings logs the device out.
 */
export default function SessionKeeper() {
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/auth/login';
          return;
        }

        const data = (await response.json().catch(() => null)) as { token?: string } | null;
        if (data?.token) {
          localStorage.setItem('token', data.token);
        }
      } catch {
        // offline or transient failure: keep the current token and retry later
      }
    };

    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
