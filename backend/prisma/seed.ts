/**
 * HIIEKO Development Seed Script
 * 
 * Creates a safe development-only admin user for authenticated integration testing.
 * 
 * ENVIRONMENT VARIABLES (backend/.env):
 *   DEV_SEED_EMAIL     - email for the dev user (default: dev@hiieko.local)
 *   DEV_SEED_PASSWORD  - password for the dev user (default: DevPassword123!)
 *   DEV_SEED_FULL_NAME - display name (default: HIIEKO Development Admin)
 * 
 * IDEMPOTENT: running twice will NOT create duplicates.
 * 
 * RUN:
 *   cd backend
 *   npx prisma db seed
 *   or
 *   npm run seed
 * 
 * NEVER USE THESE CREDENTIALS IN PRODUCTION.
 */

import { PrismaClient, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from backend/.env (this script runs from backend/prisma/)
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

// Safe development defaults - NEVER use these in production
const DEV_SEED_EMAIL = process.env.DEV_SEED_EMAIL || 'dev@hiieko.local';
const DEV_SEED_PASSWORD = process.env.DEV_SEED_PASSWORD || 'DevPassword123!';
const DEV_SEED_FULL_NAME = process.env.DEV_SEED_FULL_NAME || 'HIIEKO Development Admin';

const SALT_ROUNDS = 10;

async function main() {
  console.log('========================================');
  console.log('HIIEKO Development Seed');
  console.log('========================================');
  console.log(`User email: ${DEV_SEED_EMAIL}`);
  console.log();

  // Safety check - refuse explicit production
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Refusing seed in production.');
    process.exit(1);
  }

  // Step 1: Create/find Organization
  console.log('[1/3] Organization...');
  const orgName = 'HIIEKO Development';
  
  let organization = await prisma.organization.findFirst({
    where: { name: orgName },
  });

  if (organization) {
    console.log(`      Found: "${organization.name}"`);
  } else {
    organization = await prisma.organization.create({
      data: { name: orgName },
    });
    console.log(`      Created: "${organization.name}"`);
  }

  // Step 2: Check if user exists
  console.log();
  console.log('[2/3] User...');

  let user = await prisma.user.findUnique({
    where: { email: DEV_SEED_EMAIL.toLowerCase() },
    include: { profile: true },
  });

  if (user) {
    console.log(`      Found existing user: ${user.email} (${user.role})`);
    console.log();
    console.log('========================================');
    console.log('Seed OK (user already exists)');
    console.log('========================================');
    console.log();
    console.log('Login: POST http://localhost:4000/api/auth/login');
    console.log(`  { "email": "${DEV_SEED_EMAIL}", "password": "***" }`);
    console.log();
    return;
  }

  // Step 3: Create User + Profile
  console.log('      Hashing password...');
  const passwordHash = await bcrypt.hash(DEV_SEED_PASSWORD, SALT_ROUNDS);

  console.log('      Creating ADMIN user...');
  user = await prisma.user.create({
    data: {
      email: DEV_SEED_EMAIL.toLowerCase(),
      password_hash: passwordHash,
      role: UserRoleEnum.ADMIN,
      is_active: true,
      organization_id: organization.id,
      profile: {
        create: {
          full_name: DEV_SEED_FULL_NAME,
          language: 'ro',
        },
      },
    },
    include: { profile: true },
  });

  // Summary
  console.log();
  console.log('========================================');
  console.log('Seed CREATED successfully');
  console.log('========================================');
  console.log();
  console.log('Organization:', organization.name);
  console.log('User:        ', user.email);
  console.log('Role:        ', user.role);
  console.log('Full Name:   ', user.profile?.full_name);
  console.log();
  console.log('Login:');
  console.log('  POST http://localhost:4000/api/auth/login');
  console.log('  Content-Type: application/json');
  console.log(`  Body: { "email": "${DEV_SEED_EMAIL}", "password": "${DEV_SEED_PASSWORD}" }`);
  console.log();
  console.log('Then call GET /api/auth/me with Authorization: Bearer <accessToken>');
  console.log();
  console.log('WARNING: This is DEVELOPMENT ONLY. Never use in production.');
}

main()
  .then(async () => {
    console.log();
    console.log('========================================');
    console.log('EXTENDED TEST DATA SEED');
    console.log('========================================');
    console.log();

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { name: 'HIIEKO Development' },
    });

    if (!organization) {
      console.error('ERROR: Organization not found');
      process.exit(1);
    }

    // Create team leaders
    console.log('[4/4] Creating Team Leaders...');
    const teamLeaders = [];
    const teamLeadersData = [
      { email: 'ion.munteanu@hiieko.local', fullName: 'Ion Munteanu' },
      { email: 'maria.popescu@hiieko.local', fullName: 'Maria Popescu' },
      { email: 'andrei.popovici@hiieko.local', fullName: 'Andrei Popovici' },
    ];

    for (const data of teamLeadersData) {
      let user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (!user) {
        const passwordHash = await bcrypt.hash('TeamLeader123!', SALT_ROUNDS);
        user = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            password_hash: passwordHash,
            role: 'TEAM_LEADER' as any,
            is_active: true,
            organization_id: organization.id,
            profile: {
              create: {
                full_name: data.fullName,
                language: 'ro',
              },
            },
          },
        });
        console.log(`      Created: ${user.email}`);
      } else {
        console.log(`      Found: ${user.email}`);
      }
      teamLeaders.push(user);
    }

    // Create workers
    console.log();
    console.log('[5/5] Creating Workers...');
    const workers = [];
    const workersData = [
      { email: 'costin.dumitrescu@hiieko.local', fullName: 'Costin Dumitrescu', teamLeaderId: teamLeaders[0].id },
      { email: 'ramona.popa@hiieko.local', fullName: 'Ramona Popa', teamLeaderId: teamLeaders[0].id },
      { email: 'daniel.georgescu@hiieko.local', fullName: 'Daniel Georgescu', teamLeaderId: teamLeaders[1].id },
      { email: 'ioana.niculescu@hiieko.local', fullName: 'Ioana Niculescu', teamLeaderId: teamLeaders[1].id },
      { email: 'alexandru.ivan@hiieko.local', fullName: 'Alexandru Ivan', teamLeaderId: teamLeaders[2].id },
    ];

    for (const data of workersData) {
      let user = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (!user) {
        const passwordHash = await bcrypt.hash('Worker123!', SALT_ROUNDS);
        user = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            password_hash: passwordHash,
            role: 'WORKER' as any,
            is_active: true,
            organization_id: organization.id,
            profile: {
              create: {
                full_name: data.fullName,
                language: 'ro',
              },
            },
          },
        });
        console.log(`      Created: ${user.email}`);
      } else {
        console.log(`      Found: ${user.email}`);
      }
      workers.push(user);
    }

    console.log();
    console.log('========================================');
    console.log('COMPLETE SEED CREATED successfully');
    console.log('========================================');
    console.log();
    console.log('Organization:', organization.name);
    console.log('Team Leaders:', teamLeaders.length);
    console.log('Workers:     ', workers.length);
    console.log();
    console.log('Login: POST http://localhost:4000/api/auth/login');
    console.log(`  { \"email\": \"${DEV_SEED_EMAIL}\", \"password\": \"***\" }`);
    console.log();
  })
  .catch(async (err) => {
    console.error('SEED FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });