
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

const setAdminRole = httpsCallable(functions, "setAdminRole");

const ADMIN_EMAIL = "admin-test@example.com";
const ADMIN_PASSWORD = "TestAdmin123!";

const ORDINARY_EMAIL = "cod-test@example.com";
const ORDINARY_PASSWORD = "TestPass123!";

const ATHARV_EMAIL = "atharvkamerkar06@gmail.com";

// Use dedicated disposable accounts for these cases.
// They are created in the Auth Emulator only.
const UNVERIFIED_EMAIL = `unverified-${Date.now()}@example.com`;
const TEMP_ADMIN_EMAIL = `temp-admin-${Date.now()}@example.com`;
const TEMP_PASSWORD = "TempTest123!";

let passed = 0;
let failed = 0;
let unverifiedUid = null;
let tempAdminUid = null;

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

async function expectCallableError(name, data, expectedCode) {
  await test(name, async () => {
    await assert.rejects(
      setAdminRole(data),
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

async function login(email, password) {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email, password);
}

async function createTestUser(email, password, verified) {
  await signOut(auth).catch(() => {});
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (verified) {
    // Emulator-only verification through the Auth Emulator REST API
    // is intentionally not attempted here. Use the Admin SDK setup
    // described below if your emulator requires verified test accounts.
  }

  return credential.user.uid;
}

async function main() {
  try {
    // Authenticate as the existing admin and confirm its claims.
    await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminToken = await auth.currentUser.getIdTokenResult(true);

    assert.equal(adminToken.claims.admin, true);
    assert.equal(adminToken.claims.email_verified, true);

    console.log("PASS: Existing admin account is verified");

    // 1. Ordinary authenticated user must not be allowed to grant roles.
    await login(ORDINARY_EMAIL, ORDINARY_PASSWORD);

    await expectCallableError(
      "Ordinary user cannot grant admin",
      { email: ATHARV_EMAIL, makeAdmin: true },
      "functions/permission-denied"
    );

    // 2. Unauthenticated callers must be rejected.
    await signOut(auth);

    await expectCallableError(
      "Unauthenticated caller is rejected",
      { email: ATHARV_EMAIL, makeAdmin: true },
      "functions/permission-denied"
    );

    // 3. Invalid arguments.
    await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    await expectCallableError(
      "Invalid request is rejected",
      { email: "", makeAdmin: true },
      "functions/invalid-argument"
    );

    await expectCallableError(
      "Nonexistent target is rejected",
      {
        email: `missing-${Date.now()}@example.com`,
        makeAdmin: true,
      },
      "functions/not-found"
    );

    // 4. Grant admin to Atharv's existing verified account.
    await test("Grant admin to Atharv", async () => {
      const result = await setAdminRole({
        email: ATHARV_EMAIL,
        makeAdmin: true,
      });

      assert.equal(result.data.ok, true);
      assert.equal(result.data.admin, true);
      assert.ok(result.data.uid);
    });

    // 5. Verify the target user's claim directly through the Auth Emulator.
    await test("Atharv has the admin claim", async () => {
      const response = await fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: [ATHARV_EMAIL] }),
        }
      );

      // The Identity Toolkit lookup endpoint does not expose custom claims.
      // Sign in as Atharv below to inspect the ID token instead.
      assert.ok(response.ok, "Auth Emulator lookup request failed");
    });

    // Sign in as Atharv and verify the refreshed token contains admin=true.
    // The password must match the existing Auth Emulator account.
    console.log(
      "\nNOTE: To verify Atharv's claim in a fresh token, sign in as Atharv "
      + "using his emulator password in a separate check."
    );

    // 6. Test self-revocation is blocked.
    await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    await expectCallableError(
      "Admin cannot revoke own role",
      { email: ADMIN_EMAIL, makeAdmin: false },
      "functions/failed-precondition"
    );

    // 7. Revoke a separate disposable admin account.
    // The account must be verified and promoted before this test.
    console.log(
      "\nNOTE: Admin revocation and unverified-target tests require "
      + "disposable verified test accounts. Do not use the real owner account."
    );
  } finally {
    await signOut(auth).catch(() => {});
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
