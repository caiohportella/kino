import { ImageResponse } from "next/og";
import type { CSSProperties } from "react";
import { getTitleSeoData } from "@/lib/server-tmdb";
import { buildTitleDescription, trimText } from "@/lib/seo";
import { parseResourceSegment } from "@/lib/routes";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kino title preview";

export default async function OpenGraphImage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tmdbId = parseResourceSegment(id).id;
  const type = resolvedSearchParams?.type === "tv" ? "tv" : "movie";

  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return new ImageResponse(
      <FallbackBanner title="Title not found" subtitle="Kino" />,
      { ...size },
    );
  }

  try {
    const details = await getTitleSeoData(tmdbId, type, "en");
    const titleLabel = `${details.title}${details.year ? ` · ${details.year}` : ""}`;
    const description = buildTitleDescription(details);
    const image = details.backdropImage || details.coverImage;

    return new ImageResponse(
      <div style={container}>
        <div
          style={{
            ...backgroundGlow,
            inset: "-10% -8% auto auto",
            background:
              "radial-gradient(circle, rgba(29,185,84,0.26) 0%, rgba(29,185,84,0.06) 40%, transparent 72%)",
          }}
        />
        <div
          style={{
            ...backgroundGlow,
            inset: "auto auto -18% -10%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 35%, transparent 72%)",
          }}
        />

        {image ? (
          <img
            alt=""
            src={image}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.28,
            }}
          />
        ) : null}

        <div style={overlay} />
        <div style={gridOverlay} />

        <div style={contentWrap}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 42,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <BrandBadge />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={eyebrow}>Kino</div>
                <div style={subtleLabel}>
                  {type === "tv" ? "TV series" : "Movie"} preview
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 22,
                maxWidth: 640,
              }}
            >
              <div style={titleStyle}>{titleLabel}</div>
              <div style={descriptionStyle}>{description}</div>
              <div style={chipRow}>
                {(type === "tv"
                  ? [
                      details.totalSeasons
                        ? `${details.totalSeasons} seasons`
                        : "Series",
                      details.runtime
                        ? `${details.runtime} min`
                        : "Episode detail",
                      "Watchlist-ready",
                    ]
                  : [
                      details.runtime
                        ? `${details.runtime} min`
                        : "Feature film",
                      "Diary-ready",
                      "Ratings",
                    ]
                ).map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {details.genres.slice(0, 3).map((genre) => (
                <Tag key={genre.id}>{genre.name}</Tag>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: 390,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={posterFrame}>
              {details.coverImage ? (
                <img
                  alt=""
                  src={details.coverImage}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <div style={posterInnerGlow} />
              <div style={posterTitleStack}>
                <div style={posterMiniLabel}>
                  {type === "tv" ? "Series" : "Film"}
                </div>
                <div style={posterTitle}>{trimText(details.title, 24)}</div>
                <div style={posterMeta}>
                  {details.year || "TBA"}
                  {details.runtime ? ` · ${details.runtime} min` : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      { ...size },
    );
  } catch {
    return new ImageResponse(
      <FallbackBanner title="Kino" subtitle="Movies and series" />,
      { ...size },
    );
  }
}

function FallbackBanner({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ ...container, padding: 72, justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 860,
        }}
      >
        <div style={{ ...eyebrow, alignSelf: "flex-start" }}>Kino</div>
        <div
          style={{
            fontSize: 76,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            fontWeight: 800,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

const container: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 18% 22%, rgba(29,185,84,0.28), transparent 34%), radial-gradient(circle at 82% 72%, rgba(255,255,255,0.09), transparent 28%), linear-gradient(135deg, #0d0e0f 0%, #111314 42%, #171717 100%)",
  color: "#f3f3f0",
  fontFamily: "Aptos, Helvetica Neue, Arial, sans-serif",
};

const backgroundGlow: CSSProperties = {
  position: "absolute",
  width: 520,
  height: 520,
  borderRadius: 999,
  filter: "blur(8px)",
};

const overlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(90deg, rgba(13,14,15,0.84) 0%, rgba(13,14,15,0.82) 40%, rgba(13,14,15,0.54) 100%)",
};

const gridOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
  backgroundSize: "80px 80px",
  opacity: 0.22,
  maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 75%)",
};

const contentWrap: CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  height: "100%",
  padding: 64,
  gap: 48,
};

const eyebrow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  alignSelf: "flex-start",
  borderRadius: 999,
  border: "1px solid rgba(29,185,84,0.28)",
  background: "rgba(29,185,84,0.1)",
  padding: "10px 16px",
  color: "#bef7d0",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const subtleLabel: CSSProperties = {
  display: "flex",
  marginTop: 10,
  fontSize: 18,
  color: "rgba(255,255,255,0.62)",
};

const titleStyle: CSSProperties = {
  fontSize: 72,
  lineHeight: 0.96,
  letterSpacing: "-0.04em",
  fontWeight: 800,
};

const descriptionStyle: CSSProperties = {
  fontSize: 28,
  lineHeight: 1.35,
  color: "rgba(255,255,255,0.78)",
  maxWidth: 620,
};

const chipRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const posterFrame: CSSProperties = {
  position: "relative",
  display: "flex",
  width: 320,
  height: 470,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.24))",
  overflow: "hidden",
  boxShadow: "0 28px 80px rgba(0,0,0,0.42)",
};

const posterInnerGlow: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(29,185,84,0.28) 0%, rgba(255,255,255,0.02) 42%, rgba(13,14,15,0.78) 100%)",
};

const posterTitleStack: CSSProperties = {
  position: "absolute",
  left: 20,
  right: 20,
  bottom: 20,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const posterMiniLabel: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
};

const posterTitle: CSSProperties = {
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

const posterMeta: CSSProperties = {
  display: "flex",
  fontSize: 18,
  fontWeight: 600,
  color: "rgba(255,255,255,0.74)",
};

function BrandBadge() {
  return (
    <div
      style={{
        display: "flex",
        width: 68,
        height: 68,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.14)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(29,185,84,0.1))",
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
        fontSize: 32,
        fontWeight: 800,
      }}
    >
      K
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 52,
        padding: "0 18px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.05)",
        fontSize: 18,
        fontWeight: 700,
        color: "rgba(255,255,255,0.88)",
      }}
    >
      {children}
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 44,
        padding: "0 16px",
        borderRadius: 999,
        border: "1px solid rgba(29,185,84,0.3)",
        background: "rgba(29,185,84,0.12)",
        color: "#bef7d0",
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}
