'use client';

import { useEffect, useState } from 'react';
import type { FunnelConfig, RoadmapTask } from '@/lib/admin-config';

export default function AdminFunnelPage() {
  const [funnel, setFunnel] = useState<FunnelConfig | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/funnel', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setFunnel(data.funnel);
        setRoadmap(data.roadmap || []);
      } catch (error) {
        console.error('Error fetching funnel center:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const saveChanges = async () => {
    if (!funnel) return;
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/funnel', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ funnel, roadmap }),
      });

      if (!response.ok) throw new Error('No se pudo guardar el funnel');
      setMessage('Funnel y roadmap guardados.');
    } catch (error) {
      console.error('Error saving funnel center:', error);
      setMessage('No pudimos guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !funnel) {
    return <div className="py-12 text-center">Cargando funnel center...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Funnel center</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Embudo, oferta y tareas para llevar Nexora al siguiente nivel</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
            Aquí puedes ajustar la narrativa central, revisar etapas del funnel y ver las prioridades reales para convertir Nexora en una plataforma líder de marketing y ads.
          </p>
        </div>
        <button onClick={saveChanges} className="btn-primary" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar funnel'}
        </button>
      </div>

      {message && <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">{message}</div>}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Narrativa principal</p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Hero principal</span>
              <textarea
                value={funnel.heroTitle}
                onChange={(event) => setFunnel({ ...funnel, heroTitle: event.target.value })}
                className="input-field min-h-[96px]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Posicionamiento</span>
              <textarea
                value={funnel.positioning}
                onChange={(event) => setFunnel({ ...funnel, positioning: event.target.value })}
                className="input-field min-h-[110px]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Oferta principal</span>
              <textarea
                value={funnel.mainOffer}
                onChange={(event) => setFunnel({ ...funnel, mainOffer: event.target.value })}
                className="input-field min-h-[90px]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">CTA principal</span>
              <input
                value={funnel.callToAction}
                onChange={(event) => setFunnel({ ...funnel, callToAction: event.target.value })}
                className="input-field"
              />
            </label>
          </div>
        </div>

        <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Etapas del funnel</p>
          <div className="mt-5 space-y-4">
            {funnel.stages.map((stage, index) => (
              <div key={stage.id} className="rounded-2xl border border-gray-200 p-4">
                <input
                  value={stage.title}
                  onChange={(event) => {
                    const stages = [...funnel.stages];
                    stages[index] = { ...stage, title: event.target.value };
                    setFunnel({ ...funnel, stages });
                  }}
                  className="input-field"
                />
                <textarea
                  value={stage.goal}
                  onChange={(event) => {
                    const stages = [...funnel.stages];
                    stages[index] = { ...stage, goal: event.target.value };
                    setFunnel({ ...funnel, stages });
                  }}
                  className="input-field mt-3 min-h-[88px]"
                />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <input
                    value={stage.metric}
                    onChange={(event) => {
                      const stages = [...funnel.stages];
                      stages[index] = { ...stage, metric: event.target.value };
                      setFunnel({ ...funnel, stages });
                    }}
                    className="input-field"
                    placeholder="Métrica"
                  />
                  <input
                    value={stage.owner}
                    onChange={(event) => {
                      const stages = [...funnel.stages];
                      stages[index] = { ...stage, owner: event.target.value };
                      setFunnel({ ...funnel, stages });
                    }}
                    className="input-field"
                    placeholder="Owner"
                  />
                  <select
                    value={stage.status}
                    onChange={(event) => {
                      const stages = [...funnel.stages];
                      stages[index] = { ...stage, status: event.target.value as FunnelConfig['stages'][number]['status'] };
                      setFunnel({ ...funnel, stages });
                    }}
                    className="input-field"
                  >
                    <option value="healthy">Saludable</option>
                    <option value="watch">Vigilar</option>
                    <option value="build">Construir</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Roadmap estratégico</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Tareas pendientes para construir la mejor plataforma de marketing y ads</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {roadmap.map((task, index) => (
            <div key={task.id} className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={task.title}
                  onChange={(event) => {
                    const items = [...roadmap];
                    items[index] = { ...task, title: event.target.value };
                    setRoadmap(items);
                  }}
                  className="input-field"
                />
                <select
                  value={task.priority}
                  onChange={(event) => {
                    const items = [...roadmap];
                    items[index] = { ...task, priority: event.target.value as RoadmapTask['priority'] };
                    setRoadmap(items);
                  }}
                  className="input-field max-w-[120px]"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                </select>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={task.area}
                  onChange={(event) => {
                    const items = [...roadmap];
                    items[index] = { ...task, area: event.target.value };
                    setRoadmap(items);
                  }}
                  className="input-field"
                  placeholder="Área"
                />
                <select
                  value={task.status}
                  onChange={(event) => {
                    const items = [...roadmap];
                    items[index] = { ...task, status: event.target.value as RoadmapTask['status'] };
                    setRoadmap(items);
                  }}
                  className="input-field"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en progreso">En progreso</option>
                  <option value="base lista">Base lista</option>
                </select>
              </div>
              <textarea
                value={task.detail}
                onChange={(event) => {
                  const items = [...roadmap];
                  items[index] = { ...task, detail: event.target.value };
                  setRoadmap(items);
                }}
                className="input-field mt-3 min-h-[90px]"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
