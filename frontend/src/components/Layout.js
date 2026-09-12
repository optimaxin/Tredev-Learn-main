import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Sun, Moon, LogOut, User, UserCog, ChevronDown, Menu, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import FloatingChat from "@/components/FloatingChat";
import LanguageToggle from "@/components/LanguageToggle";
import { HOME } from "@/constants/testIds";

const NAV = [
  { to: "/courses", key: "nav.courses", testid: HOME.navCourses },
  { to: "/events", key: "nav.events", testid: "nav-events" },
  { to: "/calendar", key: "nav.calendar", testid: "nav-calendar" },
  { to: "/mentors", key: "nav.mentors", testid: "nav-mentors" },
  { to: "/calculators", key: "nav.tools", testid: HOME.navCalculators },
  { to: "/mantras", key: "nav.mantras", testid: "nav-mantras" },
  { to: "/blog", key: "nav.journal", testid: "nav-blog" },
  { to: "/consultation", key: "nav.consultation", testid: HOME.navConsultation },
  { to: "/community", key: "nav.community", testid: "nav-community" },
];

function portalPath(role) {
  if (role === "acharya") return "/acharya";
  if (role === "academic_staff") return "/staff";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/learner";
}

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  const onLogout = async () => { await logout(); nav("/"); };

  // The Learner Dashboard, the real-time Community chat, and the Staff/Admin
  // portals read better on a clean, flat theme background — the celestial
  // artwork stays everywhere else.
  const isFlatBackground = loc.pathname.startsWith("/learner") || loc.pathname.startsWith("/community")
    || loc.pathname.startsWith("/staff") || loc.pathname.startsWith("/admin");
  const pageBackground = theme === "dark" || isFlatBackground ? undefined : {
    backgroundImage: "linear-gradient(hsl(var(--background) / 0.7), hsl(var(--background) / 0.7)), url(/assets/celestial-temple-bg.png)",
    backgroundSize: "cover",
    backgroundPosition: "center top",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };

  return (
    <div className={`min-h-screen noise-overlay relative ${isFlatBackground ? "bg-background" : "bg-parchment"}`} style={pageBackground}>
      {theme === "dark" && !isFlatBackground && (
        <div className="dark-video-layer">
          <video autoPlay muted loop playsInline
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260701_083907_581a119a-89b7-4c9f-a6ef-560625e0086f.mp4" />
        </div>
      )}
      <header className="sticky top-4 md:top-6 z-50 px-3 sm:px-4 md:px-6">
        <div className="mx-auto max-w-6xl glass navbar-glow rounded-full shadow-float h-16 flex items-center gap-2 md:gap-6 px-3 sm:px-5">
          <Link to="/" data-testid={HOME.navLogo} className="flex items-baseline gap-2 group shrink-0 min-w-0">
            <span className="font-display text-lg sm:text-2xl font-bold tracking-tight text-gradient-cosmic truncate">Tredev Learn</span>
          </Link>
          <nav className="hidden xl:flex flex-1 items-center justify-center gap-4 min-w-0">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={n.testid}
                className={`text-sm font-medium font-sans transition-colors pb-1 whitespace-nowrap ${loc.pathname.startsWith(n.to) ? "text-accent border-b-2 border-accent" : "text-foreground/80 hover:text-accent link-underline"}`}>
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto xl:ml-0 flex items-center gap-1 sm:gap-2 shrink-0">
            <LanguageToggle />
            <button onClick={toggle} data-testid={HOME.themeToggle}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors shrink-0"
              aria-label={t("theme.toggle")}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid={HOME.navMe}
                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-hot flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user.name?.[0] || "U"}
                    </div>
                    <span className="text-sm hidden sm:inline">{user.name?.split(" ")[0]}</span>
                    <ChevronDown className="w-3 h-3 hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-popover">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-widest">
                    {user.role.replace("_", " ")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={portalPath(user.role)} data-testid="menu-portal"><User className="w-4 h-4 mr-2"/>{t("nav.myPortal")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/certificates" data-testid="menu-certificates">{t("nav.myCertificates")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" data-testid="menu-profile"><UserCog className="w-4 h-4 mr-2"/>{t("nav.myProfile")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} data-testid={HOME.navLogout}>
                    <LogOut className="w-4 h-4 mr-2" /> {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login" data-testid={HOME.navLogin} className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm">{t("nav.signIn")}</Button>
                </Link>
                <Link to="/register" data-testid={HOME.navRegister} className="shrink-0">
                  <Button size="sm" className="rounded-full px-3 sm:px-5 whitespace-nowrap bg-primary text-primary-foreground hover:opacity-90 border-0">
                    {t("nav.enrollNow")}
                  </Button>
                </Link>
              </>
            )}
            <button onClick={() => setMobileOpen((o) => !o)} data-testid="nav-mobile"
              className="xl:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-border flex items-center justify-center shrink-0">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="xl:hidden mx-auto max-w-6xl mt-2 rounded-3xl border border-border bg-popover px-3 py-2 grid shadow-float max-h-[70vh] overflow-y-auto">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={`m-${n.testid}`}
                className={`text-sm font-medium py-3 px-2 rounded-lg ${loc.pathname.startsWith(n.to) ? "text-accent bg-accent/10" : "text-foreground/90 hover:bg-muted"}`}>
                {t(n.key)}
              </Link>
            ))}
            {!user && (
              <Link to="/login" data-testid={`m-${HOME.navLogin}`} className="text-sm font-medium py-3 px-2 rounded-lg text-foreground/90 hover:bg-muted sm:hidden">
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        )}
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 border-t border-border mt-24 bg-gradient-to-b from-transparent to-background">
        <div className="site-container py-16 grid md:grid-cols-4 gap-10">
          <div>
            <div className="font-display text-2xl font-bold text-gradient-cosmic">Tredev Learn</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {t("footer.tagline")}
            </p>
            <div className="mt-5 flex gap-3">
              {[t("footer.badgeRating"), t("footer.badgeLearners"), t("footer.badgeLegacy")].map((s) => (
                <span key={s} className="text-[10px] chip bg-muted text-accent">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-3">{t("footer.study")}</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/courses" className="link-underline">{t("footer.allCourses")}</Link></li>
              <li><Link to="/courses?type=sadhana" className="link-underline">{t("footer.sadhanas")}</Link></li>
              <li><Link to="/courses?type=masterclass" className="link-underline">{t("footer.masterclasses")}</Link></li>
              <li><Link to="/events" className="link-underline">{t("footer.upcomingEvents")}</Link></li>
              <li><Link to="/mentors" className="link-underline">{t("footer.meetMentors")}</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">{t("footer.freeTools")}</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/calculators" className="link-underline">{t("footer.toolsPanchang")}</Link></li>
              <li><Link to="/calculators" className="link-underline">{t("footer.toolsTarot")}</Link></li>
              <li><Link to="/shloka-of-the-day" className="link-underline">{t("footer.shloka")}</Link></li>
              <li><Link to="/consultation" className="link-underline">{t("footer.freeConsultation")}</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">{t("footer.trust")}</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/verify" className="link-underline">{t("footer.verify")}</Link></li>
              <li><Link to="/blog" className="link-underline">{t("nav.journal")}</Link></li>
              <li><Link to="/calendar" className="link-underline">{t("footer.festivalCalendar")}</Link></li>
              <li><Link to="/about" className="link-underline">{t("footer.about")}</Link></li>
              <li><span className="text-muted-foreground">{t("footer.acharyaSignoff")}</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Tredev Learn — {t("footer.copyright")}
        </div>
      </footer>
      <FloatingChat />
    </div>
  );
}
