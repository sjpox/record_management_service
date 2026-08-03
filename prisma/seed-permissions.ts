import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const ADMIN_ONLY: [string, string][] = [
  ['users', 'read'],
  ['users', 'write'],
  ['backup', 'write'],
  ['maintenance', 'write'],
  ['voucher-ageing', 'write'],
  ['locations', 'write'],
  ['shelf-map', 'write'],
  ['announcements', 'write'],
  ['document-types', 'write'],
  ['permissions', 'read'],
  ['permissions', 'write'],
  ['audit-logs', 'read'],
  ['comms', 'view-all'],
  ['maintenance', 'bypass'],
];

const ENCODER_ALLOWED: [string, string][] = [
  ['vouchers', 'read'],
  ['vouchers', 'write'],
  ['comms', 'read'],
  ['comms', 'write'],
  ['index-documents', 'read'],
  ['index-documents', 'write'],
  ['other-documents', 'read'],
  ['other-documents', 'write'],
  ['locations', 'read'],
  ['shelf-map', 'read'],
  ['announcements', 'read'],
  ['document-types', 'read'],
  ['recipient-groups', 'read'],
  ['recipient-groups', 'write'],
  ['notifications', 'read'],
  ['chat', 'read'],
  ['chat', 'write'],
  ['voucher-ageing', 'read'],
];

async function main() {
  const entries: { Role: string; Resource: string; Action: string; Allowed: boolean }[] = [];

  for (const [resource, action] of ADMIN_ONLY) {
    entries.push({ Role: 'admin', Resource: resource, Action: action, Allowed: true });
    entries.push({ Role: 'encoder', Resource: resource, Action: action, Allowed: false });
  }

  for (const [resource, action] of ENCODER_ALLOWED) {
    entries.push({ Role: 'admin', Resource: resource, Action: action, Allowed: true });
    entries.push({ Role: 'encoder', Resource: resource, Action: action, Allowed: true });
  }

  for (const entry of entries) {
    await prisma.rolePermission.upsert({
      where: { Role_Resource_Action: { Role: entry.Role, Resource: entry.Resource, Action: entry.Action } },
      create: entry,
      update: { Allowed: entry.Allowed },
    });
  }

  console.log(`Seeded ${entries.length} permission entries.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
