"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminStore } from "@/store";

const NAV_ITEMS = [
  { path: "/admin/dashboard", icon: "🏠", label: "Home" },
  { path: "/admin/quiz", icon: "📋", label: "Quiz" },
  { path: "/admin/session", icon: "🎮", label: "Sesi" },
  { path: "/admin/settings", icon: "⚙️", label: "Setelan" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn } = useAdminStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Redirect ke login jika belum login
    // Kecuali sudah di halaman login (/admin)
    if (!isLoggedIn && pathname !== "/admin") {
      router.replace("/admin");
    }

    // Sync admin info on mount
    const syncAdmin = async () => {
      if (isLoggedIn) {
        try {
          const { api } = await import("@/lib/utils");
          const { useAdminStore } = await import("@/store");
          const res = await api.get("/auth/me");
          if (res.data.success && res.data.data.admin) {
             const store = useAdminStore.getState();
             const { admin } = res.data.data;
             store.setAdminAuth({
                token: store.token,
                adminId: admin._id,
                username: admin.username,
                className: admin.className,
                role: admin.role,
             });
          }
        } catch (e) {
          console.error("Gagal sync admin:", e);
        }
      }
    };
    syncAdmin();
  }, [isLoggedIn, pathname, mounted]);

  const isLoginPage = pathname === "/admin";

  if (!mounted) return null;

  // Login page tidak pakai nav
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isLoggedIn) return null;

  return (
    <div className="admin-page bg-[#0A0A0F] min-h-screen flex flex-col md:flex-row relative">
      {/* Decorative ambient glowing orbs global */}
      <div className="fixed top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--accent-purple)] opacity-10 blur-[120px] mix-blend-screen pointer-events-none rounded-full z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-[var(--accent-blue)] opacity-[0.08] blur-[100px] mix-blend-screen pointer-events-none rounded-full z-0" />

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-[rgba(19,19,26,0.85)] backdrop-blur-2xl border-r border-[rgba(255,255,255,0.05)] z-40 p-5 items-stretch shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3 mb-10 px-2 mt-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push("/admin/dashboard")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-blue)] flex items-center justify-center text-xl shadow-[0_4px_15px_rgba(108,92,231,0.4)]">🎮</div>
          <h1 className="text-xl font-black bg-gradient-to-r from-white to-[var(--accent-purple-light)] bg-clip-text text-transparent" style={{ fontFamily: "var(--font-heading)" }}>QuizClass Admin</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-semibold ${
                  isActive 
                    ? "bg-[rgba(108,92,231,0.15)] text-[var(--accent-purple-light)] border border-[rgba(108,92,231,0.3)] shadow-[inset_0_2px_10px_rgba(108,92,231,0.1)]" 
                    : "text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      {/* On desktop we shift right 64 (w-64 = 16rem = 256px), on mobile we leave space at bottom mb-[72px] for nav */}
      <main className="flex-1 md:ml-64 mb-[72px] md:mb-0 relative z-10 w-full">
        {children}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[76px] bg-[rgba(19,19,26,0.95)] backdrop-blur-xl border-t border-[rgba(255,255,255,0.05)] flex items-center justify-around px-2 pb-safe z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.4)]">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 min-w-[64px] rounded-2xl transition-all ${
                isActive 
                  ? "bg-[rgba(108,92,231,0.1)] text-[var(--accent-purple-light)]" 
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className={`text-2xl transition-transform ${isActive ? "scale-110" : ""}`}>{item.icon}</span>
              <span className="text-[10px] font-bold tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}