"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users as UsersIcon, Diamond, ServerCog, BarChart3, Search, RefreshCw, ShieldAlert,
  Ticket, Trash2, Plus, Send, Megaphone, Activity, ScrollText, X, Copy, Swords,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import { isLeadDev } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import { consoleApi } from "@/lib/consoleApi";
import ConsoleDangerDialog from "@/components/console/ConsoleDangerDialog";

/**
 * Lead Dev console.
 *
 * The gate here is COSMETIC. Every endpoint this page calls is independently
 * gated server-side with requireStaff(req, res, { leadDevOnly: true }), so an
 * ADMIN who guesses this URL sees a 404 card and, if they curl the API directly,
 * gets a 403. Never use isAdmin() to gate this — it returns true for LEAD_DEV
 * *and* every admin, which would let admins into a UI where every button 403s.
 */

type Tab = "users" | "economy" | "ops" | "insights";

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: "users", label: "Users & roles", Icon: UsersIcon },
  { id: "economy", label: "Economy", Icon: Diamond },
  { id: "ops", label: "Operations", Icon: ServerCog },
  { id: "insights", label: "Insights", Icon: BarChart3 },
];

const CARD = "rounded-2xl border border-white/10 bg-white/[0.03] p-5";
const INPUT =
  "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-purple-500/40";
const BTN =
  "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_PRIMARY =
  "rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white transition hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed";

function Stat({ label, value, tint = "text-white" }: { label: string; value: any; tint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-black tabular-nums ${tint}`}>{value}</div>
    </div>
  );
}

function RoleChip({ role }: { role?: string | null }) {
  if (role === "LEAD_DEV")
    return <span className="rounded border border-fuchsia-400/25 bg-fuchsia-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-fuchsia-300">Lead Dev</span>;
  if (role === "ADMIN")
    return <span className="rounded border border-purple-400/20 bg-purple-500/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wider text-purple-300">Admin</span>;
  return null;
}

export default function ConsolePage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("users");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Deep links use the HASH, never useSearchParams — a page-level
  // useSearchParams without a <Suspense> boundary fails `next build`, and Vercel
  // then keeps serving the last good deploy, so the page looks live but stale.
  useEffect(() => {
    const h = (window.location.hash || "").replace("#", "");
    if (TABS.some((t) => t.id === h)) setTab(h as Tab);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") history.replaceState(null, "", `#${tab}`);
  }, [tab]);

  // Confirm against the server; a 403 here is authoritative.
  useEffect(() => {
    if (!isLoaded || !isLeadDev(user)) return;
    let cancelled = false;
    consoleApi.me().then((r) => {
      if (!cancelled) setAllowed(!!r.success);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  // user is null on the first paint even for the owner (useUser hydrates from
  // localStorage in an effect), so gating on isLeadDev alone would flash a
  // denial at the one person allowed in.
  if (!isLoaded) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-[#050505] pt-28 px-4">
          <div className="mx-auto max-w-7xl animate-pulse space-y-4">
            <div className="h-10 w-56 rounded-xl bg-white/5" />
            <div className="h-64 rounded-2xl bg-white/5" />
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!isLeadDev(user) || allowed === false) {
    // Deliberately says nothing about what lives here.
    return (
      <PageTransition>
        <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <h1 className="text-lg font-black text-white">Page not found</h1>
            <p className="mt-1 text-sm text-slate-500">That page doesn't exist.</p>
            <Link href="/" className={`${BTN} mt-5 inline-block`}>Back home</Link>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      {/* overflow-clip, not overflow-hidden — the latter creates a scroll
          container that kills the md:sticky rail. */}
      <div className="relative min-h-screen overflow-clip bg-[#050505] pt-24 pb-28 text-white md:pb-24">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-[160px]" />
        <div className="pointer-events-none absolute top-64 right-0 h-[420px] w-[420px] translate-x-1/3 rounded-full bg-purple-600/10 blur-[150px]" />

        <div className="relative z-10 mx-auto max-w-7xl px-4">
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <h1 className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-500 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                Console
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Acting as <span className="font-bold text-fuchsia-400">{user?.username}</span> · Lead Dev
                <span className="ml-2 text-slate-600">— every action here is signed with your name.</span>
              </p>
            </div>
            <button
              onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); window.dispatchEvent(new Event("console:refresh")); }}
              className={BTN + " flex items-center gap-2"}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </motion.header>

          <div className="flex flex-col gap-6 md:flex-row">
            {/* Rail */}
            <nav className="md:sticky md:top-24 md:h-fit md:w-56 md:shrink-0">
              <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 md:flex-col md:overflow-visible">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors md:w-full ${
                      tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${tab === id ? "text-fuchsia-400" : ""}`} />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {tab === "users" && <UsersTab toast={toast} meId={user?.id} />}
                  {tab === "economy" && <EconomyTab toast={toast} />}
                  {tab === "ops" && <OpsTab toast={toast} />}
                  {tab === "insights" && <InsightsTab />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/* ─────────────────────────── Users & roles ─────────────────────────── */

function UsersTab({ toast, meId }: { toast: any; meId?: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [danger, setDanger] = useState<null | { kind: "delete" | "leaddev"; target: any }>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await consoleApi.listUsers(`?q=${encodeURIComponent(q)}&perPage=25`);
    setLoading(false);
    if (!r.success) return toast(r.message || "Couldn't load users", "error");
    setRows(r.data?.rows || []);
    setTotal(r.data?.total || 0);
  }, [q, toast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0); // debounce typing
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    const h = () => load();
    window.addEventListener("console:refresh", h);
    return () => window.removeEventListener("console:refresh", h);
  }, [load]);

  async function runDanger(typed: string) {
    if (!danger) return;
    setBusy(true);
    const r =
      danger.kind === "delete"
        ? await consoleApi.deleteUser(danger.target.id, { confirmUsername: typed })
        : await consoleApi.setRole(danger.target.id, { role: "LEAD_DEV", confirmUsername: typed });
    setBusy(false);
    if (!r.success) return toast(r.message || "Action failed", "error");
    toast(danger.kind === "delete" ? `${danger.target.username} deleted.` : `${danger.target.username} is now Lead Dev.`, "success");
    setDanger(null);
    setSelected(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by username or email…"
              className={INPUT + " pl-9"}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-slate-500">{total} users</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No users match “{q}”.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <img src={u.avatar || "/logo.png"} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">{u.username}</span>
                    <RoleChip role={u.role} />
                    {u.id === meId && <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">you</span>}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">{u.email}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-black tabular-nums text-amber-300">{(u.arisePoints ?? 0).toLocaleString()}</span>
                  <span className="block text-[10px] text-slate-600">AP</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <UserDrawer
          user={selected}
          meId={meId}
          toast={toast}
          onClose={() => setSelected(null)}
          onChanged={load}
          onDanger={(kind) => setDanger({ kind, target: selected })}
        />
      )}

      <ConsoleDangerDialog
        open={!!danger}
        busy={busy}
        title={danger?.kind === "delete" ? "Delete this account" : "Promote to Lead Dev"}
        confirmWord={danger?.target?.username || ""}
        confirmLabel={danger?.kind === "delete" ? "Delete forever" : "Promote"}
        body={
          danger?.kind === "delete" ? (
            <>Deletes <b className="text-white">{danger?.target?.username}</b> and everything cascading from them — comments, watchlist, invites they created, point history. This cannot be undone.</>
          ) : (
            <>Gives <b className="text-white">{danger?.target?.username}</b> full Lead Dev powers, including this console. They will be able to change your role.</>
          )
        }
        onConfirm={runDanger}
        onClose={() => setDanger(null)}
      />
    </div>
  );
}

function UserDrawer({ user, meId, toast, onClose, onChanged, onDanger }: any) {
  const [dossier, setDossier] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const isSelf = user.id === meId;

  useEffect(() => {
    consoleApi.dossier(user.id).then((r) => r.success && setDossier(r.data));
  }, [user.id]);

  async function adjust() {
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0) return toast("Enter a whole, non-zero amount.", "error");
    if (!reason.trim()) return toast("A reason is required — it goes on the public ledger.", "error");
    setBusy(true);
    const r = await consoleApi.adjustPoints(user.id, { amount: n, reason: reason.trim(), notify: true });
    setBusy(false);
    if (!r.success) return toast(r.message || "Failed", "error");
    toast(`${n > 0 ? "+" : ""}${n.toLocaleString()} AP → ${user.username}${r.data?.clamped ? " (clamped at 0)" : ""}`, "success");
    setAmount(""); setReason("");
    onChanged();
  }

  async function setRole(role: string) {
    setBusy(true);
    const r = await consoleApi.setRole(user.id, { role });
    setBusy(false);
    if (!r.success) return toast(r.message || "Failed", "error");
    toast(`${user.username} is now ${role}.`, "success");
    onChanged();
  }

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    const r = await consoleApi.notify(user.id, { message: msg.trim() });
    setBusy(false);
    if (!r.success) return toast(r.message || "Failed", "error");
    toast("Notification sent.", "success");
    setMsg("");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={CARD + " space-y-5"}>
      <div className="flex items-start gap-3">
        <img src={user.avatar || "/logo.png"} alt="" className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-black text-white">{user.username}</h3>
            <RoleChip role={user.role} />
          </div>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          {dossier?.user && (
            <p className="mt-1 text-[11px] text-slate-600">
              Joined {new Date(dossier.user.createdAt).toLocaleDateString()} ·{" "}
              {dossier.user._count?.comments ?? 0} comments · {dossier.user._count?.followers ?? 0} followers
            </p>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Arise Points" value={(user.arisePoints ?? 0).toLocaleString()} tint="text-amber-300" />
        <Stat label="XP" value={(user.xp ?? 0).toLocaleString()} />
        <Stat label="Effects" value={user.purchasedEffects?.length ?? 0} />
        <Stat label="Frames" value={user.purchasedFrames?.length ?? 0} />
      </div>

      {/* Arise Points */}
      <div>
        <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Adjust Arise Points</h4>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -250" inputMode="numeric" className={INPUT + " sm:w-40"} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (public on their ledger)" className={INPUT + " flex-1"} />
          <button onClick={adjust} disabled={busy} className={BTN_PRIMARY}>Apply</button>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Negative values clamp at zero. This reason is visible to everyone — keep notes about conduct out of it.
        </p>
      </div>

      {/* Notify */}
      <div>
        <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Send a notification</h4>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} placeholder="Message…" className={INPUT + " flex-1"} />
          <button onClick={send} disabled={busy || !msg.trim()} className={BTN + " flex items-center justify-center gap-2"}>
            <Send className="h-4 w-4" /> Send
          </button>
        </div>
      </div>

      {/* Role */}
      <div>
        <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Role</h4>
        {isSelf ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs text-slate-500">
            You can't change your own role here — a self-demotion would lock you out of this console permanently.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRole("USER")} disabled={busy || user.role === "USER"} className={BTN}>Make User</button>
            <button onClick={() => setRole("ADMIN")} disabled={busy || user.role === "ADMIN"} className={BTN}>Make Admin</button>
            <button onClick={() => onDanger("leaddev")} disabled={busy || user.role === "LEAD_DEV"} className={BTN + " border-fuchsia-500/25 text-fuchsia-300"}>
              Make Lead Dev
            </button>
          </div>
        )}
      </div>

      {/* Danger */}
      {!isSelf && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black text-red-300">
                <ShieldAlert className="h-3.5 w-3.5" /> Danger zone
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">Deletes the account and everything cascading from it.</p>
            </div>
            <button onClick={() => onDanger("delete")} className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20">
              Delete
            </button>
          </div>
        </div>
      )}

      {dossier?.user?.pointLogs?.length > 0 && (
        <div>
          <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Recent points activity</h4>
          <div className="max-h-48 space-y-1 overflow-y-auto custom-scrollbar pr-1">
            {dossier.user.pointLogs.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-1.5">
                <span className={`w-16 shrink-0 text-right text-xs font-black tabular-nums ${l.amount > 0 ? "text-emerald-400" : l.amount < 0 ? "text-red-400" : "text-slate-500"}`}>
                  {l.amount > 0 ? "+" : ""}{l.amount}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{l.reason}</span>
                <span className="shrink-0 text-[10px] text-slate-600">{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────── Economy ─────────────────────────── */

function EconomyTab({ toast }: { toast: any }) {
  const [ov, setOv] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [o, l] = await Promise.all([consoleApi.economyOverview(), consoleApi.ledger(`?q=${encodeURIComponent(q)}&perPage=30`)]);
    if (o.success) setOv(o.data);
    if (l.success) setLedger(l.data?.rows || []);
  }, [q]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("console:refresh", h);
    return () => window.removeEventListener("console:refresh", h);
  }, [load]);

  async function reverse(id: string) {
    const r = await consoleApi.reverseEntry(id, {});
    if (!r.success) return toast(r.message || "Failed", "error");
    toast("Entry reversed.", "success");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In circulation" value={(ov?.circulating ?? 0).toLocaleString()} tint="text-amber-300" />
        <Stat label="Ever minted" value={(ov?.minted ?? 0).toLocaleString()} tint="text-emerald-400" />
        <Stat label="Ever spent" value={(ov?.burned ?? 0).toLocaleString()} tint="text-red-400" />
        <Stat label="Avg / user" value={(ov?.average ?? 0).toLocaleString()} />
      </div>

      {ov?.topHolders?.length > 0 && (
        <div className={CARD}>
          <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Top holders</h4>
          <div className="space-y-1.5">
            {ov.topHolders.map((u: any, i: number) => (
              <div key={u.id} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center text-[11px] font-black text-slate-600">{i + 1}</span>
                <img src={u.avatar || "/logo.png"} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{u.username}</span>
                <RoleChip role={u.role} />
                <span className="shrink-0 text-sm font-black tabular-nums text-amber-300">{u.arisePoints.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className="mb-3 flex items-center gap-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Global ledger</h4>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by reason…" className={INPUT + " ml-auto max-w-xs py-1.5 text-xs"} />
        </div>
        {ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No ledger entries.</p>
        ) : (
          <div className="max-h-[28rem] space-y-1 overflow-y-auto custom-scrollbar pr-1">
            {ledger.map((l) => (
              <div key={l.id} className="group flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <span className={`w-20 shrink-0 text-right text-xs font-black tabular-nums ${l.amount > 0 ? "text-emerald-400" : l.amount < 0 ? "text-red-400" : "text-slate-500"}`}>
                  {l.amount > 0 ? "+" : ""}{l.amount.toLocaleString()}
                </span>
                <span className="w-28 shrink-0 truncate text-[11px] font-bold text-slate-300">{l.user?.username}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{l.reason}</span>
                <span className="shrink-0 text-[10px] text-slate-600">{new Date(l.createdAt).toLocaleDateString()}</span>
                {l.amount !== 0 && (
                  <button onClick={() => reverse(l.id)} title="Reverse this entry" className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-600">
          Reversing appends a compensating entry — it never edits or deletes the original.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Operations ─────────────────────────── */

function OpsTab({ toast }: { toast: any }) {
  const [status, setStatus] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ used: 0, unused: 0 });
  const [count, setCount] = useState("5");
  const [maintDialog, setMaintDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [post, setPost] = useState({ title: "", content: "", tag: "Dev Blog" });

  // Raid drill: readouts live under their buttons, not in a toast, so the
  // result of each call stays visible while you flip to /raid and back.
  const [drillHp, setDrillHp] = useState("1");
  const [drillBusy, setDrillBusy] = useState(false);
  const [hpNote, setHpNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [settleNote, setSettleNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function drillSetHp() {
    const n = Number(drillHp);
    if (!Number.isInteger(n) || n < 1) {
      setHpNote({ ok: false, text: "HP must be a whole number of 1 or more." });
      return;
    }
    setDrillBusy(true);
    setHpNote(null);
    const r = await consoleApi.raidSetHp({ hpLeft: n });
    setDrillBusy(false);
    // Echo the SERVER's number — it clamps to hpMax, so the request value
    // can be one the boss never actually got.
    const setTo = Number(r.data?.hpLeft ?? n);
    setHpNote(
      r.success
        ? { ok: true, text: `Boss HP set to ${setTo.toLocaleString()} on your guild's encounter.` }
        : { ok: false, text: r.message || "Couldn't set the boss HP." }
    );
  }

  async function drillSettle() {
    setDrillBusy(true);
    setSettleNote(null);
    const r = await consoleApi.raidSettleNow();
    setDrillBusy(false);
    setSettleNote(
      r.success
        ? { ok: true, text: "Settled — this week's rewards are paid out." }
        : { ok: false, text: r.message || "Couldn't settle the week." }
    );
  }

  const load = useCallback(async () => {
    const [s, i] = await Promise.all([consoleApi.opsStatus(), consoleApi.listInvites("?perPage=25")]);
    if (s.success) setStatus(s.data);
    if (i.success) { setInvites(i.data?.rows || []); setStats(i.data?.stats || { used: 0, unused: 0 }); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("console:refresh", h);
    return () => window.removeEventListener("console:refresh", h);
  }, [load]);

  async function toggleMaintenance(confirm?: string) {
    setBusy(true);
    const r = await consoleApi.setMaintenance({ enabled: !status?.maintenance, confirm });
    setBusy(false);
    if (!r.success) return toast(r.message || "Failed", "error");
    toast(r.data?.maintenance ? "Site is in maintenance mode." : "Site is live again.", "success");
    setMaintDialog(false);
    load();
  }

  async function makeInvites() {
    const r = await consoleApi.createInvites({ count: Number(count) || 1 });
    if (!r.success) return toast(r.message || "Failed", "error");
    toast(`${r.data?.length ?? 0} invite codes created.`, "success");
    load();
  }

  async function publish() {
    if (!post.title.trim() || !post.content.trim()) return toast("Title and content are required.", "error");
    const r = await consoleApi.publishAnnouncement(post);
    if (!r.success) return toast(r.message || "Failed", "error");
    toast("Published.", "success");
    setPost({ title: "", content: "", tag: "Dev Blog" });
  }

  return (
    <div className="space-y-4">
      {status?.maintenance && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
          <ShieldAlert className="h-4 w-4" /> The site is currently in maintenance mode.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={(status?.users ?? 0).toLocaleString()} />
        <Stat label="DB latency" value={`${status?.dbMs ?? "—"} ms`} tint={status?.dbMs > 400 ? "text-amber-300" : "text-emerald-400"} />
        <Stat label="Uptime" value={status ? `${Math.floor(status.uptimeSec / 60)}m` : "—"} />
        <Stat label="Memory" value={status ? `${status.memoryMb} MB` : "—"} />
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-white">Maintenance mode</h4>
            <p className="text-[11px] text-slate-500">Takes the site down for everyone except you.</p>
          </div>
          <button
            onClick={() => (status?.maintenance ? toggleMaintenance() : setMaintDialog(true))}
            disabled={busy}
            className={status?.maintenance ? BTN_PRIMARY : "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-500/20"}
          >
            {status?.maintenance ? "Bring site back online" : "Enable maintenance"}
          </button>
        </div>
        {status?.secrets && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
            {Object.entries(status.secrets).map(([k, v]) => (
              <span key={k} className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${v ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-red-400/20 bg-red-500/10 text-red-300"}`}>
                {k} {v ? "set" : "missing"}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h4 className="flex items-center gap-2 text-sm font-black text-white"><Swords className="h-4 w-4 text-fuchsia-400" /> Raid Drill</h4>
        <p className="mt-1 text-[11px] text-slate-500">
          Rehearses a full raid week on your own guild&rsquo;s encounter: set the boss HP low, land a real
          killing blow from <Link href="/raid" className="font-bold text-fuchsia-300 hover:underline">/raid</Link>, then settle to pay out.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={drillHp}
            onChange={(e) => setDrillHp(e.target.value)}
            inputMode="numeric"
            className={INPUT + " w-28 py-1.5 text-center text-xs"}
          />
          <button onClick={drillSetHp} disabled={drillBusy} className={BTN}>Set boss HP</button>
        </div>
        {hpNote && (
          <p className={`mt-1.5 text-[11px] ${hpNote.ok ? "text-emerald-400" : "text-red-400"}`}>{hpNote.text}</p>
        )}
        <div className="mt-3 border-t border-white/5 pt-3">
          <button onClick={drillSettle} disabled={drillBusy} className={BTN_PRIMARY}>Settle this week now</button>
          {settleNote && (
            <p className={`mt-1.5 text-[11px] ${settleNote.ok ? "text-emerald-400" : "text-red-400"}`}>{settleNote.text}</p>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-black text-white"><Ticket className="h-4 w-4 text-fuchsia-400" /> Invite codes</h4>
            <p className="text-[11px] text-slate-500">{stats.unused} unused · {stats.used} redeemed</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" className={INPUT + " w-20 py-1.5 text-center text-xs"} />
            <button onClick={makeInvites} className={BTN_PRIMARY + " flex items-center gap-1.5"}><Plus className="h-4 w-4" /> Generate</button>
          </div>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar pr-1">
          {invites.map((iv) => (
            <div key={iv.id} className="group flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
              <code className="shrink-0 font-mono text-xs font-bold tracking-wider text-fuchsia-300">{iv.code}</code>
              {iv.isUsed ? (
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">used by <b className="text-slate-300">{iv.usedByUser?.username || "?"}</b></span>
              ) : (
                <span className="min-w-0 flex-1 text-[11px] text-emerald-400/80">available</span>
              )}
              <span className="shrink-0 text-[10px] text-slate-600">{iv.creator?.username}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(iv.code); toast("Code copied.", "success"); }}
                className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
              ><Copy className="h-3.5 w-3.5" /></button>
              {!iv.isUsed && (
                <button
                  onClick={async () => { const r = await consoleApi.revokeInvite(iv.id); r.success ? (toast("Revoked.", "success"), load()) : toast(r.message || "Failed", "error"); }}
                  className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100"
                ><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h4 className="mb-1 flex items-center gap-2 text-sm font-black text-white"><Megaphone className="h-4 w-4 text-fuchsia-400" /> Publish an update</h4>
        <p className="mb-3 text-[11px] text-amber-300/70">
          Heads up: the deploy seed rebuilds the announcements table, so posts made here vanish on the next
          backend deploy unless they're also added to seed-announcements.ts.
        </p>
        <div className="space-y-2">
          <input value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} placeholder="Title" className={INPUT} />
          <textarea value={post.content} onChange={(e) => setPost({ ...post, content: e.target.value })} rows={5} placeholder="Content…" className={INPUT + " resize-y"} />
          <div className="flex items-center gap-2">
            <input value={post.tag} onChange={(e) => setPost({ ...post, tag: e.target.value })} className={INPUT + " w-40"} />
            <button onClick={publish} className={BTN_PRIMARY + " ml-auto"}>Publish</button>
          </div>
        </div>
      </div>

      <ConsoleDangerDialog
        open={maintDialog}
        busy={busy}
        title="Take the site down"
        confirmWord="MAINTENANCE"
        confirmLabel="Enable maintenance"
        body={<>Every visitor will see the maintenance screen until you turn this back off. Nothing is lost, but the site is unusable while it's on.</>}
        onConfirm={(typed) => toggleMaintenance(typed)}
        onClose={() => setMaintDialog(false)}
      />
    </div>
  );
}

/* ─────────────────────────── Insights ─────────────────────────── */

function InsightsTab() {
  const [d, setD] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [i, a] = await Promise.all([consoleApi.insights(), consoleApi.audit("?perPage=15")]);
    if (i.success) setD(i.data);
    if (a.success) setAudit(a.data?.rows || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("console:refresh", h);
    return () => window.removeEventListener("console:refresh", h);
  }, [load]);

  const peak = Math.max(1, ...(d?.signups || []).map((s: any) => s.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total users" value={(d?.total ?? 0).toLocaleString()} />
        <Stat label="New this week" value={(d?.new7 ?? 0).toLocaleString()} tint="text-emerald-400" />
        <Stat label="New this month" value={(d?.new30 ?? 0).toLocaleString()} />
        <Stat label="Unused invites" value={(d?.invitesUnused ?? 0).toLocaleString()} tint="text-fuchsia-300" />
      </div>

      <div className={CARD}>
        <h4 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <Activity className="h-3.5 w-3.5" /> Signups · last 14 days
        </h4>
        <div className="flex h-32 items-end gap-1">
          {(d?.signups || []).map((s: any) => (
            <div key={s.date} className="group relative flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-gradient-to-t from-purple-600/40 to-fuchsia-500/80 transition-all"
                style={{ height: `${Math.max(3, (s.count / peak) * 100)}%` }}
              />
              <span className="pointer-events-none absolute -top-6 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                {s.count}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-slate-600">
          <span>{d?.signups?.[0]?.date}</span>
          <span>today</span>
        </div>
      </div>

      {d?.roles && (
        <div className={CARD}>
          <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Roles</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(d.roles).map(([role, n]) => (
              <div key={role} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2">
                <span className="text-lg font-black tabular-nums text-white">{n as any}</span>
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={CARD}>
        <h4 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <ScrollText className="h-3.5 w-3.5" /> Recent console activity
        </h4>
        {audit.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <div className="space-y-1">
            {audit.map((a, i) => (
              <div key={a.key || i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <code className="w-48 shrink-0 truncate text-[10px] font-bold text-fuchsia-300">{a.action}</code>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
                  <b className="text-slate-300">{a.actorUsername}</b>
                  {a.targetLabel ? <> → {a.targetLabel}</> : null}
                  {a.note ? <span className="text-slate-600"> · {a.note}</span> : null}
                </span>
                <span className="shrink-0 text-[10px] text-slate-600">{a.at ? new Date(a.at).toLocaleString() : ""}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-600">
          If you see an action here you didn't take, rotate JWT_SECRET on Render immediately — that invalidates every session.
        </p>
      </div>
    </div>
  );
}
