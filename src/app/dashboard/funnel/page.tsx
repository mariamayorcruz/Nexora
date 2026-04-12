import { redirect } from 'next/navigation';

export default function FunnelRedirectPage() {
  redirect('/dashboard/pipeline');
}
