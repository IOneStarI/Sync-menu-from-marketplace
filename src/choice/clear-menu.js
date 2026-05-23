import fs from 'node:fs/promises';
import { ChoiceClient } from './client.js';

export function createEmptyFullMenuPayload() {
  return {
    sections: [
      {
        posID: 'section-empty-menu',
        name: 'Empty menu',
        description: '',
      },
    ],
    categories: [],
    dishOptions: [],
    dishes: [],
  };
}

export async function clearChoiceMenu({ config, logger, outputPath }) {
  const payload = createEmptyFullMenuPayload();

  if (outputPath) {
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    logger.info(`Clear payload written to ${outputPath}`);
  }

  if (config.dryRun) {
    logger.info('DRY_RUN=true, skipped Choice menu clear.');
    return { payload, response: null };
  }

  const client = new ChoiceClient(config.choice);
  const response = await client.createFullMenu(config.choice.language, payload);
  logger.info(`Choice menu cleared with POST /menu/${config.choice.language}/full.`);
  return { payload, response };
}
