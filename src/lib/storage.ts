import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'nexora-videos';
  const signedUrlSeconds = Number(process.env.SUPABASE_STORAGE_SIGNED_URL_SECONDS || DEFAULT_SIGNED_URL_SECONDS);

  return {
    url,
    serviceRoleKey,
    bucket,
    signedUrlSeconds: Number.isFinite(signedUrlSeconds) && signedUrlSeconds > 0
      ? signedUrlSeconds
      : DEFAULT_SIGNED_URL_SECONDS,
  };
}

export function isSupabaseStorageEnabled() {
  const env = getSupabaseEnv();
  return Boolean(env.url && env.serviceRoleKey && env.bucket);
}

function getSupabaseAdminClient(): { client: SupabaseClient; bucket: string; signedUrlSeconds: number } {
  const env = getSupabaseEnv();
  if (!env.url || !env.serviceRoleKey) {
    throw new Error('Supabase storage is not configured.');
  }

  const client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    client,
    bucket: env.bucket,
    signedUrlSeconds: env.signedUrlSeconds,
  };
}

export async function uploadVideoToSupabase(params: {
  userId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}) {
  const { client, bucket, signedUrlSeconds } = getSupabaseAdminClient();
  const objectKey = `${params.userId}/${Date.now()}-${params.fileName}`;

  const uploaded = await client.storage.from(bucket).upload(objectKey, params.buffer, {
    contentType: params.contentType,
    upsert: false,
  });

  if (uploaded.error) {
    throw new Error(`Supabase upload failed: ${uploaded.error.message}`);
  }

  const signed = await client.storage.from(bucket).createSignedUrl(objectKey, signedUrlSeconds);
  if (!signed.error && signed.data?.signedUrl) {
    return {
      provider: 'supabase' as const,
      key: objectKey,
      url: signed.data.signedUrl,
      bucket,
    };
  }

  const publicData = client.storage.from(bucket).getPublicUrl(objectKey);

  return {
    provider: 'supabase' as const,
    key: objectKey,
    url: publicData.data.publicUrl,
    bucket,
  };
}

export async function getSupabaseReadUrl(storageKey: string) {
  const { client, bucket, signedUrlSeconds } = getSupabaseAdminClient();
  const signed = await client.storage.from(bucket).createSignedUrl(storageKey, signedUrlSeconds);

  if (!signed.error && signed.data?.signedUrl) {
    return signed.data.signedUrl;
  }

  const publicData = client.storage.from(bucket).getPublicUrl(storageKey);
  return publicData.data.publicUrl;
}

export async function deleteSupabaseObject(storageKey: string) {
  const { client, bucket } = getSupabaseAdminClient();
  const removed = await client.storage.from(bucket).remove([storageKey]);
  if (removed.error) {
    throw new Error(`Supabase delete failed: ${removed.error.message}`);
  }
}
