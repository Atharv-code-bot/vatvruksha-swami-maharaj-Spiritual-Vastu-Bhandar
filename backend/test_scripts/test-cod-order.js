
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} = require("firebase/auth");
const {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} = require("firebase/functions");

const app = initializeApp({
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: "spiritual-vastu-bhandar",
});

const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099");

const functions = getFunctions(app, "asia-south1");
connectFunctionsEmulator(functions, "127.0.0.1", 5001);

const createCodOrder = httpsCallable(functions, "createCodOrder");

const ADDRESS = {
  fullName: "COD Test User",
  mobile: "9876543210",
  addressLine1: "123 Test Street",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
};

const ITEM = {
  productId: "test-brass-diya",
  variantId: "small",
  quantity: 1,
};

// One ID is shared by the first order and its retry.
const requestId = `cod-suite-${Date.now()}`;

const validRequest = {
  requestId,
  items: [ITEM],
  shippingAddress: ADDRESS,
};

let passed = 0;
let failed = 0;

async function test(name, callback) {
  try {
    await callback();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error.message || error);
  }
}

async function expectError(name, request, expectedCode) {
  await test(name, async () => {
    await assert.rejects(
      createCodOrder(request),
      (error) => {
        assert.equal(
          error.code,
          expectedCode,
          `Expected ${expectedCode}, received ${error.code}`
        );
        return true;
      }
    );
  });
}

async function main() {
  let originalOrder = null;

  try {
    // The account must already exist and have a verified email
    // in the Auth Emulator.
    await signInWithEmailAndPassword(
      auth,
      "atharvkamerkar06@gmail.com",
      "TestPass123!"
    );

    // TEST 1: Create one legitimate COD order.
    await test("Valid COD order is created", async () => {
      const result = await createCodOrder(validRequest);
      originalOrder = result.data;

      assert.equal(originalOrder.ok, true);
      assert.equal(originalOrder.idempotent, false);
      assert.equal(originalOrder.status, "confirmed");
      assert.equal(originalOrder.totals.subtotal, 9900);
      assert.equal(originalOrder.totals.total, 9900);
      assert.ok(originalOrder.orderId);
    });

    // Do not run retry tests if the initial order failed.
    if (!originalOrder) {
      throw new Error(
        "Initial order failed; fix that error before continuing."
      );
    }

    // TEST 2: Same request ID and same payload must return the
    // existing order instead of creating another order.
    await test("Retry is idempotent", async () => {
      const result = await createCodOrder(validRequest);

      assert.equal(result.data.ok, true);
      assert.equal(result.data.idempotent, true);
      assert.equal(result.data.orderId, originalOrder.orderId);
      assert.equal(
        result.data.orderNumber,
        originalOrder.orderNumber
      );
    });

    // TEST 3: An absent product must be rejected.
    await expectError(
      "Invalid product is rejected",
      {
        ...validRequest,
        requestId: `${requestId}-bad-product`,
        items: [{
          productId: "missing-test-product",
          variantId: "small",
          quantity: 1,
        }],
      },
      "functions/not-found"
    );

    // TEST 4: A quantity far above available stock must be rejected.
    // No stock should be deducted by this failed request.
    await expectError(
      "Insufficient stock is rejected",
      {
        ...validRequest,
        requestId: `${requestId}-no-stock`,
        items: [{ ...ITEM, quantity: 999999 }],
      },
      "functions/resource-exhausted"
    );

    // TEST 5: The client cannot set its own price.
    await expectError(
      "Client-supplied price is rejected",
      {
        ...validRequest,
        requestId: `${requestId}-fake-price`,
        items: [{ ...ITEM, price: 1 }],
      },
      "functions/invalid-argument"
    );

    // TEST 6: The client cannot choose another customer's UID.
    await expectError(
      "Client-supplied userId is rejected",
      {
        ...validRequest,
        requestId: `${requestId}-fake-user`,
        userId: "another-customers-uid",
      },
      "functions/invalid-argument"
    );

    // TEST 7: Sign out, then verify checkout requires authentication.
    await signOut(auth);

    await expectError(
      "Unauthenticated checkout is rejected",
      {
        ...validRequest,
        requestId: `${requestId}-unauthenticated`,
      },
      "functions/unauthenticated"
    );
  } finally {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
  }

  console.log("\n------------------------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("------------------------------");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nTEST SUITE STOPPED:", error);
  process.exitCode = 1;
});
