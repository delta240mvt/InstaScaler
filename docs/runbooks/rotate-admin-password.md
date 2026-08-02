# Rotate administrator credentials

1. Generate a new set locally: `node scripts/generate-admin-secrets.mjs "new-long-password"`.
2. Update `ADMIN_PASSWORD_PEPPER` and `ADMIN_PASSWORD_VERIFIER` together on the Core Worker.
3. To invalidate every existing session, also update `SESSION_SIGNING_KEY`. Keep it unchanged if current sessions may remain valid for up to seven days.
4. Deploy Core and verify one failed old-password login and one successful new-password login.
5. Remove generated values from terminal history and password-manager scratch notes after storing the final password securely.

The password itself is never stored in Cloudflare or Neon.
