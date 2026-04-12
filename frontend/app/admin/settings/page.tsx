"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ParticleBackground,
  GlassCard,
  Button,
  InputField,
  SectionHeader,
  Badge,
  useToast,
  CreditFooter,
} from "@/components/UI";
import { useAdminStore } from "@/store";
import { api } from "@/lib/utils";

interface Teacher {
  _id: string;
  username: string;
  className: string;
  role: string;
  createdAt?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { username, className, token, role, setAdminAuth, setClassName, logoutAdmin } =
    useAdminStore();

  const isSuperAdmin = role === "superadmin" || username === "admin";

  const [profileForm, setProfileForm] = useState({
    username: username,
    className: className,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Teacher management state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    username: "",
    password: "",
    className: "Kelas Guru",
  });
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editTeacherForm, setEditTeacherForm] = useState({
    username: "",
    className: "",
    newPassword: "",
  });

  // API Keys status
  const [apiKeysStatus, setApiKeysStatus] = useState<{ totalKeys: number; keys: { index: number; label: string; configured: boolean }[] } | null>(null);

  const fetchTeachers = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingTeachers(true);
    try {
      const res = await api.get("/auth/teacher");
      setTeachers(res.data.data?.teachers || []);
    } catch {
      showToast("Gagal memuat daftar guru!", "error");
    } finally {
      setLoadingTeachers(false);
    }
  }, [isSuperAdmin]);

  const fetchApiKeysStatus = useCallback(async () => {
    try {
      const res = await api.get("/quiz/api-keys-status");
      setApiKeysStatus(res.data.data);
    } catch {
      // Not critical, ignore
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTeachers();
      fetchApiKeysStatus();
    }
  }, [isSuperAdmin, fetchTeachers, fetchApiKeysStatus]);

  // Save profile
  const handleSaveProfile = async () => {
    if (!profileForm.username.trim()) {
      showToast("Username tidak boleh kosong!", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.put("/auth/update", {
        username: profileForm.username.trim(),
        className: profileForm.className.trim(),
      });

      if (res.data.success) {
        const { admin } = res.data.data;
        setAdminAuth({
          token,
          adminId: admin._id,
          username: admin.username,
          className: admin.className,
          role: admin.role,
        });
        showToast("Profil berhasil diperbarui! ✅", "success");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal menyimpan!", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Save password
  const handleSavePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      showToast("Semua field password wajib diisi!", "error");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showToast("Password baru minimal 6 karakter!", "error");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("Konfirmasi password tidak cocok!", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.put("/auth/update", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.data.success) {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        showToast("Password berhasil diubah! 🔐", "success");
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal mengubah password!", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  // Add teacher
  const handleAddTeacher = async () => {
    if (!teacherForm.username.trim() || !teacherForm.password.trim()) {
      showToast("Username dan password wajib diisi!", "error");
      return;
    }
    if (teacherForm.password.length < 6) {
      showToast("Password minimal 6 karakter!", "error");
      return;
    }

    setSavingTeacher(true);
    try {
      await api.post("/auth/teacher", {
        username: teacherForm.username.trim(),
        password: teacherForm.password,
        className: teacherForm.className.trim() || "Kelas Guru",
      });
      showToast("Akun guru berhasil dibuat! 🎉", "success");
      setTeacherForm({ username: "", password: "", className: "Kelas Guru" });
      setShowAddTeacher(false);
      await fetchTeachers();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal membuat akun guru!", "error");
    } finally {
      setSavingTeacher(false);
    }
  };

  // Edit teacher
  const handleEditTeacher = async () => {
    if (!editingTeacher) return;
    setSavingTeacher(true);
    try {
      await api.put(`/auth/teacher/${editingTeacher._id}`, {
        username: editTeacherForm.username.trim() || undefined,
        className: editTeacherForm.className.trim() || undefined,
        newPassword: editTeacherForm.newPassword || undefined,
      });
      showToast("Akun guru berhasil diperbarui! ✅", "success");
      setEditingTeacher(null);
      await fetchTeachers();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal memperbarui!", "error");
    } finally {
      setSavingTeacher(false);
    }
  };

  // Delete teacher
  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (!confirm(`Yakin hapus akun guru "${teacher.username}"? Ini tidak bisa dibatalkan!`)) return;
    try {
      await api.delete(`/auth/teacher/${teacher._id}`);
      showToast("Akun guru dihapus!", "info");
      await fetchTeachers();
    } catch (err: any) {
      showToast(err.response?.data?.message || "Gagal menghapus!", "error");
    }
  };

  // Logout
  const handleLogout = () => {
    if (!confirm("Yakin mau logout?")) return;
    logoutAdmin();
    router.replace("/admin");
    showToast("Berhasil logout!", "info");
  };

  return (
    <div className="min-h-screen px-5 py-6 relative z-10 max-w-md mx-auto">
      <ParticleBackground />
      <ToastComponent />

      {/* ── Header ── */}
      <div className="mb-8 mt-2 animate-slide-down relative">
        <div 
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[80px] pointer-events-none opacity-40"
          style={{ background: "var(--accent-blue)" }}
        />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg border border-white/10" style={{ background: "linear-gradient(135deg, rgba(20,20,30,0.8), rgba(30,30,45,0.8))", backdropFilter: "blur(10px)" }}>
            ⚙️
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
              Pengaturan
            </h1>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Kelola akun dan preferensi admin
            </p>
          </div>
        </div>
      </div>

      {/* ── Profile Card ── */}
      <div className="mb-6 animate-slide-up relative">
        <div 
          className="absolute inset-0 rounded-[2rem] blur-xl opacity-20 pointer-events-none"
          style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
        />
        <div className="relative p-6 rounded-[2rem] overflow-hidden"
          style={{ 
            background: "linear-gradient(145deg, rgba(30,30,45,0.9) 0%, rgba(20,20,30,0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
          }}>
          
          {/* Avatar admin */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500 rounded-2xl blur-md opacity-50 animate-pulse-slow" />
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl relative z-10 border border-white/10"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-purple), var(--accent-purple-dark))",
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.2)",
                  }}
                >
                  {isSuperAdmin ? "👑" : "🧑‍🏫"}
                </div>
              </div>
              <div>
                <p
                  className="text-xl font-black tracking-tight"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  {username}
                </p>
                <p
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {className}
                </p>
                <div className="flex">
                  <Badge variant={isSuperAdmin ? "purple" : "yellow"} className="text-[10px] uppercase tracking-wider font-bold">
                    {isSuperAdmin ? "👑 SuperAdmin" : "👨‍🏫 Guru"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div className="h-px w-full bg-white/5 mb-5" />

          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">👤</span>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Info Profil</h3>
          </div>

        <div className="space-y-3">
          <InputField
            label="Username"
            value={profileForm.username}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                username: e.target.value,
              }))
            }
            icon={<span>👤</span>}
            placeholder="Username admin"
          />
          <InputField
            label="Nama Kelas"
            value={profileForm.className}
            onChange={(e) =>
              setProfileForm((prev) => ({
                ...prev,
                className: e.target.value,
              }))
            }
            icon={<span>🏫</span>}
            placeholder="contoh: Kelas RPL 2024"
          />
        </div>

        <Button
          onClick={handleSaveProfile}
          loading={savingProfile}
          className="mt-6"
          variant="primary"
        >
          <span>✨</span>
          <span>Simpan Perubahan</span>
        </Button>
        </div>
      </div>

      {/* ── Password Card ── */}
      <div className="p-6 rounded-[2rem] mb-6 animate-slide-up"
        style={{ 
          background: "var(--bg-elevated)",
          border: "1px solid rgba(255,255,255,0.05)",
          animationDelay: "0.1s" 
        }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔐</span>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Ubah Password</h3>
          </div>
          <button
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ 
              background: "rgba(255,255,255,0.05)",
              color: "var(--accent-purple-light)",
              border: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            {showPasswords ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>

        <div className="space-y-3">
          <InputField
            label="Password Lama"
            type={showPasswords ? "text" : "password"}
            value={passwordForm.currentPassword}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                currentPassword: e.target.value,
              }))
            }
            icon={<span>🔑</span>}
            placeholder="Password saat ini"
            autoComplete="current-password"
          />
          <InputField
            label="Password Baru"
            type={showPasswords ? "text" : "password"}
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                newPassword: e.target.value,
              }))
            }
            icon={<span>🔒</span>}
            placeholder="Password baru (min. 6 karakter)"
            autoComplete="new-password"
          />
          <InputField
            label="Konfirmasi Password Baru"
            type={showPasswords ? "text" : "password"}
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm((prev) => ({
                ...prev,
                confirmPassword: e.target.value,
              }))
            }
            icon={<span>✅</span>}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
          />
        </div>

        {/* Match indicator */}
        {passwordForm.newPassword && passwordForm.confirmPassword && (
          <div
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background:
                passwordForm.newPassword === passwordForm.confirmPassword
                  ? "rgba(0,184,148,0.1)"
                  : "rgba(255,107,107,0.1)",
              color:
                passwordForm.newPassword === passwordForm.confirmPassword
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
            }}
          >
            {passwordForm.newPassword === passwordForm.confirmPassword
              ? "✅ Password cocok!"
              : "❌ Password tidak cocok"}
          </div>
        )}

        <Button
          onClick={handleSavePassword}
          loading={savingPassword}
          className="mt-6"
          variant="primary"
        >
          <span>🔐</span>
          <span>Perbarui Password</span>
        </Button>
      </div>

      {/* ── Teacher Management (SuperAdmin only) ── */}
      {isSuperAdmin && (
        <div className="p-6 rounded-[2rem] mb-6 animate-slide-up"
          style={{ 
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.05)",
            animationDelay: "0.15s" 
          }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Kelola Guru</h3>
            </div>
            <button
              onClick={() => setShowAddTeacher(!showAddTeacher)}
              className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: showAddTeacher ? "rgba(255,107,107,0.15)" : "rgba(0,184,148,0.15)",
                color: showAddTeacher ? "var(--accent-red)" : "var(--accent-green)",
              }}
            >
              {showAddTeacher ? "✕ Batal" : "+ Tambah"}
            </button>
          </div>

          {/* Add Teacher Form */}
          {showAddTeacher && (
            <div
              className="mb-4 p-4 rounded-xl animate-slide-up"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Akun Guru Baru
              </p>
              <div className="space-y-3">
                <InputField
                  placeholder="Username guru"
                  value={teacherForm.username}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, username: e.target.value }))}
                  icon={<span>👤</span>}
                />
                <InputField
                  placeholder="Password (min. 6 karakter)"
                  type="password"
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                  icon={<span>🔑</span>}
                />
                <InputField
                  placeholder="Nama Kelas"
                  value={teacherForm.className}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, className: e.target.value }))}
                  icon={<span>🏫</span>}
                />
              </div>
              <Button onClick={handleAddTeacher} loading={savingTeacher} variant="green" className="mt-3">
                <span>➕</span>
                <span>Buat Akun Guru</span>
              </Button>
            </div>
          )}

          {/* Edit Teacher Form */}
          {editingTeacher && (
            <div
              className="mb-4 p-4 rounded-xl animate-slide-up"
              style={{ background: "var(--bg-elevated)", border: "1px solid rgba(108,92,231,0.3)" }}
            >
              <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "var(--accent-purple-light)" }}>
                Edit: {editingTeacher.username}
              </p>
              <div className="space-y-3">
                <InputField
                  placeholder={`Username (sekarang: ${editingTeacher.username})`}
                  value={editTeacherForm.username}
                  onChange={(e) => setEditTeacherForm(prev => ({ ...prev, username: e.target.value }))}
                  icon={<span>👤</span>}
                />
                <InputField
                  placeholder={`Kelas (sekarang: ${editingTeacher.className})`}
                  value={editTeacherForm.className}
                  onChange={(e) => setEditTeacherForm(prev => ({ ...prev, className: e.target.value }))}
                  icon={<span>🏫</span>}
                />
                <InputField
                  placeholder="Password baru (kosongkan jika tidak diubah)"
                  type="password"
                  value={editTeacherForm.newPassword}
                  onChange={(e) => setEditTeacherForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  icon={<span>🔒</span>}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={() => setEditingTeacher(null)} style={{ background: "rgba(255,255,255,0.05)" }} className="flex-1 text-sm">
                  Batal
                </Button>
                <Button onClick={handleEditTeacher} loading={savingTeacher} variant="primary" className="flex-1 text-sm">
                  💾 Simpan
                </Button>
              </div>
            </div>
          )}

          {/* Teacher List */}
          {loadingTeachers ? (
            <div className="text-center py-4">
              <div className="w-6 h-6 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Memuat daftar guru...</p>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-1">🧑‍🏫</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Belum ada akun guru</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tambahkan guru untuk berbagi akses quiz</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teachers.map((teacher) => (
                <div
                  key={teacher._id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: "rgba(108,92,231,0.15)" }}
                    >
                      🧑‍🏫
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
                        {teacher.username}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {teacher.className}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTeacher(teacher);
                        setEditTeacherForm({ username: teacher.username, className: teacher.className, newPassword: "" });
                        setShowAddTeacher(false);
                      }}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: "rgba(108,92,231,0.12)",
                        color: "var(--accent-purple-light)",
                        border: "1px solid rgba(108,92,231,0.25)",
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(teacher)}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background: "rgba(255,107,107,0.1)",
                        color: "var(--accent-red)",
                        border: "1px solid rgba(255,107,107,0.2)",
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Gemini API Keys Status (SuperAdmin only) ── */}
      {isSuperAdmin && (
        <div className="p-6 rounded-[2rem] mb-6 animate-slide-up"
          style={{ 
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.05)",
            animationDelay: "0.2s" 
          }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Status API Key Gemini</h3>
          </div>
          <p className="text-[11px] font-semibold mb-5 pl-7" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
            * Sistem mendukung hingga 3 API key berbarengan untuk mengatasi batasan limit rate secara otomatis.
          </p>
          {apiKeysStatus ? (
            <div className="space-y-2">
              {[
                { label: "GEMINI_API_KEY", index: 1 },
                { label: "GEMINI_API_KEY_2", index: 2 },
                { label: "GEMINI_API_KEY_3", index: 3 },
              ].map((item) => {
                const configured = apiKeysStatus.keys.some(k => k.index === item.index);
                return (
                  <div
                    key={item.index}
                    className="flex items-center justify-between py-2 px-3 rounded-xl transition-colors hover:bg-white/5"
                    style={{
                      background: configured ? "rgba(0,184,148,0.05)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${configured ? "rgba(0,184,148,0.1)" : "var(--border)"}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: configured ? "var(--accent-green)" : "var(--text-muted)",
                          boxShadow: configured ? "0 0 8px var(--accent-green)" : "none",
                        }}
                      />
                      <p className="text-[11px] font-mono font-bold tracking-wider" style={{ color: "var(--text-secondary)" }}>
                        {item.label}
                      </p>
                    </div>
                    <Badge variant={configured ? "green" : "purple"} className="text-[10px]">
                      {configured ? "✅ TERSAMBUNG" : "⚠️ KOSONG"}
                    </Badge>
                  </div>
                );
              })}
              <div className="mt-4 p-3 rounded-xl border border-white/5 bg-black/20 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Key Aktif</p>
                <p className="text-2xl font-black mt-1" style={{ color: "var(--accent-purple)", fontFamily: "var(--font-score)" }}>{apiKeysStatus.totalKeys}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Mengecek status API...</p>
            </div>
          )}
        </div>
      )}

      {/* ── App Info ── */}
      <div className="p-6 rounded-[2rem] mb-6 animate-slide-up"
        style={{ 
          background: "var(--bg-elevated)",
          border: "1px solid rgba(255,255,255,0.05)",
          animationDelay: "0.25s" 
        }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">ℹ️</span>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Tentang Sistem</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Nama Aplikasi", value: "QuizClass" },
            { label: "Versi", value: "2.0.0" },
            { label: "Developer", value: "Ikbal x RPL" },
            { label: "Frontend", value: "Next.js + Vercel" },
            { label: "Backend", value: "Express + Railway" },
            { label: "Database", value: "MongoDB Atlas" },
            { label: "Real-time", value: "Socket.IO" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {item.label}
              </p>
              <p
                className="text-sm font-bold"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div
        className="p-6 rounded-[2rem] mb-24 animate-slide-up relative overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid rgba(255,107,107,0.2)",
          animationDelay: "0.3s",
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] pointer-events-none rounded-full" />
        <div className="flex items-center gap-2 mb-2 relative z-10">
          <span className="text-lg">⚠️</span>
          <p
            className="text-sm font-black uppercase tracking-wider"
            style={{
              color: "var(--accent-red)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Danger Zone
          </p>
        </div>
        <p
          className="text-xs mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Hati-hati! Tindakan di bawah tidak dapat dibatalkan.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all relative z-10 overflow-hidden group hover:shadow-[0_0_20px_rgba(255,107,107,0.2)]"
          style={{
            background: "rgba(255,107,107,0.1)",
            color: "var(--accent-red)",
            border: "1px solid rgba(255,107,107,0.2)",
          }}
        >
          <div className="absolute inset-0 w-0 bg-red-500/10 transition-all duration-300 ease-out group-hover:w-full" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            <span>🚪</span>
            <span>Logout dari Admin</span>
          </span>
        </button>
      </div>

      <CreditFooter />
    </div>
  );
}