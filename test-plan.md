# Sauce Demo E-commerce - Test Plan (POM Architecture)

## Application Overview
Sauce Demo is an e-commerce website that simulates a shopping experience with features including:
- User authentication
- Product catalog browsing and filtering
- Shopping cart management
- Checkout process

## Page Object Model Structure

```typescript
// pages/
├── LoginPage.ts
├── InventoryPage.ts
├── CartPage.ts
├── CheckoutInfoPage.ts
├── CheckoutOverviewPage.ts
└── CheckoutCompletePage.ts
```

## Test Scenarios

### 1. Authentication Tests

#### 1.1 Successful Login
**Test ID:** AUTH_001
**Description:** Verify successful login with valid credentials
**Steps:**
1. Navigate to login page
2. Enter username "standard_user"
3. Enter password "secret_sauce"
4. Click Login button

**Expected Results:**
- User is redirected to inventory page
- Product list is visible
- Shopping cart icon is present in header

#### 1.2 Failed Login Attempts
**Test ID:** AUTH_002
**Description:** Verify system behavior with invalid credentials
**Steps:**
1. Navigate to login page
2. Test the following scenarios:
   a. Invalid username / valid password
   b. Valid username / invalid password
   c. Empty username / valid password
   d. Valid username / empty password
   e. Login with locked_out_user

**Expected Results:**
- Appropriate error message displayed for each case
- User remains on login page
- Form fields maintain entered values (except password)

### 2. Product Inventory Tests

#### 2.1 Product Listing
**Test ID:** INV_001
**Description:** Verify product listing functionality
**Steps:**
1. Login as standard_user
2. Verify product grid layout
3. Verify each product card contains:
   - Product image
   - Product name
   - Product description
   - Price
   - Add to Cart button

**Expected Results:**
- All products are displayed correctly
- Product information is complete and accurate
- Images load properly

#### 2.2 Product Sorting
**Test ID:** INV_002
**Description:** Verify product sorting functionality
**Steps:**
1. Login as standard_user
2. Test all sorting options:
   - Name (A to Z)
   - Name (Z to A)
   - Price (low to high)
   - Price (high to low)

**Expected Results:**
- Products are correctly sorted according to selected criterion
- Sort dropdown maintains selected option
- Product list updates immediately

### 3. Shopping Cart Tests

#### 3.1 Add Products to Cart
**Test ID:** CART_001
**Description:** Verify adding products to shopping cart
**Steps:**
1. Login as standard_user
2. Add multiple products to cart
3. Verify cart badge updates
4. Click cart icon

**Expected Results:**
- Products are added successfully
- Cart badge shows correct quantity
- Cart page displays all added items
- Each item shows correct price

#### 3.2 Cart Management
**Test ID:** CART_002
**Description:** Verify cart management functionality
**Steps:**
1. Add multiple products to cart
2. Navigate to cart page
3. Remove one product
4. Verify cart updates
5. Continue shopping
6. Add another product

**Expected Results:**
- Products can be removed individually
- Cart total updates correctly
- Continue shopping returns to inventory
- Cart maintains state during navigation

### 4. Checkout Process Tests

#### 4.1 Checkout Information
**Test ID:** CHECK_001
**Description:** Verify checkout information form
**Steps:**
1. Add products to cart
2. Proceed to checkout
3. Fill in personal information:
   - First Name
   - Last Name
   - Zip Code
4. Click Continue

**Expected Results:**
- All fields accept valid input
- Form validation works correctly
- User proceeds to checkout overview

#### 4.2 Checkout Overview
**Test ID:** CHECK_002
**Description:** Verify checkout overview and completion
**Steps:**
1. Complete checkout information
2. Verify order summary:
   - Item list
   - Item subtotal
   - Tax
   - Total
3. Click Finish

**Expected Results:**
- Order summary shows correct items and prices
- Tax calculation is accurate
- Total amount is correct
- Order completion page shows success message

## Test Data Requirements

### User Credentials
- standard_user / secret_sauce
- locked_out_user / secret_sauce
- problem_user / secret_sauce
- performance_glitch_user / secret_sauce

### Customer Information
- First Name: "John"
- Last Name: "Doe"
- Zip Code: "12345"

## Test Environment Requirements

### Browser Coverage
- Chrome
- Firefox
- Safari
- Edge

### Viewport Sizes
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

## Notes and Assumptions
1. Tests assume a clean state at the beginning of each scenario
2. All tests should be independent and can run in any order
3. Network connectivity is stable
4. Test data is not persisted between test runs
5. Browser cache is cleared before each test suite execution