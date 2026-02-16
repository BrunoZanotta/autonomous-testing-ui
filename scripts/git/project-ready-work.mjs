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

try {
  const isCartCard = /(carrinho|cart|checkout|subtotal|valor total|total da compra)/i.test(cardText);
  const isInventoryCard = /(inv-\d*|inventory|produto|product)/i.test(cardText);

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
    // Fallback keeps the automation moving even when card text is generic.
    process.stdout.write(
      `No explicit cart/inventory intent found for '${cardTitle}'. Using default cart two-products scenario (work_type=${cardWorkType}).\n`,
    );
    createdTestFile = generateCartTwoProductsTest(products);
  }

  if (!dryRun && runTargetedTests) {
    run('npx', ['playwright', 'test', createdTestFile, '--project=chromium'], { stdio: 'inherit' });
  }

  console.log(`Generated: ${createdTestFile}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
