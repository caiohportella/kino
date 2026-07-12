"use client";

import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { AccentDots } from "@/components/landing/accent-dots";
import { LandingReveal } from "@/components/landing/landing-reveal";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function LandingCTA() {
  const { t } = useTranslation();

  return (
    <section className="landing-section py-16 sm:py-20">
      <LandingReveal className="rounded-md border border-kino-accent/30 bg-kino-accent/10 p-6 md:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black italic leading-tight tracking-normal text-kino-text sm:text-5xl">
              <AccentDots>{t("landing.cta.headline")}</AccentDots>
            </h2>
            <p className="mt-4 text-base leading-8 text-kino-muted">
              {t("landing.cta.body")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <Button
              nativeButton={false}
              render={
                <Link href="/auth/register">
                  {t("landing.cta.button")}
                  <ArrowRight size={17} />
                </Link>
              }
              className="min-h-12 px-5"
            ></Button>
            <Button
              nativeButton={false}
              render={
                <Link href="/discover">
                  <Compass size={17} />
                  {t("landing.nav.explore")}
                </Link>
              }
              className="min-h-12 px-5"
              variant="secondary"
            ></Button>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
