import { Hono } from "hono";
import { connectInstagramAccount, disconnectInstagramAccount, listInstagramAccounts, type AccountConnectionDb, type AccountDb } from "@/lib/core/instagram-accounts";
import type { CoreEnv } from "@/lib/cloudflare/env";
import { exchangeInstagramCode, exchangeLongLivedToken, getInstagramProfile, getInstagramResource, subscribeInstagramWebhooks } from "@/lib/core/meta-client";
import { buildAuthorizationUrl, createOAuthState, decryptToken, encryptToken, verifyOAuthState } from "@/lib/core/meta-oauth";
import { requireAdmin } from "@/workers/core/middleware/auth";

type InstagramDb = AccountDb & AccountConnectionDb;

async function selectedAccount(db: AccountDb, id?: string) {
  const select = { id: true, instagramId: true, accessToken: true };
  return id ? db.instagramAccount.findUnique({ where: { id }, select }) : db.instagramAccount.findFirst({ orderBy: { connectedAt: "desc" }, select });
}

export function instagramRoutes(getDb: (env: CoreEnv) => InstagramDb) {
  const app = new Hono<{ Bindings: CoreEnv }>();

  app.get("/instagram/callback", async (context) => {
    const state = await verifyOAuthState(context.req.query("state") ?? "", Math.floor(Date.now() / 1000), context.env.OAUTH_STATE_KEY);
    const code = context.req.query("code");
    if (!state || !code) return context.redirect(`${context.env.APP_BASE_URL}/settings?instagram=invalid`);
    try {
      const short = await exchangeInstagramCode({ code, appId: context.env.META_APP_ID, appSecret: context.env.META_APP_SECRET, redirectUri: context.env.META_REDIRECT_URI });
      const long = await exchangeLongLivedToken(short.accessToken, context.env.META_APP_SECRET);
      const profile = await getInstagramProfile(long.accessToken);
      const webhookSubscribed = await subscribeInstagramWebhooks(profile.instagramId, long.accessToken).catch(() => false);
      await connectInstagramAccount(getDb(context.env), { ...profile, accessToken: await encryptToken(long.accessToken, context.env.ENCRYPTION_KEY), tokenExpiresAt: new Date(Date.now() + long.expiresIn * 1000), webhookSubscribed });
      return context.redirect(`${state.returnTo}?instagram=connected`);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "connection_failed";
      return context.redirect(`${state.returnTo}?instagram=${encodeURIComponent(code)}`);
    }
  });

  app.use("/instagram/*", requireAdmin);
  app.get("/instagram/connect", async (context) => {
    const returnTo = `${context.env.APP_BASE_URL}/settings`;
    const state = await createOAuthState(returnTo, Math.floor(Date.now() / 1000), context.env.OAUTH_STATE_KEY);
    return context.redirect(buildAuthorizationUrl({ appId: context.env.META_APP_ID, redirectUri: context.env.META_REDIRECT_URI, state }));
  });
  app.get("/instagram/accounts", async (context) => {
    const accounts = await listInstagramAccounts(getDb(context.env));
    return context.json({ data: { instagramAccounts: accounts, selectedInstagramAccountId: (accounts[0] as { id?: string } | undefined)?.id ?? null } });
  });
  app.delete("/instagram/accounts/:id", async (context) => {
    await disconnectInstagramAccount(getDb(context.env), context.req.param("id"));
    return context.body(null, 204);
  });
  app.delete("/instagram/disconnect", async (context) => {
    const id = context.req.query("id");
    if (!id) return context.json({ error: "missing_account_id" }, 400);
    await disconnectInstagramAccount(getDb(context.env), id);
    return context.body(null, 204);
  });
  app.get("/instagram/profile", async (context) => {
    const account = await selectedAccount(getDb(context.env), context.req.query("instagramAccountId")) as { accessToken: string } | null;
    if (!account) return context.json({ error: "account_not_found" }, 404);
    return context.json({ data: await getInstagramResource("me", await decryptToken(account.accessToken, context.env.ENCRYPTION_KEY), { fields: "id,user_id,username,name,profile_picture_url,followers_count,media_count" }) });
  });
  app.get("/instagram/posts", async (context) => {
    const account = await selectedAccount(getDb(context.env), context.req.query("instagramAccountId")) as { instagramId: string; accessToken: string } | null;
    if (!account) return context.json({ error: "account_not_found" }, 404);
    return context.json({ data: await getInstagramResource(`${account.instagramId}/media`, await decryptToken(account.accessToken, context.env.ENCRYPTION_KEY), { fields: "id,caption,media_type,media_url,permalink,timestamp", limit: "50" }) });
  });
  app.get("/instagram/overview", async (context) => {
    const account = await selectedAccount(getDb(context.env), context.req.query("instagramAccountId")) as { instagramId: string; accessToken: string } | null;
    if (!account) return context.json({ error: "account_not_found" }, 404);
    return context.json({ data: await getInstagramResource(`${account.instagramId}/insights`, await decryptToken(account.accessToken, context.env.ENCRYPTION_KEY), { metric: "reach,profile_views,accounts_engaged,total_interactions,follows_and_unfollows", period: "day" }) });
  });
  app.get("/instagram/conversations", async (context) => {
    const account = await selectedAccount(getDb(context.env), context.req.query("instagramAccountId")) as { instagramId: string; accessToken: string } | null;
    if (!account) return context.json({ error: "account_not_found" }, 404);
    return context.json({ data: await getInstagramResource(`${account.instagramId}/conversations`, await decryptToken(account.accessToken, context.env.ENCRYPTION_KEY), { platform: "instagram", fields: "id,updated_time,participants,messages.limit(1){id,created_time,from,to,message}" }) });
  });
  app.get("/instagram/conversations/:id", async (context) => {
    const account = await selectedAccount(getDb(context.env), context.req.query("instagramAccountId")) as { accessToken: string } | null;
    if (!account) return context.json({ error: "account_not_found" }, 404);
    return context.json({ data: await getInstagramResource(context.req.param("id"), await decryptToken(account.accessToken, context.env.ENCRYPTION_KEY), { fields: "id,updated_time,participants,messages.limit(100){id,created_time,from,to,message}" }) });
  });
  return app;
}
