import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

const SAMPLE_PRODUCTS = [
  {
    barcode: '7591011000012',
    sku: 'ALM-PAN-01',
    name: 'Harina P.A.N. Blanca 1kg',
    category: 'Alimentos',
    price: 1.40,
    cost: 0.95,
    stock: 45,
    minStock: 15,
    unit: 'PAQ',
  },
  {
    barcode: '7591011000029',
    sku: 'BEB-POL-01',
    name: 'Cerveza Polar Pilsen 355ml',
    category: 'Licores y Bebidas',
    price: 1.25,
    cost: 0.80,
    stock: 72,
    minStock: 24,
    unit: 'BOT',
  },
  {
    barcode: '7591011000036',
    sku: 'ALM-NUT-01',
    name: 'Nutella Ferrero 350g',
    category: 'Importados & Dulces',
    price: 5.50,
    cost: 3.80,
    stock: 4, // Low stock -> trigger warning
    minStock: 10,
    unit: 'UND',
  },
  {
    barcode: '7591011000043',
    sku: 'LAC-LECH-01',
    name: 'Leche en Polvo La Campiña 900g',
    category: 'Lácteos',
    price: 9.20,
    cost: 7.10,
    stock: 2, // Low stock -> trigger warning
    minStock: 8,
    unit: 'UND',
  },
  {
    barcode: '7591011000050',
    sku: 'LIC-RST-01',
    name: 'Ron Santa Teresa Linaje 0.75L',
    category: 'Licores y Bebidas',
    price: 13.50,
    cost: 9.80,
    stock: 12,
    minStock: 6,
    unit: 'BOT',
  },
  {
    barcode: '7591011000067',
    sku: 'ALM-CAFE-01',
    name: 'Café Fama de América Molido 500g',
    category: 'Alimentos',
    price: 3.80,
    cost: 2.60,
    stock: 20,
    minStock: 10,
    unit: 'PAQ',
  },
  {
    barcode: '7591011000074',
    sku: 'ALM-ACEI-01',
    name: 'Aceite de Maíz Mazeite 1L',
    category: 'Alimentos',
    price: 4.10,
    cost: 2.90,
    stock: 18,
    minStock: 8,
    unit: 'BOT',
  },
  {
    barcode: '7591011000081',
    sku: 'LAC-QUES-01',
    name: 'Queso Guayanés Fresco 500g',
    category: 'Lácteos & Delicatessen',
    price: 4.50,
    cost: 3.10,
    stock: 0, // CRITICAL: 0 units -> triggers critical alert!
    minStock: 5,
    unit: 'PAQ',
  },
  {
    barcode: '7591011000098',
    sku: 'SNK-PRIN-01',
    name: 'Papas Pringles Original 158g',
    category: 'Snacks',
    price: 2.95,
    cost: 1.90,
    stock: 30,
    minStock: 12,
    unit: 'UND',
  },
  {
    barcode: '7591011000104',
    sku: 'HIG-COLG-01',
    name: 'Crema Dental Colgate Total 12 100ml',
    category: 'Higiene & Cuidado',
    price: 2.20,
    cost: 1.40,
    stock: 25,
    minStock: 10,
    unit: 'UND',
  },
  {
    barcode: '7591011000111',
    sku: 'ALM-ARRO-01',
    name: 'Arroz Mary Tradicional 1kg',
    category: 'Alimentos',
    price: 1.35,
    cost: 0.90,
    stock: 50,
    minStock: 15,
    unit: 'PAQ',
  },
  {
    barcode: '7591011000128',
    sku: 'ALM-PAS-01',
    name: 'Pasta Primor Spaghetti 1kg',
    category: 'Alimentos',
    price: 1.60,
    cost: 1.05,
    stock: 35,
    minStock: 12,
    unit: 'PAQ',
  },
  {
    barcode: '7591011000135',
    sku: 'LIC-WHIS-01',
    name: 'Whisky Buchanan\'s 12 Años 750ml',
    category: 'Licores y Bebidas',
    price: 32.00,
    cost: 24.50,
    stock: 8,
    minStock: 4,
    unit: 'BOT',
  },
  {
    barcode: '7591011000142',
    sku: 'BEB-RED-01',
    name: 'Bebida Energizante Red Bull 250ml',
    category: 'Licores y Bebidas',
    price: 2.50,
    cost: 1.65,
    stock: 40,
    minStock: 15,
    unit: 'UND',
  },
  {
    barcode: '7591011000159',
    sku: 'ALM-ATUN-01',
    name: 'Atún Margarita en Aceite 170g',
    category: 'Alimentos',
    price: 1.85,
    cost: 1.20,
    stock: 3, // Low stock -> trigger warning
    minStock: 10,
    unit: 'UND',
  }
];

export async function seedDatabase() {
  console.log('Seeding Bodegón products...');
  for (const item of SAMPLE_PRODUCTS) {
    await prisma.product.upsert({
      where: { barcode: item.barcode },
      update: {},
      create: item,
    });
  }
  console.log(`Database seeded with ${SAMPLE_PRODUCTS.length} Bodegón products.`);

  // Seed default admin user
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const hashedPassword = await bcryptjs.hash('1234.', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Administrador General',
        isAdmin: true,
      },
    });
    console.log('Usuario administrador inicial (admin / 1234.) creado con éxito.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
