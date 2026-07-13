import { Fragment, type CSSProperties, type ReactNode } from "react";
import type {
  PublicProfileOgData,
  PublicWatchlistOgData,
} from "./server-supabase";
import { getInitials } from "./og-images";
import { KINO_LOGO_ASPECT_RATIO } from "./brand";
import { KINO_OG_LOGO_URL } from "./og-assets";

export { getOgImageOptions, OG_SIZE } from "./og-fonts";
export const OG_CONTENT_TYPE = "image/png";
type OgImage = string | ArrayBuffer;

const colors = {
  accent: "#1db954",
  accentSoft: "#b9f6ce",
  background: "#121212",
  panel: "#171717",
  surface: "#1e1e1e",
  text: "#e8e8e5",
  muted: "#b0b0b0",
  subtle: "#7d7d7d",
};

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatRuntime(minutes?: number) {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

const frame: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  overflow: "hidden",
  background: colors.background,
  color: colors.text,
  fontFamily: "Kino Body",
};

export function KinoFrame({
  background,
  children,
  label,
  logo,
}: {
  background?: OgImage | null;
  children: ReactNode;
  label: string;
  logo?: OgImage | null;
}) {
  return (
    <div style={frame}>
      {background ? (
        <img
          alt=""
          src={background as string}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            background
              ? "radial-gradient(circle at 12% 8%, rgba(29,185,84,0.18), transparent 32%), linear-gradient(90deg, rgba(10,11,11,0.96) 0%, rgba(12,13,13,0.90) 48%, rgba(10,11,11,0.68) 100%)"
              : "radial-gradient(circle at 12% 8%, rgba(29,185,84,0.18), transparent 32%), radial-gradient(circle at 88% 100%, rgba(29,185,84,0.08), transparent 28%), linear-gradient(120deg, #121212 0%, #151716 58%, #101110 100%)",
        }}
      />
      <FilmRail side="left" />
      <FilmRail side="right" />
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          padding: "54px 70px 50px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <OgKinoLogo src={logo} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: colors.muted,
              fontSize: 18,
            }}
          >
            <div style={{ width: 26, height: 2, background: colors.accent }} />
            {label}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function FilmRail({ side }: { side: "left" | "right" }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        bottom: 20,
        [side]: 18,
        width: 14,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: 0.28,
      }}
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          style={{
            width: 14,
            height: 34,
            borderRadius: 4,
            background: colors.subtle,
          }}
        />
      ))}
    </div>
  );
}

function normalizeAccentDotsText(value: string) {
  const text = value.trim().replace(/\.+$/u, ".");
  if (!text || /[.!?…,:;]$/u.test(text)) return text;
  return `${text}.`;
}

export function OgTerminalDot({ size }: { size: number }) {
  return <span style={{ color: colors.accent, fontSize: size }}>.</span>;
}

function OgAccentDotsText({
  normalize = true,
  value,
  size,
}: {
  normalize?: boolean;
  value: string;
  size: number;
}) {
  const parts = (normalize ? normalizeAccentDotsText(value) : value).split(".");
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? <OgTerminalDot size={size} /> : null}
        </Fragment>
      ))}
    </>
  );
}

function wrapOgHeading(value: string, maxWidth: number, size: number) {
  const text = normalizeAccentDotsText(value);
  const maxCharacters = Math.max(10, Math.floor(maxWidth / (size * 0.56)));
  const lines: string[] = [];

  for (const word of text.split(/\s+/u)) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxCharacters) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

export function OgKinoLogo({ src }: { src?: OgImage | null }) {
  const width = 126;
  const height = Math.round(width / KINO_LOGO_ASPECT_RATIO);
  return (
    <img
      alt="Kino"
      height={height}
      src={(src || KINO_OG_LOGO_URL) as string}
      style={{
        width,
        height,
        objectFit: "contain",
      }}
      width={width}
    />
  );
}

export function OgMetadataRow({ items }: { items: Array<string | null | undefined> }) {
  const visibleItems = items.filter((item): item is string => Boolean(item?.trim()));
  if (visibleItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        color: colors.muted,
        fontSize: 19,
        fontWeight: 700,
      }}
    >
      {visibleItems.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          {index > 0 ? (
            <div
              style={{
                width: 4,
                height: 4,
                display: "flex",
                borderRadius: 999,
                background: colors.subtle,
              }}
            />
          ) : null}
          <div style={{ display: "flex" }}>{item}</div>
        </Fragment>
      ))}
    </div>
  );
}

export function OgAccentDotsHeading({
  children,
  maxWidth = 760,
  size = 66,
}: {
  children: string;
  maxWidth?: number;
  size?: number;
}) {
  const lines = wrapOgHeading(children, maxWidth, size);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxWidth,
        color: colors.text,
        fontFamily: "Kino OG",
        fontSize: size,
        fontStyle: "italic",
        fontWeight: 900,
        letterSpacing: 0,
        lineHeight: 0.96,
      }}
    >
      {lines.map((line, index) => (
        <div key={`${line}-${index}`} style={{ display: "flex" }}>
          <OgAccentDotsText normalize={false} size={size} value={line} />
        </div>
      ))}
    </div>
  );
}

function SupportingText({
  children,
  maxWidth = 720,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        maxWidth,
        color: colors.muted,
        fontSize: 26,
        lineHeight: 1.34,
      }}
    >
      {children}
    </div>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: 42,
        display: "flex",
        alignItems: "center",
        borderRadius: 999,
        background: "rgba(29,185,84,0.11)",
        color: colors.accentSoft,
        padding: "0 16px",
        fontSize: 17,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

export function HomeOg() {
  return (
    <KinoFrame label="Discover · Track · Share">
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 70,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 700,
          }}
        >
          <OgAccentDotsHeading>
            Every story you watch, kept in one calm place.
          </OgAccentDotsHeading>
          <SupportingText>
            Discover movies and series, track episodes, rate titles, and build
            watchlists with friends.
          </SupportingText>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {["Diary", "Ratings", "Watchlists"].map((item) => (
              <MetaPill key={item}>{item}</MetaPill>
            ))}
          </div>
        </div>
        <AbstractReel />
      </div>
    </KinoFrame>
  );
}

export function DiscoverOg() {
  return (
    <KinoFrame label="Discover">
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 62,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 650,
          }}
        >
          <OgAccentDotsHeading maxWidth={650}>Discover.</OgAccentDotsHeading>
          <SupportingText maxWidth={610}>
            Find trending stories, new releases, and acclaimed movies and
            series worth keeping.
          </SupportingText>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {["Trending", "New releases", "Top rated"].map((item) => (
              <MetaPill key={item}>{item}</MetaPill>
            ))}
          </div>
        </div>
        <DiscoverOgIllustration />
      </div>
    </KinoFrame>
  );
}

function AbstractReel() {
  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 330,
          height: 330,
          borderRadius: 999,
          background: "rgba(29,185,84,0.08)",
          border: "2px solid rgba(29,185,84,0.36)",
        }}
      />
      {[0, 90, 180, 270].map((rotation) => (
        <div
          key={rotation}
          style={{
            position: "absolute",
            width: 104,
            height: 104,
            borderRadius: 999,
            background: colors.surface,
            border: "1px solid rgba(255,255,255,0.10)",
            transform: `rotate(${rotation}deg) translateY(-88px)`,
          }}
        />
      ))}
      <div
        style={{
          width: 86,
          height: 86,
          borderRadius: 999,
          background: colors.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -8,
          bottom: 22,
          width: 250,
          height: 18,
          borderRadius: 999,
          background: "linear-gradient(90deg, #1db954, rgba(29,185,84,0))",
          transform: "rotate(-18deg)",
        }}
      />
    </div>
  );
}

export function TitleOg({
  backdrop,
  poster,
  synopsis,
  title,
  year,
  type,
  genres,
  runtime,
  seasons,
  status,
}: {
  backdrop?: OgImage | null;
  poster?: OgImage | null;
  synopsis?: string | null;
  title: string;
  year?: number | null;
  type: "movie" | "tv";
  genres: string[];
  runtime?: number | null;
  seasons?: number | null;
  status?: string | null;
}) {
  const typeLabel = type === "tv" ? "TV Series" : "Movie";
  const detailLabel =
    type === "movie"
      ? formatRuntime(runtime || undefined) || null
      : seasons && seasons > 0
        ? `${seasons} ${seasons === 1 ? "season" : "seasons"}`
        : null;
  const secondaryItems = [
    ...genres.slice(0, type === "tv" && status ? 2 : 3),
    type === "tv" ? status : null,
  ];

  return (
    <KinoFrame background={backdrop} label={typeLabel}>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 52,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 15,
          }}
        >
          {year ? (
            <div
              style={{
                display: "flex",
                color: colors.muted,
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              {year}
            </div>
          ) : null}
          <OgAccentDotsHeading maxWidth={690} size={60}>
            {trimText(title, 64)}
          </OgAccentDotsHeading>
          <OgMetadataRow items={[typeLabel, detailLabel]} />
          {synopsis?.trim() ? (
            <div
              style={{
                display: "flex",
                maxWidth: 660,
                color: colors.muted,
                fontSize: 21,
                lineHeight: 1.34,
              }}
            >
              {trimText(synopsis, 145)}
            </div>
          ) : null}
          <OgMetadataRow items={secondaryItems} />
          <div
            style={{
              width: 72,
              height: 3,
              display: "flex",
              marginTop: 6,
              background: colors.accent,
            }}
          />
        </div>
        <TitleOgArtwork poster={poster} />
      </div>
    </KinoFrame>
  );
}

export function TitleOgArtwork({ poster }: { poster?: OgImage | null }) {
  if (poster) {
    return (
      <div
        style={{
          position: "relative",
          width: 360,
          height: 430,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 322,
            height: 322,
            display: "flex",
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(29,185,84,0.17) 0%, rgba(29,185,84,0.04) 52%, transparent 72%)",
          }}
        />
        <div
          style={{
            position: "relative",
            width: 270,
            height: 405,
            display: "flex",
            overflow: "hidden",
            borderRadius: 16,
            background: colors.surface,
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 28px 68px rgba(0,0,0,0.46)",
          }}
        >
          <img
            alt=""
            src={poster as string}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 330,
          height: 330,
          display: "flex",
          borderRadius: 999,
          background:
            "radial-gradient(circle, rgba(29,185,84,0.17) 0%, rgba(29,185,84,0.04) 52%, transparent 72%)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 326,
          height: 226,
          display: "flex",
          overflow: "hidden",
          borderRadius: 18,
          background: "linear-gradient(145deg, #26342c, #171a18 58%, #101110)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 26px 64px rgba(0,0,0,0.42)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -34,
            bottom: -86,
            width: 250,
            height: 250,
            display: "flex",
            borderRadius: 999,
            background: "rgba(29,185,84,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 34,
            top: 30,
            width: 82,
            height: 82,
            display: "flex",
            borderRadius: 999,
            background: "rgba(232,232,229,0.12)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 52,
            height: 2,
            display: "flex",
            background: "rgba(255,255,255,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 34,
            bottom: 28,
            width: 96,
            height: 6,
            display: "flex",
            borderRadius: 999,
            background: colors.accent,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 4,
          top: 54,
          width: 58,
          height: 78,
          display: "flex",
          borderRadius: 10,
          background: colors.surface,
          border: "1px solid rgba(255,255,255,0.10)",
          transform: "rotate(-8deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 48,
          width: 76,
          height: 104,
          display: "flex",
          borderRadius: 12,
          background: "#1c2921",
          border: "1px solid rgba(29,185,84,0.34)",
          transform: "rotate(7deg)",
        }}
      />
    </div>
  );
}

export function PersonOg({
  name,
  portrait,
  role,
  knownFor,
}: {
  name: string;
  portrait: OgImage | null;
  role?: string | null;
  knownFor: string[];
}) {
  return (
    <div style={frame}>
      {portrait ? (
        <img
          alt=""
          src={portrait as string}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "72% 28%",
            opacity: 0.2,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "radial-gradient(circle at 78% 38%, rgba(29,185,84,0.18), transparent 30%), linear-gradient(90deg, rgba(10,11,11,0.98) 0%, rgba(12,13,13,0.93) 52%, rgba(10,11,11,0.64) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "56px 70px",
          gap: 58,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <OgKinoLogo />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <MetaPill>{role || "Film and television"}</MetaPill>
              <div
                style={{ display: "flex", color: colors.muted, fontSize: 20 }}
              >
                Person
              </div>
            </div>
            <OgAccentDotsHeading maxWidth={680} size={64}>
              {trimText(name, 52)}
            </OgAccentDotsHeading>
            {knownFor.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div
                  style={{
                    display: "flex",
                    color: colors.subtle,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  Known for
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {knownFor.slice(0, 3).map((title) => (
                    <MetaPill key={title}>{trimText(title, 28)}</MetaPill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", color: colors.subtle, fontSize: 18 }}>
            Movies, series, and the people who shape them.
          </div>
        </div>
        <PersonPortrait image={portrait} name={name} />
      </div>
    </div>
  );
}

function PersonPortrait({
  image,
  name,
}: {
  image: OgImage | null;
  name: string;
}) {
  return (
    <div
      style={{
        width: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 286,
          height: 430,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: 14,
          background: "linear-gradient(145deg, #253128, #171817)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        {image ? (
          <img
            alt=""
            src={image as string}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 24%",
            }}
          />
        ) : (
          <div
            style={{
              width: 154,
              height: 154,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "rgba(29,185,84,0.13)",
              border: "3px solid rgba(29,185,84,0.52)",
              color: colors.accentSoft,
              fontSize: 54,
              fontStyle: "italic",
              fontWeight: 900,
            }}
          >
            {getInitials(name)}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
            display: "flex",
            background: "linear-gradient(transparent, rgba(0,0,0,0.82))",
          }}
        />
      </div>
    </div>
  );
}

function PosterPlaceholder({ title }: { title: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: 24,
        background: "linear-gradient(145deg, #252925, #171817)",
      }}
    >
      <div
        style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.05,
        }}
      >
        {trimText(title, 30)}
      </div>
    </div>
  );
}

export function ProfileOg({
  data,
  avatar,
  logo,
}: {
  data: PublicProfileOgData;
  avatar: OgImage | null;
  logo?: OgImage | null;
}) {
  const stats = [
    ["Ratings", data.movieRatings],
    ["Episodes", data.episodesWatched],
    ["Diary", data.diaryEntries],
  ] as const;
  return (
    <KinoFrame label="Public profile" logo={logo}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 62 }}>
        <div
          style={{
            position: "relative",
            width: 292,
            height: 326,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 292,
              height: 292,
              display: "flex",
              borderRadius: 999,
              background: "rgba(29,185,84,0.08)",
            }}
          />
          <Avatar image={avatar} name={data.displayName} size={250} />
        </div>
        <div
          style={{ display: "flex", flex: 1, flexDirection: "column", gap: 16 }}
        >
          <OgAccentDotsHeading maxWidth={650}>
            {trimText(data.displayName, 42)}
          </OgAccentDotsHeading>
          {data.username ? (
            <div
              style={{
                display: "flex",
                color: colors.accentSoft,
                fontSize: 25,
              }}
            >{`@${trimText(data.username, 28)}`}</div>
          ) : null}
          <div
            style={{
              display: "flex",
              maxWidth: 660,
              minHeight: 72,
              color: colors.muted,
              fontSize: 24,
              lineHeight: 1.38,
            }}
          >
            {trimText(
              data.bio || "Movies, series, and a viewing history kept on Kino.",
              150,
            )}
          </div>
          <div
            style={{
              display: "flex",
              width: 70,
              height: 3,
              background: colors.accent,
              margin: "6px 0",
            }}
          />
          <div style={{ display: "flex", gap: 38 }}>
            {stats.map(([label, value]) => (
              <div
                key={label}
                style={{ display: "flex", flexDirection: "column", gap: 5 }}
              >
                <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>
                  {value}
                </div>
                <div
                  style={{ display: "flex", color: colors.muted, fontSize: 17 }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </KinoFrame>
  );
}

export function SettingsOg({
  data,
  avatar,
}: {
  data: PublicProfileOgData;
  avatar: OgImage | null;
}) {
  return (
    <KinoFrame label="Settings">
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 64 }}>
        <div
          style={{
            width: 410,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Avatar image={avatar} name={data.displayName} size={150} />
          <div
            style={{
              display: "flex",
              color: colors.text,
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1.04,
            }}
          >
            {trimText(data.displayName, 34)}
          </div>
          {data.username ? (
            <div
              style={{ display: "flex", color: colors.muted, fontSize: 22 }}
            >{`@${trimText(data.username, 28)}`}</div>
          ) : null}
          <div style={{ display: "flex", color: colors.subtle, fontSize: 18 }}>
            A calm place to tune your Kino experience.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <OgAccentDotsHeading maxWidth={490} size={58}>
            Settings.
          </OgAccentDotsHeading>
          <SettingsControls />
        </div>
      </div>
    </KinoFrame>
  );
}

function SettingsControls() {
  const controls = [
    { label: "Appearance", position: 72 },
    { label: "Language", position: 42 },
    { label: "Privacy", position: 82 },
  ];

  return (
    <div
      style={{ width: 440, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            position: "relative",
            width: 58,
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: "rgba(29,185,84,0.12)",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              display: "flex",
              borderRadius: 999,
              border: "6px solid #1db954",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 800 }}>
            Preferences
          </div>
          <div style={{ display: "flex", color: colors.muted, fontSize: 17 }}>
            Configured for you
          </div>
        </div>
      </div>
      {controls.map((control, index) => (
        <div
          key={control.label}
          style={{
            minHeight: 84,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 20px",
            borderRadius: 12,
            background: index === 0 ? "rgba(29,185,84,0.09)" : colors.panel,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              background: colors.surface,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                display: "flex",
                borderRadius: 999,
                background: index === 0 ? colors.accent : colors.subtle,
              }}
            />
          </div>
          <div
            style={{
              width: 126,
              display: "flex",
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            {control.label}
          </div>
          <div
            style={{
              position: "relative",
              flex: 1,
              height: 8,
              display: "flex",
              borderRadius: 999,
              background: "rgba(255,255,255,0.10)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${control.position}%`,
                top: -7,
                width: 22,
                height: 22,
                display: "flex",
                borderRadius: 999,
                background: index === 0 ? colors.accent : colors.muted,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({
  image,
  name,
  size,
}: {
  image: OgImage | null;
  name: string;
  size: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 999,
        background: "#263129",
        border: "4px solid rgba(29,185,84,0.78)",
        color: colors.accentSoft,
        fontSize: size * 0.3,
        fontWeight: 800,
      }}
    >
      {image ? (
        <img
          alt=""
          src={image as string}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

export function WatchlistsOg() {
  return (
    <KinoFrame label="Watchlists">
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 60,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <OgAccentDotsHeading maxWidth={650}>
            Collections worth coming back to.
          </OgAccentDotsHeading>
          <SupportingText maxWidth={610}>
            Save the next watch, shape a theme, or build a shared list together.
          </SupportingText>
        </div>
        <WatchlistsOgIllustration />
      </div>
    </KinoFrame>
  );
}

export function FeatureOg({
  description,
  kind,
  label,
  title,
}: {
  description: string;
  kind: "discover" | "search";
  label: string;
  title: string;
}) {
  return (
    <KinoFrame label={label}>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 70,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <OgAccentDotsHeading maxWidth={680}>{title}</OgAccentDotsHeading>
          <SupportingText maxWidth={620}>{description}</SupportingText>
        </div>
        <FeatureMark kind={kind} />
      </div>
    </KinoFrame>
  );
}

function FeatureMark({ kind }: { kind: "discover" | "search" }) {
  if (kind === "search") {
    return (
      <div
        style={{
          position: "relative",
          width: 330,
          height: 330,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            display: "flex",
            borderRadius: 999,
            border: "18px solid rgba(29,185,84,0.72)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 30,
            width: 126,
            height: 22,
            display: "flex",
            borderRadius: 999,
            background: colors.accent,
            transform: "rotate(45deg)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 360,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 300,
          height: 300,
          display: "flex",
          borderRadius: 999,
          border: "2px solid rgba(29,185,84,0.38)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 190,
          height: 190,
          display: "flex",
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,0.15)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 38,
          top: 82,
          width: 58,
          height: 58,
          display: "flex",
          borderRadius: 999,
          background: colors.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 68,
          bottom: 58,
          width: 34,
          height: 34,
          display: "flex",
          borderRadius: 999,
          background: colors.text,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 82,
          height: 82,
          display: "flex",
          borderRadius: 999,
          background: colors.surface,
        }}
      />
    </div>
  );
}

export function WatchlistsOgIllustration() {
  const lists = [
    {
      title: "Weekend picks",
      count: "8 titles",
      top: 20,
      left: 34,
      accent: true,
      collaborators: false,
    },
    {
      title: "Our watchlist",
      count: "12 titles",
      top: 142,
      left: 4,
      accent: false,
      collaborators: true,
    },
    {
      title: "Quiet favorites",
      count: "6 titles",
      top: 264,
      left: 48,
      accent: false,
      collaborators: false,
    },
  ];

  return (
    <div
      style={{
        position: "relative",
        width: 390,
        height: 410,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 18,
          display: "flex",
          borderRadius: 28,
          background:
            "radial-gradient(circle at 58% 48%, rgba(29,185,84,0.13), transparent 64%)",
        }}
      />
      {lists.map((list, listIndex) => (
        <div
          key={list.title}
          style={{
            position: "absolute",
            top: list.top,
            left: list.left,
            width: 334,
            height: 112,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 16px",
            borderRadius: 16,
            background: list.accent ? "#1b2b21" : colors.panel,
            border: list.accent
              ? "1px solid rgba(29,185,84,0.48)"
              : "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 20px 46px rgba(0,0,0,0.34)",
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map((posterIndex) => (
              <div
                key={posterIndex}
                style={{
                  width: 38,
                  height: 60,
                  display: "flex",
                  borderRadius: 6,
                  background:
                    posterIndex === 1
                      ? "linear-gradient(145deg, #304338, #1c2821)"
                      : listIndex === 1
                        ? "linear-gradient(145deg, #343434, #222222)"
                        : "linear-gradient(145deg, #26312b, #1b211e)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              minWidth: 0,
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div
              style={{
                display: "flex",
                color: colors.text,
                fontSize: 19,
                fontWeight: 800,
              }}
            >
              {list.title}
            </div>
            <div
              style={{ display: "flex", color: colors.muted, fontSize: 15 }}
            >
              {list.count}
            </div>
            {list.collaborators ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                {["#b9f6ce", "#99a89f", "#65736b"].map(
                  (background, avatarIndex) => (
                    <div
                      key={background}
                      style={{
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginLeft: avatarIndex === 0 ? 0 : -7,
                        borderRadius: 999,
                        background,
                        border: "2px solid #171717",
                        color: "#102017",
                        fontSize: 9,
                        fontWeight: 900,
                      }}
                    >
                      {avatarIndex + 1}
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: list.accent
                ? colors.accent
                : "rgba(255,255,255,0.07)",
              color: list.accent ? "#07130b" : colors.accentSoft,
            }}
          >
            {listIndex === 2 ? (
              <div
                style={{
                  width: 9,
                  height: 15,
                  display: "flex",
                  borderRight: "3px solid #b9f6ce",
                  borderBottom: "3px solid #b9f6ce",
                  transform: "rotate(45deg)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 15,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {[0, 1, 2].map((line) => (
                  <div
                    key={line}
                    style={{
                      width: line === 2 ? 10 : 15,
                      height: 2,
                      display: "flex",
                      borderRadius: 999,
                      background: list.accent ? "#07130b" : colors.accentSoft,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoverOgIllustration() {
  return (
    <div
      style={{ position: "relative", width: 360, height: 400, display: "flex" }}
    >
      {[
        { x: 28, y: 46, rotate: -9, color: "#223128" },
        { x: 104, y: 20, rotate: 2, color: "#282828" },
        { x: 176, y: 60, rotate: 10, color: "#1f2822" },
      ].map((item, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: item.x,
            top: item.y,
            width: 150,
            height: 250,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 18,
            borderRadius: 12,
            background: item.color,
            border: "1px solid rgba(255,255,255,0.10)",
            transform: `rotate(${item.rotate}deg)`,
          }}
        >
          <div style={{ width: 34, height: 4, background: colors.accent }} />
          <div
            style={{
              marginTop: 12,
              width: 88,
              height: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.22)",
            }}
          />
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 140,
          bottom: 22,
          minWidth: 122,
          height: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          background: colors.accent,
          color: "#07130b",
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        Saved
      </div>
    </div>
  );
}

export function WatchlistOg({
  data,
  images,
  avatars,
}: {
  data: PublicWatchlistOgData;
  images: Array<OgImage | null>;
  avatars: Array<OgImage | null>;
}) {
  const visibleParticipants = data.participants.slice(0, 5);
  const remainder = Math.max(
    0,
    data.participants.length - visibleParticipants.length,
  );
  return (
    <KinoFrame label="Shared watchlist">
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 54 }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <OgAccentDotsHeading maxWidth={660}>
            {trimText(data.name, 50)}
          </OgAccentDotsHeading>
          {data.description ? (
            <SupportingText maxWidth={650}>
              {trimText(data.description, 112)}
            </SupportingText>
          ) : (
            <SupportingText maxWidth={650}>
              {data.titles.length > 0
                ? "A shared collection, curated together."
                : "A fresh list waiting for its first title."}
            </SupportingText>
          )}
          <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
            {visibleParticipants.map((participant, index) => (
              <div
                key={`${participant.displayName}-${index}`}
                style={{ display: "flex", marginLeft: index === 0 ? 0 : -14 }}
              >
                <Avatar
                  image={avatars[index] || null}
                  name={participant.displayName}
                  size={58}
                />
              </div>
            ))}
            {remainder > 0 ? (
              <div
                style={{
                  width: 58,
                  height: 58,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: -14,
                  borderRadius: 999,
                  background: colors.surface,
                  border: "3px solid #121212",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >{`+${remainder}`}</div>
            ) : null}
            <div
              style={{
                display: "flex",
                marginLeft: 16,
                color: colors.muted,
                fontSize: 17,
              }}
            >
              {data.participants.length === 1
                ? "1 curator"
                : `${data.participants.length} curators`}
            </div>
          </div>
        </div>
        <WatchlistCollage titles={data.titles} images={images} />
      </div>
    </KinoFrame>
  );
}

function WatchlistCollage({
  titles,
  images,
}: {
  titles: PublicWatchlistOgData["titles"];
  images: Array<OgImage | null>;
}) {
  if (titles.length === 0) {
    return (
      <div
        style={{
          width: 340,
          height: 350,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: colors.panel,
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 86,
              height: 112,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: colors.surface,
              color: colors.accent,
              fontSize: 40,
            }}
          >
            +
          </div>
          <div style={{ display: "flex", color: colors.muted, fontSize: 19 }}>
            The first pick starts here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: "relative", width: 360, height: 390, display: "flex" }}
    >
      {titles.slice(0, 3).map((title, index) => (
        <div
          key={`${title.title}-${index}`}
          style={{
            position: "absolute",
            left: 18 + index * 82,
            top: 28 + (index % 2) * 24,
            width: 176,
            height: 292,
            display: "flex",
            overflow: "hidden",
            borderRadius: 12,
            background: colors.surface,
            border: "1px solid rgba(255,255,255,0.12)",
            transform: `rotate(${(index - 1) * 6}deg)`,
          }}
        >
          {images[index] ? (
            <img
              alt=""
              src={images[index] as string}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <PosterPlaceholder title={title.title} />
          )}
        </div>
      ))}
    </div>
  );
}

export function DiaryOg() {
  return (
    <KinoFrame label="Cinema diary">
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 70,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <OgAccentDotsHeading maxWidth={660}>
            A quiet record of everything you watched.
          </OgAccentDotsHeading>
          <SupportingText maxWidth={620}>
            Dates, rewatches, ratings, and the stories behind each viewing.
          </SupportingText>
        </div>
        <DiaryTimeline />
      </div>
    </KinoFrame>
  );
}

function DiaryTimeline() {
  return (
    <div
      style={{ width: 360, display: "flex", flexDirection: "column", gap: 16 }}
    >
      {[
        ["12", "First watch", "4.5"],
        ["08", "Rewatch", "5.0"],
        ["03", "Series night", "4.0"],
      ].map(([day, label, rating], index) => (
        <div
          key={day}
          style={{
            minHeight: 94,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "16px 20px",
            borderRadius: 12,
            background: index === 0 ? "rgba(29,185,84,0.10)" : colors.panel,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 50,
              color: index === 0 ? colors.accentSoft : colors.text,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {day}
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>{label}</div>
            <div
              style={{
                width: 120,
                height: 7,
                borderRadius: 999,
                background: "rgba(255,255,255,0.12)",
              }}
            />
          </div>
          <div
            style={{ display: "flex", color: colors.accentSoft, fontSize: 18 }}
          >{`Rated ${rating}`}</div>
        </div>
      ))}
    </div>
  );
}

export function FallbackOg({
  title = "This page stepped out of frame.",
  label = "Kino",
}: {
  title?: string;
  label?: string;
}) {
  return (
    <KinoFrame label={label}>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            textAlign: "center",
          }}
        >
          <OgAccentDotsHeading maxWidth={800}>{title}</OgAccentDotsHeading>
          <SupportingText>
            There is always another story waiting on Kino.
          </SupportingText>
        </div>
      </div>
    </KinoFrame>
  );
}
