const DEFAULT_ADMIN_EMAILS = ['info.emprendeelegante@gmail.com', 'admin@nexora.com'];
const DEFAULT_FOUNDER_EMAILS = ['info.emprendeelegante@gmail.com', 'mayorexcelsiorllc@gmail.com'];
const INTERNAL_TEST_LOCAL_PART_PATTERN =
  /(^|[+._-])(test|prueba|demo|internal|sandbox|qa|nexora)([+._-]|\d|$)/i;

function normalizeEmailList(value?: string | null, fallback: string[] = []) {
  const configuredEmails = value
    ? value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return Array.from(new Set([...fallback.map((entry) => entry.toLowerCase()), ...configuredEmails]));
}

export function getAdminEmails() {
  return normalizeEmailList(process.env.ADMIN_EMAILS, DEFAULT_ADMIN_EMAILS);
}

export function getFounderEmails() {
  return normalizeEmailList(process.env.FOUNDER_EMAILS, DEFAULT_FOUNDER_EMAILS);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function isFounderEmail(email?: string | null) {
  if (!email) return false;
  return getFounderEmails().includes(email.trim().toLowerCase());
}

export function isInternalOrTestEmail(email?: string | null) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isAdminEmail(normalized) || isFounderEmail(normalized)) return true;

  const [localPart = '', domain = ''] = normalized.split('@');
  if (domain === 'example.com' || domain === 'example.org' || domain === 'example.net') {
    return true;
  }

  return INTERNAL_TEST_LOCAL_PART_PATTERN.test(localPart);
}

export function getFounderPlan() {
  return process.env.FOUNDER_PLAN?.trim().toLowerCase() || 'enterprise';
}

export function getFounderTrialDays() {
  const rawValue = Number(process.env.FOUNDER_TRIAL_DAYS || '365');
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 365;
}
