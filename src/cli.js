import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { runImport } from './importer.js';
import { createLogger } from './logger.js';
import { clearChoiceMenu } from './choice/clear-menu.js';

export function parseArgs(argv) {
  const args = {
    url: undefined,
    output: undefined,
    dryRun: undefined,
    clearChoiceMenu: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') {
      args.url = argv[++i];
    } else if (arg === '--output') {
      args.output = argv[++i];
    } else if (arg === '--clear-choice-menu') {
      args.clearChoiceMenu = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--live') {
      args.dryRun = false;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (!args.url && !arg.startsWith('--')) {
      args.url = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  npm start -- --url <marketplace-url> [--dry-run] [--output payload.json]
  npm start -- <marketplace-url> --live
  npm start -- --clear-choice-menu --dry-run [--output clear-payload.json]
  npm start -- --clear-choice-menu --live

Environment:
  CHOICE_API_BASE_URL       Choice Open API base URL
  CHOICE_BEARER_TOKEN       Bearer token for Choice
  CHOICE_MENU_LANGUAGE      Language path for POST /menu/:language/full
  CHOICE_MENU_CHECK_PATH    Optional GET path used to check existing menu items, defaults to /menu/:language/full/list
  DRY_RUN                   true to skip Choice write calls
`.trim());
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const logger = createLogger();
  const config = loadConfig({ dryRun: args.dryRun });
  if (args.clearChoiceMenu) {
    await clearChoiceMenu({
      config,
      logger,
      outputPath: args.output,
    });
    return;
  }

  if (!args.url) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const result = await runImport({
    marketplaceUrl: args.url,
    outputPath: args.output,
    config,
    logger,
  });

  logger.summary(result.summary);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
  console.error(error.message);
  if (error.details?.response && process.env.DEBUG_CHOICE_ERRORS === 'true') {
    console.error(JSON.stringify(error.details.response, null, 2));
  } else if (error.details && process.env.DEBUG_MARKETPLACE_ERRORS === 'true') {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
  });
}
