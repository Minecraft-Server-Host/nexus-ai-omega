/**
 * Nexus AI Omega — Database Seed
 * Seeds: Owner + CoOwner NexusTeamMembers (bootstrap)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEAM_SEED = [
  {
    userId: '1097607057244442764',
    username: 'NexusOwner',
    rank: 'OWNER',
    role: 'OWNER',
    status: 'ACTIVE',
    active: true,
    permissions: ['*'],
    verified: true,
    badges: ['👑', '🌐', '⚡'],
    twoFactorEnabled: true,
  },
  {
    userId: '1056815951980527678',
    username: 'NexusCoOwner',
    rank: 'CO_OWNER',
    role: 'CO_OWNER',
    status: 'ACTIVE',
    active: true,
    permissions: [
      'global.ban', 'global.unban', 'global.userinfo', 'global.blacklist',
      'team.manage', 'team.add', 'team.remove', 'team.promote', 'team.demote',
      'team.suspend', 'team.activate', 'team.info', 'team.list',
      'server.manage', 'ai.manage', 'security.manage', 'analytics.view',
    ],
    verified: true,
    badges: ['💎', '🌐'],
    twoFactorEnabled: true,
  },
];

async function main() {
  console.log('🌱 Nexus AI Omega — Seeding database…');

  for (const member of TEAM_SEED) {
    await prisma.nexusTeamMember.upsert({
      where: { userId: member.userId },
      update: {
        rank: member.rank,
        role: member.role,
        status: member.status,
        active: member.active,
        permissions: member.permissions,
        verified: member.verified,
        badges: member.badges,
      },
      create: {
        ...member,
        joinDate: new Date(),
        lastSeen: new Date(),
        lastActive: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`  ✅ Upserted team member: ${member.username} (${member.rank})`);
  }

  const count = await prisma.nexusTeamMember.count();
  console.log(`\n✅ Seed complete — ${count} Nexus Team members in DB`);
  console.log('  👑 Owner:    1097607057244442764 — ACTIVE');
  console.log('  💎 Co-Owner: 1056815951980527678 — ACTIVE');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
