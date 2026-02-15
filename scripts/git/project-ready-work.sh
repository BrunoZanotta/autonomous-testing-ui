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

CARD_TITLE="${PROJECT_CARD_TITLE:-}"
CARD_BODY="${PROJECT_CARD_BODY:-}"
CARD_TEXT="${CARD_TITLE} ${CARD_BODY}"
DRY_RUN="${DRY_RUN:-0}"
RUN_TARGETED_TESTS="${RUN_TARGETED_TESTS:-1}"

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

next_inventory_id() {
  local max_id
  max_id="$(find tests/inventory -maxdepth 1 -type f -name 'inv-*.spec.ts' \
    | sed -E 's#.*/inv-([0-9]{3})-.*#\1#' \
    | sort -n \
    | tail -n1)"

  if [[ -z "$max_id" ]]; then
    printf "001"
    return
  fi

  printf "%03d" "$((10#$max_id + 1))"
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

ensure_generic_inventory_assertion() {
  if rg -n "assertProductCardTitleDescriptionAndImageByName\(" pages/InventoryPage.ts >/dev/null 2>&1; then
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

is_inventory_card=0
if printf '%s' "$CARD_TEXT" | rg -qi '(^|[^a-z])inv-([0-9]+)?|inventory|produto'; then
  is_inventory_card=1
fi

if [[ "$is_inventory_card" -ne 1 ]]; then
  echo "error: unsupported card type for automated generator." >&2
  echo "title: ${CARD_TITLE}" >&2
  exit 10
fi

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

created_test_file=""
if [[ -n "$product_key" ]]; then
  created_test_file="$(generate_inventory_test_for_product_key "$product_name" "$product_key")"
else
  created_test_file="$(generate_inventory_test_for_product_name "$product_name")"
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
if [[ -n "$product_key" ]]; then
  echo "Used store product key: $product_key"
else
  echo "Used generic product assertion by name for: $product_name"
fi
