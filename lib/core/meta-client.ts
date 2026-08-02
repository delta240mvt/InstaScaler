type Fetch = typeof fetch;

async function json<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string }; error_message?: string };
  if (!response.ok) throw new Error(data.error?.message ?? data.error_message ?? `Meta API returned ${response.status}`);
  return data;
}

export async function exchangeInstagramCode(input: { code: string; appId: string; appSecret: string; redirectUri: string; fetch?: Fetch }): Promise<{ accessToken: string; userId: string }> {
  const body = new URLSearchParams({ client_id: input.appId, client_secret: input.appSecret, grant_type: "authorization_code", redirect_uri: input.redirectUri, code: input.code });
  const response = await (input.fetch ?? fetch)("https://api.instagram.com/oauth/access_token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const data = await json<{ access_token: string; user_id: string | number }>(response);
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

export async function exchangeLongLivedToken(shortToken: string, appSecret: string, request: Fetch = fetch): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);
  const data = await json<{ access_token: string; expires_in: number }>(await request(url));
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getInstagramProfile(accessToken: string, request: Fetch = fetch): Promise<{ instagramId: string; username: string; name: string | null }> {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set("fields", "id,user_id,username,name");
  url.searchParams.set("access_token", accessToken);
  const data = await json<{ id: string; user_id?: string; username: string; name?: string }>(await request(url));
  return { instagramId: String(data.user_id ?? data.id), username: data.username, name: data.name ?? null };
}

export async function subscribeInstagramWebhooks(instagramId: string, accessToken: string, request: Fetch = fetch): Promise<boolean> {
  const url = new URL(`https://graph.instagram.com/${encodeURIComponent(instagramId)}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "comments,messages");
  url.searchParams.set("access_token", accessToken);
  const data = await json<{ success?: boolean }>(await request(url, { method: "POST" }));
  return data.success === true;
}

export async function getInstagramResource(path: string, accessToken: string, query: Record<string, string> = {}, request: Fetch = fetch): Promise<unknown> {
  const url = new URL(`https://graph.instagram.com/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  return json(await request(url));
}
