import { prisma } from '@/lib/prisma';
import { isAdminEmail, isFounderEmail } from '@/lib/access';

export type AppRole = 'admin' | 'founder' | 'user';

export async function listRoles(userId: string): Promise<AppRole[]> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });

  return rows.map((row) => row.role as AppRole);
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const found = await prisma.userRole.findFirst({
    where: { userId, role },
    select: { id: true },
  });

  return Boolean(found);
}

export async function grantRole(userId: string, role: AppRole) {
  await prisma.userRole.upsert({
    where: { userId_role: { userId, role } },
    update: {},
    create: { userId, role },
  });
}

export async function revokeRole(userId: string, role: AppRole) {
  await prisma.userRole.deleteMany({ where: { userId, role } });
}

/**
 * Bootstrap: the very first admins come from the ADMIN_EMAILS/FOUNDER_EMAILS allowlist,
 * but from then on the database row is the source of truth for authorization.
 */
export async function syncRolesFromAllowlist(user: { id: string; email: string }) {
  const roles: AppRole[] = [];
  if (isAdminEmail(user.email)) roles.push('admin');
  if (isFounderEmail(user.email)) roles.push('founder');

  for (const role of roles) {
    await grantRole(user.id, role);
  }

  return roles;
}

/** Authorization check used by admin endpoints: database role first, allowlist only as bootstrap. */
export async function isAdminUser(user: { id: string; email: string }): Promise<boolean> {
  if (await hasRole(user.id, 'admin')) return true;
  if (await hasRole(user.id, 'founder')) return true;

  const bootstrapped = await syncRolesFromAllowlist(user);
  return bootstrapped.length > 0;
}
