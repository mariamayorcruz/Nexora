const { PrismaClient } = require('@prisma/client');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const founderEmails = ['info.emprendeelegante@gmail.com', 'mayorexcelsiorllc@gmail.com'];

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { in: founderEmails } },
        select: { id: true, email: true },
    });

    if (users.length === 0) {
        console.log('No founder users found in DB.');
        return;
    }

    console.log('Before reset:');
    for (const user of users) {
        const jobs = await prisma.aiWorkspaceJob.count({ where: { userId: user.id } });
        const buckets = await prisma.aiWorkspaceUsage.count({ where: { userId: user.id } });
        console.log(`${user.email} -> jobs:${jobs} usageBuckets:${buckets}`);
    }

    const userIds = users.map((u) => u.id);

    const deletedJobs = await prisma.aiWorkspaceJob.deleteMany({
        where: { userId: { in: userIds } },
    });

    const deletedBuckets = await prisma.aiWorkspaceUsage.deleteMany({
        where: { userId: { in: userIds } },
    });

    console.log(`Deleted jobs: ${deletedJobs.count}`);
    console.log(`Deleted usage buckets: ${deletedBuckets.count}`);

    console.log('After reset:');
    for (const user of users) {
        const jobs = await prisma.aiWorkspaceJob.count({ where: { userId: user.id } });
        const buckets = await prisma.aiWorkspaceUsage.count({ where: { userId: user.id } });
        console.log(`${user.email} -> jobs:${jobs} usageBuckets:${buckets}`);
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
