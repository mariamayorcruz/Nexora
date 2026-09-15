import { flowAdapter } from '@/lib/payments/flow';
import { mercadoPagoAdapter } from '@/lib/payments/mercadopago';
import type { PaymentAdapter, PaymentProvider } from '@/lib/payments/types';

export * from '@/lib/payments/types';

const ADAPTERS: Partial<Record<PaymentProvider, PaymentAdapter>> = {
  flow: flowAdapter,
  mercadopago: mercadoPagoAdapter,
};

export function getPaymentAdapter(provider: string): PaymentAdapter | null {
  return ADAPTERS[provider as PaymentProvider] ?? null;
}

export const SUPPORTED_SELLER_PROVIDERS: PaymentProvider[] = ['flow', 'mercadopago'];
