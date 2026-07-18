import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const likes = await prisma.animeLike.findMany({
    where: { anilistId: 46569 }
  });
  console.log("HELLS PARADISE LIKES:", likes);
}
main().finally(() => prisma.$disconnect());
