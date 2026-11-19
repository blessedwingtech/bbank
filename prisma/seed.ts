import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminEmail = 'admin@bbank.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const hashedPassword = await bcrypt.hash('Admin@2024!', saltRounds);

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        role: Role.admin,
        isActive: true,
      },
    });
    console.log(`Default admin created: ${admin.email}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Create demo manager if not exists
  const managerEmail = 'manager@bbank.com';
  const existingManager = await prisma.user.findUnique({
    where: { email: managerEmail },
  });
  if (!existingManager) {
    await prisma.user.create({
      data: {
        username: 'manager',
        email: managerEmail,
        password: hashedPassword,
        firstName: 'Bank',
        lastName: 'Manager',
        role: Role.manager,
        isActive: true,
      },
    });
    console.log(`Default manager created: ${managerEmail}`);
  }

  // Create demo user if not exists
  const userEmail = 'user@bbank.com';
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });
  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        username: 'client1',
        email: userEmail,
        password: hashedPassword,
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '+33612345678',
        address: '10 Rue de la Paix, Paris',
        role: Role.user,
        isActive: true,
      },
    });
    console.log(`Default client created: ${user.email}`);

    // Create a demo checking account
    await prisma.account.create({
      data: {
        accountNumber: 'BB-12345678',
        owner: `${user.firstName} ${user.lastName}`,
        accountType: 'checking',
        balance: 1500.0,
        status: 'active',
        userId: user.id,
      },
    });

    // Create a demo savings account
    await prisma.account.create({
      data: {
        accountNumber: 'BB-87654321',
        owner: `${user.firstName} ${user.lastName}`,
        accountType: 'savings',
        balance: 5000.0,
        accumulatedInterest: 25.0,
        status: 'active',
        userId: user.id,
      },
    });
    console.log('Demo accounts created for client1');
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
