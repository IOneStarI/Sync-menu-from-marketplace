import fs from 'node:fs/promises';
import { ChoiceClient } from './choice/client.js';
import { detectMarketplace } from './marketplaces/detect.js';
import { parseBoltMenu } from './marketplaces/bolt.js';
import { parseFoodoraMenu } from './marketplaces/foodora.js';
import { parseGlovoMenu } from './marketplaces/glovo.js';
import { parsePyszneMenu } from './marketplaces/pyszne.js';
import { parseUberMenu } from './marketplaces/uber.js';
import { parseWoltMenu } from './marketplaces/wolt.js';
import { mapToChoiceFullMenu } from './mapper/choice-full-menu.js';
import { AppError } from './errors.js';

const parsers = {
  bolt: parseBoltMenu,
  foodora: parseFoodoraMenu,
  glovo: parseGlovoMenu,
  pyszne: parsePyszneMenu,
  uber: parseUberMenu,
  wolt: parseWoltMenu,
};

export async function runImport({ marketplaceUrl, outputPath, config, logger }) {
  const marketplace = detectMarketplace(marketplaceUrl);
  const parser = parsers[marketplace];
  if (!parser) {
    throw new AppError(`Unsupported marketplace link: ${marketplaceUrl}`, 'UNSUPPORTED_MARKETPLACE');
  }

  logger.info(`Marketplace detected: ${marketplace}`);
  const normalizedMenu = await parser(marketplaceUrl, { logger });
  const mapped = mapToChoiceFullMenu(normalizedMenu);

  if (outputPath) {
    await fs.writeFile(outputPath, `${JSON.stringify(mapped.payload, null, 2)}\n`, 'utf8');
    logger.info(`Payload written to ${outputPath}`);
  }

  if (config.dryRun) {
    logger.info('DRY_RUN=true, skipped Choice API write.');
    return {
      payload: mapped.payload,
      summary: createSummary(marketplace, mapped, 'dry-run'),
    };
  }

  const client = new ChoiceClient(config.choice);
  await assertChoiceRestaurantIsEmpty(client);
  await client.createFullMenu(config.choice.language, mapped.payload);

  return {
    payload: mapped.payload,
    summary: createSummary(marketplace, mapped, 'imported'),
  };
}

async function assertChoiceRestaurantIsEmpty(client) {
  const existing = await client.getExistingMenu();
  const counts = countExistingItems(existing);
  if (counts.dishes > 0 || counts.categories > 0) {
    throw new AppError(
      `Choice restaurant already contains menu data (${counts.categories} categories, ${counts.dishes} dishes). Import stopped.`,
      'CHOICE_MENU_NOT_EMPTY',
    );
  }
}

function countExistingItems(existing) {
  const data = existing?.data && typeof existing.data === 'object' ? existing.data : existing;
  return {
    categories: Array.isArray(data?.categories) ? data.categories.length : 0,
    dishes: Array.isArray(data?.dishes)
      ? data.dishes.length
      : Array.isArray(data?.menu)
        ? data.menu.length
        : 0,
  };
}

function createSummary(marketplace, mapped, status) {
  return {
    marketplace,
    status,
    sections: mapped.payload.sections.length,
    categories: mapped.payload.categories.length,
    items: mapped.sourceCounts.items,
    modifiers: mapped.payload.dishOptions.length,
    importedItems: mapped.payload.dishes.length,
    inactiveItems: mapped.payload.dishes.filter((dish) => dish.active === false || dish.attributes?.includes('SOLD_OUT')).length,
    failedItems: mapped.failedItems,
    warnings: mapped.warnings,
  };
}
