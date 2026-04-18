const NAME_LOCALE = 'es';

/**
 * Lead / recipient name for email: first character uppercased, rest lowercased (locale-aware).
 * Example: "maria" → "Maria", "MARIA" → "Maria"
 */
export function capitalizeLeadNameForEmail(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const lower = s.toLocaleLowerCase(NAME_LOCALE);
  return lower.charAt(0).toLocaleUpperCase(NAME_LOCALE) + lower.slice(1);
}
