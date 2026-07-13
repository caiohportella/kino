import { ImageResponse } from "next/og";
import { createElement } from "react";
import { FallbackOg, getOgImageOptions } from "@/lib/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    createElement(FallbackOg),
    await getOgImageOptions({ "cache-control": "public, max-age=86400" }),
  );
}
