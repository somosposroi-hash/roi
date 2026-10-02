import { runSalesServiceTests } from './sales.service.spec';
import { runBarcodeTests } from './barcode.spec';
import { prisma } from '../config/database';

export async function runAllUnitTests() {
  console.log('====================================================');
  console.log('🧪 EJECUTANDO SUITE DE PRUEBAS UNITARIAS DE POS');
  console.log('   - Concurrencia y Transacciones Atómicas ($transaction)');
  console.log('   - Rollback por Stock Insuficiente');
  console.log('   - Prevención de Race Conditions');
  console.log('   - Búsqueda Ultra Rápida por Código de Barras');
  console.log('====================================================\n');

  const start = Date.now();
  const salesSuite = await runSalesServiceTests();
  const barcodeSuite = await runBarcodeTests();
  const totalDuration = Date.now() - start;

  const allSuites = [salesSuite, barcodeSuite];
  const totalTests = allSuites.reduce((acc, s) => acc + s.total, 0);
  const totalPassed = allSuites.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = allSuites.reduce((acc, s) => acc + s.failed, 0);

  for (const suite of allSuites) {
    console.log(`\n📦 Suite: ${suite.suite} (${suite.passed}/${suite.total} pasaron)`);
    for (const r of suite.results) {
      const statusIcon = r.passed ? '✅ PASÓ' : '❌ FALLÓ';
      console.log(`   ${statusIcon} [${r.durationMs}ms] ${r.name}`);
      if (r.error) {
        console.log(`       ⚠️  Error: ${r.error}`);
      }
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${totalPassed}/${totalTests} pruebas pasaron en ${totalDuration}ms`);
  console.log('----------------------------------------------------\n');

  return {
    success: totalFailed === 0,
    totalTests,
    totalPassed,
    totalFailed,
    durationMs: totalDuration,
    suites: allSuites,
  };
}

if (process.argv[1] && process.argv[1].endsWith('run-tests.ts')) {
  runAllUnitTests()
    .then(async (res) => {
      await prisma.$disconnect();
      if (!res.success) process.exit(1);
    })
    .catch(async (e) => {
      console.error('Test execution failed:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
