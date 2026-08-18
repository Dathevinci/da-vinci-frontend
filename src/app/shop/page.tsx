"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  Check,
  Diamond,
  Aperture,
  CircleDot,
  Orbit,
  Snowflake,
  Flame,
  Sun,
  Zap,
  Leaf,
  Search,
  X,
  LayoutGrid,
  CloudLightning,
  CloudFog,
  Moon,
  Cog,
  Target,
  Trees,
  Gift,
  Swords,
  Flower2,
  Skull,
  Sprout,
  Eye,
  ArrowRight,
  Infinity as InfinityIcon,
  History,
  Hourglass,
  Atom,
  Shell,
  Tag,
  Key,
  Network,
  Radiation,
  Ghost,
  Ship,
  MountainSnow,
} from "lucide-react";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import LoadingScreen from "@/components/ui/LoadingScreen";
import GiftModal from "@/components/shop/GiftModal";
import BuyPointsModal from "@/components/shop/BuyPointsModal";
import { authHeaders } from "@/lib/authToken";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { cloudinaryFit } from "@/lib/cloudinary";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { isCrimsonChosen, isCrimsonActive, CRIMSON_OFF } from "@/components/profile/CrimsonRealm";

const DEJAVU_ENDS_AT = Date.parse("2026-07-24T23:59:59Z");

const SHOP_ITEMS = [
  // ---- SSS GRADE ----
  {
    id: "effect_outergod",
    type: "effect",
    sss: true,
    discountPercent: 10,
    name: "Outer God: Abyssal Gaze",
    description:
      "「 It has noticed you. 」 A tear in reality rips open behind your avatar — a jagged black wound rimmed in sickly bioluminescent teal, breathing. Colossal appendages writhe out of it, dreadfully slow, lined with pale suckers — and some grow eyes that follow the viewer's cursor. SSS grade. Launch sale — 10% off.",
    price: 6000,
    icon: Shell,
    color: "text-teal-300",
    glow: "shadow-[0_0_26px_rgba(13,148,136,0.75)]",
    gradient: "from-teal-400 via-purple-900 to-fuchsia-600",
  },
  {
    id: "effect_dejavu",
    type: "effect",
    sss: true,
    limited: true,
    endsAt: DEJAVU_ENDS_AT,
    name: "Dejavu: Temporal Echo",
    description:
      "「 …you have read this before, haven't you? 」 LIMITED — 3 days, then it vanishes forever. The card plunges into a psychological void of pitch black and ash grey. A volatile quantum field orbits your avatar with time-dilation rings. SSS grade. Limited.",
    price: 6000,
    icon: History,
    color: "text-slate-200",
    glow: "shadow-[0_0_26px_rgba(139,0,0,0.7)]",
    gradient: "from-slate-100 via-red-900 to-cyan-500",
  },
  {
    id: "effect_hollow",
    type: "effect",
    sss: true,
    name: "Hollow Technique: Purple",
    description:
      "「 Nine Ropes, Polarized Light, Crow and Declaration… 」 The collision of opposites. Cobalt and crimson spheres slam together above your profile, giving birth to a violent violet-magenta singularity with shockwaves and Six-Eyes pulses. SSS grade.",
    price: 6500,
    icon: Atom,
    color: "text-purple-300",
    glow: "shadow-[0_0_26px_rgba(167,36,240,0.75)]",
    gradient: "from-blue-500 via-purple-600 to-red-500",
  },
  {
    id: "effect_himalaya",
    type: "effect",
    sss: true,
    name: "The Silent Himalayas",
    description:
      "Night falls on the roof of the world. Three ranges of moonlit Himalayan peaks rise across the screen while weightless snow drifts down in three layers of depth. Sagarmāthā's silence. SSS grade.",
    price: 8500,
    icon: MountainSnow,
    color: "text-sky-200",
    glow: "shadow-[0_0_26px_rgba(191,219,254,0.7)]",
    gradient: "from-slate-200 via-sky-400 to-slate-800",
  },
  {
    id: "effect_ritual",
    type: "effect",
    sss: true,
    name: "With This Treasure…",
    description:
      "「 With this treasure, I summon— 」 The complete ritual. The world drowns in boiling shadows; the bone-white Eight-Handled Wheel hangs above, snapping with a spray of sparks. SSS grade.",
    price: 8500,
    icon: Target,
    color: "text-slate-100",
    glow: "shadow-[0_0_26px_rgba(255,255,255,0.75)]",
    gradient: "from-slate-100 via-slate-500 to-black",
  },
  {
    id: "effect_void",
    type: "effect",
    sss: true,
    name: "Domain Expansion: Infinite Void",
    description:
      "「 Throughout Heaven and Earth, I alone am the honored one. 」 A barrier of blinding starlight seals the viewer inside the domain. Behind you, a colossal cosmic eye opens as pure information freezes mid-air. SSS grade.",
    price: 7500,
    icon: InfinityIcon,
    color: "text-cyan-300",
    glow: "shadow-[0_0_26px_rgba(103,232,249,0.7)]",
    gradient: "from-white via-cyan-400 to-indigo-950",
  },
  {
    id: "effect_unblinking",
    type: "effect",
    sss: true,
    name: "The Unblinking",
    description:
      "A page torn from a cursed manuscript. A colossal hand-drawn eye follows the viewer's cursor, blinking, while skeletal hands and slash marks tear through the dark. SSS grade.",
    price: 7000,
    icon: Eye,
    color: "text-neutral-200",
    glow: "shadow-[0_0_26px_rgba(139,0,0,0.7)]",
    gradient: "from-neutral-200 via-neutral-600 to-red-950",
  },
  {
    id: "effect_portal",
    type: "effect",
    sss: true,
    name: "Dimension C-137",
    description:
      "「 Twenty minutes of adventure, in and out. 」 An interdimensional portal tears open with churning acid fluid, toxic green bubbles, multiverse rocks, and reality glitch slicing. SSS grade.",
    price: 8000,
    icon: Radiation,
    color: "text-lime-300",
    glow: "shadow-[0_0_26px_rgba(57,255,20,0.7)]",
    gradient: "from-lime-300 via-green-500 to-fuchsia-500",
  },
  {
    id: "effect_bankai",
    type: "effect",
    sss: true,
    name: "Bankai: Senbonzakura Kageyoshi",
    description:
      "「 Scatter. 」 A lone katana falls dead-vertical into the dark, six monolithic ghost-blades rise, and shatter into thousands of glowing sakura petals. SSS grade.",
    price: 16000,
    icon: Swords,
    color: "text-pink-300",
    glow: "shadow-[0_0_26px_rgba(255,20,147,0.7)]",
    gradient: "from-slate-200 via-pink-400 to-fuchsia-600",
  },
  {
    id: "effect_dandadan",
    type: "effect",
    sss: true,
    name: "Dandadan: The Turbo Clash",
    description:
      "Warzone between two realities: toxic-green abduction beams meet viscous cursed ink and a dual-tone alien fire aura. SSS grade.",
    price: 14000,
    icon: Ghost,
    color: "text-fuchsia-400",
    glow: "shadow-[0_0_26px_rgba(255,0,255,0.7)]",
    gradient: "from-lime-300 via-cyan-400 to-fuchsia-500",
  },
  {
    id: "effect_grandline",
    type: "effect",
    sss: true,
    name: "The Grand Line",
    description:
      "「 I’m going to be King of the Pirates! 」 A four-layer procedural ocean at golden hour with a hand-drawn mahogany galleon on true buoyancy physics, wanted poster ring, and orbiting ฿ Berri marks. SSS grade.",
    price: 15000,
    icon: Ship,
    color: "text-amber-400",
    glow: "shadow-[0_0_26px_rgba(255,183,71,0.7)]",
    gradient: "from-amber-300 via-orange-400 to-cyan-500",
  },
  {
    id: "effect_webslinger",
    type: "effect",
    sss: true,
    name: "The Web-Slinger",
    description:
      "High-tension interactive web mechanics. Stretched titanium-white silk strands, glowing cyan haze, and reactive spidey-sense pulses. SSS grade.",
    price: 7000,
    icon: Network,
    color: "text-cyan-200",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.7)]",
    gradient: "from-slate-100 via-cyan-500 to-red-600",
  },

  // ---- EXTREME RARE ----
  {
    id: "effect_jungle",
    type: "effect",
    rare: true,
    name: "The Ancient Jungle",
    description: "Deep humid jungle floor with golden god rays, fireflies, Monstera leaves, and living vines. Extreme rare.",
    price: 3800,
    icon: Sprout,
    color: "text-emerald-400",
    glow: "shadow-[0_0_24px_rgba(31,107,56,0.8)]",
    gradient: "from-emerald-500 via-green-700 to-yellow-700",
  },
  {
    id: "effect_mango",
    type: "effect",
    rare: true,
    name: "Mango Loco",
    description: "Día de los Muertos fiesta with marigold wreaths, sugar skulls, and vibrant splash effects. Extreme rare.",
    price: 3800,
    icon: Skull,
    color: "text-orange-400",
    glow: "shadow-[0_0_24px_rgba(255,140,0,0.8)]",
    gradient: "from-orange-400 via-pink-500 to-lime-500",
  },
  {
    id: "effect_lotus",
    type: "effect",
    rare: true,
    name: "The Sacred Lotus Pond",
    description: "Sacred lotus pond with rippling crystal water, dancing fireflies, and blooming lilies. Extreme rare.",
    price: 3600,
    icon: Flower2,
    color: "text-emerald-300",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.7)]",
    gradient: "from-pink-300 via-emerald-500 to-teal-800",
  },
  {
    id: "effect_samurai",
    type: "effect",
    rare: true,
    name: "The Ghost Samurai",
    description: "Spectral katana, lightning-fast iaijutsu slashes, and drifting sakura petals. Extreme rare.",
    price: 3600,
    icon: Swords,
    color: "text-red-400",
    glow: "shadow-[0_0_24px_rgba(220,38,38,0.8)]",
    gradient: "from-slate-300 via-red-600 to-stone-950",
  },
  {
    id: "effect_mahoraga",
    type: "effect",
    rare: true,
    name: "Wheel of Adaptation",
    description: "Eight-Handled Wheel turning with heavy metallic gold aura and adaptation shockwaves. Extreme rare.",
    price: 2600,
    icon: Cog,
    color: "text-amber-300",
    glow: "shadow-[0_0_24px_rgba(255,215,0,0.8)]",
    gradient: "from-amber-300 via-yellow-600 to-stone-900",
  },
  {
    id: "effect_tempest",
    type: "effect",
    rare: true,
    name: "Monarch's Tempest",
    description: "Cel-shaded thundercloud, lightning arcs, and pouring parallax storm. Extreme rare.",
    price: 2400,
    icon: CloudLightning,
    color: "text-sky-300",
    glow: "shadow-[0_0_24px_rgba(56,189,248,0.8)]",
    gradient: "from-sky-400 via-purple-600 to-slate-800",
  },
  {
    id: "effect_blackhole",
    type: "effect",
    rare: true,
    name: "Event Horizon",
    description: "Deep space black hole accretion disk with spiral galaxy stars. Extreme rare.",
    price: 2400,
    icon: Orbit,
    color: "text-orange-400",
    glow: "shadow-[0_0_24px_rgba(255,100,0,0.8)]",
    gradient: "from-orange-500 via-purple-500 to-black",
  },
  {
    id: "effect_fool",
    type: "effect",
    rare: true,
    name: "Fog of History",
    description: "Endless Grey Fog, Tarot Club crimson stars, and silver spirit threads. Extreme rare.",
    price: 2000,
    icon: CloudFog,
    color: "text-slate-300",
    glow: "shadow-[0_0_24px_rgba(203,213,225,0.7)]",
    gradient: "from-slate-400 via-slate-600 to-amber-700",
  },
  {
    id: "effect_evernight",
    type: "effect",
    rare: true,
    name: "Evernight's Blessing",
    description: "Crimson Moon, River of Eternal Darkness, and drifting night-vanilla blossoms. Extreme rare.",
    price: 2200,
    icon: Moon,
    color: "text-rose-300",
    glow: "shadow-[0_0_24px_rgba(244,63,94,0.7)]",
    gradient: "from-rose-400 via-rose-800 to-slate-900",
  },
  {
    id: "effect_ascension",
    type: "effect",
    rare: true,
    name: "Voltaic Ascension",
    description: "Amethyst lightning storm with violet smoke and glowing aura. Extreme rare.",
    price: 1600,
    icon: Zap,
    color: "text-purple-300",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.8)]",
    gradient: "from-fuchsia-500 via-purple-500 to-purple-700",
  },

  // ---- FRAMES ----
  {
    id: "frame_amethyst",
    type: "frame",
    name: "Amethyst Halo",
    description: "A violet-and-magenta ring that rotates around your avatar everywhere.",
    price: 90,
    icon: Aperture,
    color: "text-purple-400",
    glow: "shadow-[0_0_15px_rgba(192,132,252,0.5)]",
    gradient: "from-purple-500 to-fuchsia-600",
  },
  {
    id: "frame_gold",
    type: "frame",
    name: "Golden Aureole",
    description: "A ring of molten gold that rotates around your avatar.",
    price: 110,
    icon: CircleDot,
    color: "text-amber-400",
    glow: "shadow-[0_0_15px_rgba(251,191,36,0.5)]",
    gradient: "from-amber-400 to-orange-600",
  },
  {
    id: "frame_ember",
    type: "frame",
    name: "Ember Crown",
    description: "A slowly spinning ring of fire — gold, orange, and crimson.",
    price: 100,
    icon: Flame,
    color: "text-red-500",
    glow: "shadow-[0_0_15px_rgba(239,68,68,0.5)]",
    gradient: "from-orange-500 to-red-600",
  },
  {
    id: "frame_frost",
    type: "frame",
    name: "Frost Sigil",
    description: "A rotating ring of icy cyan and sapphire light.",
    price: 100,
    icon: Snowflake,
    color: "text-cyan-400",
    glow: "shadow-[0_0_15px_rgba(34,211,238,0.5)]",
    gradient: "from-cyan-400 to-blue-600",
  },
  {
    id: "frame_verdant",
    type: "frame",
    name: "Verdant Ring",
    description: "A spinning ring of emerald and jade that blooms around your avatar.",
    price: 90,
    icon: Orbit,
    color: "text-emerald-400",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]",
    gradient: "from-emerald-400 to-teal-600",
  },

  // ---- STANDARD EFFECTS ----
  {
    id: "effect_gateway",
    type: "effect",
    unique: true,
    badge: "🗝️",
    name: "The Gate & The Key",
    description: "Four-dimensional wireframe tesseract with turning golden light geometry.",
    price: 4500,
    icon: Key,
    color: "text-violet-300",
    glow: "shadow-[0_0_26px_rgba(138,43,226,0.75)]",
    gradient: "from-violet-400 via-purple-900 to-amber-400",
  },
  {
    id: "effect_canopy",
    type: "effect",
    unique: true,
    badge: "🌿",
    name: "Heart of the Forest",
    description: "Knotted wooden branches, living vines, blooming teal flowers, and god rays.",
    price: 3200,
    icon: Trees,
    color: "text-emerald-300",
    glow: "shadow-[0_0_22px_rgba(16,185,129,0.7)]",
    gradient: "from-emerald-300 via-green-600 to-amber-900",
  },
  {
    id: "effect_froggie",
    type: "effect",
    unique: true,
    name: "Froggie Frenzy",
    description: "A tiny froggie that hops around your avatar with lily pads and pond bubbles.",
    price: 400,
    icon: Leaf,
    color: "text-emerald-300",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.6)]",
    gradient: "from-emerald-400 to-lime-500",
  },
  {
    id: "effect_aura",
    type: "effect",
    name: "Ethereal Aura",
    description: "A pulsing violet glow breathes around your avatar everywhere.",
    price: 110,
    icon: Sun,
    color: "text-fuchsia-400",
    glow: "shadow-[0_0_15px_rgba(217,70,239,0.5)]",
    gradient: "from-fuchsia-400 to-purple-600",
  },
  {
    id: "effect_sparkles",
    type: "effect",
    name: "Astral Dust",
    description: "Golden sparkles drift and twinkle around your avatar.",
    price: 100,
    icon: Sparkles,
    color: "text-yellow-300",
    glow: "shadow-[0_0_15px_rgba(253,224,71,0.5)]",
    gradient: "from-yellow-300 to-yellow-600",
  },
  {
    id: "effect_snow",
    type: "effect",
    name: "Winter's Veil",
    description: "Snowflakes fall gently around your avatar.",
    price: 90,
    icon: Snowflake,
    color: "text-sky-300",
    glow: "shadow-[0_0_15px_rgba(125,211,252,0.5)]",
    gradient: "from-sky-300 to-blue-500",
  },
  {
    id: "effect_embers",
    type: "effect",
    name: "Cinder Storm",
    description: "Glowing embers rise smoothly around your avatar.",
    price: 90,
    icon: Flame,
    color: "text-orange-400",
    glow: "shadow-[0_0_15px_rgba(251,146,60,0.5)]",
    gradient: "from-orange-400 to-red-600",
  },
];

const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
};

function useLiveClock(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function DropCountdown({ endsAt }: { endsAt: number }) {
  const now = useLiveClock();
  return now !== null ? (
    <span>
      Vanishes in <span className="font-mono tabular-nums text-red-200">{fmtLeft(endsAt - now)}</span>
    </span>
  ) : (
    <span>Limited drop — 3 days only</span>
  );
}

const finalPrice = (item: { price: number } & Record<string, any>) => {
  const off = (item as any).discountPercent as number | undefined;
  return off ? Math.round(item.price * (1 - off / 100)) : item.price;
};

export default function ShopPage() {
  const { user, updateProfile, isLoaded } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<typeof SHOP_ITEMS[0] | null>(null);
  const [previewItem, setPreviewItem] = useState<typeof SHOP_ITEMS[0] | null>(null);
  const [showBuyPoints, setShowBuyPoints] = useState(false);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [owned, setOwned] = useState<"all" | "unowned" | "owned">("all");
  const [nowTs, setNowTs] = useState<number | null>(null);

  useEffect(() => {
    setNowTs(Date.now());
  }, []);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  const applyNewBalance = (newAP: number | null) => {
    if (typeof newAP !== "number") return;
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      u.arisePoints = newAP;
      localStorage.setItem("davinci_user", JSON.stringify(u));
      window.dispatchEvent(new Event("davinci_user_updated"));
    } catch {}
  };

  const INVENTORY_FIELD: Record<string, string> = {
    role: "purchasedRoles",
    tag: "purchasedTags",
    theme: "purchasedThemes",
    color: "purchasedColors",
    font: "purchasedFonts",
    effect: "purchasedEffects",
    frame: "purchasedFrames",
  };

  const applyPurchase = (itemId: string, type: string, newAP: number | null) => {
    try {
      const stored = localStorage.getItem("davinci_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      if (typeof newAP === "number") u.arisePoints = newAP;
      const f = INVENTORY_FIELD[type];
      if (f) u[f] = Array.from(new Set([...(Array.isArray(u[f]) ? u[f] : []), itemId]));
      localStorage.setItem("davinci_user", JSON.stringify(u));
      window.dispatchEvent(new Event("davinci_user_updated"));
    } catch {}
  };

  if (!isLoaded) return <LoadingScreen message="Loading shop" />;
  if (!user) return null;

  const getInventoryArray = (type: string) => {
    switch (type) {
      case "role":
        return user.purchasedRoles || [];
      case "tag":
        return user.purchasedTags || [];
      case "theme":
        return user.purchasedThemes || [];
      case "color":
        return user.purchasedColors || [];
      case "font":
        return user.purchasedFonts || [];
      case "effect":
        return user.purchasedEffects || [];
      case "frame":
        return user.purchasedFrames || [];
      default:
        return [];
    }
  };

  const getActiveField = (type: string) => {
    switch (type) {
      case "role":
        return user.activeRole;
      case "tag":
        return user.activeTag;
      case "theme":
        return user.activeTheme;
      case "color":
        return user.activeColor;
      case "font":
        return user.activeFont;
      case "effect":
        return user.activeEffect;
      case "frame":
        return user.activeFrame;
      default:
        return null;
    }
  };

  const handlePurchase = async (item: typeof SHOP_ITEMS[0]) => {
    const endsAt = (item as any).endsAt as number | undefined;
    if (endsAt && Date.now() > endsAt) {
      return toast("This limited item's window has closed.", "error");
    }

    const isGod = isAdmin(user);
    if (!isGod && (user.arisePoints || 0) < finalPrice(item)) {
      return toast("Not enough Arise Points!", "error");
    }

    setBuyingId(item.id);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/purchase`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId: user.id, itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "Purchase failed", "error");
        return;
      }
      applyPurchase(item.id, item.type, typeof data.arisePoints === "number" ? data.arisePoints : null);
      toast(`Successfully unlocked ${item.name}!`, "success");
    } catch (err) {
      toast("Purchase failed", "error");
    } finally {
      setBuyingId(null);
    }
  };

  const handleToggle = async (item: typeof SHOP_ITEMS[0], isEquipping: boolean) => {
    const updatePayload: any = {};
    const val = isEquipping ? item.id : null;
    switch (item.type) {
      case "role":
        updatePayload.activeRole = val;
        break;
      case "tag":
        updatePayload.activeTag = val;
        break;
      case "theme":
        updatePayload.activeTheme = val;
        break;
      case "color":
        updatePayload.activeColor = val;
        break;
      case "font":
        updatePayload.activeFont = val;
        break;
      case "effect":
        updatePayload.activeEffect = val;
        break;
      case "frame":
        updatePayload.activeFrame = val;
        break;
    }

    try {
      await updateProfile(updatePayload);
      toast(`${isEquipping ? "Equipped" : "Unequipped"} ${item.name}`, "success");
    } catch (err) {
      toast("Failed to toggle item", "error");
    }
  };

  const COLLECTIONS = [
    {
      key: "jujutsu",
      title: "The Sorcery Collection",
      blurb: "Domains, cursed techniques, and pure imaginary mass.",
      ids: ["effect_void", "effect_hollow", "effect_mahoraga", "effect_ritual"],
    },
    {
      key: "mysteries",
      title: "The Mysteries Collection",
      blurb: "Grey fog, borrowed divinity, and the pathways between them.",
      ids: ["effect_fool", "effect_evernight"],
    },
    {
      key: "nature",
      title: "The Wild Collection",
      blurb: "Mountains, canopies, and still water.",
      ids: ["effect_himalaya", "effect_jungle", "effect_lotus", "effect_canopy"],
    },
    {
      key: "cosmic",
      title: "The Cosmic Collection",
      blurb: "Gravity, lightning, and the dark between stars.",
      ids: ["effect_blackhole", "effect_ascension", "effect_unblinking"],
    },
  ] as const;

  const collectionItems = (key: string) => {
    const set = COLLECTIONS.find((c) => c.key === key);
    if (!set) return [];
    return set.ids.map((id) => SHOP_ITEMS.find((it) => it.id === id)).filter(Boolean) as typeof SHOP_ITEMS;
  };

  const SECTIONS = [
    { key: "sss", title: "SSS Grade", blurb: "Mythic cosmetics with full-screen profile phenomena." },
    { key: "rare", title: "Extreme Rare", blurb: "Rare animated powers that transform your entire profile." },
    { key: "frame", title: "Avatar Frames", blurb: "Rotating animated rings that wrap your avatar everywhere." },
    { key: "effect", title: "Avatar Effects", blurb: "Particle auras and animated profile flourishes." },
    ...COLLECTIONS.map((c) => ({ key: c.key, title: c.title, blurb: c.blurb })),
  ];

  const sectionItems = (key: string) =>
    COLLECTIONS.some((c) => c.key === key)
      ? collectionItems(key)
      : key === "sss"
      ? SHOP_ITEMS.filter((it) => (it as any).sss)
      : key === "rare"
      ? SHOP_ITEMS.filter((it) => (it as any).rare && !(it as any).sss)
      : SHOP_ITEMS.filter((it) => it.type === key && !(it as any).rare && !(it as any).sss);

  const matchesFilters = (item: typeof SHOP_ITEMS[0]) => {
    const q = query.trim().toLowerCase();
    if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
    const has = getInventoryArray(item.type).includes(item.id);
    if (owned === "owned" && !has) return false;
    if (owned === "unowned" && has) return false;
    return true;
  };

  const sectionData = SECTIONS.filter((s) =>
    category === "all" ? !COLLECTIONS.some((c) => c.key === s.key) : s.key === category
  ).map((s) => ({
    ...s,
    items: sectionItems(s.key).filter(matchesFilters),
  }));

  const shownCount = sectionData.reduce((n, s) => n + s.items.length, 0);

  const TABS = [
    { key: "all", label: "All Items", icon: LayoutGrid, count: SHOP_ITEMS.length },
    { key: "sss", label: "SSS Grade", icon: Target, count: sectionItems("sss").length },
    { key: "rare", label: "Extreme Rare", icon: Zap, count: sectionItems("rare").length },
    { key: "frame", label: "Frames", icon: Aperture, count: sectionItems("frame").length },
    { key: "effect", label: "Effects", icon: Sparkles, count: sectionItems("effect").length },
    ...COLLECTIONS.map((c) => ({
      key: c.key as string,
      label: c.title.replace(/^The\s+|\s+Collection$/g, ""),
      icon: Gift,
      count: collectionItems(c.key).length,
    })).filter((t) => t.count > 0),
  ];

  const equippedItems = SHOP_ITEMS.filter((it) => getActiveField(it.type) === it.id);

  const renderCard = (item: typeof SHOP_ITEMS[0], i: number) => {
    const hasItem = getInventoryArray(item.type).includes(item.id);
    const isActive = getActiveField(item.type) === item.id;
    const isSSS = !!(item as any).sss;
    const isRare = !isSSS && !!(item as any).rare;
    const isUnique = !isSSS && !isRare && !!(item as any).unique;
    const off = (item as any).discountPercent as number | undefined;
    const salePrice = finalPrice(item);
    const canAfford = isAdmin(user) || (user.arisePoints || 0) >= salePrice;
    const isLimited = !!(item as any).limited;
    const endsAt = (item as any).endsAt as number | undefined;
    const msLeft = endsAt && nowTs !== null ? endsAt - nowTs : null;
    const isExpired = msLeft !== null && msLeft <= 0;

    const rarityBadge = isSSS
      ? "bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 text-black font-black"
      : isRare
      ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold"
      : isUnique
      ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-bold"
      : "bg-white/10 text-white/80 font-bold border border-white/10";

    return (
      <div
        key={item.id}
        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
          isActive
            ? "border-violet-400/60 bg-[#0e0e18] ring-1 ring-violet-400/40 shadow-lg shadow-violet-950/20"
            : isSSS
            ? "border-amber-400/30 bg-gradient-to-b from-amber-950/20 via-[#0b0b11] to-[#0b0b11] hover:border-amber-400/60"
            : isRare
            ? "border-purple-500/25 bg-gradient-to-b from-purple-950/20 via-[#0b0b11] to-[#0b0b11] hover:border-purple-400/50"
            : "border-white/10 bg-[#0b0b11] hover:border-violet-400/40 hover:bg-[#0e0e16]"
        }`}
      >
        {/* Preview Tap Zone */}
        <button
          onClick={() => setPreviewItem(item)}
          className="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden text-left"
          title={`Click to preview ${item.name}`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-15 transition-opacity duration-300 group-hover:opacity-25`} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.8)_100%)]" />

          {/* Badges */}
          <div className="absolute left-3 top-3 z-20 flex flex-col gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${rarityBadge}`}>
              {isSSS ? "★ SSS Grade" : isRare ? "✦ Rare" : isUnique ? "Unique" : item.type}
            </span>
            {off && (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/40 bg-teal-950/80 px-2 py-0.5 text-[9px] font-bold uppercase text-teal-300">
                <Tag className="h-2.5 w-2.5" /> -{off}%
              </span>
            )}
          </div>

          {hasItem && (
            <span className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
              <Check className="h-2.5 w-2.5" /> Owned
            </span>
          )}

          {/* Avatar Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 transition-transform duration-300 group-hover:scale-105">
              <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-violet-700 text-xl font-bold text-white shadow-md">
                {user.avatar ? (
                  <img src={cloudinaryFit(user.avatar, 200)} alt="" className="h-full w-full object-cover" />
                ) : (
                  user.username?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <AvatarDecoration
                frame={item.type === "frame" ? item.id : null}
                effect={item.type === "effect" ? item.id : null}
                size="sm"
              />
            </div>
          </div>
        </button>

        {/* Limited countdown ticker */}
        {isLimited && (
          <div className="border-y border-red-800/30 bg-red-950/40 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-red-300 flex items-center justify-center gap-1">
            <Hourglass className="h-2.5 w-2.5" />
            {isExpired ? <span>Window Closed</span> : endsAt ? <DropCountdown endsAt={endsAt} /> : <span>Limited Drop</span>}
          </div>
        )}

        {/* Card Body */}
        <div className="flex flex-1 flex-col justify-between p-3.5 gap-2.5 font-mono">
          <div>
            <h3 title={item.name} className="truncate text-xs sm:text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
              {item.name}
            </h3>
            <p className="line-clamp-2 text-[10px] text-white/40 mt-1 leading-relaxed">
              {item.description}
            </p>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {!hasItem ? (
              isExpired ? (
                <button
                  disabled
                  className="flex h-8 flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[10px] font-bold text-white/30"
                >
                  Vanished
                </button>
              ) : canAfford ? (
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={buyingId === item.id}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 text-[11px] font-bold text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/25"
                >
                  {buyingId === item.id ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <Diamond className="h-3 w-3 text-violet-300" />
                      {off && <s className="mr-0.5 text-[9px] text-violet-200/50">{item.price.toLocaleString()}</s>}
                      <span>{salePrice.toLocaleString()} AP</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setShowBuyPoints(true)}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/20"
                >
                  <Diamond className="h-3 w-3 text-amber-300" /> {salePrice.toLocaleString()} · Top Up
                </button>
              )
            ) : (
              <button
                onClick={() => handleToggle(item, !isActive)}
                className={`flex h-8 flex-1 items-center justify-center rounded-xl border text-[11px] font-bold transition ${
                  isActive
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                }`}
              >
                {isActive ? "Unequip" : "Equip"}
              </button>
            )}

            <button
              onClick={() => !isExpired && setGiftTarget(item)}
              disabled={isExpired}
              title="Gift to a friend"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 hover:border-violet-400/40 hover:text-white transition"
            >
              <Gift className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#09090b] px-4 pb-36 pt-24 font-mono text-white">
        {/* Subtle Top Ambient Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_60%_80%_at_50%_-10%,rgba(139,92,246,0.18),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-7xl space-y-8">
          
          {/* ── HEADER ── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.42em] text-violet-400/80">Da Vinci · Cosmetic Vault</p>
              <h1 className="mt-1 flex items-center gap-3 font-fell text-4xl sm:text-5xl font-bold uppercase tracking-[0.08em] text-white">
                <ShoppingBag className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-violet-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]" />
                Arise Shop
              </h1>
              <p className="mt-1 text-xs text-white/50">Exclusive animated frames and SSS profile effects that follow you everywhere.</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 items-center gap-2 rounded-full border border-violet-400/30 bg-violet-950/40 px-4 shadow-inner">
                <Diamond className="h-4 w-4 text-violet-300" />
                <span className="text-sm font-bold text-white">
                  {isLeadDev(user) ? "∞ AP" : `${displayArisePoints(user)} AP`}
                </span>
              </div>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-violet-400/40 bg-violet-600 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Diamond className="h-3.5 w-3.5" /> Buy Points
              </button>
            </div>
          </div>

          {/* ── FEATURED HERO DROP ── */}
          {(() => {
            const hero = SHOP_ITEMS.find((it) => it.id === "effect_outergod") || SHOP_ITEMS[0];
            const hOwned = getInventoryArray(hero.type).includes(hero.id);
            const hActive = getActiveField(hero.type) === hero.id;
            const hOff = (hero as any).discountPercent as number | undefined;
            const hPrice = finalPrice(hero);

            return (
              <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-[#041614] via-[#09090f] to-[#140615] p-6 sm:p-8 shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
                  <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0">
                    <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-teal-400/40 bg-teal-950 text-2xl font-bold text-white shadow-xl">
                      {user.avatar ? (
                        <img src={cloudinaryFit(user.avatar, 300)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        user.username?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <AvatarDecoration frame={null} effect={hero.id} size="lg" />
                  </div>

                  <div className="flex-1 text-center md:text-left min-w-0">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                      <span className="rounded-full bg-gradient-to-r from-teal-300 to-amber-300 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                        ★ SSS Grade · Featured
                      </span>
                      {hOff && (
                        <span className="rounded-full border border-teal-400/40 bg-teal-950/80 px-2.5 py-0.5 text-[9px] font-bold text-teal-300">
                          -{hOff}% Launch Deal
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider text-white">
                      {hero.name}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-white/50 max-w-xl leading-relaxed">
                      {hero.description}
                    </p>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                    <div className="flex items-baseline gap-2">
                      {hOff && <s className="text-xs text-white/40">{hero.price.toLocaleString()}</s>}
                      <span className="text-2xl font-bold text-teal-300">{hPrice.toLocaleString()}</span>
                      <span className="text-xs text-white/40 font-bold">AP</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewItem(hero)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-bold text-white hover:bg-white/[0.08] transition"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      {hOwned ? (
                        <button
                          onClick={() => handleToggle(hero, !hActive)}
                          className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-5 text-xs font-bold transition ${
                            hActive
                              ? "border-red-500/30 bg-red-500/15 text-red-300"
                              : "border-teal-400/40 bg-teal-500/20 text-teal-200"
                          }`}
                        >
                          {hActive ? "Unequip" : "Equip"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(hero)}
                          disabled={buyingId === hero.id}
                          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-teal-400/40 bg-teal-500/20 px-5 text-xs font-bold text-teal-200 hover:bg-teal-500/30 transition shadow-lg"
                        >
                          <Diamond className="h-3.5 w-3.5" /> Unlock
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── EQUIPPED NOW RIBBON ── */}
          {equippedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Equipped:</span>
              {equippedItems.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-950/40 px-3 py-1 text-xs font-bold text-violet-200"
                >
                  <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${it.gradient}`} />
                  {it.name}
                  <button
                    onClick={() => handleToggle(it, false)}
                    title={`Unequip ${it.name}`}
                    className="text-white/40 hover:text-red-400 transition ml-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ── SEARCH & CATEGORY TOOLBAR ── */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search frames, effects, cosmetics..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/[0.03] pl-11 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/40 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Ownership Segmented Pills */}
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 shrink-0">
                {[
                  { key: "all", label: "Everything" },
                  { key: "unowned", label: "Available" },
                  { key: "owned", label: "Owned" },
                ].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setOwned(o.key as any)}
                    className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                      owned === o.key
                        ? "border border-violet-400/40 bg-violet-500/20 text-violet-200"
                        : "text-white/40 hover:text-white/80"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => {
                const TabIcon = t.icon;
                const active = category === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setCategory(t.key)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide transition ${
                      active
                        ? "border-violet-400/40 bg-violet-500/20 text-violet-200 shadow-sm"
                        : "border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                    }`}
                  >
                    <TabIcon className={`h-3.5 w-3.5 ${active ? "text-violet-300" : "text-white/40"}`} />
                    <span>{t.label}</span>
                    <span className="text-[10px] opacity-60">({t.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CARD SECTIONS ── */}
          {shownCount === 0 ? (
            <div className="py-20 text-center rounded-2xl border border-white/10 bg-[#0b0b11]">
              <Sparkles className="mx-auto h-8 w-8 text-white/20" />
              <p className="mt-3 text-sm font-bold text-white/50">No cosmetics match your filters.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setOwned("all");
                }}
                className="mt-3 text-xs font-bold text-violet-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            sectionData.map((section) => {
              const items = section.items;
              if (items.length === 0) return null;
              return (
                <div key={section.key} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div>
                      <h2 className="font-fell text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
                        {section.title}
                      </h2>
                      <p className="text-xs text-white/40">{section.blurb}</p>
                    </div>
                    <span className="text-xs font-bold text-violet-400">{items.length} items</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {items.map((item, i) => renderCard(item, i))}
                  </div>
                </div>
              );
            })
          )}

        </div>
      </div>

      {/* ── LIVE PREVIEW MODAL ── */}
      {previewItem &&
        createPortal(
          (() => {
            const pv = previewItem;
            const pOwned = getInventoryArray(pv.type).includes(pv.id);
            const pActive = getActiveField(pv.type) === pv.id;
            const pPrice = finalPrice(pv);
            const canBuy = isAdmin(user) || (user.arisePoints || 0) >= pPrice;

            return (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPreviewItem(null)} />

                <div className="relative z-10 flex w-full max-w-3xl flex-col md:flex-row overflow-hidden rounded-3xl border border-white/15 bg-[#0b0b11] shadow-2xl font-mono">
                  {/* Left Mock Profile */}
                  <div className="relative h-64 md:h-auto md:w-1/2 flex items-center justify-center bg-gradient-to-b from-[#161622] to-[#0b0b11] overflow-hidden p-6 border-b md:border-b-0 md:border-r border-white/10">
                    {pv.type === "effect" && <ProfileEffect effect={pv.id} />}

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative h-24 w-24 sm:h-28 sm:w-28">
                        <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-violet-700 text-2xl font-bold text-white shadow-xl">
                          {user.avatar ? (
                            <img src={cloudinaryFit(user.avatar, 300)} alt="" className="h-full w-full object-cover" />
                          ) : (
                            user.username?.[0]?.toUpperCase() || "?"
                          )}
                        </div>
                        <AvatarDecoration
                          frame={pv.type === "frame" ? pv.id : null}
                          effect={pv.type === "effect" ? pv.id : null}
                          size="lg"
                        />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">{user.username}</p>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">Live Profile Preview</span>
                    </div>
                  </div>

                  {/* Right Details */}
                  <div className="p-6 md:w-1/2 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                          {pv.type}
                        </span>
                        <button
                          onClick={() => setPreviewItem(null)}
                          className="text-white/40 hover:text-white transition"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <h3 className="mt-1 text-xl font-bold text-white">{pv.name}</h3>
                      <p className="mt-2 text-xs text-white/60 leading-relaxed">{pv.description}</p>
                    </div>

                    <div className="border-t border-white/10 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40 font-bold uppercase">Price</span>
                        <div className="flex items-center gap-1.5 text-base font-bold text-white">
                          <Diamond className="h-4 w-4 text-violet-300" />
                          {pPrice.toLocaleString()} AP
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!pOwned ? (
                          canBuy ? (
                            <button
                              onClick={() => {
                                handlePurchase(pv);
                                setPreviewItem(null);
                              }}
                              disabled={buyingId === pv.id}
                              className="flex-1 rounded-full border border-violet-400/40 bg-violet-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-violet-500 transition shadow-lg"
                            >
                              Acquire Now
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setPreviewItem(null);
                                setShowBuyPoints(true);
                              }}
                              className="flex-1 rounded-full border border-amber-400/40 bg-amber-500/20 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/30 transition"
                            >
                              Top Up AP
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              handleToggle(pv, !pActive);
                              setPreviewItem(null);
                            }}
                            className={`flex-1 rounded-full border py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                              pActive
                                ? "border-red-500/40 bg-red-500/20 text-red-300"
                                : "border-violet-400/40 bg-violet-600 text-white hover:bg-violet-500"
                            }`}
                          >
                            {pActive ? "Unequip" : "Equip"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}

      {giftTarget && (
        <GiftModal
          item={{ id: giftTarget.id, name: giftTarget.name, price: finalPrice(giftTarget), gradient: giftTarget.gradient }}
          gifterId={user.id}
          isGod={isLeadDev(user)}
          onClose={() => setGiftTarget(null)}
          onGifted={applyNewBalance}
        />
      )}

      {showBuyPoints && <BuyPointsModal username={user.username} onClose={() => setShowBuyPoints(false)} />}
    </PageTransition>
  );
}
