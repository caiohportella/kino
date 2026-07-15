"use client";

import { BookOpen, Compass, ListChecks, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppFooter } from "@/components/app-footer";
import { KinoLogo } from "@/components/kino-logo";
import { HomeSkeleton } from "@/components/skeletons/page-skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  AccountMenu,
  MobileAccountActions,
  MobileProfileMenuItem,
} from "@/components/account-menu";

const authenticatedNavItems = [
  { href: "/discover", labelKey: "tabs.home", icon: Compass },
  { href: "/search", labelKey: "tabs.search", icon: Search },
  { href: "/diary", labelKey: "tabs.diary", icon: BookOpen },
  { href: "/watchlists", labelKey: "tabs.watchlists", icon: ListChecks },
];

const publicNavItems = [
  { href: "/discover", labelKey: "tabs.home", icon: Compass },
  { href: "/search", labelKey: "tabs.search", icon: Search },
  { href: "/diary", labelKey: "tabs.diary", icon: BookOpen },
  { href: "/watchlists", labelKey: "tabs.watchlists", icon: ListChecks },
];

/** Redirects authenticated users from the marketing landing to /discover */
function LandingRedirect() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/discover");
    }
  }, [user, loading, router]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const { t } = useTranslation();

  // Auth callback route: render bare
  if (pathname.startsWith("/auth/callback")) {
    return <>{children}</>;
  }

  // Root marketing page: render bare (no shell chrome) with landing redirect
  if (pathname === "/") {
    return (
      <>
        <LandingRedirect />
        {children}
      </>
    );
  }

  // While auth resolves, show a loading state
  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-kino-bg p-6">
        <HomeSkeleton label={t("common.loading")} />
      </main>
    );
  }

  const navItems = user ? authenticatedNavItems : publicNavItems;

  return (
    <div className="page-shell flex min-h-screen flex-col bg-kino-bg">
      <header className="app-header">
        <div className="app-header-inner">
          <Link
            aria-label="Kino home"
            className="inline-flex h-11 shrink-0 items-center justify-center transition-opacity hover:opacity-80 focus-ring"
            href={user ? "/discover" : "/"}
          >
            <KinoLogo className="h-10 w-[60px]" priority width={60} />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 lg:flex"
          >
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/discover" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  className="header-link"
                  data-active={active}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={17} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <AccountMenu />

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label="Open navigation"
                        className="lg:hidden"
                        size="icon"
                        variant="secondary"
                      >
                        <Menu size={18} />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-64">
                    <MobileProfileMenuItem />
                    <DropdownMenuSeparator className="my-2" />
                    {navItems.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/discover" &&
                          pathname.startsWith(item.href));
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          render={
                            <Link href={item.href}>
                              <Icon size={16} />
                              {t(item.labelKey)}
                            </Link>
                          }
                          className={cn(
                            active && "bg-white/[0.06] text-kino-text"
                          )}
                          key={item.href}
                        ></DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator className="my-2" />
                    <MobileAccountActions />
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/login"
                  className={buttonVariants({
                    size: "sm",
                    variant: "ghost",
                  })}
                >
                  {t("landing.nav.signIn")}
                </Link>

                <Link
                  href="/auth/register"
                  className={buttonVariants({
                    size: "sm",
                    variant: "default",
                  })}
                >
                  {t("landing.nav.createAccount")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-main flex-1">{children}</main>
      {user ? <AppFooter /> : null}
    </div>
  );
}
