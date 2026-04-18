import { redirect } from 'next/navigation';

export default function ClientesIndexPage() {
  redirect('/dashboard/clientes/lista');
}
