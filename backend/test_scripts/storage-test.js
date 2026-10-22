
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} = require("firebase/auth");
const {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} = require("firebase/storage");

const app = initializeApp({
  apiKey: "demo-api-key",
  authDomain: "localhost",
  projectId: "spiritual-vastu-bhandar",
  storageBucket: "spiritual-vastu-bhandar.firebasestorage.app",
});

const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099");

const storage = getStorage(app);
connectStorageEmulator(storage, "127.0.0.1", 9199);

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const imagePath = `products/storage-test-${Date.now()}/test.png`;
const imageRef = ref(storage, imagePath);
const deniedUploadRef = ref(
  storage,
  `products/unauthorized-test-${Date.now()}/test.png`
);

// Valid minimal 1x1 PNG image.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
  "base64"
);

async function expectStorageDenied(name, operation) {
  try {
    await operation();
    throw new Error(`${name}: operation unexpectedly succeeded`);
  } catch (error) {
    if (error.message.includes("unexpectedly succeeded")) {
      throw error;
    }

    assert.equal(
      error.code,
      "storage/unauthorized",
      `${name}: expected storage/unauthorized, received ${error.code}`
    );

    console.log(`PASS: ${name}`);
  }
}

async function main() {
  assert.ok(email, "Set TEST_EMAIL before running this script");
  assert.ok(password, "Set TEST_PASSWORD before running this script");

  try {
    // Authenticate as the administrator.
    await signInWithEmailAndPassword(auth, email, password);

    const token = await auth.currentUser.getIdTokenResult(true);

    assert.equal(
      token.claims.admin,
      true,
      "This account does not have the admin claim"
    );

    assert.equal(
      token.claims.email_verified,
      true,
      "This account's email is not verified"
    );

    console.log("PASS: Admin authentication and claims");

    // Test 1: Admin upload.
    await uploadBytes(imageRef, png, {
      contentType: "image/png",
    });

    console.log("PASS: Admin can upload an image");

    // Test 2: Public image retrieval.
    const downloadURL = await getDownloadURL(imageRef);
    assert.ok(downloadURL);

    console.log("PASS: Image download URL generated");

    // Test 3: Unauthenticated users cannot upload.
    await signOut(auth);

    await expectStorageDenied(
      "Unauthenticated upload is rejected",
      () =>
        uploadBytes(deniedUploadRef, png, {
          contentType: "image/png",
        })
    );

    // Test 4: Public read works without authentication.
    const publicURL = await getDownloadURL(imageRef);
    assert.ok(publicURL);

    console.log("PASS: Public image read works without authentication");

    // Test 5: Unauthenticated users cannot delete.
    await expectStorageDenied(
      "Unauthenticated delete is rejected",
      () => deleteObject(imageRef)
    );

    // Test 6: An admin can delete the test image.
    await signInWithEmailAndPassword(auth, email, password);

    await deleteObject(imageRef);

    console.log("PASS: Admin can delete an image");

    console.log("\nStorage emulator tests completed successfully.");
  } finally {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error("\nSTORAGE TEST FAILED:", error);
  process.exitCode = 1;
});
