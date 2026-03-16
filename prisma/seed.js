const bcrypt = require("bcrypt");
const prisma = require("../src/prisma");

async function main() {
  const adminPass = await bcrypt.hash("admin123", 10);
  const clientPass = await bcrypt.hash("client123", 10);
  const photoPass = await bcrypt.hash("photo123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      passwordHash: adminPass,
      role: "ADMIN",
    },
    create: {
      email: "admin@example.com",
      passwordHash: adminPass,
      role: "ADMIN",
    },
  });

  const photographerUser = await prisma.user.upsert({
    where: { email: "photo@example.com" },
    update: {
      passwordHash: photoPass,
      role: "PHOTOGRAPHER",
    },
    create: {
      email: "photo@example.com",
      passwordHash: photoPass,
      role: "PHOTOGRAPHER",
    },
  });

  const client = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {
      passwordHash: clientPass,
      role: "CLIENT",
    },
    create: {
      email: "client@example.com",
      passwordHash: clientPass,
      role: "CLIENT",
    },
  });

  const profile = await prisma.photographerProfile.upsert({
    where: { userId: photographerUser.id },
    update: {
      displayName: "Art Photo",
      city: "Kazan",
      timezone: "Europe/Moscow",
      isActive: true,
    },
    create: {
      userId: photographerUser.id,
      displayName: "Art Photo",
      bio: "Studio and outdoor photoshoots",
      city: "Kazan",
      timezone: "Europe/Moscow",
      isActive: true,
    },
  });

  await prisma.service.createMany({
    data: [
      {
        photographerId: profile.id,
        title: "Portrait 1h",
        durationMin: 60,
        priceCents: 500000,
        isActive: true,
      },
      {
        photographerId: profile.id,
        title: "Family 2h",
        durationMin: 120,
        priceCents: 900000,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seed completed:", {
    admin: admin.email,
    photographer: photographerUser.email,
    client: client.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
