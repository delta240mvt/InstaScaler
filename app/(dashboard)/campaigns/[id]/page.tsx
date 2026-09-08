"use client";

/**
 * Campaign Detail
 *
 * Clicking a campaign opens this read-only view: a summary of the automation
 * on the left, and Insights / Preview tabs on the right. Edit and Stop/Resume
 * live in the top bar.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { coreFetch } from "@/lib/core-api/client";
import { getPolishErrorMessage } from "@/lib/core-api/errors";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";

interface Campaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollowBeforeFreebie: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  instagramAccount: { username: string };
  trackedLinks?: {
    destinationUrl: string;
    label?: string | null;
    trackedUrl?: string;
  }[];
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
  };
}

type Tab = "insights" | "preview";

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("insights");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    coreFetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!(payload.data !== undefined)) return setNotFound(true);
        const found = (payload.data as Campaign[]).find((c) => c.id === id);
        if (!found) return setNotFound(true);
        setCampaign(found);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    const acct = campaign.instagramAccountId;
    coreFetch(`/api/instagram/profile?instagramAccountId=${acct}`)
      .then((r) => r.json())
      .then((d) =>
        setAvatarUrl((d.data !== undefined) ? d.data.profilePictureUrl ?? null : null)
      )
      .catch(() => setAvatarUrl(null));

    if (campaign.postId) {
      coreFetch(`/api/instagram/posts?instagramAccountId=${acct}&limit=50`)
        .then((r) => r.json())
        .then((payload) => {
          if (!(payload.data !== undefined)) return;
          const hit = (
            payload.data as {
              id: string;
              thumbnail_url?: string;
              media_url?: string;
            }[]
          ).find((p) => p.id === campaign.postId);
          setPostThumb(hit?.thumbnail_url ?? hit?.media_url ?? null);
        })
        .catch(() => setPostThumb(null));
    }
  }, [campaign]);

  async function toggleActive() {
    if (!campaign) return;
    setBusy(true);
    try {
      await coreFetch(`/api/automations?id=${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
      setCampaign({ ...campaign, isActive: !campaign.isActive });
    } catch (error) {
      setError(error instanceof Error ? error.message : getPolishErrorMessage(null));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="app-skeleton h-64 rounded-2xl" />;
  }
  if (notFound || !campaign) {
    return (
      <div className="app-card p-8 text-center">
        <p className="text-sm text-muted">Nie znaleziono kampanii.</p>
        <button
          onClick={() => router.push("/campaigns")}
          className="mt-4 rounded border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >

          Wróć do kampanii
        </button>
      </div>
    );
  }

  const publicReplies =
    campaign.publicReplyMessages && campaign.publicReplyMessages.length > 0
      ? campaign.publicReplyMessages
      : campaign.publicReplyMessage
        ? [campaign.publicReplyMessage]
        : [];
  const hasLink = Boolean(campaign.trackedLinks?.[0]?.destinationUrl);
  const hasSecondLink = Boolean(campaign.trackedLinks?.[1]?.destinationUrl);

  const trigger = campaign.matchAnyPost
    ? "Dowolny post lub rolka"
    : campaign.pendingNextReel
      ? "Następna rolka"
      : "Wybrany post lub rolka";
  const matchText = campaign.matchAnyWord
    ? "Dowolny komentarz"
    : campaign.keywords.join(", ") || "Brak słów kluczowych";

  const metrics = [
    { label: "Wysyłki", value: campaign.analytics.sent },
    { label: "Kliknięcia", value: campaign.analytics.clicks },
    { label: "CTR", value: `${campaign.analytics.ctr.toLocaleString("pl-PL")}%` },
    { label: "Błąd", value: campaign.analytics.failed },
  ];

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-8">
      {error && <p role="alert" className="app-card p-4 text-sm text-error lg:col-span-2">{error}</p>}
      {/* Left: config summary */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns"
            className="text-sm text-muted hover:text-foreground"
          >

            &larr; Kampanie
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{campaign.name}</h1>
          <span
            className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
              campaign.isActive
                ? "bg-success/10 text-success"
                : "bg-zinc-500/10 text-muted"
            }`}
          >
            {campaign.isActive ? "AKTYWNA" : "Wstrzymana"}
          </span>
        </div>

        <Summary title="Gdy ktoś skomentuje">
          <div className="flex items-center gap-3">
            {postThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postThumb}
                alt="Post"
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-surface-hover text-[10px] text-muted">
                {campaign.matchAnyPost || campaign.pendingNextReel ? "Dowolny" : "Post"}
              </div>
            )}
            <span className="text-sm text-foreground">{trigger}</span>
          </div>
        </Summary>

        <Summary title="A komentarz zawiera">
          <FieldBox>{matchText}</FieldBox>
          {campaign.dmTriggerEnabled && (
            <p className="text-xs text-muted">

              Odpowiada również na wiadomości zawierające{" "}
              {campaign.matchAnyWord ? "dowolną treść" : "te słowa"}.
            </p>
          )}
          {publicReplies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Odpowiedź publiczna pod postem</p>
              {publicReplies.map((m, i) => (
                <FieldBox key={i}>{m}</FieldBox>
              ))}
            </div>
          )}
        </Summary>

        {campaign.openingDmEnabled && (
          <Summary title="Otrzyma wiadomość powitalną">
            <FieldBox>{campaign.openingDmMessage || "Wiadomość powitalna"}</FieldBox>
            <FieldBox>{campaign.openingDmButtonLabel || "Przycisk"}</FieldBox>
          </Summary>
        )}

        {campaign.requireFollowBeforeFreebie && (
          <Summary title="Najpierw musi zaobserwować konto">
            <FieldBox>
              {campaign.followPromptMessage ||
                "Zaobserwuj moje konto, aby otrzymać bezpłatny materiał. Gdy to zrobisz, naciśnij przycisk poniżej — wtedy wyślę Ci link."}
            </FieldBox>
            <FieldBox>
              {campaign.followPromptButtonLabel || "Już obserwuję"}
            </FieldBox>
          </Summary>
        )}

        <Summary title="Następnie otrzyma wiadomość">
          <FieldBox>{campaign.dmMessage}</FieldBox>
          {hasLink && (
            <FieldBox>{campaign.linkButtonLabel || "Otwórz link"}</FieldBox>
          )}
          {hasSecondLink && (
            <FieldBox>
              {campaign.trackedLinks?.[1]?.label || "Otwórz link"}
            </FieldBox>
          )}
        </Summary>

        {hasLink && (
          <Summary title="Wysyłany link">
            {campaign.trackedLinks
              ?.filter((link) => link.destinationUrl)
              .map((link, i) => (
                <div key={i} className="space-y-1">
                  <div className="rounded border border-border bg-surface px-3 py-2">
                    <p className="select-all break-all font-mono text-xs text-foreground">
                      {link.destinationUrl}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {link.label ? `${link.label} · ` : ""}wysyłany bezpośrednio
                  </p>
                </div>
              ))}
          </Summary>
        )}

        {campaign.followUpEnabled && campaign.followUpMessage && (
          <Summary title="Następnie wiadomość uzupełniająca">
            <FieldBox>{campaign.followUpMessage}</FieldBox>
            <p className="text-xs text-muted">
              {campaign.followUpDelayMinutes && campaign.followUpDelayMinutes > 0
                ? `Wysyłana ${campaign.followUpDelayMinutes.toLocaleString("pl-PL")} min po linku.`
                : "Wysyłana bezpośrednio po linku."}
            </p>
          </Summary>
        )}
      </div>

      {/* Right: top bar + tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-border pb-3">
          <div className="flex gap-4">
            <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>

              Statystyki
            </TabButton>
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>

              Podgląd
            </TabButton>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/campaigns/${campaign.id}/edit`}
              className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
            >

              Edytuj
            </Link>
            <button
              onClick={toggleActive}
              disabled={busy}
              className={`rounded border px-3 py-1.5 text-sm disabled:opacity-50 ${
                campaign.isActive
                  ? "border-error/30 text-error hover:bg-error/10"
                  : "border-success/30 text-success hover:bg-success/10"
              }`}
            >
              {campaign.isActive ? "Wstrzymaj" : "Wznów"}
            </button>
          </div>
        </div>

        {tab === "insights" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="app-card p-4">
                <p className="text-sm text-muted">{m.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {typeof m.value === "number" ? m.value.toLocaleString("pl-PL") : m.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "preview" && (
          <div className="flex justify-center sm:justify-start">
          <CampaignPreview
            tab={previewTab}
            onTabChange={setPreviewTab}
            username={campaign.instagramAccount.username}
            avatarUrl={avatarUrl}
            postThumb={postThumb}
            caption=""
            sampleComment={campaign.matchAnyWord ? "super!" : campaign.keywords[0] ?? "LINK"}
            dmTriggerEnabled={campaign.dmTriggerEnabled}
            publicReplyEnabled={campaign.publicReplyEnabled}
            publicReplyMessage={publicReplies[0] ?? ""}
            openingDmEnabled={campaign.openingDmEnabled}
            openingDmMessage={campaign.openingDmMessage ?? ""}
            openingDmButtonLabel={campaign.openingDmButtonLabel ?? ""}
            revealMessage={campaign.dmMessage}
            hasLink={hasLink}
            linkButtonLabel={campaign.linkButtonLabel ?? "Otwórz link"}
            linkUrl={
              campaign.trackedLinks?.[0]?.destinationUrl
            }
            hasSecondLink={hasSecondLink}
            secondLinkButtonLabel={
              campaign.trackedLinks?.[1]?.label ?? "Otwórz link"
            }
            requireFollow={campaign.requireFollowBeforeFreebie}
            followPromptMessage={campaign.followPromptMessage ?? ""}
            followPromptButtonLabel={
              campaign.followPromptButtonLabel ?? "Już obserwuję"
            }
            followUpEnabled={campaign.followUpEnabled ?? false}
            followUpMessage={campaign.followUpMessage ?? ""}
            followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
          />
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-card space-y-2 p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`border-b-2 pb-2 text-sm font-medium ${
        active
          ? "border-accent text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
