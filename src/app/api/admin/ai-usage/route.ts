import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalJobs, jobsThisMonth, recentJobs] = await Promise.all([
      prisma.aiWorkspaceJob.count(),
      prisma.aiWorkspaceJob.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.aiWorkspaceJob.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
    ]);

    const creditsThisMonth = await prisma.aiWorkspaceJob.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { creditsUsed: true },
    });

    const jobsByToolRaw = await prisma.aiWorkspaceJob.groupBy({
      by: ['tool'],
      _count: { tool: true },
      _sum: { creditsUsed: true },
      orderBy: { _count: { tool: 'desc' } },
    });

    const jobsByTool = jobsByToolRaw.map((item) => ({
      tool: item.tool,
      count: item._count.tool,
      credits: item._sum.creditsUsed || 0,
    }));

    return NextResponse.json({
      usage: {
        totalJobs,
        jobsThisMonth,
        creditsUsedThisMonth: creditsThisMonth._sum.creditsUsed || 0,
        topTool: jobsByTool[0]?.tool || 'ad-copy',
        topUser: recentJobs[0]?.user?.email || 'N/A',
        jobsByTool,
        recentJobs: recentJobs.map((job) => ({
          id: job.id,
          tool: job.tool,
          user: job.user?.name || job.user?.email || 'Usuario',
          creditsUsed: job.creditsUsed,
          createdAt: job.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json({ error: 'Error fetching AI usage' }, { status: 500 });
  }
}
