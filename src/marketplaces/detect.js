import { AppError } from '../errors.js';

export function detectMarketplace(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new AppError(`Invalid marketplace URL: ${input}`, 'INVALID_URL');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'wolt.com' || hostname.endsWith('.wolt.com')) return 'wolt';
  if (hostname === 'foodora.cz' || hostname === 'www.foodora.cz' || hostname.endsWith('.foodora.cz')) return 'foodora';
  if (hostname === 'food.bolt.eu') return 'bolt';
  if (hostname === 'glovoapp.com' || hostname === 'www.glovoapp.com' || hostname.endsWith('.glovoapp.com')) return 'glovo';
  if (hostname === 'pyszne.pl' || hostname === 'www.pyszne.pl') return 'pyszne';
  if (hostname === 'just-eat.co.uk' || hostname === 'www.just-eat.co.uk' || hostname.endsWith('.just-eat.co.uk')) return 'pyszne';
  if (hostname === 'takeaway.com' || hostname === 'www.takeaway.com' || hostname.endsWith('.takeaway.com')) return 'pyszne';
  if (hostname === 'ubereats.com' || hostname === 'www.ubereats.com' || hostname.endsWith('.ubereats.com')) return 'uber';
  throw new AppError(`Unsupported marketplace host: ${url.hostname}`, 'UNSUPPORTED_MARKETPLACE');
}
