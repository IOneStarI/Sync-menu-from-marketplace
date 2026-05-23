---
name: sync-menu-from-marketplace
description: Build or update a Node.js tool that imports restaurant menus from marketplace restaurant links into Choice through the Choice Open API endpoint POST /menu/:language/full. Use when Codex needs to implement, extend, debug, or validate marketplace menu import flows with sections, categories, dish options, dishes, bearer-token authentication, starting with Wolt, Foodora, Bolt Food, Uber Eats, Glovo, and Pyszne/Just Eat and designed for additional marketplace parsers.
---

# Sync Menu From Marketplace

## Overview

Create a modular Node.js importer that accepts a marketplace restaurant URL, extracts the full menu, maps it to the Choice Open API full-menu payload, and creates a new Choice menu only when the connected Choice restaurant is empty. Supported marketplaces start with Wolt, Foodora, Bolt Food, Uber Eats, Glovo, and Pyszne/Just Eat.

## Core Workflow

1. Accept a marketplace restaurant link as input.
2. Detect the marketplace from the URL.
3. Parse categories, items, prices, images, descriptions, availability, and additions/modifiers/options.
4. Map marketplace data into the Choice `POST /menu/:language/full` structure.
5. Check whether the connected Choice restaurant already has menu items.
6. Check existing Choice menu data with `GET /menu/:language/full/list`.
7. Stop without importing if the restaurant already contains items, and show a clear message.
8. Create a new menu in Choice when the restaurant is empty by calling `POST /menu/:language/full`.
9. Log imported items, inactive items, failed items, warnings, and missing fields.
10. Print a final summary with marketplace, category, item, modifier, import, inactive, failure, and warning counts.

## Implementation Standards

- Use Node.js with `async`/`await`.
- Keep credentials, menu language, Choice API base URL, and bearer token in environment variables or a config file.
- Store local secrets in `.env`; commit only `.env.example`.
- Send Choice authentication as `Authorization: Bearer ${CHOICE_BEARER_TOKEN}`.
- Do not hardcode restaurant menu data.
- Use regular marketplace prices, not discounted prices.
- Import unavailable marketplace items, but mark them inactive in Choice.
- Add marketplace image URLs as Choice image links in `media`.
- Keep the importer flexible so new marketplaces can be added through separate parser modules.
- Keep common parser helpers in `src/utils/parser.js`, embedded-state scraping helpers in `src/utils/html-scraper.js`, and shared defaults in `src/constants.js`; do not copy/paste these helpers into each marketplace parser.
- Read the current Choice Open API documentation before implementing or changing payloads: `https://open-api.stage-choiceqr.online/docs#/`.

## Suggested Module Boundaries

- `marketplaces/detect`: identify supported marketplaces from restaurant URLs.
- `marketplaces/bolt`: fetch and normalize Bolt Food public menu trees.
- `marketplaces/foodora`: fetch and normalize Foodora/Foodpanda-style category-product menu data.
- `marketplaces/glovo`: fetch and normalize Glovo public store content, including product attribute groups.
- `marketplaces/pyszne`: fetch and normalize Pyszne/Just Eat Takeaway restaurant menu data from the public restaurant API.
- `marketplaces/uber`: fetch and normalize Uber Eats storefront menu data from embedded React Query page state.
- `marketplaces/wolt`: fetch and normalize Wolt menu data.
- `mapper`: convert normalized marketplace data into Choice API request payloads.
- `choice/client`: wrap authenticated Choice API calls and response handling.
- `importer`: coordinate detection, parsing, empty-restaurant checks, menu creation, and summaries.
- `logger`: record successful imports, failed items, inactive imports, and warnings.

## Unsupported Marketplace Workflow

When the input URL is not from a listed marketplace:

1. Reject the link with `UNSUPPORTED_MARKETPLACE` during normal import runs. Do not guess another parser and do not send anything to Choice.
2. To add support, inspect the hostname, URL path IDs/slugs, page HTML, embedded app state, and network/API endpoints first.
3. Identify a reliable menu source before writing code: public JSON API, embedded page state, partner API, or another documented source.
4. If access needs credentials, cookies, or anti-bot bypass, add explicit environment variables and clear errors. Do not silently scrape an empty page.
5. Add a dedicated parser module under `marketplaces/<name>`, wire it into `detect` and `importer`, and normalize into the shared menu shape.
6. Add fixture tests for detection, parser normalization, prices, inactive items, images, and additions/modifiers before attempting a live Choice import.

## Choice Configuration

Use these environment variables:

- `CHOICE_API_BASE_URL`: Choice Open API base URL.
- `CHOICE_BEARER_TOKEN`: bearer token used for Choice API requests.
- `CHOICE_MENU_LANGUAGE`: path language for `POST /menu/:language/full`, for example `en`, `uk`, or `ro`.
- `CHOICE_MENU_CHECK_PATH`: optional override for the existing-menu check; default to `/menu/:language/full/list`.
- `DRY_RUN`: when `true`, parse and map the menu but do not call Choice write endpoints.
- `FOODORA_API_BASE_URL`: optional Foodora Partner API base URL, default `https://foodora.partner.deliveryhero.io`.
- `FOODORA_CHAIN_ID`: Foodora Partner API chain ID.
- `FOODORA_VENDOR_ID`: Foodora Partner API vendor ID.
- `FOODORA_BEARER_TOKEN`: Foodora Partner API bearer token.
- `FOODORA_LOCALE`: Foodora catalog locale, for example `en_CZ`.
- `FOODORA_PAGE_SIZE`: Foodora catalog page size, default `500`.
- `BOLT_API_BASE_URL`: optional Bolt Food public API base URL, default `https://deliveryuser.live.boltsvc.net`.
- `BOLT_LANGUAGE`: Bolt request language, for example `uk-UA`.
- `BOLT_VERSION`: Bolt web client version string, default to the version pinned in the parser.
- `GLOVO_API_BASE_URL`: optional Glovo API base URL, default `https://api.glovoapp.com`.
- `GLOVO_DELIVERY_LATITUDE` and `GLOVO_DELIVERY_LONGITUDE`: optional Glovo delivery coordinate overrides. When omitted, derive coordinates from the Glovo city public API.
- `GLOVO_APP_VERSION`: optional Glovo web app version header, default `7`.
- `PYSZNE_API_BASE_URL`: optional Pyszne/Just Eat Takeaway API base URL, default `https://cw-api.takeaway.com`.
- `PYSZNE_API_VERSION`: optional Pyszne/Just Eat Takeaway API version, default `v29`.
- `PYSZNE_COUNTRY_CODE`: optional country-code header override, default inferred from the URL host.
- `PYSZNE_LANGUAGE`: optional language-code header override, default inferred from the URL path.
- `PYSZNE_COOKIE`: optional browser cookie header for Pyszne/Just Eat API requests when Cloudflare requires an existing session.
- `PYSZNE_TRY_SITE_API`: optional `true`/`false`; when `true`, also try same-origin `/api/...` endpoints on the restaurant site. Default `false`.

Never print the bearer token in logs, errors, summaries, or debug output.

## Normalized Menu Shape

Use an internal normalized model before mapping to Choice:

- Section: external ID when available, name, description, schedule, show-outside-schedule flag.
- Category: external ID when available, section reference, name, active status, sort order.
- Item: external ID when available, category reference, name, description, regular price in major currency units, image URL, active status, sold-out status.
- Modifier group: external ID when available, section reference, name, selection type, min/max selection rules, required status, active status.
- Modifier option: external ID when available, name, regular price delta in major currency units, default status, active status.

Preserve raw marketplace IDs where possible for logs, debugging, and failed item reports.

## Choice Full Menu Payload Rules

Build one payload for `POST /menu/:language/full` with these top-level arrays:

- `sections`
- `categories`
- `dishOptions`
- `dishes`

Generate stable `posID` values for every section, category, dish option, option item, and dish. Prefer marketplace IDs when available; otherwise slugify the marketplace name plus a stable path such as category name, item name, and index. Do not generate random IDs.
Marketplace parsers must normalize item and modifier prices to major currency units that match marketplace display values. The mapper must convert those values to Choice minor units by multiplying by 100 before sending the payload.

### Sections

Map marketplace menu sections to Choice `sections`.

Required fields:

- `posID`: stable section ID.
- `name`: section/menu name.

Optional fields:

- `description`: marketplace section description when available.
- `showOutsideSchedule`: use only when marketplace schedule behavior is known.
- `schedule`: array of day schedules when available.

Schedule rules:

- `dayOfWeek`: number from `0` to `6` following the Choice API expectation.
- `active`: boolean.
- `from`: `HH:mm:ss`.
- `till`: `HH:mm:ss`.

If the marketplace has categories but no explicit sections, create one default section such as `Main menu` and link all categories to it.
Before writing to Choice, remove sections that are not referenced by any category. If a dish option points at a removed empty section, move that option group to the first kept section so the payload does not contain dangling section references.

### Categories

Map marketplace categories to Choice `categories`.

Required fields:

- `name`: category name.
- `posID`: stable category ID.
- `sectionPosID`: `posID` of the parent section.
- `active`: `false` only when the marketplace category is unavailable or hidden; otherwise `true`.

Every dish must reference an existing category through `categoryPosID`.

### Dish Options

Map marketplace additions, modifiers, option groups, and choices to Choice `dishOptions`.

Required fields:

- `posID`: stable modifier group ID.
- `sectionPosID`: section where this option group belongs.
- `active`: boolean.
- `type`: `single` for one-choice groups, `multiple` for multi-choice groups.
- `name`: modifier group name.
- `list`: available options.

Optional fields:

- `required`: true when the marketplace requires a selection.
- `countable`: true when the same option can be selected more than once.
- `menuMinCount`: minimum selection count for multiple-choice groups.
- `menuMaxCount`: maximum selection count for multiple-choice groups.

List item rules:

- Each list item needs `name`, `active`, `price`, and `posID`.
- `price` must be the regular modifier price in Choice minor units.
- Set `default: true` only when the marketplace marks a default option.
- Reuse one Choice `dishOptions` entry when the same marketplace addition/modifier group is attached to multiple dishes. Do not create duplicate Choice option groups for each dish when the group name, type, required flag, and option list are equivalent.
- For Wolt, dish-level option bindings reference reusable option definitions through `option_id`; use `option_id` as the group reference, not the binding `id`.

### Dishes

Map marketplace menu items to Choice `dishes`.

Required fields:

- `posID`: stable dish ID.
- `categoryPosID`: `posID` of the parent category.
- `name`: dish name.
- `price`: regular item price in Choice minor units.

Optional fields:

- `description`: marketplace item description.
- `active`: false when the marketplace item is unavailable.
- `attributes`: include `SOLD_OUT` for sold-out/unavailable marketplace items when Choice expects sold-out state as an attribute.
- `media`: marketplace photo/image URL.
- `dishOptions`: linked option groups and selected option list items by `posID`.
- `preparationTime`, `VAT`, `weight`, `weightType`, `kcal`, `alcohol`, `menuLabels`, `allergens`: include only when the marketplace provides reliable data or the project configuration supplies defaults.

Unavailable item rule:

- Import unavailable marketplace items.
- Mark them inactive with `active: false` when possible.
- Add `SOLD_OUT` in `attributes` when the Choice API expects sold-out state there.

Dish option link rules:

- A dish-level `dishOptions[].posID` must match an existing top-level `dishOptions[].posID`.
- A dish-level option list item `posID` must match an existing item in that option group's top-level `list`.
- Include dish-level price overrides only when the marketplace option price differs for that specific dish.

Category link rules:

- Every dish must use the Choice category `posID` that corresponds to its marketplace category.
- For Wolt, categories own their dishes through `category.item_ids`; use those IDs to assign each item to the correct category.
- For Foodora, prefer the customer API shape where categories contain `products`, or where products reference assigned categories.
- For Bolt Food, `GET /deliveryClient/public/getMenuCategories` returns a tree under `data.items`; map root `menu` children to categories, category children to dishes, and dish children to option groups.
- For Uber Eats, storefront pages expose menu data in the `__REACT_QUERY_STATE__` `getStoreV1` query. Map `catalogSectionsMap[*].payload.standardItemsPayload` entries to categories and their `catalogItems` to dishes.
- Do not fall back to the first category unless the marketplace data has no category-to-item relationship.

Price rules:

- Use regular prices only.
- Convert marketplace-specific minor-unit values to major currency units inside the marketplace parser.
- Convert normalized parser prices to Choice minor units in the mapper. For example, marketplace display price `236` must be sent as `23600` so Choice displays `236`, and `9.99` must be sent as `999`.
- Report missing required dish prices as failed items unless the Choice API explicitly permits zero-priced items for that menu type.

## Error Handling

Handle and report:

- Unsupported marketplace links.
- Missing prices.
- Missing images.
- Unavailable items.
- Invalid or unsupported additions/modifiers/options.
- Missing or invalid bearer token configuration.
- Choice API authentication, validation, and network errors.
- Restaurants that already contain menu items.
- Marketplace responses that are missing expected menu data.
- Marketplace anti-bot blocks such as Foodora PerimeterX captcha responses. Report the block clearly rather than treating it as an empty menu.
- Uber Eats anti-bot or JavaScript-only responses that omit `__REACT_QUERY_STATE__`. Report the block clearly rather than treating it as an empty menu.
- Glovo store pages require a public store ID, store address ID, generated Perseus session headers, and delivery coordinates. Resolve coordinates from Glovo city metadata when possible, or use `GLOVO_DELIVERY_LATITUDE` and `GLOVO_DELIVERY_LONGITUDE`.
- Pyszne/Just Eat public pages and the Takeaway restaurant API may be blocked by Cloudflare or rate limiting. Report the block clearly rather than treating it as an empty menu.
- Foodora public pages/API may be blocked by PerimeterX. When that happens, use the official Foodora Partner Catalog API: `GET /v2/chains/{chain_id}/vendors/{vendor_id}/categories` and `GET /v2/chains/{chain_id}/vendors/{vendor_id}/catalog`.

Current anti-bot status:

- Foodora public page/API import is marked not working in this environment because PerimeterX captcha blocks automated requests. Use the Foodora Partner API fallback when credentials are available.
- Pyszne/Just Eat public page/API import is marked not working in this environment because Cloudflare captcha/rate limiting blocks automated requests or returns no usable menu JSON.

## Validation Checklist

Before considering the importer complete:

- Test marketplace detection for supported and unsupported URLs.
- Test Wolt parsing with real or fixture menu data.
- Test Foodora parsing with fixture category-product menu data. Real Foodora page/API requests may be blocked by PerimeterX from automation environments.
- Test Uber Eats parsing with fixture React Query storefront data and, when possible, a real storefront page such as `https://www.ubereats.com/gb/store/arizona-burger-hoza/qvS01KO6QquI8CNWiAYDRA?diningMode=DELIVERY&surfaceName=`.
- Test Glovo parsing with fixture public store content and, when possible, a real storefront page such as `https://glovoapp.com/uk/pl/katowice/stores/zloty-osiol-ktw-1`.
- Test Pyszne/Just Eat parsing with fixture public restaurant API data and, when possible, a real storefront page such as `https://www.pyszne.pl/en/menu/mcdonalds-jet-connect-test-store-pl`.
- Test section-to-category mapping and category-to-dish mapping.
- Test `POST /menu/:language/full` payload shape before sending live requests.
- Test that discounted prices are ignored.
- Test inactive marketplace items mapping to inactive Choice items.
- Test modifier groups and dish-level option references use matching `posID` values.
- Test the empty-restaurant guard so no import happens when Choice already has items.
- Test mapper output separately from live API calls.
- Test API error handling with mocked Choice responses where possible.
