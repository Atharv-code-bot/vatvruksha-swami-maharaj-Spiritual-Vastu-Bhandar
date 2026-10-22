
/**
 * One-time script to create the FIRST admin.
 * 
 * 
 *  Emulator example (PowerShell):
 *  $env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
 *  node make-first-admin.js spiritual-vastu-bhandar owner@example.com
 *  Remove the variable after testing:
 *  Remove-Item Env:FIREBASE_AUTH_EMULATOR_HOST
 *
 * Usage(real project-deployed):
 * node make-first-admin.js spiritual-vastu-bhandar owner@example.com
 * 
 * (real project-deployed) Before running:
 * 1. Install firebase-admin if it is not already installed.
 * 2. Run: gcloud auth application-default login
 * 3. Use a Google account authorized for the intended Firebase project.
 * 4. Verify the target project and admin email.
 *
 * IMPORTANT:
 * This script grants admin access to a real Firebase Auth user.
 * Do not run it against production without client approval.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const admin = require("firebase-admin");

/**
 * Locate the ADC credential file without permanently modifying
 * the user's environment or copying credentials into this project.
 */
function discoverAdcFile() {
  const candidates = [];
  const home = os.homedir();

  // Respect an explicitly configured credential path first.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  if (process.platform === "win32") {
    if (process.env.APPDATA) {
      candidates.push(
        path.join(
          process.env.APPDATA,
          "gcloud",
          "application_default_credentials.json"
        )
      );
    }

    if (process.env.LOCALAPPDATA) {
      candidates.push(
        path.join(
          process.env.LOCALAPPDATA,
          "gcloud",
          "application_default_credentials.json"
        )
      );

      // Handle some packaged Windows installations.
      const packagesDir = path.join(
        process.env.LOCALAPPDATA,
        "Packages"
      );

      try {
        for (const packageName of fs.readdirSync(packagesDir)) {
          candidates.push(
            path.join(
              packagesDir,
              packageName,
              "LocalCache",
              "Roaming",
              "gcloud",
              "application_default_credentials.json"
            )
          );
        }
      } catch (_) {
        // The directory may not exist.
      }
    }
  } else {
    candidates.push(
      path.join(
        home,
        ".config",
        "gcloud",
        "application_default_credentials.json"
      )
    );
  }

  // Ask gcloud for its actual configuration directory.
  try {
    const configDir = execFileSync(
      "gcloud",
      [
        "info",
        "--format=value(config.paths.global_config_dir)"
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }
    ).trim();

    if (configDir) {
      candidates.push(
        path.join(
          configDir,
          "application_default_credentials.json"
        )
      );
    }
  } catch (_) {
    // gcloud may not be installed or available on PATH.
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  const found = uniqueCandidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch (_) {
      return false;
    }
  });

  if (!found) {
    console.error(
      "Could not locate application_default_credentials.json."
    );
    console.error(
      "First run: gcloud auth application-default login"
    );
    console.error(
      "Then check whether gcloud can locate its ADC configuration."
    );
    return null;
  }

  // Applies only to this Node.js process.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = found;

  console.log("ADC credential file found.");
  console.log(`Credential path: ${found}`);

  return found;
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = args[0];
  const email = args[1] ? args[1].trim() : "";

  if (args.length !== 2 || !projectId || !email) {
    console.error(
      "Usage: node make-first-admin.js <project-id> <owner-email>"
    );
    process.exitCode = 1;
    return;
  }

  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const usingEmulator = Boolean(emulatorHost);

  console.log(`Target project : ${projectId}`);
  console.log(`Target email   : ${email}`);
  console.log(
    `Mode           : ${
      usingEmulator
        ? `EMULATOR (${emulatorHost})`
        : "REAL PROJECT"
    }`
  );

  if (
    !usingEmulator &&
    projectId === "spiritual-vastu-bhandar"
  ) {
    console.warn(
      "\nWARNING: You are targeting the real spiritual-vastu-bhandar project."
    );
    console.warn(
      "Confirm client approval, project ID, and target email before proceeding.\n"
    );
  }

  if (!usingEmulator) {
    const adcFile = discoverAdcFile();

    if (!adcFile) {
      process.exitCode = 1;
      return;
    }
  }

  // Initialize the Admin SDK for the explicitly supplied project.
  admin.initializeApp({ projectId });

  const auth = admin.auth();
  let user;

  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error(
        "No Firebase Auth user exists for this email. " +
        "Ask the user to sign in once first, then retry."
      );
    }

    throw error;
  }

  if (!user.emailVerified) {
    throw new Error(
      "Refusing to grant admin access because this account's email is not verified."
    );
  }

  // Preserve any other existing custom claims.
  const claims = {
    ...(user.customClaims || {}),
    admin: true
  };

  await auth.setCustomUserClaims(user.uid, claims);

  console.log("\nAdmin role granted successfully.");
  console.log(`Email: ${email}`);
  console.log(`UID: ${user.uid}`);
  console.log(
    "The user must refresh their Firebase ID token or sign out and sign in again."
  );
}

main().catch((error) => {
  console.error(`Failed to set first admin: ${error.message}`);
  process.exitCode = 1;
});
