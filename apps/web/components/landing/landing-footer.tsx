"use client";

import Link from "next/link";
import { FooterSocialLinks } from "@/components/footer-social-links";
import { AccentDots } from "@/components/landing/accent-dots";
import { useTranslation } from "@/lib/i18n";

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/[0.06] py-8">
      <div className="landing-section flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            className="text-xl font-black italic tracking-normal text-kino-text"
            href="/"
          >
            <AccentDots>Kino.</AccentDots>
          </Link>
          <p className="text-sm text-kino-muted">
            {t("landing.footer.tagline")}
          </p>
        </div>
        <p className="text-sm text-kino-muted">
          Made with <span aria-hidden="true">&#10084;&#65039;</span> by{' '}
          <a
            className="text-xs font-semibold text-kino-text hover:underline"
            href="https://github.com/caiohportella"
          >
            Caio H. Portella
          </a>
        </p>
        <div className="flex flex-col items-start gap-3">
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-3 text-sm font-semibold text-kino-muted"
          >
            <Link className="hover:text-kino-text" href="/search">
              {t("landing.footer.links.search")}
            </Link>
            <Link className="hover:text-kino-text" href="/diary">
              {t("landing.footer.links.diary")}
            </Link>
            <Link className="hover:text-kino-text" href="/watchlists">
              {t("landing.footer.links.watchlists")}
            </Link>
          </nav>
          <FooterSocialLinks />
        </div>
      </div>
    </footer>
  );
}
