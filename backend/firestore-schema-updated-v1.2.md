# Firestore Schema Reference --- Spiritual Vastu Bhandar (version 1.2)

Database: Cloud Firestore Standard, region `asia-south1`. Backend:
Python Cloud Functions. Auth: Firebase Authentication (Google,
Email/Password).

This is the updated version 1.2 schema and implementation reference. It
preserves the existing order, payment, inventory, authentication, and
security rules while recording the category-image removal and
admin-dashboard clarifications agreed during implementation. Business
decisions explicitly deferred to later phases are listed near the end.

## Conventions

-   **Money:** integer paise (₹299 = `29900`). Never floats.
-   **Timestamps:** Firestore timestamps, set by the server (server
    timestamp or Cloud Function), not by the browser.
-   **Variant IDs:** stable, never reused, never derived from labels.
    Use only `a-z`, `0-9`, `_` (no dots, spaces or slashes, because dots
    break field-path updates). Products without options use one variant,
    `default`.
-   **Product images:** store Firebase Storage **paths**, not URLs,
    using `products/{productId}/{filename}`. The frontend builds
    download URLs using the bucket name from an environment variable.
-   **Category images:** not used. Category documents must not require
    or write an image field. Existing legacy `imagePath` fields may
    remain until separately cleaned up; no empty placeholder field is
    required.
-   **Category descriptions:** not used by the customer-facing dashboard
    or the agreed category workflow. New category documents should omit
    `description`; legacy values may remain until separately cleaned up.
-   **No hard deletes** of ordered products or variants. Set
    `isActive: false`.
-   **Query filters that the rules require:** categories and products
    must be queried with `isActive == true`; customer orders with
    `userId == <own uid>`. Rules do not filter results.
-   **Admin:** custom claim `admin: true` (and a verified email). No
    role field in Firestore.

## Version 1.1 change notes

-   Category image upload/display is no longer part of the agreed
    category workflow. New category documents omit `imagePath`; no empty
    image field is required. This does not automatically delete old
    Storage objects or legacy Firestore fields.
-   Category descriptions are also not used by the customer-facing
    dashboard. New category documents should omit `description`; this
    does not automatically remove legacy description fields.
-   Admin profile name/mobile edits are application-profile updates, not
    new schema collections. The agreed profile document remains
    `users/{uid}` with `name`, `email`, `mobile`, `createdAt`, and
    `updatedAt`; Firebase Authentication remains the source of truth for
    identity/email and password credentials.
-   Admin Exceptions is a read-only review queue. The schema's supported
    review marker remains
    `orders/{orderId}.payment.needsReview == true`. The frontend must
    not invent new persistent fields or directly mutate order/payment
    status to populate this page. Any additional backend status markers
    should be documented only after confirmed against the deployed
    backend contract.
-   Admin payment recheck, where retained for uncertain Paytm payments,
    calls a trusted backend function. The frontend must not confirm
    payment or write payment/order state directly. Exceptions itself
    must not invoke payment verification.
-   Dashboard cards, loading states, refresh buttons, navbar state,
    animations, and route guards are frontend behavior and do not add
    Firestore fields.

## `categories/{categoryId}`

Category documents contain only the fields needed for category identity, visibility, ordering, and timestamps. Do not add `description` or image fields for new categories.

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `name`                  string                  
  *(no image field)*      ---                     Category images are not
                                                  used; omit `imagePath`
                                                  entirely.

  `isActive`              boolean                 Customers see active
                                                  categories only

  `sortOrder`             number                  Display order

  `createdAt`,            timestamp               
  `updatedAt`                                     
  -----------------------------------------------------------------------

## `products/{productId}`

  --------------------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- --------------------------------
  `name`                  string                  

  `slug`                  string                  URL identifier; must be unique
                                                  when provided. Check uniqueness
                                                  before saving in the admin
                                                  workflow and enforce it in
                                                  trusted backend logic where
                                                  writes can race.

  `description`           string                  

  `color`                 string                  

  `categoryId`            string                  Category document ID

  `images`                array of strings        Storage paths

  `specs`                 map, optional           e.g. `{ "material": "Brass" }`

  `variants`              map                     Keyed by variant ID, at least
                                                  one valid variant

  `isActive`              boolean                 Product visibility

  `sortOrder`             number                  

  `createdAt`,            timestamp               
  `updatedAt`                                     
  --------------------------------------------------------------------------------

**Variant fields** (`variants.{variantId}`):

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `label`                 string                  Editable display name
                                                  (e.g. "Small")

  `sku`                   string                  Unique when provided;
                                                  check before saving and
                                                  enforce uniqueness in
                                                  trusted backend logic
                                                  where writes can race.

  `price`                 integer paise           Current selling price

  `mrp`                   integer paise           List price

  `stock`                 integer, ≥ 0            Units available to sell
                                                  now

  `isActive`              boolean                 Inactive variants
                                                  cannot be ordered

  `sortOrder`             number                  

  `weightGrams`           number, optional        Reserved for shipping
                                                  rules (undecided)
  -----------------------------------------------------------------------

## `users/{uid}`

Document ID = Firebase Auth UID. Auth is the source of truth for
identity.

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `name`                  string                  

  `email`                 string                  Copied from Auth. Order
                                                  snapshots take the
                                                  email from the verified
                                                  Auth token

  `mobile`                string                  Collected without OTP

  `createdAt`,            timestamp               
  `updatedAt`                                     
  -----------------------------------------------------------------------

## `users/{uid}/addresses/{addressId}`

`fullName`, `mobile`, `addressLine1`, `addressLine2` (optional),
`landmark` (optional), `city`, `state`, `pincode` (strings), `isDefault`
(boolean), `createdAt`, `updatedAt`. At checkout, an address can be
entered without saving. Each order keeps its own snapshot.

## `orders/{orderId}`

Created **only** by trusted Python Cloud Functions.

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  `orderNumber`           string                  Customer-facing;
                                                  generated by trusted
                                                  backend logic and
                                                  guaranteed unique.
                                                  Validate the format
                                                  against Paytm's
                                                  order-ID requirements
                                                  during payment
                                                  integration.

  `userId`                string                  Customer UID

  `customer`              map                     Snapshot: `name`,
                                                  `email`, `mobile`

  `idempotencyKeyHash`    String                  SHA-256 hash of the
                                                  client-generated
                                                  requestId; used by the
                                                  backend to identify
                                                  retries and prevent
                                                  duplicate order
                                                  creation. Set by
                                                  trusted backend logic.

  `shippingAddress`       map                     Snapshot of the
                                                  delivery address

  `items`                 array of maps           Snapshots (below)

  `totals`                map                     Backend-calculated
                                                  (below)

  `paymentMethod`         string                  `cod` or `paytm`

  `payment`               map                     Below

  `status`                string                  Order lifecycle

  `statusHistory`         array of maps           `status`, timestamp,
                                                  actor

  `trackingId`            string, optional        Courier reference

  `reservedUntil`         timestamp               Paytm orders only:
                                                  stock-reservation
                                                  expiry (about 15
                                                  minutes)

  `stockReleasedAt`       timestamp               Set in the same
                                                  transaction that
                                                  restores stock;
                                                  prevents duplicate
                                                  stock restoration

  `createdAt`,            timestamp               
  `updatedAt`                                     

  `schemaVersion`         number                  `1`
  -----------------------------------------------------------------------

**`items[]`:** `productId`, `variantId`, `productName`, `variantLabel`,
`sku`, `imagePath` (where available), `unitPrice`, `quantity`,
`lineTotal`, `weightGrams` (if needed).

**`totals`:** `subtotal`, `shipping`, `codFee`, `discount` (if
introduced), `total`. All integer paise, calculated by the backend,
never taken from the frontend. Structure stays flexible until shipping
and COD policies are decided.

**`payment`:** `status`, `amount`, Paytm order and transaction
references, verification timestamps. No credentials or secrets. -
`status` values: COD `pending` (to be collected) then `collected`; Paytm
`pending`, `paid`, `failed`, `uncertain`. - COD collection is recorded
by a protected function, including `collectedAt` and the actor who
recorded it. - `needsReview` (boolean): set when money may have been
deducted despite a failure or a late payment cannot safely be fulfilled.
The admin dashboard must be able to list these orders even if email
delivery fails.

Payment status is kept separate from order status.

### Order statuses

`pending_payment`, `confirmed`, `shipped`, `delivered`,
`payment_failed`, `expired`, `cancelled` (reserved for future manual
cancellation). COD orders start at `confirmed`.

Allowed transitions (enforced by protected backend functions; never by
direct client or admin Firestore writes):

  -----------------------------------------------------------------------
  From                    To                      Who
  ----------------------- ----------------------- -----------------------
  `pending_payment`       `confirmed`             Payment verification
                                                  function

  `pending_payment`       `payment_failed`        Payment verification
                                                  function (confirmed
                                                  failure only)

  `pending_payment`       `expired`               Scheduled expiry job
                                                  (after status check
                                                  with Paytm)

  `confirmed`             `shipped`               Admin, via function

  `shipped`               `delivered`             Admin, via function

  `confirmed`             `cancelled`             Admin, via function
                                                  (future; restores stock
                                                  once)
  -----------------------------------------------------------------------

`delivered`, `payment_failed`, `expired`, `cancelled` are terminal.
Cancelling a delivered order is not allowed by default. Cancelling a
shipped order is undecided.

## Inventory

-   Stock lives at `products/{productId}.variants.{variantId}.stock`.
-   The order function checks current price and stock and decrements
    stock **in one Firestore transaction**.
-   COD: stock deducted when the order is accepted. Paytm: stock
    reserved when payment begins; the reservation expires after about 15
    minutes.
-   Confirmed Paytm failure or expiry: release stock **exactly once**.
    If the payment status is uncertain, verify with Paytm before
    releasing.
-   Payment calls and emails never run inside a Firestore transaction
    (transactions can retry).
-   Admin stock edits must not overwrite concurrent order changes. Stock
    set/adjust goes through a transactional backend function; other
    catalog fields can be edited directly with field-level updates.
-   One shared, idempotent stock-restoration routine serves failed
    payments, expiry and future cancellation.
-   Low stock: `0 < stock <= threshold`; out of stock: `stock == 0`.
    Default threshold is 5, kept in one shared admin-app config constant
    for version 1; do not create a separate configuration collection.
-   The dashboard shows product name, variant label and exact quantity.
-   A stock-movement audit collection is deferred.

**Scalability note:** embedded variants cannot be queried by stock
across products. The low-stock view reads the product documents and
checks variants in the browser. That is one read per product per load
(about 120 reads for this catalog), which is fine. If the catalog grows
large, add a derived field on the product document (not a new
collection), maintained by the stock function, such as the lowest
active-variant stock, and query on that.

## Payment failure handling

-   Paytm confirms failure: order `payment_failed`, stock released once.
-   Money may have been deducted despite failure: email the client for
    manual investigation and refund; set `payment.needsReview`. No
    automatic refunds.
-   Uncertain result: verify the final status first. Do not release
    stock or fail the order before then.
-   If Paytm reports success after the reservation has expired, verify
    the payment and attempt to reserve the required stock again
    transactionally. If stock is unavailable, do not fulfil the order
    normally; keep it `expired`, set `payment.needsReview`, and notify
    the client for manual investigation/refund. No automatic refund.
-   Email delivery, retries and duplicate prevention are deferred to the
    email phase. COD emails must show the backend-calculated amount to
    collect.

## Queries and indexes (composite)

  -----------------------------------------------------------------------
  Collection              Index fields            Used by
  ----------------------- ----------------------- -----------------------
  `categories`            `isActive` ASC,         Active categories,
                          `sortOrder` ASC         ordered

  `products`              `isActive` ASC,         All active products,
                          `sortOrder` ASC         ordered

  `products`              `isActive` ASC,         Active products in a
                          `categoryId` ASC,       category
                          `sortOrder` ASC         

  `orders`                `userId` ASC,           Customer order history
                          `createdAt` DESC        

  `orders`                `status` ASC,           Admin filter by status
                          `createdAt` DESC        

  `orders`                `status` ASC,           Expiry job:
                          `reservedUntil` ASC     `pending_payment` and
                                                  `reservedUntil` in the
                                                  past
  -----------------------------------------------------------------------

Single-field queries (all orders by `createdAt`, admin product list)
need no composite index. These indexes go in `firestore.indexes.json`.
The emulator may not enforce missing indexes, but the deployed database
does.

## Security summary

  -----------------------------------------------------------------------
  Data              Customer          Admin             Functions
  ----------------- ----------------- ----------------- -----------------
  Active categories Read              Read and write    ,
  and products                        all               

  Own profile and   Read and write    Read profile      ,
  addresses         permitted fields                    

  Own orders        Read              Read all          Create and update

  Order status,     No writes         No direct writes  Only writers
  totals, payment,                                      
  stock                                                 
  reservations                                          

  Admin role        Cannot grant      Via protected     Sets the claim
                                      function          

  Anything else     Denied            Denied            ,
  -----------------------------------------------------------------------

## Deferred business decisions (not conflicts)

-   Shipping charges, COD fee, minimum and maximum order values, pincode
    restrictions, quantity limits.
-   Email provider, delivery, retries, duplicate prevention.
-   Cancellation workflow details (timestamp, reason, actor fields),
    cancellation of shipped orders, refund handling (manual).
-   Stock-movement audit collection.

## Agreed implementation requirements

1.  Paytm orders use `reservedUntil`; any stock restoration records
    `stockReleasedAt` in the same transaction so stock is restored at
    most once.
2.  Payment status is separate from order status. COD collection is
    recorded through a protected function with timestamp and actor.
    `payment.needsReview` identifies payments requiring manual
    investigation.
3.  Order status transitions are enforced by protected backend
    functions. Customers and admins cannot directly write order status,
    totals, payment state, or stock-reservation fields in Firestore.
4.  A late Paytm success is verified. The backend attempts to re-reserve
    stock; if unavailable, the order remains `expired`, is marked
    `needsReview`, and the client is notified for manual
    investigation/refund.
5.  Stock set/adjust operations use a transactional backend function.
    Catalog edits must not overwrite stock fields.
6.  `orderNumber` is generated uniquely by trusted backend logic. Slugs
    and SKUs must be unique when supplied; check in the admin workflow
    and enforce in trusted backend logic where concurrent writes are
    possible. Validate Paytm order-ID format during payment integration.
7.  Checkout requires a verified email. Support Google and
    Email/Password authentication; the customer profile's email is
    copied from Firebase Auth, and order email snapshots use the
    verified Auth identity.
8.  Storage rules should support `products/{productId}/{filename}`
    product-image paths, with public read access only where intended and
    admin-only writes subject to file type and size limits. Category
    image uploads are no longer part of the workflow; legacy category
    objects, if any, are not automatically deleted.
9.  Customers can read only active categories/products and their own
    orders. Firestore rules do not filter query results, so client
    queries must include the required filters.
10. The first admin is bootstrapped using a trusted local Admin SDK
    script after confirming the correct Firebase project and account.
    Admin privileges use the Firebase Auth custom claim `admin: true`
    plus a verified email; never a client-editable Firestore role field.

## Deferred business decisions

-   Shipping charges, COD fee, minimum and maximum order values, pincode
    restrictions, quantity limits, and any tax/GST rules.
-   Email provider, delivery implementation, retries, and duplicate
    prevention (handled in the later email phase). Customer and client
    order emails must use backend-calculated totals; COD emails must
    clearly state the amount to collect.
-   Cancellation workflow implementation (deferred): customer contacts
    the admin and provides the Order ID; the admin checks the request
    and manually changes the status through a protected function. No
    customer self-service cancellation or automatic refund. If
    cancellation is approved, restore stock exactly once. Paytm refunds
    are handled manually by the client. Define any additional
    cancellation fields when implementing this phase.
-   Stock-movement audit collection.
