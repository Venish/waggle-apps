"use client";

import {
  extractYoutubeVideoId,
  isImageMediaUrl,
  isVideoMediaUrl,
  toAdminUploadUrl,
} from "@/00_lib/mediaUrl";

export function AdminMediaPlayer({
  url,
  youtubeVideoId,
  title = "첨부 미디어",
  compact = false,
}: {
  url?: string | null;
  youtubeVideoId?: string | null;
  title?: string;
  compact?: boolean;
}) {
  const adminUrl = toAdminUploadUrl(url);

  if (adminUrl && isVideoMediaUrl(adminUrl)) {
    return (
      <div
        className={`overflow-hidden rounded-control bg-black atlas-border ${
          compact ? "max-w-sm" : "max-w-xl"
        }`}
      >
        <div className="aspect-video w-full">
          <video
            src={adminUrl}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (adminUrl && isImageMediaUrl(adminUrl)) {
    return (
      <div
        className={`overflow-hidden rounded-control bg-base-1 atlas-border ${
          compact ? "max-w-xs" : "max-w-md"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={adminUrl} alt={title} className="max-h-72 w-full object-contain" />
      </div>
    );
  }

  const ytId = extractYoutubeVideoId(youtubeVideoId ?? url);
  if (ytId) {
    return (
      <div
        className={`overflow-hidden rounded-control bg-black atlas-border ${
          compact ? "max-w-sm" : "max-w-xl"
        }`}
      >
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return null;
}
