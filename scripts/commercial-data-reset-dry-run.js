/**
 * DRY RUN: mismo alcance que commercial-data-reset.js — solo lectura, sin borrar nada.
 *
 * Uso (raíz del repo):
 *   node scripts/commercial-data-reset-dry-run.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ALLOWLIST_EMAILS = [
  'info.emprendeelegante@gmail.com',
  'mayorexcelsiorllc@gmail.com',
].map((e) => e.trim().toLowerCase());

function tryParseSentLogsCount(defaultCadence) {
  const value = String(defaultCadence || '').trim();
  if (!value.startsWith('{')) return 0;
  try {
    const parsed = JSON.parse(value);
    const logs = parsed?.salesEngine?.sentLogs;
    return Array.isArray(logs) ? logs.length : 0;
  } catch {
    return 0;
  }
}

function summarizeAdminConfig(config) {
  if (!config) {
    return { present: false };
  }
  const funnel = config.funnelConfig && typeof config.funnelConfig === 'object' ? config.funnelConfig : null;
  const emails = Array.isArray(config.emailTemplates) ? config.emailTemplates : [];
  const automation = config.automationConfig && typeof config.automationConfig === 'object' ? config.automationConfig : null;
  const roadmap = Array.isArray(config.roadmapConfig) ? config.roadmapConfig : [];

  return {
    present: true,
    funnelKeys: funnel ? Object.keys(funnel) : [],
    emailTemplatesCount: emails.length,
    automationKeys: automation ? Object.keys(automation) : [],
    roadmapTasksCount: roadmap.length,
    note:
      'El script de limpieza NO borra AdminWorkspaceConfig. Textos de funnel, plantillas lifecycle, automation y roadmap siguen en BD salvo que los edites a mano.',
  };
}

async function main() {
  console.log('=== COMMERCIAL CLEANUP — DRY RUN (preview only) ===\n');
  console.log('Allowlist:', ALLOWLIST_EMAILS.join(', '));

  const keepUsers = await prisma.user.findMany({
    where: { email: { in: ALLOWLIST_EMAILS } },
    select: { id: true, email: true, name: true },
  });

  const foundEmails = new Set(keepUsers.map((u) => u.email.toLowerCase()));
  const missingAdmins = ALLOWLIST_EMAILS.filter((e) => !foundEmails.has(e));
  const keepIds = keepUsers.map((u) => u.id);

  const deletedUsersList =
    keepIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { notIn: keepIds } },
          select: { id: true, email: true, name: true },
          orderBy: { email: 'asc' },
        })
      : await prisma.user.findMany({
          select: { id: true, email: true, name: true },
          orderBy: { email: 'asc' },
        });

  const totalUsers = await prisma.user.count();
  const usersToDelete = await prisma.user.count({
    where: { id: { notIn: keepIds.length ? keepIds : ['__none__'] } },
  });
  /** Si no hay ningún allowlist en BD, notIn [] borraría a todos; el script real falla antes. */
  const usersToDeleteSafe = keepIds.length === 0 ? totalUsers : usersToDelete;

  const [
    leadCaptureAll,
    crmLeadAll,
    attributionSessions,
    attributionEvents,
    connectionRequestAll,
    verificationTokenAll,
    paymentSettingsCount,
    adminConfigRows,
  ] = await Promise.all([
    prisma.leadCapture.count(),
    prisma.crmLead.count(),
    prisma.attributionSession.count(),
    prisma.attributionEvent.count(),
    prisma.connectionRequest.count(),
    prisma.verificationToken.count(),
    prisma.paymentSettings.count(),
    prisma.adminWorkspaceConfig.findMany({ select: { key: true, funnelConfig: true, emailTemplates: true, automationConfig: true, roadmapConfig: true } }),
  ]);

  const subsOrphans = keepIds.length
    ? await prisma.subscription.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.subscription.count();
  const invoicesOrphans = keepIds.length
    ? await prisma.invoice.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.invoice.count();
  const campaignsOrphans = keepIds.length
    ? await prisma.campaign.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.campaign.count();
  const adAccountsOrphans = keepIds.length
    ? await prisma.adAccount.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.adAccount.count();
  const crmSettingsOrphans = keepIds.length
    ? await prisma.crmWorkspaceSettings.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.crmWorkspaceSettings.count();
  const aiProjectsOrphans = keepIds.length
    ? await prisma.aiVideoProject.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.aiVideoProject.count();
  const aiAssetsOrphans = keepIds.length
    ? await prisma.aiVideoAsset.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.aiVideoAsset.count();
  const aiJobsOrphans = keepIds.length
    ? await prisma.aiWorkspaceJob.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.aiWorkspaceJob.count();
  const aiUsageOrphans = keepIds.length
    ? await prisma.aiWorkspaceUsage.count({ where: { userId: { notIn: keepIds } } })
    : await prisma.aiWorkspaceUsage.count();

  /** Eliminación explícita post-usuario (solo admins) — mismas consultas que el script real */
  const adminCampaigns = keepIds.length
    ? await prisma.campaign.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminAdAccounts = keepIds.length
    ? await prisma.adAccount.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminInvoices = keepIds.length
    ? await prisma.invoice.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminAiProjects = keepIds.length
    ? await prisma.aiVideoProject.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminAiAssets = keepIds.length
    ? await prisma.aiVideoAsset.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminAiJobs = keepIds.length
    ? await prisma.aiWorkspaceJob.count({ where: { userId: { in: keepIds } } })
    : 0;
  const adminAiUsage = keepIds.length
    ? await prisma.aiWorkspaceUsage.count({ where: { userId: { in: keepIds } } })
    : 0;

  const analyticsOrphans = keepIds.length
    ? await prisma.analytics.count({
        where: { campaign: { userId: { notIn: keepIds } } },
      })
    : await prisma.analytics.count();

  const analyticsAdmin = keepIds.length
    ? await prisma.analytics.count({
        where: { campaign: { userId: { in: keepIds } } },
      })
    : 0;

  /** Versiones de vídeo: cascada con proyecto */
  const videoVersionsOrphans = keepIds.length
    ? await prisma.aiVideoProjectVersion.count({
        where: { userId: { notIn: keepIds } },
      })
    : await prisma.aiVideoProjectVersion.count();
  const videoVersionsAdmin = keepIds.length
    ? await prisma.aiVideoProjectVersion.count({
        where: { userId: { in: keepIds } },
      })
    : 0;

  let sentLogsRemainingOnAdmins = 0;
  if (keepIds.length) {
    const adminCrmSettings = await prisma.crmWorkspaceSettings.findMany({
      where: { userId: { in: keepIds } },
      select: { userId: true, defaultCadence: true },
    });
    for (const row of adminCrmSettings) {
      sentLogsRemainingOnAdmins += tryParseSentLogsCount(row.defaultCadence);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMEN CLARO (solo lectura — no se borró nada)            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('1) KEPT USERS');
  console.log('   Emails preservados:');
  keepUsers.forEach((u) => console.log(`     • ${u.email}`));
  console.log('   IDs preservados:');
  keepUsers.forEach((u) => console.log(`     • ${u.id}  (${u.email})`));

  console.log('\n2) DELETED USERS');
  console.log('   Emails que se borrarían:');
  if (deletedUsersList.length === 0) {
    console.log('     (ninguno)');
  } else {
    deletedUsersList.forEach((u) => console.log(`     • ${u.email}${u.name ? ` — ${u.name}` : ''}`));
  }
  console.log(`   Cantidad total: ${deletedUsersList.length}`);

  console.log('\n3) COUNTS PER MODEL (filas en BD hoy / impacto del script)');
  console.log(`   LeadCapture              ${leadCaptureAll}  → borrar todas`);
  console.log(`   CrmLead                  ${crmLeadAll}  → borrar todas`);
  console.log(`   AttributionSession       ${attributionSessions}  → borrar todas`);
  console.log(`   AttributionEvent         ${attributionEvents}  → borrar con sesiones`);
  console.log(`   ConnectionRequest        ${connectionRequestAll}  → borrar todas`);
  console.log(`   VerificationToken        ${verificationTokenAll}  → borrar todas`);
  console.log(`   User                     ${totalUsers} total → mantener ${keepUsers.length}, borrar ${deletedUsersList.length}`);
  console.log('   (tras borrar usuarios no-allowlist, cascada típica:)');
  console.log(`   Subscription (esos users)     ${subsOrphans}`);
  console.log(`   Invoice (esos users)            ${invoicesOrphans}`);
  console.log(`   Campaign (esos users)           ${campaignsOrphans}`);
  console.log(`   Analytics (esas campaigns)      ${analyticsOrphans}`);
  console.log(`   AdAccount (esos users)          ${adAccountsOrphans}`);
  console.log(`   CrmWorkspaceSettings (esos)     ${crmSettingsOrphans}`);
  console.log(`   AiVideoProject (esos)           ${aiProjectsOrphans}`);
  console.log(`   AiVideoProjectVersion (esos)    ${videoVersionsOrphans}`);
  console.log(`   AiVideoAsset (esos)             ${aiAssetsOrphans}`);
  console.log(`   AiWorkspaceJob (esos)           ${aiJobsOrphans}`);
  console.log(`   AiWorkspaceUsage (esos)         ${aiUsageOrphans}`);
  console.log('   (luego el script borra en cuentas allowlist:)');
  console.log(`   Campaign (admins)               ${adminCampaigns}`);
  console.log(`   AdAccount (admins)            ${adminAdAccounts}`);
  console.log(`   Invoice (admins)              ${adminInvoices}`);
  console.log(`   Analytics (admins)            ${analyticsAdmin}`);
  console.log(`   AiVideoProject (admins)       ${adminAiProjects}`);
  console.log(`   AiVideoProjectVersion (admins) ${videoVersionsAdmin}`);
  console.log(`   AiVideoAsset (admins)         ${adminAiAssets}`);
  console.log(`   AiWorkspaceJob (admins)       ${adminAiJobs}`);
  console.log(`   AiWorkspaceUsage (admins)     ${adminAiUsage}`);
  console.log(`   AdminWorkspaceConfig          ${adminConfigRows.length} fila(s) — NO se borran`);
  console.log(`   PaymentSettings               ${paymentSettingsCount} fila(s) — NO se borran`);

  console.log('\n4) CONFIRMACIÓN — estos emails NO se borran con el script:');
  console.log('     ✓ info.emprendeelegante@gmail.com');
  console.log('     ✓ mayorexcelsiorllc@gmail.com');
  if (missingAdmins.length) {
    console.log('\n   ⚠ ADVERTENCIA: falta User en BD para:', missingAdmins.join(', '));
  }

  console.log('\n--- Detalle (mismo dry-run, formato tabla) ---\n');
  console.log('--- 1) Registros que el script BORRARÍA (conteo) ---\n');
  console.log('Tabla / modelo                          | Cantidad a borrar');
  console.log('-'.repeat(60));
  console.log(`LeadCapture (todos)                     | ${leadCaptureAll}`);
  console.log(`CrmLead (todos)                         | ${crmLeadAll}`);
  console.log(`AttributionSession (todos)              | ${attributionSessions}`);
  console.log(`AttributionEvent (cascada con sesión)     | ${attributionEvents}`);
  console.log(`ConnectionRequest (todos)               | ${connectionRequestAll}`);
  console.log(`VerificationToken (todos)               | ${verificationTokenAll}`);
  console.log(`User (solo no-allowlist)                | ${usersToDeleteSafe}`);
  console.log('');
  console.log('…y por CASCADE al borrar esos User (no allowlist):');
  console.log(`  Subscription                           | ${subsOrphans}`);
  console.log(`  Invoice                                | ${invoicesOrphans}`);
  console.log(`  Campaign                               | ${campaignsOrphans}`);
  console.log(`  Analytics (ligadas a esas campaigns)   | ${analyticsOrphans}`);
  console.log(`  AdAccount                              | ${adAccountsOrphans}`);
  console.log(`  CrmWorkspaceSettings                   | ${crmSettingsOrphans}`);
  console.log(`  AiVideoProject                         | ${aiProjectsOrphans}`);
  console.log(`  AiVideoProjectVersion                  | ${videoVersionsOrphans}`);
  console.log(`  AiVideoAsset                           | ${aiAssetsOrphans}`);
  console.log(`  AiWorkspaceJob                         | ${aiJobsOrphans}`);
  console.log(`  AiWorkspaceUsage                       | ${aiUsageOrphans}`);
  console.log('');
  console.log('Luego el script borra explícitamente en cuentas ALLOWLIST (admins):');
  console.log(`  Campaign                               | ${adminCampaigns}`);
  console.log(`  AdAccount                              | ${adminAdAccounts}`);
  console.log(`  Invoice                                | ${adminInvoices}`);
  console.log(`  Analytics (ligadas a esas campaigns)   | ${analyticsAdmin}`);
  console.log(`  AiVideoProject                         | ${adminAiProjects}`);
  console.log(`  AiVideoProjectVersion                  | ${videoVersionsAdmin}`);
  console.log(`  AiVideoAsset                           | ${adminAiAssets}`);
  console.log(`  AiWorkspaceJob                         | ${adminAiJobs}`);
  console.log(`  AiWorkspaceUsage                       | ${adminAiUsage}`);

  console.log('\n--- 2) Lista usuarios a eliminar (detalle) ---\n');
  deletedUsersList.forEach((u) => console.log(`  - ${u.email} | id=${u.id}`));
  console.log(`\nTotal usuarios hoy: ${totalUsers} | allowlist: ${keepUsers.length} | a borrar: ${deletedUsersList.length}`);

  console.log('\n--- 3) Emails admin en allowlist (existencia en BD) ---\n');
  if (missingAdmins.length) {
    console.log('FALTAN en la BD (no hay User con ese email):');
    missingAdmins.forEach((e) => console.log(`  ⚠ ${e}`));
  } else {
    console.log('OK: los dos emails allowlist existen como User.');
  }

  console.log('\n--- 4) Datos fuera de las tablas del script (followup / logs) ---\n');
  console.log(
    '- CrmWorkspaceSettings.defaultCadence: JSON con salesEngine.sentLogs, followUpTemplates, citas, etc.'
  );
  console.log(
    `  Tras el script, filas CrmWorkspaceSettings de admins SE CONSERVAN → entradas sentLogs que queden en JSON: ~${sentLogsRemainingOnAdmins} (solo allowlist; filas de otros usuarios se pierden con el User).`
  );
  console.log('- AdminWorkspaceConfig (platform): emailTemplates, funnelConfig, automationConfig, roadmapConfig — NO se borran con el script.');
  console.log('- No hay tablas Prisma dedicadas a "sequence log" aparte de lo anterior.');

  console.log('\n--- 5) AdminWorkspaceConfig (no se borra; queda tras limpieza) ---\n');
  console.log(`Filas en tabla: ${adminConfigRows.length}`);
  console.log(`PaymentSettings filas (no se borran): ${paymentSettingsCount}`);
  adminConfigRows.forEach((row) => {
    const s = summarizeAdminConfig(row);
    console.log(`  key=${row.key}:`, JSON.stringify(s, null, 2));
  });
  console.log(
    '\nNota: "datos de prueba" en copy (títulos funnel, plantillas, roadmap) son subjetivos; el dry run solo lista tamaños/keys.'
  );

  console.log('\n=== Fin dry run (no se modificó la base de datos) ===\n');

  if (keepIds.length === 0 && totalUsers > 0) {
    console.warn(
      '[advertencia] Ningún usuario coincide con allowlist: el script real abortaría; los conteos "User eliminados" asumen allowlist vacía = peligro.'
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
