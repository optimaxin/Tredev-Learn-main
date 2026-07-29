import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Sun, Moon, LogOut, User, ChevronDown, Menu, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import FloatingChat from "@/components/FloatingChat";
import { HOME } from "@/constants/testIds";

const NAV = [
  { to: "/courses", label: "Courses", testid: HOME.navCourses },
  { to: "/webinars", label: "Webinars", testid: "nav-webinars" },
  { to: "/mentors", label: "Mentors", testid: "nav-mentors" },
  { to: "/calculators", label: "Free Tools", testid: HOME.navCalculators },
  { to: "/mantras", label: "Mantras", testid: "nav-mantras" },
  { to: "/blog", label: "Journal", testid: "nav-blog" },
  { to: "/events", label: "Events", testid: "nav-events" },
  { to: "/consultation", label: "Consultation", testid: HOME.navConsultation },
];

function portalPath(role) {
  if (role === "acharya") return "/acharya";
  if (role === "academic_staff") return "/staff";
  if (role === "admin" || role === "super_admin") return "/admin";
  return "/learner";
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  const onLogout = async () => { await logout(); nav("/"); };

  return (
    <div className="min-h-screen bg-parchment noise-overlay relative">
      <header className="sticky top-0 z-50 glass-strong border-b border-border">
        <div className="site-container h-16 flex items-center gap-6">
          <Link to="/" data-testid={HOME.navLogo} className="flex items-baseline gap-2 group shrink-0">
            <span className="font-display text-2xl font-bold tracking-tight text-gradient-cosmic">Tredev</span>
            <span className="font-display italic text-xl text-accent">Learn</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 ml-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={n.testid}
                className={`text-sm font-medium link-underline transition-colors ${loc.pathname.startsWith(n.to) ? "text-primary" : "text-foreground/85 hover:text-primary"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} data-testid={HOME.themeToggle}
              className="w-9 h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button data-testid={HOME.navMe}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors">
                    <div className="w-6 h-6 rounded-full bg-gradient-hot flex items-center justify-center text-xs font-bold text-white">
                      {user.name?.[0] || "U"}
                    </div>
                    <span className="text-sm hidden sm:inline">{user.name?.split(" ")[0]}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-popover">
                  <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-widest">
                    {user.role.replace("_", " ")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={portalPath(user.role)} data-testid="menu-portal"><User className="w-4 h-4 mr-2"/>My Portal</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/certificates" data-testid="menu-certificates">My Certificates</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} data-testid={HOME.navLogout}>
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login" data-testid={HOME.navLogin} className="hidden sm:inline-flex">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link to="/register" data-testid={HOME.navRegister}>
                  <Button size="sm" className="rounded-full px-5 bg-gradient-hot text-white hover:opacity-90 btn-glow border-0">
                    Enroll now
                  </Button>
                </Link>
              </>
            )}
            <button onClick={() => setMobileOpen((o) => !o)} data-testid="nav-mobile"
              className="lg:hidden w-9 h-9 rounded-full border border-border flex items-center justify-center">
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-popover px-5 py-4 grid gap-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="text-sm py-2" data-testid={`m-${n.testid}`}>
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 border-t border-border mt-24 bg-gradient-to-b from-transparent to-background">
        <div className="site-container py-16 grid md:grid-cols-4 gap-10">
          <div>
            <div className="font-display text-2xl font-bold text-gradient-cosmic">Tredev Learn</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              A place to study the Vedic traditions rigorously. Not a place to buy predictions about your life.
            </p>
            <div className="mt-5 flex gap-3">
              {["4.8★ Google", "6L+ Learners", "51+ Yrs Legacy"].map((s) => (
                <span key={s} className="text-[10px] chip bg-muted text-accent">{s}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="overline mb-3">Study</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/courses" className="link-underline">All courses</Link></li>
              <li><Link to="/courses?type=sadhana" className="link-underline">Sadhanas</Link></li>
              <li><Link to="/courses?type=masterclass" className="link-underline">Free masterclasses</Link></li>
              <li><Link to="/webinars" className="link-underline">Upcoming webinars</Link></li>
              <li><Link to="/mentors" className="link-underline">Meet the mentors</Link></li>
            </ul>
          </div>
          <div>
            <div className="overline mb-3">Free tools</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/calculators" className="link-underline">Panchang · Kundli · Numerology</Link></li>
              <li><Link to="/calculators" className="link-underline">Tarot · Ram Shalākā</Link></li>
              <li><Link to="/shloka-of-the-day" className="link-underline">Shloka of the day</Link></li>
              <li><Link to="/consultation" className="link-underline">Free pathway consultation</Link></li>
            </ul>
          </div>
          <div>
            <div className="overline mb-3">Trust</div>
            <ul className="text-sm space-y-2">
              <li><Link to="/verify" className="link-underline">Verify a certificate</Link></li>
              <li><Link to="/blog" className="link-underline">Journal</Link></li>
              <li><Link to="/events" className="link-underline">Events</Link></li>
              <li><Link to="/about" className="link-underline">About us</Link></li>
              <li><span className="text-muted-foreground">Ācharya sign-off · every lesson</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Tredev Learn — built for serious study. · Structured like a university. Accessible like a streaming site. Credentialed like a professional course.
        </div>
      </footer>
      <FloatingChat />
    </div>
  );
}
