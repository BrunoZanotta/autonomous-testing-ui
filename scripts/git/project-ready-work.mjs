#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { run } from '../lib/cli.mjs';

const cardTitle = process.env.PROJECT_CARD_TITLE ?? '';
const cardBody = process.env.PROJECT_CARD_BODY ?? '';
const cardText = `${cardTitle} ${cardBody}`.trim();
const cardWorkType = process.env.PROJECT_CARD_WORK_TYPE ?? 'newTest';
const dryRun = process.env.DRY_RUN === '1';
const runTargetedTests = process.env.RUN_TARGETED_TESTS !== '0';
const issueNumberRaw = process.env.PROJECT_CARD_ISSUE_NUMBER ?? '0';

if (!cardTitle && !cardBody) {
  console.error('error: missing PROJECT_CARD_TITLE/PROJECT_CARD_BODY context.');
  console.error('hint: run through scripts/git/project-ready-to-pr.mjs or export card vars.');
  process.exit(1);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeSingleQuotes(value) {
  return String(value).replace(/'/g, "\\'");
}

const PT_TO_EN_WORD = new Map([
  ['adicionando', 'adding'],
  ['adicione', 'add'],
  ['adicionar', 'add'],
  ['adicionado', 'added'],
  ['adicionados', 'added'],
  ['apenas', 'only'],
  ['auto', 'auto'],
  ['carrinho', 'cart'],
  ['corrigir', 'fix'],
  ['criar', 'create'],
  ['descricao', 'description'],
  ['despacho', 'dispatch'],
  ['disparo', 'trigger'],
  ['dois', 'two'],
  ['duas', 'two'],
  ['english', 'english'],
  ['erro', 'error'],
  ['excluir', 'delete'],
  ['exclusao', 'deletion'],
  ['fluxo', 'flow'],
  ['gerado', 'generated'],
  ['gerados', 'generated'],
  ['gerar', 'generate'],
  ['ingles', 'english'],
  ['manual', 'manual'],
  ['mudar', 'change'],
  ['nao', 'not'],
  ['no', 'in'],
  ['nome', 'name'],
  ['nomes', 'names'],
  ['novo', 'new'],
  ['novo', 'new'],
  ['pedido', 'requested'],
  ['pedi', 'requested'],
  ['portugues', 'portuguese'],
  ['produto', 'product'],
  ['produtos', 'products'],
  ['quatro', 'four'],
  ['que', 'that'],
  ['refatorar', 'refactor'],
  ['refatore', 'refactor'],
  ['refatoracao', 'refactor'],
  ['remover', 'remove'],
  ['sem', 'without'],
  ['teste', 'test'],
  ['testes', 'tests'],
  ['tres', 'three'],
  ['validar', 'validate'],
  ['validacao', 'validation'],
  ['wrong', 'wrong'],
]);

const PORTUGUESE_SIGNAL_REGEX = /\b(criar|adicionando|carrinho|produto|produtos|portugues|ingles|teste|testes|refatorar|remover|excluir|validar|novo)\b/i;

function readStoreProducts() {
  const inventoryPath = path.join('pages', 'InventoryPage.ts');
  const content = fs.readFileSync(inventoryPath, 'utf8');

  const products = [];
  const regex = /([a-zA-Z0-9]+):\s*\{[\s\S]*?name:\s*'([^']+)'[\s\S]*?\},/g;
  let match = regex.exec(content);
  while (match) {
    products.push({ key: match[1], name: match[2] });
    match = regex.exec(content);
  }

  if (products.length === 0) {
    throw new Error('error: no products found in pages/InventoryPage.ts');
  }

  return products;
}

function nextSequenceId(dirPath, prefix) {
  const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
  let max = 0;

  for (const file of files) {
    const match = file.match(new RegExp(`^${prefix}-(\\d{3})-.*\\.spec\\.ts$`));
    if (!match) {
      continue;
    }
    const value = Number.parseInt(match[1], 10);
    if (Number.isInteger(value) && value > max) {
      max = value;
    }
  }

  return String(max + 1).padStart(3, '0');
}

function extractProductName(text) {
  const sauceMatch = text.match(/(Sauce Labs(?:\s+[A-Za-z0-9().'\-]+){1,5})/i);
  if (sauceMatch) {
    return sauceMatch[1]
      .replace(/\s+(valide|validar|validate|quero|teste|test|descricao|description|imagem|image).*$/i, '')
      .trim();
  }

  const fallback = text.match(/(Test\.allTheThings\(\) T-Shirt \(Red\))/i);
  return fallback ? fallback[1].trim() : '';
}

function chooseTwoProductKeys(products) {
  if (products.length < 2) {
    throw new Error('error: at least two products are required in STORE_PRODUCTS.');
  }

  const issueNumber = Number.parseInt(issueNumberRaw, 10);
  const seed = Number.isInteger(issueNumber) ? issueNumber : 0;

  const firstIndex = seed % products.length;
  let secondIndex = (seed + 3) % products.length;
  if (secondIndex === firstIndex) {
    secondIndex = (firstIndex + 1) % products.length;
  }

  return [products[firstIndex].key, products[secondIndex].key];
}

function generateInventoryTestByKey(productName, productKey) {
  const id = nextSequenceId(path.join('tests', 'inventory'), 'inv');
  const slug = slugify(productName.replace(/^Sauce Labs\s+/i, '')) || 'product-details';
  const filePath = path.join('tests', 'inventory', `inv-${id}-${slug}-product-details.spec.ts`);

  if (fs.existsSync(filePath)) {
    throw new Error(`error: target file already exists: ${filePath}`);
  }

  const testTitle = escapeSingleQuotes(productName.replace(/^Sauce Labs\s+/i, '') + ' Product Details');

  if (!dryRun) {
    const content = `import { test } from '../../fixtures/app.fixture';\n\ntest.describe('Product Inventory Tests', { tag: '@inventory' }, () => {\n  test('${testTitle}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {\n    await inventoryPage.assertOnInventoryPage();\n    await inventoryPage.assertProductCardTitleDescriptionAndImageFor('${productKey}');\n  });\n});\n`;
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return filePath;
}

function generateInventoryTestByName(productName) {
  const id = nextSequenceId(path.join('tests', 'inventory'), 'inv');
  const slug = slugify(productName.replace(/^Sauce Labs\s+/i, '')) || 'product-details';
  const filePath = path.join('tests', 'inventory', `inv-${id}-${slug}-product-details.spec.ts`);

  if (fs.existsSync(filePath)) {
    throw new Error(`error: target file already exists: ${filePath}`);
  }

  const testTitle = escapeSingleQuotes(productName.replace(/^Sauce Labs\s+/i, '') + ' Product Details');
  const escapedProductName = escapeSingleQuotes(productName);

  if (!dryRun) {
    const content = `import { test } from '../../fixtures/app.fixture';\n\ntest.describe('Product Inventory Tests', { tag: '@inventory' }, () => {\n  test('${testTitle}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {\n    await inventoryPage.assertOnInventoryPage();\n    await inventoryPage.assertProductCardTitleDescriptionAndImageByName('${escapedProductName}');\n  });\n});\n`;
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return filePath;
}

function generateCartTwoProductsTest(products) {
  const id = nextSequenceId(path.join('tests', 'cart'), 'cart');
  const slug = slugify(cardTitle) || 'two-products-cart-validation';
  const filePath = path.join('tests', 'cart', `cart-${id}-${slug}.spec.ts`);

  if (fs.existsSync(filePath)) {
    throw new Error(`error: target file already exists: ${filePath}`);
  }

  const [keyOne, keyTwo] = chooseTwoProductKeys(products);
  const testTitle = escapeSingleQuotes('Cart Two Products Validation');

  if (!dryRun) {
    const content = `import { test } from '../../fixtures/app.fixture';\n\ntest.describe('Shopping Cart Tests', { tag: '@cart' }, () => {\n  test('${testTitle}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {\n    await inventoryPage.assertOnInventoryPage();\n    await inventoryPage.assertProductCardDetailsFor('${keyOne}');\n    await inventoryPage.assertProductCardDetailsFor('${keyTwo}');\n\n    await inventoryPage.addProductToCartByKey('${keyOne}');\n    await inventoryPage.addProductToCartByKey('${keyTwo}');\n    await inventoryPage.assertCartBadgeCount(2);\n\n    await inventoryPage.goToCart();\n    await cartPage.assertOnCartPage();\n    await cartPage.assertCartItemCount(2);\n    await cartPage.assertProductDetailsInCartByKey('${keyOne}');\n    await cartPage.assertProductDetailsInCartByKey('${keyTwo}');\n\n    await cartPage.proceedToCheckout();\n    await checkoutPage.assertOnCheckoutInfoPage();\n    await checkoutPage.fillCheckoutInformationFromProfile('valid');\n    await checkoutPage.clickContinue();\n\n    await checkoutPage.assertOnCheckoutOverviewPage();\n    await checkoutPage.assertProductInOverviewByKey('${keyOne}');\n    await checkoutPage.assertProductInOverviewByKey('${keyTwo}');\n    await checkoutPage.assertSubtotalEqualsProductSum(['${keyOne}', '${keyTwo}']);\n    await checkoutPage.assertTotalEqualsSubtotalPlusTax();\n  });\n});\n`;
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return filePath;
}

function isSpecFile(filePath) {
  return String(filePath).endsWith('.spec.ts');
}

function listSpecFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSpecFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isSpecFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseActions(text) {
  const source = String(text ?? '').toLowerCase();
  const noCreate = /(nao|não|do not|don't)\s+(criar|create|adicionar|add|gerar|generate)\s+(novo\s+)?teste?/.test(source);
  const explicitCreateCommand = /\b(crie|criar|adicione|adicionar|gere|gerar|implemente|create|add|generate)\b[^.\n]{0,40}\b(test|teste|tests|testes)\b/.test(
    source,
  );
  const wantsRefactor = /(refator|refactor|renomear|rename|padroniz|normaliz|ingles|english)/.test(source);
  const wantsDelete = /(excluir|exclua|remove|remover|delete|apagar)/.test(source);
  const wantsCreateRaw = explicitCreateCommand;

  return {
    create: wantsCreateRaw && !noCreate,
    refactor: wantsRefactor,
    delete: wantsDelete,
  };
}

function toRepoRelativePath(filePath) {
  const normalized = path.normalize(filePath);
  return normalized.startsWith(`${path.sep}`) ? normalized.slice(1) : normalized;
}

function extractExplicitTestPaths(text) {
  const files = new Set();
  const source = String(text ?? '');
  const withTestsPath = source.match(/tests\/[A-Za-z0-9_./-]+\.spec\.ts/g) ?? [];
  const fileNameOnly = source.match(/\b[a-z]+-\d{3}-[a-z0-9-]+\.spec\.ts\b/gi) ?? [];

  for (const value of withTestsPath) {
    files.add(path.normalize(value.trim()));
  }

  if (fileNameOnly.length > 0) {
    const existing = listSpecFiles('tests');
    for (const name of fileNameOnly) {
      const matches = existing.filter((filePath) => path.basename(filePath).toLowerCase() === name.toLowerCase());
      if (matches.length === 1) {
        files.add(path.normalize(matches[0]));
      }
    }
  }

  return Array.from(files);
}

function normalizeWord(word) {
  return word
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mapWord(word) {
  const normalized = normalizeWord(word);
  const mapped = PT_TO_EN_WORD.get(normalized);
  if (!mapped) {
    return word;
  }

  if (word.toUpperCase() === word) {
    return mapped.toUpperCase();
  }
  if (word[0] === word[0]?.toUpperCase()) {
    return mapped[0].toUpperCase() + mapped.slice(1);
  }
  return mapped;
}

function translateSentence(text) {
  return String(text).replace(/[A-Za-zÀ-ÿ]+/g, (word) => mapWord(word));
}

function translateSlug(slug) {
  const parts = String(slug)
    .split('-')
    .filter(Boolean);
  return parts
    .map((token) => mapWord(token))
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function hasPortugueseInFilename(filePath) {
  const fileName = path.basename(filePath, '.spec.ts');
  return PORTUGUESE_SIGNAL_REGEX.test(fileName);
}

function hasPortugueseInContent(content) {
  return /(test|describe)\(\s*['"`][^'"`]*(criar|adicionando|carrinho|produto|produtos|portugues|ingles|teste|testes|validar|novo)[^'"`]*['"`]/i.test(
    content,
  );
}

function refactorTitlesToEnglish(content) {
  return String(content).replace(
    /(test|describe)\(\s*(['"`])([^'"`]+)\2/g,
    (_all, fn, quote, title) => `${fn}(${quote}${translateSentence(title)}${quote}`,
  );
}

function translateFileNameToEnglish(filePath) {
  const directory = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const suffix = '.spec.ts';
  if (!fileName.endsWith(suffix)) {
    return filePath;
  }

  const stem = fileName.slice(0, -suffix.length);
  const translatedStem = translateSlug(stem);
  if (!translatedStem || translatedStem === stem) {
    return filePath;
  }

  return path.join(directory, `${translatedStem}${suffix}`);
}

function deleteRequestedFiles(explicitPaths, summary) {
  if (explicitPaths.length === 0) {
    throw new Error('error: delete was requested but no explicit test file path was found in card text.');
  }

  for (const requestedPath of explicitPaths) {
    const safePath = path.normalize(requestedPath);
    if (!safePath.startsWith('tests')) {
      throw new Error(`error: refusing to delete path outside tests/: ${safePath}`);
    }
    if (!safePath.endsWith('.spec.ts')) {
      throw new Error(`error: refusing to delete non-spec file: ${safePath}`);
    }
    if (!fs.existsSync(safePath)) {
      summary.missing.push(safePath);
      continue;
    }

    if (!dryRun) {
      fs.rmSync(safePath, { force: true });
    }
    summary.deleted.push(safePath);
  }
}

function refactorFilesToEnglish(explicitPaths, summary, excludedPaths = new Set()) {
  const scanAutoCandidates = () =>
    listSpecFiles('tests').filter((filePath) => {
      if (excludedPaths.has(path.normalize(filePath))) {
        return false;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      return hasPortugueseInFilename(filePath) || hasPortugueseInContent(content);
    });

  let candidates = [];
  if (explicitPaths.length > 0) {
    candidates = explicitPaths.filter((filePath) => fs.existsSync(filePath) && !excludedPaths.has(path.normalize(filePath)));
    if (candidates.length === 0 && excludedPaths.size > 0) {
      candidates = scanAutoCandidates();
    }
  } else {
    candidates = scanAutoCandidates();
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const originalContent = fs.readFileSync(candidate, 'utf8');
    const updatedContent = refactorTitlesToEnglish(originalContent);

    if (!dryRun && updatedContent !== originalContent) {
      fs.writeFileSync(candidate, updatedContent, 'utf8');
    }
    if (updatedContent !== originalContent) {
      summary.refactored.push(candidate);
    }

    const targetPath = translateFileNameToEnglish(candidate);
    if (targetPath !== candidate) {
      if (fs.existsSync(targetPath)) {
        summary.warnings.push(`skip rename; target already exists: ${targetPath}`);
      } else {
        if (!dryRun) {
          fs.renameSync(candidate, targetPath);
        }
        summary.renamed.push({ from: candidate, to: targetPath });
      }
    }
  }
}

function collectRunnableTargets(summary) {
  const files = new Set();

  for (const value of summary.created) {
    files.add(path.normalize(value));
  }
  for (const value of summary.refactored) {
    files.add(path.normalize(value));
  }
  for (const renameEntry of summary.renamed) {
    files.add(path.normalize(renameEntry.to));
  }

  return Array.from(files).filter((filePath) => fs.existsSync(filePath));
}

try {
  const isCartCard = /(carrinho|cart|checkout|subtotal|valor total|total da compra)/i.test(cardText);
  const isInventoryCard = /(inv-\d*|inventory|produto|product)/i.test(cardText);

  const requested = parseActions(cardText);
  if (!requested.create && !requested.refactor && !requested.delete) {
    if (cardWorkType === 'newTest') {
      requested.create = true;
    } else {
      throw new Error('error: no actionable intent found in card text for bugfix flow. add explicit refactor/delete/create instruction.');
    }
  }

  const explicitPaths = extractExplicitTestPaths(cardText);
  const summary = {
    created: [],
    deleted: [],
    refactored: [],
    renamed: [],
    missing: [],
    warnings: [],
    actions: requested,
  };

  if (requested.delete) {
    deleteRequestedFiles(explicitPaths, summary);
  }

  if (requested.refactor) {
    const excludedPaths = new Set(summary.deleted.map((filePath) => path.normalize(filePath)));
    refactorFilesToEnglish(explicitPaths, summary, excludedPaths);
  }

  if (requested.create) {
    const products = readStoreProducts();
    let createdTestFile = '';

    if (isCartCard) {
      createdTestFile = generateCartTwoProductsTest(products);
    } else if (isInventoryCard) {
      const productName = extractProductName(cardText);
      if (!productName) {
        throw new Error('error: could not extract product name from card text. expected pattern like "Sauce Labs <Product Name>"');
      }

      const product = products.find((entry) => entry.name.toLowerCase() === productName.toLowerCase());
      if (product) {
        createdTestFile = generateInventoryTestByKey(productName, product.key);
      } else {
        createdTestFile = generateInventoryTestByName(productName);
      }
    } else {
      process.stdout.write(
        `No explicit cart/inventory intent found for '${cardTitle}'. Using default cart two-products scenario (work_type=${cardWorkType}).\n`,
      );
      createdTestFile = generateCartTwoProductsTest(products);
    }

    summary.created.push(createdTestFile);
  }

  if (!requested.create && summary.deleted.length === 0 && summary.refactored.length === 0 && summary.renamed.length === 0) {
    throw new Error('error: no changes were produced for requested non-create actions.');
  }

  if (!dryRun && runTargetedTests) {
    const runnableTargets = collectRunnableTargets(summary);
    if (runnableTargets.length > 0) {
      run('npx', ['playwright', 'test', ...runnableTargets, '--project=chromium'], { stdio: 'inherit' });
    } else {
      process.stdout.write('No runnable test targets generated for this card. Skipping targeted test run.\n');
    }
  }

  for (const filePath of summary.created) {
    console.log(`Generated: ${filePath}`);
  }
  for (const filePath of summary.deleted) {
    console.log(`Deleted: ${filePath}`);
  }
  for (const filePath of summary.refactored) {
    console.log(`Refactored: ${toRepoRelativePath(filePath)}`);
  }
  for (const renameEntry of summary.renamed) {
    console.log(`Renamed: ${toRepoRelativePath(renameEntry.from)} -> ${toRepoRelativePath(renameEntry.to)}`);
  }
  for (const warning of summary.warnings) {
    console.log(`Warning: ${warning}`);
  }
  for (const missing of summary.missing) {
    console.log(`Missing: ${missing}`);
  }

  console.log(
    JSON.stringify({
      status: 'WORKFLOW_COMPLETED',
      actions: summary.actions,
      created: summary.created,
      deleted: summary.deleted,
      refactored: summary.refactored.map((filePath) => toRepoRelativePath(filePath)),
      renamed: summary.renamed.map((entry) => ({
        from: toRepoRelativePath(entry.from),
        to: toRepoRelativePath(entry.to),
      })),
      missing: summary.missing,
      warnings: summary.warnings,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
