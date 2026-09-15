'use client';

import { useCallback, useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  active: boolean;
};

type PaymentAccount = {
  id: string;
  provider: string;
  currency: string;
  country: string;
  connected: boolean;
  isDefault: boolean;
  credentials: Record<string, string | null>;
};

type LifecycleRule = {
  id: string;
  kind: 'no_purchase' | 'post_purchase' | 'birthday' | string;
  enabled: boolean;
  delayDays: number;
  intervalDays: number;
  maxSends: number;
  template: string;
  discountPercent: number;
  couponValidDays: number;
  sendHour: number;
};

const KIND_LABELS: Record<string, { title: string; hint: string }> = {
  no_purchase: {
    title: 'No compraron todavía',
    hint: 'Se les escribe después de unos días y luego cada cierto tiempo con novedades.',
  },
  post_purchase: {
    title: 'Ya compraron',
    hint: 'Agradecimiento, revisión y novedades para que vuelvan a comprar.',
  },
  birthday: {
    title: 'Cumpleaños',
    hint: 'Saludo el mismo día con un cupón de descuento que se genera solo.',
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  flow: 'Flow (Chile · Webpay, transferencia)',
  mercadopago: 'Mercado Pago',
};

const card = 'rounded-3xl border border-white/10 bg-white/[0.03] p-6';
const input =
  'w-full rounded-2xl border border-white/10 bg-[#040810] px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60';
const button =
  'rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#04121a] transition hover:bg-cyan-400 disabled:opacity-50';
const ghostButton =
  'rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-cyan-400/60';

export default function VentasPage() {
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [rules, setRules] = useState<LifecycleRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState({ name: '', price: '', currency: 'CLP', description: '' });
  const [payForm, setPayForm] = useState({ provider: 'flow', country: 'CL', apiKey: '', secretKey: '', accessToken: '' });

  useEffect(() => {
    setToken(typeof window === 'undefined' ? null : window.localStorage.getItem('token'));
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [p, a, r] = await Promise.all([
        fetch('/api/products', { headers }).then((res) => res.json()),
        fetch('/api/payments/accounts', { headers }).then((res) => res.json()),
        fetch('/api/automation/lifecycle', { headers }).then((res) => res.json()),
      ]);
      setProducts(p.products || []);
      setAccounts(a.accounts || []);
      setRules(r.rules || []);
    } catch {
      setMessage('No pudimos cargar tus datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProduct() {
    if (!token) return;
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProduct, price: Number(newProduct.price) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'No se pudo guardar el producto.');
      return;
    }
    setNewProduct({ name: '', price: '', currency: newProduct.currency, description: '' });
    setMessage('Producto agregado ✦');
    void load();
  }

  async function removeProduct(id: string) {
    if (!token) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    void load();
  }

  async function savePaymentAccount() {
    if (!token) return;
    const response = await fetch('/api/payments/accounts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payForm, isDefault: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'No se pudo conectar la cuenta de cobro.');
      return;
    }
    setPayForm({ ...payForm, apiKey: '', secretKey: '', accessToken: '' });
    setMessage('Cuenta de cobro conectada ✦');
    void load();
  }

  async function saveRule(rule: LifecycleRule) {
    if (!token) return;
    const response = await fetch('/api/automation/lifecycle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!response.ok) {
      setMessage('No se pudo guardar la campaña.');
      return;
    }
    setMessage('Campaña guardada ✦');
    void load();
  }

  function updateRule(kind: string, patch: Partial<LifecycleRule>) {
    setRules((current) => current.map((rule) => (rule.kind === kind ? { ...rule, ...patch } : rule)));
  }

  return (
    <div className="space-y-8 text-white">
      <header>
        <h1 className="text-2xl font-semibold">Ventas por WhatsApp</h1>
        <p className="mt-1 text-sm text-white/60">
          Tu catálogo, tu cuenta de cobro y los mensajes automáticos para que ningún cliente se enfríe.
        </p>
      </header>

      {message ? (
        <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          {message}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-white/50">Cargando…</p> : null}

      <section className={card}>
        <h2 className="text-lg font-semibold">Catálogo</h2>
        <p className="mt-1 text-sm text-white/60">
          El asistente solo cotiza lo que esté aquí, con estos precios. Nunca inventa.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            className={input}
            placeholder="Nombre del producto o servicio"
            value={newProduct.name}
            onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
          />
          <input
            className={input}
            placeholder="Precio"
            inputMode="numeric"
            value={newProduct.price}
            onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
          />
          <select
            className={input}
            value={newProduct.currency}
            onChange={(event) => setNewProduct({ ...newProduct, currency: event.target.value })}
          >
            {['CLP', 'ARS', 'BRL', 'COP', 'MXN', 'PEN', 'USD'].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          <button type="button" className={button} onClick={createProduct}>
            Agregar
          </button>
        </div>

        <ul className="mt-5 space-y-2">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm"
            >
              <span>
                <strong>{product.name}</strong>{' '}
                <span className="text-white/60">
                  · {product.price.toLocaleString('es-CL')} {product.currency}
                </span>
              </span>
              <button type="button" className="text-xs text-white/50 hover:text-red-300" onClick={() => removeProduct(product.id)}>
                Quitar
              </button>
            </li>
          ))}
          {!products.length && !loading ? (
            <li className="text-sm text-white/50">Todavía no cargaste productos.</li>
          ) : null}
        </ul>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Dónde recibes tu dinero</h2>
        <p className="mt-1 text-sm text-white/60">
          Conecta tu cuenta: los pagos de tus clientes llegan directo a ti. Guardamos las claves cifradas y nunca se
          muestran completas.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <select
            className={input}
            value={payForm.provider}
            onChange={(event) => setPayForm({ ...payForm, provider: event.target.value })}
          >
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={input}
            value={payForm.country}
            onChange={(event) => setPayForm({ ...payForm, country: event.target.value })}
          >
            {[
              ['CL', 'Chile'],
              ['AR', 'Argentina'],
              ['BR', 'Brasil'],
              ['CO', 'Colombia'],
              ['MX', 'México'],
              ['PE', 'Perú'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {payForm.provider === 'flow' ? (
            <>
              <input
                className={input}
                placeholder="API Key de Flow"
                value={payForm.apiKey}
                onChange={(event) => setPayForm({ ...payForm, apiKey: event.target.value })}
              />
              <input
                className={input}
                placeholder="Secret Key de Flow"
                type="password"
                value={payForm.secretKey}
                onChange={(event) => setPayForm({ ...payForm, secretKey: event.target.value })}
              />
            </>
          ) : (
            <input
              className={`${input} md:col-span-2`}
              placeholder="Access Token de Mercado Pago"
              type="password"
              value={payForm.accessToken}
              onChange={(event) => setPayForm({ ...payForm, accessToken: event.target.value })}
            />
          )}
        </div>

        <button type="button" className={`${button} mt-4`} onClick={savePaymentAccount}>
          Conectar cuenta
        </button>

        <ul className="mt-5 space-y-2">
          {accounts.map((account) => (
            <li key={account.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
              <strong>{PROVIDER_LABELS[account.provider] || account.provider}</strong>{' '}
              <span className="text-white/60">
                · {account.currency} · {account.connected ? 'conectada' : 'pendiente'}
                {account.isDefault ? ' · principal' : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">Mensajes automáticos</h2>
        <p className="mt-1 text-sm text-white/60">
          Usa {'{{nombre}}'}, {'{{negocio}}'}, {'{{descuento}}'}, {'{{cupon}}'} y {'{{vence}}'} dentro del texto.
        </p>

        <div className="mt-5 space-y-5">
          {rules.map((rule) => (
            <div key={rule.kind} className="rounded-2xl border border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{KIND_LABELS[rule.kind]?.title || rule.kind}</h3>
                  <p className="text-xs text-white/50">{KIND_LABELS[rule.kind]?.hint}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => updateRule(rule.kind, { enabled: event.target.checked })}
                  />
                  Activa
                </label>
              </div>

              <textarea
                className={`${input} mt-4 min-h-[90px]`}
                value={rule.template}
                onChange={(event) => updateRule(rule.kind, { template: event.target.value })}
              />

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {rule.kind !== 'birthday' ? (
                  <>
                    <label className="text-xs text-white/60">
                      Esperar (días)
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={rule.delayDays}
                        onChange={(event) => updateRule(rule.kind, { delayDays: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      Repetir cada (días)
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={rule.intervalDays}
                        onChange={(event) => updateRule(rule.kind, { intervalDays: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      Máximo de envíos
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={rule.maxSends}
                        onChange={(event) => updateRule(rule.kind, { maxSends: Number(event.target.value) || 0 })}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="text-xs text-white/60">
                      Descuento (%)
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={rule.discountPercent}
                        onChange={(event) => updateRule(rule.kind, { discountPercent: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label className="text-xs text-white/60">
                      Cupón válido (días)
                      <input
                        className={`${input} mt-1`}
                        inputMode="numeric"
                        value={rule.couponValidDays}
                        onChange={(event) => updateRule(rule.kind, { couponValidDays: Number(event.target.value) || 1 })}
                      />
                    </label>
                  </>
                )}
                <label className="text-xs text-white/60">
                  Hora de envío
                  <input
                    className={`${input} mt-1`}
                    inputMode="numeric"
                    value={rule.sendHour}
                    onChange={(event) => updateRule(rule.kind, { sendHour: Number(event.target.value) || 0 })}
                  />
                </label>
              </div>

              <button type="button" className={`${ghostButton} mt-4`} onClick={() => saveRule(rule)}>
                Guardar
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
