/**
 * Limpieza comercial / demos: borra leads, capturas, atribución, datos de workspace
 * de usuarios de prueba y vacía el CRM para cuentas admin conservadas.
 *
 * NO modifica: AdminWorkspaceConfig, PaymentSettings, ni usuarios en ALLOWLIST.
 *
 * Uso (desde la raíz del repo):
 *   node scripts/commercial-data-reset.js
 *
 * Requiere: DATABASE_URL en .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Emails que deben seguir existiendo (acceso admin). Normalizados a minúsculas. */
const ALLOWLIST_EMAILS = [
  'info.emprendeelegante@gmail.com',
  'mayorexcelsiorllc@gmail.com',
].map((e) => e.trim().toLowerCase());

async function main() {
  console.log('[commercial-data-reset] Emails protegidos:', ALLOWLIST_EMAILS.join(', '));

  const keepUsers = await prisma.user.findMany({
    where: { email: { in: ALLOWLIST_EMAILS } },
    select: { id: true, email: true, name: true },
  });

  const foundEmails = new Set(keepUsers.map((u) => u.email.toLowerCase()));
  const missing = ALLOWLIST_EMAILS.filter((e) => !foundEmails.has(e));
  if (missing.length) {
    throw new Error(
      `[commercial-data-reset] Faltan usuarios en la BD para: ${missing.join(', ')}. ` +
        'Crea esas cuentas antes o ajusta ALLOWLIST_EMAILS.'
    );
  }

  const keepIds = keepUsers.map((u) => u.id);
  console.log('[commercial-data-reset] IDs conservados:', keepIds);

  await prisma.$transaction(
    async (tx) => {
      // Sin FK a User o ya independientes
      const lc = await tx.leadCapture.deleteMany({});
      console.log(`[commercial-data-reset] LeadCapture eliminados: ${lc.count}`);

      const crm = await tx.crmLead.deleteMany({});
      console.log(`[commercial-data-reset] CrmLead eliminados: ${crm.count}`);

      const attr = await tx.attributionSession.deleteMany({});
      console.log(`[commercial-data-reset] AttributionSession eliminados: ${attr.count} (eventos en cascada)`);

      const conn = await tx.connectionRequest.deleteMany({});
      console.log(`[commercial-data-reset] ConnectionRequest eliminados: ${conn.count}`);

      // Usuarios de prueba: cascada elimina Subscription, Invoice, Campaign, Analytics,
      // AdAccount, CrmWorkspaceSettings, Ai*, etc. de esos usuarios
      const removedUsers = await tx.user.deleteMany({
        where: { id: { notIn: keepIds } },
      });
      console.log(`[commercial-data-reset] User eliminados: ${removedUsers.count}`);

      // Cuentas admin: vaciar resto comercial / producto demo (config CRM se conserva)
      const camp = await tx.campaign.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] Campaign eliminadas (admin): ${camp.count}`);

      const ads = await tx.adAccount.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] AdAccount eliminadas (admin): ${ads.count}`);

      const inv = await tx.invoice.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] Invoice eliminadas (admin): ${inv.count}`);

      const vid = await tx.aiVideoProject.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] AiVideoProject eliminados (admin): ${vid.count}`);

      const ast = await tx.aiVideoAsset.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] AiVideoAsset eliminados (admin): ${ast.count}`);

      const jobs = await tx.aiWorkspaceJob.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] AiWorkspaceJob eliminados (admin): ${jobs.count}`);

      const usage = await tx.aiWorkspaceUsage.deleteMany({ where: { userId: { in: keepIds } } });
      console.log(`[commercial-data-reset] AiWorkspaceUsage eliminados (admin): ${usage.count}`);

      // Sesiones NextAuth-style y tokens de sesión embebidos en VerificationToken
      const vt = await tx.verificationToken.deleteMany({});
      console.log(`[commercial-data-reset] VerificationToken eliminados: ${vt.count} (todos; hay que volver a iniciar sesión)`);
    },
    { timeout: 120000 }
  );

  const remaining = await prisma.user.count();
  console.log(`[commercial-data-reset] Usuarios restantes en BD: ${remaining}`);
  console.log('[commercial-data-reset] Listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
