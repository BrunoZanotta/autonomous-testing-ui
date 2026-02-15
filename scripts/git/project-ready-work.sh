#!/usr/bin/env bash
set -euo pipefail

# Card-driven implementation command for scheduler.
# Consumes context exported by scripts/git/project-ready-to-pr.sh.

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: required command not found: $cmd" >&2
    exit 1
  fi
}

require_cmd git
require_cmd awk
require_cmd sed
require_cmd perl

HAS_RG=0
if command -v rg >/dev/null 2>&1; then
  HAS_RG=1
fi

CARD_TITLE="${PROJECT_CARD_TITLE:-}"
CARD_BODY="${PROJECT_CARD_BODY:-}"
CARD_TEXT="${CARD_TITLE} ${CARD_BODY}"
DRY_RUN="${DRY_RUN:-0}"
RUN_TARGETED_TESTS="${RUN_TARGETED_TESTS:-1}"
CARD_ISSUE_NUMBER="${PROJECT_CARD_ISSUE_NUMBER:-0}"

if [[ -z "$CARD_TITLE" && -z "$CARD_BODY" ]]; then
  echo "error: missing PROJECT_CARD_TITLE/PROJECT_CARD_BODY context." >&2
  echo "hint: run through scripts/git/project-ready-to-pr.sh or export card vars." >&2
  exit 1
fi

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

ts_escape_single() {
  printf "%s" "$1" | sed "s/'/\\\\'/g"
}

text_matches() {
  local text="$1"
  local pattern="$2"

  if [[ "$HAS_RG" -eq 1 ]]; then
    printf '%s' "$text" | rg -qi -- "$pattern"
  else
    printf '%s' "$text" | grep -Eiq -- "$pattern"
  fi
}

file_contains() {
  local pattern="$1"
  local file_path="$2"

  if [[ "$HAS_RG" -eq 1 ]]; then
    rg -q -- "$pattern" "$file_path"
  else
    grep -Eq -- "$pattern" "$file_path"
  fi
}

next_sequence_id() {
  local dir_path="$1"
  local prefix="$2"
  local max_id

  max_id="$(find "$dir_path" -maxdepth 1 -type f -name "${prefix}-*.spec.ts" \
    | sed -E "s#.*/${prefix}-([0-9]{3})-.*#\\1#" \
    | sort -n \
    | tail -n1)"

  if [[ -z "$max_id" ]]; then
    printf "001"
    return
  fi

  printf "%03d" "$((10#$max_id + 1))"
}

next_inventory_id() {
  next_sequence_id "tests/inventory" "inv"
}

next_cart_id() {
  next_sequence_id "tests/cart" "cart"
}

extract_product_name() {
  local text="$1"
  local candidate

  candidate="$(printf '%s' "$text" | perl -ne 'if (/(Sauce Labs(?:\s+[A-Za-z0-9().\x27-]+){1,5})/i) { $x=$1; $x =~ s/\s+$//; print $x; exit }')"
  if [[ -n "$candidate" ]]; then
    candidate="$(printf '%s' "$candidate" | sed -E 's/[[:space:]]+(valide|validar|validate|quero|teste|test|descricao|description|imagem|image).*$//I')"
    printf "%s" "$candidate"
    return
  fi

  candidate="$(printf '%s' "$text" | perl -ne 'if (/(Test\.allTheThings\(\) T-Shirt \(Red\))/i) { $x=$1; $x =~ s/\s+$//; print $x; exit }')"
  if [[ -n "$candidate" ]]; then
    printf "%s" "$candidate"
    return
  fi

  printf ""
}

find_store_product_key_by_name() {
  local product_name_lower
  product_name_lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"

  awk '
    /^[[:space:]]*[a-zA-Z0-9]+:[[:space:]]*\{/ {
      line=$0
      sub(/^[[:space:]]*/, "", line)
      split(line, parts, ":")
      key=parts[1]
    }
    /name:[[:space:]]*\x27/ {
      if (match($0, /\x27[^\x27]+\x27/)) {
        raw=substr($0, RSTART+1, RLENGTH-2)
        printf("%s|%s\n", key, raw)
      }
    }
  ' pages/InventoryPage.ts \
  | while IFS='|' read -r key name; do
      if [[ "$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')" == "$product_name_lower" ]]; then
        printf '%s' "$key"
        break
      fi
    done
}

list_store_product_keys() {
  awk '
    /^export const STORE_PRODUCTS = \{/ { in_products=1; next }
    in_products && /^\} as const;/ { exit }
    in_products && /^[[:space:]]*[a-zA-Z0-9]+:[[:space:]]*\{/ {
      line=$0
      sub(/^[[:space:]]*/, "", line)
      split(line, parts, ":")
      print parts[1]
    }
  ' pages/InventoryPage.ts
}

choose_two_product_keys() {
  local keys=()
  local key

  while IFS= read -r key; do
    if [[ -n "$key" ]]; then
      keys+=("$key")
    fi
  done < <(list_store_product_keys)

  local total="${#keys[@]}"

  if [[ "$total" -lt 2 ]]; then
    echo "error: at least two products are required in STORE_PRODUCTS." >&2
    exit 30
  fi

  local seed="0"
  if [[ "$CARD_ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    seed="$CARD_ISSUE_NUMBER"
  fi

  local first_idx=$((seed % total))
  local second_idx=$(((seed + 3) % total))

  if [[ "$second_idx" -eq "$first_idx" ]]; then
    second_idx=$(((first_idx + 1) % total))
  fi

  printf '%s %s\n' "${keys[$first_idx]}" "${keys[$second_idx]}"
}

ensure_generic_inventory_assertion() {
  if file_contains "assertProductCardTitleDescriptionAndImageByName\(" pages/InventoryPage.ts; then
    return
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] would update pages/InventoryPage.ts with generic inventory assertion method" >&2
    return
  fi

  awk '
    {
      print
      if ($0 ~ /^  async assertProductCardTitleDescriptionAndImageFor\(productKey: StoreProductKey\) \{$/) {
        in_method=1
      } else if (in_method == 1 && $0 ~ /^  }$/) {
        print ""
        print "  async assertProductCardTitleDescriptionAndImageByName(productName: string) {"
        print "    const product = this.getProductByName(productName);"
        print "    const productTitle = product.locator(\".inventory_item_name\");"
        print "    const productDescription = product.locator(\".inventory_item_desc\");"
        print "    const productImage = product.locator(\"img\");"
        print ""
        print "    await expect(productTitle).toHaveText(productName);"
        print "    await expect(productDescription).toBeVisible();"
        print ""
        print "    const descriptionText = ((await productDescription.textContent()) ?? \"\").trim();"
        print "    expect(descriptionText.length).toBeGreaterThan(0);"
        print ""
        print "    await expect(productImage).toBeVisible();"
        print "    await expect(productImage).toHaveAttribute(\"alt\", productName);"
        print "  }"
        in_method=0
      }
    }
  ' pages/InventoryPage.ts > pages/InventoryPage.ts.tmp

  mv pages/InventoryPage.ts.tmp pages/InventoryPage.ts
}

generate_inventory_test_for_product_key() {
  local product_name="$1"
  local product_key="$2"
  local inv_id slug file_path test_title escaped_test_title

  inv_id="$(next_inventory_id)"
  slug="$(slugify "${product_name/Sauce Labs /}")"
  if [[ -z "$slug" ]]; then
    slug="product-details"
  fi

  file_path="tests/inventory/inv-${inv_id}-${slug}-product-details.spec.ts"
  test_title="${product_name/Sauce Labs /} Product Details"
  escaped_test_title="$(ts_escape_single "$test_title")"

  if [[ -f "$file_path" ]]; then
    echo "error: target file already exists: $file_path" >&2
    exit 20
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] would create $file_path using store key '$product_key'" >&2
    echo "$file_path"
    return
  fi

  cat > "$file_path" <<TS
import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('${escaped_test_title}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardTitleDescriptionAndImageFor('${product_key}');
  });
});
TS

  echo "$file_path"
}

generate_inventory_test_for_product_name() {
  local product_name="$1"
  local inv_id slug file_path test_title escaped_test_title escaped_product_name

  inv_id="$(next_inventory_id)"
  slug="$(slugify "${product_name/Sauce Labs /}")"
  if [[ -z "$slug" ]]; then
    slug="product-details"
  fi

  ensure_generic_inventory_assertion

  file_path="tests/inventory/inv-${inv_id}-${slug}-product-details.spec.ts"
  test_title="${product_name/Sauce Labs /} Product Details"
  escaped_test_title="$(ts_escape_single "$test_title")"
  escaped_product_name="$(ts_escape_single "$product_name")"

  if [[ -f "$file_path" ]]; then
    echo "error: target file already exists: $file_path" >&2
    exit 21
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] would create $file_path using generic product-name assertion" >&2
    echo "$file_path"
    return
  fi

  cat > "$file_path" <<TS
import { test } from '../../fixtures/app.fixture';

test.describe('Product Inventory Tests', { tag: '@inventory' }, () => {
  test('${escaped_test_title}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardTitleDescriptionAndImageByName('${escaped_product_name}');
  });
});
TS

  echo "$file_path"
}

generate_cart_two_products_test() {
  local cart_id slug file_path escaped_test_title
  local key_one key_two

  cart_id="$(next_cart_id)"
  slug="$(slugify "$CARD_TITLE")"
  if [[ -z "$slug" ]]; then
    slug="two-products-cart-validation"
  fi

  file_path="tests/cart/cart-${cart_id}-${slug}.spec.ts"

  if [[ -f "$file_path" ]]; then
    echo "error: target file already exists: $file_path" >&2
    exit 40
  fi

  read -r key_one key_two < <(choose_two_product_keys)

  escaped_test_title="$(ts_escape_single "Cart Two Products Validation")"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY_RUN] would create $file_path using product keys '$key_one' and '$key_two'" >&2
    echo "$file_path"
    return
  fi

  cat > "$file_path" <<TS
import { test } from '../../fixtures/app.fixture';

test.describe('Shopping Cart Tests', { tag: '@cart' }, () => {
  test('${escaped_test_title}', { tag: '@regression' }, async ({ authenticatedPage: _authenticatedPage, inventoryPage, cartPage, checkoutPage }) => {
    await inventoryPage.assertOnInventoryPage();
    await inventoryPage.assertProductCardDetailsFor('${key_one}');
    await inventoryPage.assertProductCardDetailsFor('${key_two}');

    await inventoryPage.addProductToCartByKey('${key_one}');
    await inventoryPage.addProductToCartByKey('${key_two}');
    await inventoryPage.assertCartBadgeCount(2);

    await inventoryPage.goToCart();
    await cartPage.assertOnCartPage();
    await cartPage.assertCartItemCount(2);
    await cartPage.assertProductDetailsInCartByKey('${key_one}');
    await cartPage.assertProductDetailsInCartByKey('${key_two}');

    await cartPage.proceedToCheckout();
    await checkoutPage.assertOnCheckoutInfoPage();
    await checkoutPage.fillCheckoutInformationFromProfile('valid');
    await checkoutPage.clickContinue();

    await checkoutPage.assertOnCheckoutOverviewPage();
    await checkoutPage.assertProductInOverviewByKey('${key_one}');
    await checkoutPage.assertProductInOverviewByKey('${key_two}');
    await checkoutPage.assertSubtotalEqualsProductSum(['${key_one}', '${key_two}']);
    await checkoutPage.assertTotalEqualsSubtotalPlusTax();
  });
});
TS

  echo "$file_path"
}

is_cart_card=0
if text_matches "$CARD_TEXT" '(carrinho|cart|checkout|subtotal|valor total|total da compra)'; then
  is_cart_card=1
fi

is_inventory_card=0
if text_matches "$CARD_TEXT" '(^|[^a-z])(inv-([0-9]+)?)|inventory|produto|product'; then
  is_inventory_card=1
fi

created_test_file=""

if [[ "$is_cart_card" -eq 1 ]]; then
  created_test_file="$(generate_cart_two_products_test)"
elif [[ "$is_inventory_card" -eq 1 ]]; then
  product_name="$(extract_product_name "$CARD_TITLE")"
  if [[ -z "$product_name" ]]; then
    product_name="$(extract_product_name "$CARD_BODY")"
  fi
  if [[ -z "$product_name" ]]; then
    product_name="$(extract_product_name "$CARD_TEXT")"
  fi

  if [[ -z "$product_name" ]]; then
    echo "error: could not extract product name from card text." >&2
    echo "expected pattern like 'Sauce Labs <Product Name>'" >&2
    exit 11
  fi

  product_key="$(find_store_product_key_by_name "$product_name" || true)"

  if [[ -n "$product_key" ]]; then
    created_test_file="$(generate_inventory_test_for_product_key "$product_name" "$product_key")"
  else
    created_test_file="$(generate_inventory_test_for_product_name "$product_name")"
  fi
else
  echo "error: unsupported card type for automated generator." >&2
  echo "title: ${CARD_TITLE}" >&2
  exit 10
fi

if [[ "$DRY_RUN" != "1" ]]; then
  if [[ -z "$created_test_file" || ! -f "$created_test_file" ]]; then
    echo "error: test generation failed; no test file created." >&2
    exit 12
  fi

  if [[ "$RUN_TARGETED_TESTS" == "1" ]]; then
    npx playwright test "$created_test_file" --project=chromium
  fi
fi

echo "Generated: $created_test_file"
