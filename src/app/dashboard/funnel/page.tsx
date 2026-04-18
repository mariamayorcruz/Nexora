import { redirect } from 'next/navigation';

export default function FunnelRedirectPage() {
  redirect('/dashboard/clientes/pipeline');
}
