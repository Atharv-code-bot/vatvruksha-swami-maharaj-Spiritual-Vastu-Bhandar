# Vatvruksha Swami Maharaj Spiritual Vastu Bhandar

A modern e-commerce platform for spiritual and vastu products, featuring
customer and admin web applications powered by a shared Firebase
backend.

## Features

-   **Customer Storefront:** Product discovery, customer accounts, and
    order placement.
-   **Admin Dashboard:** Centralized interface for managing store
    operations.
-   **Secure Backend:** Python Firebase Cloud Functions with Firestore
    and Firebase Storage.
-   **Authentication:** Firebase Authentication with Google and
    email/password sign-in support.
-   **Payments:** Cash on Delivery (COD) and Paytm payment integration
    with server-side verification.
-   **Email Notifications:** Transactional order emails through Resend,
    including backend-calculated totals.
-   **Security:** Backend authorization, Firestore and Storage rules,
    and server-trusted order processing.

## Technology Stack

-   **Frontend:** React, JavaScript, Vite, Tailwind CSS
-   **Backend:** Python, Firebase Cloud Functions
-   **Database & Storage:** Cloud Firestore, Firebase Storage
-   **Authentication:** Firebase Authentication
-   **Payments:** Paytm
-   **Email:** Resend
-   **Testing:** Firebase Emulator Suite

## Project Structure

``` text
.
├── backend/
│   ├── functions/       # Cloud Functions and business logic
│   ├── scripts/         # Administrative utilities
│   ├── test_scripts/    # Backend tests
│   ├── test-dashboard/  # Testing dashboard and assets
│   ├── firebase.json
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
└── Frontend/
    ├── admin-side/      # Admin React application
    ├── customer-side/   # Customer React application
    └── shared/          # Shared frontend utilities
```

Both frontend applications follow a separate-app structure with their
own dependencies and configuration, while using the shared backend.

## Backend Services

The backend includes functions for COD order creation, Paytm order
creation and payment verification, expiry of pending Paytm orders, and
administrator role management.

Order totals are calculated or validated on the backend. Payment success
is verified server-side, and COD emails clearly communicate the final
amount payable or collectable. Sensitive operations derive customer
identity from verified Firebase authentication context rather than
trusting a client-supplied user ID.

## Local Development

### Admin frontend

``` bash
cd Frontend/admin-side
npm install
npm run dev
```

### Firebase Emulator Suite

Run from the `backend/` directory:

``` bash
firebase emulators:start --import=./emulator-data --project demo-spiritual-vastu-bhandar
```

Open the Emulator UI at `http://127.0.0.1:4000/` while the emulators are
running. The import option requires a local `emulator-data/` export.

### Backend dependencies

Use Python 3.11 and install dependencies from
`backend/functions/requirements.txt`. Keep local virtual environments,
`.env` files, secrets, emulator exports, and generated files out of
version control. Use `.env.example` files with placeholders to document
required configuration.

## Security and Deployment

-   Enforce authorization in backend functions and Firebase rules.
-   Never expose private payment, email, or service-account credentials
    in frontend code or source control.
-   Verify Paytm payment status on the backend.
-   Use emulator testing and non-production credentials before testing
    external integrations.
-   Confirm the Firebase target project before deployment.

The intended deployment keeps the customer storefront and admin
dashboard as separate frontend applications backed by the same Firebase
services. Production Firebase, billing, and merchant accounts should
remain under the client's ownership.

## Project Status

The project architecture covers the customer storefront, admin
dashboard, and shared Firebase backend. Update this documentation as
implementation and deployment milestones are verified.

------------------------------------------------------------------------

**Project:** Vatvruksha Swami Maharaj Spiritual Vastu Bhandar
