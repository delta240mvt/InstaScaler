import { createHmac, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) throw new Error("Usage: node scripts/generate-admin-secrets.mjs <password>");
const base64url = (value) => value.toString("base64url");
const pepper = base64url(randomBytes(32));
console.log(`ADMIN_PASSWORD_PEPPER=${pepper}`);
console.log(`ADMIN_PASSWORD_VERIFIER=${base64url(createHmac("sha256", pepper).update(password).digest())}`);
console.log(`SESSION_SIGNING_KEY=${base64url(randomBytes(32))}`);
console.log(`OAUTH_STATE_KEY=${base64url(randomBytes(32))}`);
console.log(`ENCRYPTION_KEY=${base64url(randomBytes(32))}`);
console.log(`IP_HASH_SALT=${base64url(randomBytes(32))}`);
