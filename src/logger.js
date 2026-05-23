export function createLogger() {
  return {
    info(message) {
      console.log(message);
    },
    warn(message) {
      console.warn(`Warning: ${message}`);
    },
    error(message) {
      console.error(`Error: ${message}`);
    },
    summary(summary) {
      console.log('\nImport summary');
      console.log(`Marketplace detected: ${summary.marketplace}`);
      console.log(`Total sections found: ${summary.sections}`);
      console.log(`Total categories found: ${summary.categories}`);
      console.log(`Total items found: ${summary.items}`);
      console.log(`Total additions/modifiers found: ${summary.modifiers}`);
      console.log(`Total items imported: ${summary.importedItems}`);
      console.log(`Items imported as inactive: ${summary.inactiveItems}`);
      console.log(`Failed items: ${summary.failedItems.length}`);
      if (summary.warnings.length > 0) {
        console.log(`Warnings: ${summary.warnings.length}`);
        for (const warning of summary.warnings) console.log(`- ${warning}`);
      } else {
        console.log('Warnings: 0');
      }
    },
  };
}
