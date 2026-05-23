import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChoiceClient } from './choice/client.js';
import { loadConfig } from './config.js';
import { parseMenuInstructionsWithAI, isDestructiveAction, isDirectApiAction, validateActionPlan } from './menu-assistant/plan.js';
import { normalizeFullMenu } from './menu-assistant/apply.js';
import { executeDirectApiAction } from './menu-assistant/direct-api.js';
import { executeCrudAction } from './menu-assistant/crud-api.js';

export function parseAssistantArgs(argv) {
  const args = {
    file: undefined,
    output: undefined,
    rollbackDir: 'rollback',
    logDir: 'logs',
    dryRun: undefined,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--rollback-dir') args.rollbackDir = argv[++i];
    else if (arg === '--log-dir') args.logDir = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--live') args.dryRun = false;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (!args.file && !arg.startsWith('--')) args.file = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  npm run ai-menu -- --file commands.txt --dry-run
  npm run ai-menu -- commands.txt --live
  npm run ai-menu -- commands.txt --live --force

Options:
  --file <path>          Plain text instruction file
  --dry-run             Build and validate the plan, but do not POST changes
  --live                Allow live POST when DRY_RUN is false
  --force               Required for delete/remove actions
  --output <path>       Write action plan and changed full-menu payload
  --rollback-dir <dir>  Save previous menu snapshot before live writes
  --log-dir <dir>       Write JSONL audit logs
`.trim());
}

export async function runAssistant(args, dependencies = {}) {
  const logger = dependencies.logger || console;
  if (!args.file && !args.text) throw new Error('--file is required.');

  const config = loadConfig({ dryRun: args.dryRun });
  const log = await createAuditLogger(args.logDir || 'logs');
  const text = args.text ?? await fs.readFile(path.resolve(args.file), 'utf8');
  await log.write('input.read', { file: args.file || '<inline>', length: text.length });

  const plan = await parseMenuInstructionsWithAI(text);
  await log.write('ai.plan', plan);

  const validation = validateActionPlan(plan);
  if (!validation.ok) {
    await log.write('plan.invalid', { errors: validation.errors });
    return { ok: false, status: 'invalid-plan', plan, errors: validation.errors };
  }

  if (plan.clarificationRequired || plan.actions.some((action) => action.type === 'clarification')) {
    await log.write('plan.clarification', { question: plan.clarificationQuestion });
    return { ok: false, status: 'clarification-required', plan, clarification: plan.clarificationQuestion };
  }

  const destructive = plan.actions.filter(isDestructiveAction);
  if (destructive.length > 0 && !args.force) {
    const message = 'Delete/remove actions require --force.';
    await log.write('plan.confirmation_required', { message, actions: destructive });
    return { ok: false, status: 'confirmation-required', plan, clarification: message };
  }

  const client = dependencies.client || new ChoiceClient(config.choice);
  const directActions = plan.actions.filter(isDirectApiAction);
  const crudActions = plan.actions.filter((a) => !isDirectApiAction(a) && a.type !== 'clarification');

  // Dry-run: report planned changes without any API writes
  if (config.dryRun) {
    const changes = [
      ...crudActions.map((a) => ({ type: a.type, target: a.itemName || a.categoryName || a.sectionName || a.modifierGroupName || a.packName || '' })),
      ...directActions.map((a) => ({ type: a.type, target: a.id || a.packName || a.itemName || a.reason || 'Choice API' })),
    ];
    await log.write('plan.dry-run', { changes });
    const result = { ok: true, status: 'dry-run', plan, changes, auditLog: log.filePath };
    if (args.output) {
      await fs.writeFile(path.resolve(args.output), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      await log.write('output.written', { path: args.output });
    }
    logger.log(`Dry run complete. Planned changes: ${changes.length}`);
    return result;
  }

  // Live: fetch current menu for ID lookups, then call individual CRUD endpoints
  await log.write('choice.request', { method: 'GET', path: config.choice.menuCheckPath });
  const existing = await client.getExistingMenu();
  await log.write('choice.response', { method: 'GET', path: config.choice.menuCheckPath, body: existing });

  const menu = normalizeFullMenu(existing);
  const rollbackPath = await saveRollbackSnapshot(args.rollbackDir, existing);
  await log.write('rollback.saved', { path: rollbackPath });

  const allChanges = [];
  for (const action of crudActions) {
    const change = await executeCrudAction({ client, language: config.choice.language, menu, action, logger: log });
    if (change) allChanges.push(change);
  }
  for (const action of directActions) {
    await executeDirectApiAction({ client, language: config.choice.language, action, logger: log });
    allChanges.push({ type: action.type, target: action.id || action.packName || action.itemName || action.reason || 'Choice API' });
  }

  const result = { ok: true, status: 'applied', plan, changes: allChanges, rollbackPath, auditLog: log.filePath };
  if (args.output) {
    await fs.writeFile(path.resolve(args.output), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await log.write('output.written', { path: args.output });
  }
  logger.log(`Applied changes: ${allChanges.length}`);
  return result;
}

async function createAuditLogger(logDir) {
  await fs.mkdir(logDir, { recursive: true });
  const filePath = path.join(logDir, `ai-menu-assistant-${timestamp()}.jsonl`);
  return {
    filePath,
    async write(event, data) {
      await fs.appendFile(filePath, `${JSON.stringify({ at: new Date().toISOString(), event, data })}\n`, 'utf8');
    },
  };
}

async function saveRollbackSnapshot(rollbackDir, menu) {
  await fs.mkdir(rollbackDir, { recursive: true });
  const filePath = path.join(rollbackDir, `choice-menu-before-${timestamp()}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(menu, null, 2)}\n`, 'utf8');
  return filePath;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseAssistantArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runAssistant(args);
  console.log(JSON.stringify({
    ok: result.ok,
    status: result.status,
    changes: result.changes?.length || 0,
    clarification: result.clarification,
    auditLog: result.auditLog,
  }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
