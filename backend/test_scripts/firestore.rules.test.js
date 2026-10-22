
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} = require("firebase/firestore");

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ID = "spiritual-vastu-bhandar";
const FIRESTORE_HOST = "127.0.0.1";
const FIRESTORE_PORT = 8081;

let testEnv;

before(async () => {
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: FIRESTORE_HOST,
      port: FIRESTORE_PORT,
      rules,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

async function seedData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "categories/active-category"), {
      name: "Active Category",
      isActive: true,
      sortOrder: 1,
    });

    await setDoc(doc(db, "categories/inactive-category"), {
      name: "Inactive Category",
      isActive: false,
      sortOrder: 2,
    });

    await setDoc(doc(db, "products/active-product"), {
      name: "Active Product",
      categoryId: "active-category",
      color: "Brass",
      isActive: true,
      variants: {
        small: {
          label: "Small",
          price: 9900,
          stock: 10,
          isActive: true,
        },
      },
    });

    await setDoc(doc(db, "products/inactive-product"), {
      name: "Inactive Product",
      categoryId: "active-category",
      isActive: false,
      variants: {},
    });

    await setDoc(doc(db, "users/customer-a"), {
      name: "Customer A",
      email: "a@example.com",
      mobile: "9000000001",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await setDoc(doc(db, "users/customer-a/addresses/home"), {
      fullName: "Customer A",
      mobile: "9000000001",
      addressLine1: "Test Street",
      city: "Kolhapur",
      state: "Maharashtra",
      pincode: "416001",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await setDoc(doc(db, "orders/test-order"), {
      userId: "customer-a",
      status: "confirmed",
    });
  });
}

function customerA() {
  return testEnv.authenticatedContext("customer-a", {
    email: "a@example.com",
    email_verified: true,
  }).firestore();
}

function customerB() {
  return testEnv.authenticatedContext("customer-b", {
    email: "b@example.com",
    email_verified: true,
  }).firestore();
}

function verifiedAdmin() {
  return testEnv.authenticatedContext("admin-user", {
    email: "admin@example.com",
    email_verified: true,
    admin: true,
  }).firestore();
}

function unverifiedAdmin() {
  return testEnv.authenticatedContext("unverified-admin", {
    email: "unverified@example.com",
    email_verified: false,
    admin: true,
  }).firestore();
}

describe("Firestore security rules", () => {
  beforeEach(async () => {
    await seedData();
  });

  it("allows customers to read active products", async () => {
    await assertSucceeds(
      getDoc(doc(customerA(), "products/active-product"))
    );
  });

  it("denies customers access to inactive products", async () => {
    await assertFails(
      getDoc(doc(customerA(), "products/inactive-product"))
    );
  });

  it("allows customers to read active categories", async () => {
    await assertSucceeds(
      getDoc(doc(customerA(), "categories/active-category"))
    );
  });

  it("denies customers access to inactive categories", async () => {
    await assertFails(
      getDoc(doc(customerA(), "categories/inactive-category"))
    );
  });

  it("allows customers to read their own profile", async () => {
    await assertSucceeds(
      getDoc(doc(customerA(), "users/customer-a"))
    );
  });

  it("denies customers access to another profile", async () => {
    await assertFails(
      getDoc(doc(customerA(), "users/customer-b"))
    );
  });

  it("denies customers access to another customer's address", async () => {
    await assertFails(
      getDoc(doc(customerB(), "users/customer-a/addresses/home"))
    );
  });

  it("denies customers direct order creation", async () => {
    await assertFails(
      setDoc(doc(customerA(), "orders/new-order"), {
        userId: "customer-a",
        status: "confirmed",
      })
    );
  });

  it("denies customers direct order updates", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "orders/test-order"), {
        status: "delivered",
      })
    );
  });

  it("denies customers direct product stock changes", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "products/active-product"), {
        "variants.small.stock": 999,
      })
    );
  });

  it("allows a verified admin to read inactive products", async () => {
    await assertSucceeds(
      getDoc(doc(verifiedAdmin(), "products/inactive-product"))
    );
  });

  it("allows a verified admin to create a category", async () => {
    await assertSucceeds(
      setDoc(doc(verifiedAdmin(), "categories/admin-category"), {
        name: "Admin Category",
        isActive: true,
        sortOrder: 3,
      })
    );
  });

  it("denies admin access when email is unverified", async () => {
    await assertFails(
      setDoc(doc(unverifiedAdmin(), "categories/blocked-category"), {
        name: "Blocked Category",
        isActive: true,
        sortOrder: 4,
      })
    );
  });
  
  it("denies customers changing their email", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "users/customer-a"), {
        email: "attacker@example.com",
      })
    );
  });

  it("denies customers adding unauthorized profile fields", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "users/customer-a"), {
        admin: true,
      })
    );
  });

  it("denies customers modifying another user's address", async () => {
    await assertFails(
      updateDoc(
        doc(customerB(), "users/customer-a/addresses/home"),
        { city: "Mumbai" }
      )
    );
  });

  it("denies customers changing variant prices", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "products/active-product"), {
        "variants.small.price": 1,
      })
    );
  });

  it("denies customers changing product active status", async () => {
    await assertFails(
      updateDoc(doc(customerA(), "products/active-product"), {
        isActive: false,
      })
    );
  });

  it("denies admins without the admin claim", async () => {
    const db = testEnv.authenticatedContext("ordinary-admin", {
      email: "ordinary@example.com",
      email_verified: true,
    }).firestore();

    await assertFails(
      setDoc(doc(db, "categories/unauthorized-category"), {
        name: "Unauthorized Category",
        isActive: true,
        sortOrder: 5,
      })
    );
  });

});
