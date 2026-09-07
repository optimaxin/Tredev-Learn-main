import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Calculators from "@/pages/Calculators";
import Consultation from "@/pages/Consultation";
import CertificateVerify from "@/pages/CertificateVerify";
import LearnerDashboard from "@/pages/LearnerDashboard";
import AcharyaPortal from "@/pages/AcharyaPortal";
import AcademicStaffPortal from "@/pages/AcademicStaffPortal";
import AdminPortal from "@/pages/AdminPortal";
import Community from "@/pages/Community";
import MyCertificates from "@/pages/MyCertificates";
import Blog from "@/pages/Blog";
import BlogDetail from "@/pages/BlogDetail";
import Mentors from "@/pages/Mentors";
import Events from "@/pages/Events";
import Calendar from "@/pages/Calendar";
import QuizAttempt from "@/pages/QuizAttempt";
import Mantras from "@/pages/Mantras";
import AboutUs from "@/pages/AboutUs";
import ShlokaPlayer from "@/components/ShlokaPlayer";
import { fetchDailyVerse } from "@/lib/dailyVerse";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-20 text-center text-muted-foreground">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function ShlokaOfDayRoute() {
  const [v, setV] = React.useState(null);
  React.useEffect(() => { fetchDailyVerse().then(setV).catch(() => {}); }, []);
  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
      <div className="chip bg-primary/15 text-primary border border-primary/30 mb-4">TODAY'S VERSE</div>
      <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-8">
        Shloka of the <span className="text-gradient-hot">day</span>
      </h1>
      {v && v.devanagari && <ShlokaPlayer verse={v} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <CurrencyProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors theme="system" />
          <Layout>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/calculators" element={<Calculators />} />
              <Route path="/shloka-of-the-day" element={<ShlokaOfDayRoute />} />
              <Route path="/consultation" element={<Consultation />} />
              <Route path="/community" element={<Community />} />
              <Route path="/verify" element={<CertificateVerify />} />
              <Route path="/verify/:code" element={<CertificateVerify />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogDetail />} />
              <Route path="/webinars" element={<Navigate to="/events" replace />} />
              <Route path="/mentors" element={<Mentors />} />
              <Route path="/events" element={<Events />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/mantras" element={<Mantras />} />
              <Route path="/about" element={<AboutUs />} />

              <Route path="/learner" element={<Protected roles={["learner","academic_staff","acharya","admin","super_admin"]}><LearnerDashboard /></Protected>} />
              <Route path="/certificates" element={<Protected><MyCertificates /></Protected>} />
              <Route path="/quiz/:quizId" element={<Protected><QuizAttempt /></Protected>} />
              <Route path="/acharya" element={<Protected roles={["acharya"]}><AcharyaPortal /></Protected>} />
              <Route path="/staff" element={<Protected roles={["academic_staff","admin","super_admin"]}><AcademicStaffPortal /></Protected>} />
              <Route path="/admin" element={<Protected roles={["admin","super_admin"]}><AdminPortal /></Protected>} />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
