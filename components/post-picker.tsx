"use client";

import { coreFetch } from "@/lib/core-api/client";

/* eslint-disable @next/next/no-img-element */

/**
 * Post Picker
 *
 * Grid of Instagram post thumbnails, selectable.
 * Fetches from /api/instagram/posts.
 */

import { useEffect, useState } from "react";
import { getPolishErrorMessage } from "@/lib/core-api/errors";
import { readCache, writeCache } from "@/lib/client-cache";

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

interface PostPickerProps {
  selectedPostId: string | null;
  instagramAccountId?: string | null;
  /** postId -> name of the campaign already using it. Flagged in the grid. */
  usedPostIds?: Record<string, string>;
  onSelect: (
    postId: string,
    postUrl?: string,
    thumbUrl?: string,
    caption?: string
  ) => void;
}

export default function PostPicker({
  selectedPostId,
  instagramAccountId,
  usedPostIds,
  onSelect,
}: PostPickerProps) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The post currently hovered — its video (if it's a reel) plays a preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (instagramAccountId) {
      params.set("instagramAccountId", instagramAccountId);
    }
    // Load the full library so older posts/reels are selectable, not just the
    // most recent page.
    params.set("all", "true");

    // Show the cached library instantly (stale-while-revalidate), then refresh.
    const cacheKey = `ig-posts:${instagramAccountId ?? "default"}`;
    const cached = readCache<InstagramPost[]>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    setPosts(cached.data ?? []);
    setLoading(!cached.data);
    if (cached.data) {
      setPosts(cached.data);
      setLoading(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    coreFetch(`/api/instagram/posts${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if ((data.data !== undefined)) {
          setPosts(data.data);
          writeCache(cacheKey, data.data);
        } else if (!cached.data) {
          setError(getPolishErrorMessage(data.error));
        }
      })
      .catch(() => {
        if (!cancelled && !cached.data) setError("Nie udało się wczytać postów.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instagramAccountId]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-square rounded bg-surface" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">{error}</p>
        <p className="text-xs text-zinc-500 mt-1">Najpierw połącz konto Instagram</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted">Nie znaleziono postów</p>
      </div>
    );
  }

  const visible = query.trim()
    ? posts.filter((p) =>
        (p.caption ?? "").toLowerCase().includes(query.trim().toLowerCase())
      )
    : posts;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj postów po opisie"
          placeholder="Szukaj postów po opisie…"
          className="app-field w-full"
        />
        <span className="shrink-0 text-xs text-muted">{posts.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">

          Brak postów pasujących do „{query}”
        </p>
      ) : (
        <>
          {usedPostIds && Object.keys(usedPostIds).length > 0 && (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-warning/50" />

              Już użyty
            </p>
          )}
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4">
            {visible.map((post) => {
              const isSelected = selectedPostId === post.id;
              const usedByName = usedPostIds?.[post.id];
              const isUsed = Boolean(usedByName) && !isSelected;
              const thumb = post.thumbnail_url ?? post.media_url;
              const isVideo = post.media_type === "VIDEO";
              const showVideo =
                isVideo && hoveredId === post.id && Boolean(post.media_url);
              return (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelect(post.id, post.permalink, thumb, post.caption)}
            onMouseEnter={() => setHoveredId(post.id)}
            onMouseLeave={() =>
              setHoveredId((cur) => (cur === post.id ? null : cur))
            }
            aria-pressed={isSelected}
            title={isUsed ? `Już użyty w kampanii „${usedByName}”` : undefined}
            className={`
              relative aspect-square overflow-hidden rounded-xl border-2 transition-transform hover:-translate-y-0.5
              ${
                isSelected
                  ? "border-accent"
                  : isUsed
                    ? "border-warning/40 hover:border-warning/60"
                    : "border-border hover:border-border-hover"
              }
            `}
          >
            {thumb ? (
              <img
                src={thumb}
                alt={post.caption?.slice(0, 50) ?? "Post na Instagramie"}
                className={`w-full h-full object-cover ${isUsed ? "opacity-75" : ""}`}
              />
            ) : (
              <div className="w-full h-full bg-surface flex items-center justify-center">
                <span className="text-xs text-muted">Brak obrazu</span>
              </div>
            )}
            {showVideo && (
              <video
                src={post.media_url}
                poster={thumb}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                className={`absolute inset-0 h-full w-full object-cover ${
                  isUsed ? "opacity-60" : ""
                }`}
              />
            )}
            {isSelected && (
              <span className="absolute bottom-0 inset-x-0 bg-accent text-black text-xs py-1">

                Wybrano
              </span>
            )}
          </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
