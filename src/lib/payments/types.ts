export type PaymentProvider = 'flow' | 'mercadopago' | 'stripe';

export interface PaymentCredentials {
  apiKey?: string;
  secretKey?: string;
  accessToken?: string;
  [key: string]: string | undefined;
}

export interface CreatePaymentLinkInput {
  provider: PaymentProvider;
  credentials: PaymentCredentials;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  buyerEmail?: string | null;
  returnUrl: string;
  notifyUrl: string;
}

export interface CreatePaymentLinkResult {
  ok: boolean;
  url?: string;
  providerRef?: string;
  error?: string;
}

export interface VerifyWebhookInput {
  credentials: PaymentCredentials;
  rawBody: string;
  headers: Headers;
}

export interface WebhookEvent {
  ok: boolean;
  providerRef?: string;
  reference?: string;
  status?: 'paid' | 'pending' | 'failed';
  amount?: number;
  currency?: string;
  error?: string;
}

export interface PaymentAdapter {
  provider: PaymentProvider;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookEvent>;
}
