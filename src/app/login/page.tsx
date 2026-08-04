"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare, CheckCircle2, Award, MessagesSquare, Layers,
  Eye, EyeOff, Loader2, KeyRound, Check, X as XIcon,
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { isAdmin, isLeadDev } from "@/lib/admin";
import LoadingScreen from "@/components/ui/LoadingScreen";

/**
 * THE DOOR — sign in and sign up as a real page rather than a modal.
 *
 * Left: what's behind the door. Right: the form. Invite code is required to
 * sign up because the whole site is invite-only; Discord sits on both tabs
 * because that's how most people actually get in.
 */

const FEATURES: { Icon: any; title: string; body: string }[] = [
  { Icon: MessageSquare, title: "Talk in the Community", body: "Forums, threads and comments — with GIFs and emoji." },
  { Icon: CheckCircle2, title: "Track Your Progress", body: "Mark episodes watched and chapters read, across devices." },
  { Icon: Award, title: "Earn Points & Levels", body: "Watching and reading pay Arise Points. Rank up, wear titles." },
  { Icon: MessagesSquare, title: "Comment on Everything", body: "Anime, manhwa and light novels — every page has a thread." },
  { Icon: Layers, title: "Collect Arise Cards", body: "Pull heroes, duel other members, dispatch parties into dungeons." },
];

/** Cheap, honest strength read — length first, then variety. */
function scorePassword(pw: string): { score: number; label: string; tone: string } {
  if (!pw) return { score: 0, label: "", tone: "text-slate-500" };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: "Weak", tone: "text-red-400" };
  if (s === 2) return { score: 2, label: "Fair", tone: "text-amber-400" };
  if (s === 3) return { score: 3, label: "Good", tone: "text-sky-400" };
  return { score: 4, label: "Strong", tone: "text-emerald-400" };
}

function DiscordMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

/** Dark, not blurple — the owner's ask, and it sits better on this theme. */
function DiscordButton({ label }: { label: string }) {
  return (
    <a
      href="/api/auth/discord/login"
      className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm font-bold text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
    >
      <DiscordMark className="h-5 w-5 text-slate-300 transition group-hover:text-white" />
      {label}
    </a>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { user, isLoaded, login, signup } = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const [mode, setMode] = useState<"login" | "signup">(
    sp.get("mode") === "signup" ? "signup" : "login"
  );
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already signed in? There is nothing here for you.
  useEffect(() => {
    if (isLoaded && user) router.replace("/");
  }, [isLoaded, user, router]);

  const strength = useMemo(() => scorePassword(password), [password]);
  const longEnough = password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = mode === "login"
        ? await login(identifier, password)
        : await signup(username, email, password, inviteCode);

      if (res.success) {
        if (mode === "login") {
          const uName = ((res as any).user?.username || identifier).toLowerCase();
          if (uName === "xhackerdevil") toast("Welcome Bug Founder 🐞", "success");
          else if (isLeadDev(uName)) toast("Welcome Back, Lead Developer 👑", "success");
          else if (isAdmin(uName)) toast("Welcome Back, Admin 👑", "success");
          else toast("Welcome Back!", "success");
        } else {
          toast("Welcome to Da Vinci!", "success");
        }
        router.push("/");
      } else {
        setError(res.message || "That didn't work. Check your details and try again.");
      }
    } catch {
      setError("Couldn't reach the server. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-slate-600 outline-none transition focus:border-violet-400/50 focus:bg-white/[0.06]";
  const label = "mb-1.5 block font-mono text-sm font-bold text-slate-200";

  // pb-12, not pb-28: that clearance existed for the bottom nav, which no
  // longer renders on this route.
  return (
    <div className="min-h-screen bg-[#070709] pb-12">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url(/landing-bg.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070709]/70 via-[#070709]/80 to-[#070709]" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:py-32"
        >
          <h1 className="font-mono text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
            {mode === "login" ? "Welcome Back" : "Join Da Vinci"}
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-mono text-sm leading-relaxed text-slate-400 sm:text-base">
            {mode === "login"
              ? "Enter your details to access your account and continue watching"
              : "Bring your invite code and make yourself at home"}
          </p>
        </motion.div>
      </div>

      {/* ── THE TWO COLUMNS ── */}
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* what's behind the door */}
        <div className="order-2 lg:order-1">
          <h2 className="font-mono text-3xl font-black text-white">Join our Community</h2>
          <p className="mt-3 max-w-md font-mono text-sm leading-relaxed text-slate-400">
            An invitation-only atelier for anime, manhwa and light novels — with a
            card game living underneath it.
          </p>

          <div className="mt-9 flex flex-col gap-6">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-5 w-5 text-slate-300" />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-base font-black text-white">{title}</span>
                  <span className="mt-0.5 block font-mono text-sm leading-relaxed text-slate-500">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* the form */}
        <div className="order-1 lg:order-2">
          <div className="mb-6 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`rounded-lg px-5 py-2 font-mono text-sm font-bold transition ${
                  mode === m ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-5">
            {mode === "login" ? (
              <div>
                <label className={label} htmlFor="identifier">Username or Email</label>
                <input
                  id="identifier"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Your username or email"
                  className={field}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className={label} htmlFor="username">Username</label>
                  <input
                    id="username"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className={field}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="m@example.com"
                    className={field}
                  />
                </div>
              </>
            )}

            <div>
              <label className={label} htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === "signup" && (
                <>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">Password strength</span>
                    <span className={`font-mono text-xs font-black ${strength.tone}`}>{strength.label}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        strength.score <= 1 ? "bg-red-500"
                          : strength.score === 2 ? "bg-amber-500"
                            : strength.score === 3 ? "bg-sky-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="font-mono text-xs font-bold text-slate-300">Password requirements:</p>
                    <p className={`mt-2 flex items-center gap-2 font-mono text-xs ${longEnough ? "text-emerald-300" : "text-slate-500"}`}>
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${longEnough ? "bg-emerald-500/20" : "bg-white/10"}`}>
                        {longEnough ? <Check className="h-2.5 w-2.5" /> : <XIcon className="h-2.5 w-2.5" />}
                      </span>
                      At least 6 characters
                    </p>
                  </div>
                </>
              )}
            </div>

            {mode === "signup" && (
              <div>
                <label className={label} htmlFor="invite">
                  Invite Code
                  <span className="ml-2 font-normal text-slate-500">— Da Vinci is invitation only</span>
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    id="invite"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="A1B2C3D4"
                    className={`${field} pl-11 tracking-[0.2em]`}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-mono text-sm font-black text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Connecting…" : mode === "login" ? "Login" : "Sign Up"}
            </button>
          </form>

          {/* Discord — on both tabs, because it's how most people arrive */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
            <div className="relative flex justify-center">
              <span className="bg-[#070709] px-3 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-600">
                or continue with
              </span>
            </div>
          </div>

          <DiscordButton label={mode === "login" ? "Login with Discord" : "Sign up with Discord"} />

          {mode === "signup" && (
            <p className="mt-3 text-center font-mono text-xs leading-relaxed text-slate-600">
              Signing up with Discord still asks for your invite code.
            </p>
          )}

          {mode === "login" && (
            <p className="mt-6 text-center font-mono text-xs text-slate-500">
              Lost your password? Ask a staff member on{" "}
              <a
                href="https://discord.gg/dSPPjPUQbM"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-slate-300 underline decoration-white/20 underline-offset-2 transition hover:text-white"
              >
                Discord
              </a>
              .
            </p>
          )}

          <p className="mt-8 text-center font-mono text-xs leading-relaxed text-slate-600">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-white">Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-white">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
