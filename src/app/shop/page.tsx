"use client";

import { useState, useEffect, useRef } from "react";
import PageTransition from "@/components/layout/PageTransition";
import { useUser } from "@/hooks/useUser";
import { isAdmin, isLeadDev, displayArisePoints } from "@/lib/admin";
import { useToast } from "@/components/ui/Toast";
import { MountainSnow, ShoppingBag, Sparkles, Check, Diamond, Aperture, CircleDot, Orbit, Snowflake, Flame, Sun, Zap, Leaf, Search, X, LayoutGrid, CloudLightning, CloudFog, Moon, Cog, Target, Trees, Gift, Swords, Flower2, Skull, Sprout, Eye, ArrowRight } from "lucide-react";
import GiftModal from "@/components/shop/GiftModal";
import BuyPointsModal from "@/components/shop/BuyPointsModal";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AvatarDecoration } from "@/components/profile/AvatarDecoration";
import { ProfileEffect } from "@/components/profile/ProfileEffect";
import { isCrimsonChosen, isCrimsonActive, CRIMSON_OFF } from "@/components/profile/CrimsonRealm";

import { motion } from "framer-motion";

// The shop is now focused on avatar decorations: animated Frames (rings) and
// Effects (particles around your avatar + a matching flourish across your profile).
const SHOP_ITEMS = [
  // ---- SSS GRADE: one exists ----
  { id: "effect_himalaya", type: "effect", sss: true, name: "The Silent Himalayas", description: "Night falls on the roof of the world. Three ranges of moonlit Himalayan peaks rise across the viewer's ENTIRE screen — deep twilight blue in the distance, icy silver up front — while heavy, weightless snow drifts down in three layers of depth, fluttering without a breath of wind. Freezing mountain mist rolls along the ridges, and the snow QUIETLY PILES: soft rolling drifts bury the bottom of the screen and settle in a gentle cap on the crown of your avatar and the top of your profile. Sagarmāthā's silence. SSS grade.", price: 25500, icon: MountainSnow, color: "text-sky-200", glow: "shadow-[0_0_26px_rgba(191,219,254,0.7)]", gradient: "from-slate-200 via-sky-400 to-slate-800" },

  { id: "effect_ritual", type: "effect", sss: true, name: "With This Treasure…", description: "「 With this treasure, I summon— 」 The complete ritual. The world drowns in boiling black shadows; jagged tendrils lash out of the dark and seize your avatar while a blinding divine core burns through them. Above it hangs the bone-white Eight-Handled Wheel — impossibly still, until it shudders… and SNAPS 45 degrees with a spray of white sparks that shakes the viewer's entire screen. The Ten Shadows' final trump card — and it speaks: the summoning chant plays aloud when the profile opens. SSS grade. One exists.", price: 25000, icon: Target, color: "text-slate-100", glow: "shadow-[0_0_26px_rgba(255,255,255,0.75)]", gradient: "from-slate-100 via-slate-500 to-black" },

  { id: "effect_unblinking", type: "effect", sss: true, name: "The Unblinking", description: "It noticed you. Your profile becomes a page torn from a cursed manuscript — every line hand-inked and BOILING, redrawn each frame like a frantic sketch that refuses to sit still. A colossal hand-drawn EYE follows the viewer's cursor, blinking, its slit pupil dilating as they draw near — and sometimes it stops chasing and stares STRAIGHT AT THEM. Small eyes open in the dark to watch, a skeletal hand rises from the bottom of the page to reach for your avatar, a many-legged thing skitters across the card, and the darkness clenches like a heartbeat while ink drips and slash marks tear the page. The page watches back. SSS grade.", price: 20000, icon: Eye, color: "text-neutral-200", glow: "shadow-[0_0_26px_rgba(139,0,0,0.7)]", gradient: "from-neutral-200 via-neutral-600 to-red-950" },

  // ---- EXTREME RARE ----
  { id: "effect_jungle", type: "effect", rare: true, name: "The Ancient Jungle", description: "Something ancient has swallowed your profile. The viewer's ENTIRE screen becomes a dark, humid jungle floor: blurred fern silhouettes loom in the deep background while three shafts of warm golden sunlight pierce the canopy through drifting spores and darting cyan-and-gold fireflies. Giant procedural Monstera leaves — heart-shaped, slit with deep fenestrations — fan out from behind your avatar as thick woody vines drop from the top of the screen and coil around its rim. Huge leaves creep in from every corner, swaying on a heavy, humid breeze, while canopy leaves tumble slowly down. The jungle remembers.", price: 12500, icon: Sprout, color: "text-emerald-400", glow: "shadow-[0_0_24px_rgba(31,107,56,0.8)]", gradient: "from-emerald-500 via-green-700 to-yellow-700" },
  { id: "effect_mango", type: "effect", rare: true, name: "Mango Loco", description: "Completely unhinged. Your profile becomes a Día de los Muertos fiesta on the deep cobalt blue of a Mango Loco can: a rotating wreath of ruffled marigolds rings your avatar while three glowing sugar skulls — cyan, pink and lime eyes blazing — orbit around it. Every few seconds a Monster claw of toxic-lime tears down the viewer's ENTIRE screen and erupts a violent splatter of thick mango-orange and hot-pink juice that arcs out and drips down the glass, all through a chaotic storm of white-and-cyan carbonation fizz and falling fiesta confetti. Loud. Tropical. Loco.", price: 12500, icon: Skull, color: "text-orange-400", glow: "shadow-[0_0_24px_rgba(255,140,0,0.8)]", gradient: "from-orange-400 via-pink-500 to-lime-500" },
  { id: "effect_lotus", type: "effect", rare: true, name: "The Sacred Lotus Pond", description: "Stillness itself. A sacred lotus pond blooms across the viewer's ENTIRE screen — clear crystal water rippling with every gentle drop, and stirring into fresh waves as they move their mouse or scroll. Forty golden fireflies hover and dance over the surface while a cluster of giant green lily pads drifts around your avatar. Beside you, a pink Lotus and a pristine white Water Lily breathe slowly open and closed, their golden stamens shedding faint pollen into the air. The calm at the eye of the storm.", price: 12000, icon: Flower2, color: "text-emerald-300", glow: "shadow-[0_0_24px_rgba(52,211,153,0.7)]", gradient: "from-pink-300 via-emerald-500 to-teal-800" },
  { id: "effect_samurai", type: "effect", rare: true, name: "The Ghost Samurai", description: "The blade remembers. A spectral katana — hamon glinting along its tempered edge — floats across your avatar and, every six seconds, draws in a flash: a lightning-fast iaijutsu slash that carves a glowing crimson crescent around you and sends a gust through the storm of sakura petals falling across the viewer's ENTIRE screen, while your avatar rests in an aura of crimson and pale steel. The Ghost does not miss.", price: 12000, icon: Swords, color: "text-red-400", glow: "shadow-[0_0_24px_rgba(220,38,38,0.8)]", gradient: "from-slate-300 via-red-600 to-stone-950" },
  { id: "effect_mahoraga", type: "effect", rare: true, name: "Wheel of Adaptation", description: "The Divine General's Eight-Handled Wheel manifests behind your avatar in heavy metallic gold and bronze — idling with a slow, ominous turn until it violently SNAPS 45 degrees, hurling a blinding divine shockwave across the viewer's ENTIRE screen while cursed ink drifts through the dark. It adapts. Every four seconds. Forever.", price: 8000, icon: Cog, color: "text-amber-300", glow: "shadow-[0_0_24px_rgba(255,215,0,0.8)]", gradient: "from-amber-300 via-yellow-600 to-stone-900" },
  { id: "effect_tempest", type: "effect", rare: true, name: "Monarch's Tempest", description: "The apex artifact. A cel-shaded thundercloud crowns your avatar with lightning flickering inside it while electric arcs snap around the rim — and when anyone opens your profile, a cinematic storm engulfs their ENTIRE screen: pouring parallax rain, branched lightning strikes, and thunder-flash lighting. Dark-fantasy anime, made real.", price: 7500, icon: CloudLightning, color: "text-sky-300", glow: "shadow-[0_0_24px_rgba(56,189,248,0.8)]", gradient: "from-sky-400 via-purple-600 to-slate-800" },
  { id: "effect_blackhole", type: "effect", rare: true, name: "Event Horizon", description: "A highly detailed Black Hole / Deep Space Galaxy avatar effect. Your avatar becomes the center of an accretion disk while a spiral galaxy orbits around it, consuming doomed stars.", price: 7500, icon: Orbit, color: "text-orange-400", glow: "shadow-[0_0_24px_rgba(255,100,0,0.8)]", gradient: "from-orange-500 via-purple-500 to-black" },
  { id: "effect_fool", type: "effect", rare: true, name: "Fog of History", description: "Above the Grey Fog, at the bronze table. When anyone opens your profile, the endless Grey Fog rolls across their ENTIRE screen — crimson stars of the Tarot Club pulse deep within it, and silver spirit threads snake out of the mist to bind themselves to your avatar, crowned in an abyssal-black and cosmic-gold aura. He is watching.", price: 6000, icon: CloudFog, color: "text-slate-300", glow: "shadow-[0_0_24px_rgba(203,213,225,0.7)]", gradient: "from-slate-400 via-slate-600 to-amber-700" },
  { id: "effect_evernight", type: "effect", rare: true, name: "Evernight's Blessing", description: "The night belongs to Her. When anyone opens your profile, a massive Crimson Moon rises over their ENTIRE screen while the River of Eternal Darkness undulates below — and night-vanilla blossoms drift down like snow, swirling into orbit around your avatar, which rests inside an intertwined silver-and-crimson Aura of Concealment. Sleep. Tranquility. Concealment.", price: 6500, icon: Moon, color: "text-rose-300", glow: "shadow-[0_0_24px_rgba(244,63,94,0.7)]", gradient: "from-rose-400 via-rose-800 to-slate-900" },
  { id: "effect_ascension", type: "effect", rare: true, name: "Voltaic Ascension", description: "The single rarest power in Da Vinci. A storm of amethyst lightning crackles around your avatar while violet smoke pours across your profile — then reality tears open in a warp of light the moment your profile is viewed. Turns your whole profile purple. For the very few.", price: 5000, icon: Zap, color: "text-purple-300", glow: "shadow-[0_0_24px_rgba(168,85,247,0.8)]", gradient: "from-fuchsia-500 via-purple-500 to-purple-700" },

  // ---- Avatar Frames: an animated ring that spins around your avatar everywhere ----
  { id: "frame_amethyst", type: "frame", name: "Amethyst Halo", description: "A violet-and-magenta ring that slowly spins around your avatar. Shows on your profile, your comments, and the nav bar.", price: 90, icon: Aperture, color: "text-purple-400", glow: "shadow-[0_0_15px_rgba(192,132,252,0.5)]", gradient: "from-purple-500 to-fuchsia-600" },
  { id: "frame_gold", type: "frame", name: "Golden Aureole", description: "A ring of molten gold that rotates around your avatar wherever it appears. Pure prestige.", price: 110, icon: CircleDot, color: "text-amber-400", glow: "shadow-[0_0_15px_rgba(251,191,36,0.5)]", gradient: "from-amber-400 to-orange-600" },
  { id: "frame_ember", type: "frame", name: "Ember Crown", description: "A slowly spinning ring of fire — gold, orange and crimson — that wraps your avatar.", price: 100, icon: Flame, color: "text-red-500", glow: "shadow-[0_0_15px_rgba(239,68,68,0.5)]", gradient: "from-orange-500 to-red-600" },
  { id: "frame_frost", type: "frame", name: "Frost Sigil", description: "A rotating ring of icy cyan and sapphire light that circles your avatar.", price: 100, icon: Snowflake, color: "text-cyan-400", glow: "shadow-[0_0_15px_rgba(34,211,238,0.5)]", gradient: "from-cyan-400 to-blue-600" },
  { id: "frame_verdant", type: "frame", name: "Verdant Ring", description: "A spinning ring of emerald and jade that blooms around your avatar.", price: 90, icon: Orbit, color: "text-emerald-400", glow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]", gradient: "from-emerald-400 to-teal-600" },

  // ---- Avatar Effects: particles around your avatar + a flourish across your profile ----
  { id: "effect_canopy", type: "effect", unique: true, badge: "🌿", name: "Heart of the Forest", description: "The forest claims you. Knotted wooden branches and living vines coil around your avatar, blooming with glowing teal woodland flowers — while the viewer's ENTIRE screen becomes a shaded grove: golden god rays slanting through the dark, hundreds of hand-drawn leaves fluttering down (and swirling around you instead of falling through), pollen spores drifting up, and sudden gusts of wind sweeping the canopy sideways — all wrapped in the soft, living ambience of the forest itself.", price: 10000, icon: Trees, color: "text-emerald-300", glow: "shadow-[0_0_22px_rgba(16,185,129,0.7)]", gradient: "from-emerald-300 via-green-600 to-amber-900" },
  { id: "effect_froggie", type: "effect", unique: true, name: "Froggie Frenzy", description: "The cutest thing money can buy. A tiny froggie hops around your avatar everywhere you go — and sprints across your profile going 'ribbit ribbit', with lily pads and pond bubbles. 100% serious. 100% ribbit.", price: 500, icon: Leaf, color: "text-emerald-300", glow: "shadow-[0_0_18px_rgba(52,211,153,0.6)]", gradient: "from-emerald-400 to-lime-500" },
  { id: "effect_aura", type: "effect", name: "Ethereal Aura", description: "A pulsing violet glow breathes around your avatar — and energy ripples across your whole profile when someone opens it.", price: 110, icon: Sun, color: "text-fuchsia-400", glow: "shadow-[0_0_15px_rgba(217,70,239,0.5)]", gradient: "from-fuchsia-400 to-purple-600" },
  { id: "effect_sparkles", type: "effect", name: "Astral Dust", description: "Golden sparkles drift and twinkle around your avatar — and shimmer across your whole profile when someone opens it.", price: 100, icon: Sparkles, color: "text-yellow-300", glow: "shadow-[0_0_15px_rgba(253,224,71,0.5)]", gradient: "from-yellow-300 to-yellow-600" },
  { id: "effect_snow", type: "effect", name: "Winter's Veil", description: "Snowflakes fall gently around your avatar — and drift across your whole profile when someone opens it.", price: 90, icon: Snowflake, color: "text-sky-300", glow: "shadow-[0_0_15px_rgba(125,211,252,0.5)]", gradient: "from-sky-300 to-blue-500" },
  { id: "effect_embers", type: "effect", name: "Cinder Storm", description: "Glowing embers rise around your avatar — and float up across your whole profile when someone opens it.", price: 90, icon: Flame, color: "text-orange-400", glow: "shadow-[0_0_15px_rgba(251,146,60,0.5)]", gradient: "from-orange-400 to-red-600" },
];

export default function ShopPage() {
  const { user, updateProfile, isLoaded } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<typeof SHOP_ITEMS[0] | null>(null);
  // The item being previewed full-screen (its real effect plays over a mock profile).
  const [previewItem, setPreviewItem] = useState<typeof SHOP_ITEMS[0] | null>(null);
  // Money → Arise Points top-up modal (Ko-fi bundles).
  const [showBuyPoints, setShowBuyPoints] = useState(false);

  // After a successful gift the server has already moved the points; just sync
  // the gifter's cached balance so the navbar/shop show it immediately.
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

  // After a server-authoritative purchase, sync the cached user from the server's
  // response (new balance) + add the item to the right inventory array, so the
  // navbar balance and the shop's owned state update instantly.
  const INVENTORY_FIELD: Record<string, string> = {
    role: "purchasedRoles", tag: "purchasedTags", theme: "purchasedThemes",
    color: "purchasedColors", font: "purchasedFonts", effect: "purchasedEffects", frame: "purchasedFrames",
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
  // Discovery controls — as the catalog grows these keep everything findable.
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "sss" | "rare" | "frame" | "effect">("all");
  const [owned, setOwned] = useState<"all" | "unowned" | "owned">("all");
  // Descriptions are long — collapsed to 3 lines with a per-card "See more".
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const toggleDesc = (id: string) =>
    setExpandedDescs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  // The "Explore / Take me there" buttons live at the top; the filtered grid is
  // far below the toolbar, so set the category AND scroll down to it.
  const gridRef = useRef<HTMLDivElement>(null);
  const jumpToCategory = (cat: typeof category) => {
    setCategory(cat);
    requestAnimationFrame(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-purple-500 rounded-full border-t-transparent" /></div>;
  // Open to every logged-in user — cosmetics are the main Arise Points sink.
  if (!user) return null; // redirect to home is handled by the effect above

  const getInventoryArray = (type: string) => {
    switch(type) {
      case 'role': return user.purchasedRoles || [];
      case 'tag': return user.purchasedTags || [];
      case 'theme': return user.purchasedThemes || [];
      case 'color': return user.purchasedColors || [];
      case 'font': return user.purchasedFonts || [];
      case 'effect': return user.purchasedEffects || [];
      case 'frame': return user.purchasedFrames || [];
      default: return [];
    }
  };

  const getActiveField = (type: string) => {
    switch(type) {
      case 'role': return user.activeRole;
      case 'tag': return user.activeTag;
      case 'theme': return user.activeTheme;
      case 'color': return user.activeColor;
      case 'font': return user.activeFont;
      case 'effect': return user.activeEffect;
      case 'frame': return user.activeFrame;
      default: return null;
    }
  };

  const handlePurchase = async (item: typeof SHOP_ITEMS[0]) => {
    // Staff (admins + lead dev) buy freely without spending — their balance is a
    // fixed display (40k for admins, ∞ for the lead dev), so nothing is deducted.
    const isGod = isAdmin(user);
    
    if (!isGod && (user.arisePoints || 0) < item.price) {
      return toast("Not enough Arise Points!", "error");
    }

    setBuyingId(item.id);
    try {
      // Server-authoritative: the backend checks the price + balance and moves
      // the points. The client can no longer set its own AP or inventory.
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/users/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "Purchase failed", "error");
        return;
      }
      applyPurchase(item.id, item.type, typeof data.arisePoints === "number" ? data.arisePoints : null);
      toast(`Successfully purchased ${item.name}!`, "success");
    } catch (err) {
      toast("Purchase failed", "error");
    } finally {
      setBuyingId(null);
    }
  };

  // Donor-exclusive: the chosen summons or silences her Crimson Realm. Summoning
  // sets activeEffect to the realm; silencing sets an explicit "off" so it does
  // not spring back (an empty slot would default to the realm). Equipping any
  // normal shop effect below sets it aside just the same, and unequipping that
  // effect returns her to the realm — she never loses it.
  const handleCrimsonToggle = async (summon: boolean) => {
    try {
      await updateProfile({ activeEffect: summon ? "effect_crimson" : CRIMSON_OFF });
      toast(summon ? "Summoned The Visceral Crimson Realm" : "Silenced your Crimson Realm", "success");
    } catch (err) {
      toast("Failed to toggle item", "error");
    }
  };

  const handleToggle = async (item: typeof SHOP_ITEMS[0], isEquipping: boolean) => {
    const updatePayload: any = {};
    const val = isEquipping ? item.id : null;
    switch(item.type) {
      case 'role': updatePayload.activeRole = val; break;
      case 'tag': updatePayload.activeTag = val; break;
      case 'theme': updatePayload.activeTheme = val; break;
      case 'color': updatePayload.activeColor = val; break;
      case 'font': updatePayload.activeFont = val; break;
      case 'effect': updatePayload.activeEffect = val; break;
      case 'frame': updatePayload.activeFrame = val; break;
    }

    try {
      await updateProfile(updatePayload);
      toast(`${isEquipping ? 'Equipped' : 'Unequipped'} ${item.name}`, "success");
    } catch (err) {
      toast("Failed to toggle item", "error");
    }
  };

  const renderCard = (item: typeof SHOP_ITEMS[0], i: number) => {
    const hasItem = getInventoryArray(item.type).includes(item.id);
    const isActive = getActiveField(item.type) === item.id;
    // Frames & effects render a live avatar preview so buyers see what they get.
    const isPreviewable = item.type === "frame" || (item.type === "effect" && item.id !== "effect_sparkles");
    const isSSS = !!(item as any).sss;
    const isRare = !isSSS && !!(item as any).rare;
    const isUnique = !!(item as any).unique;
    // Rarity styling for the mini-profile chip + tier line.
    const rarity = isSSS
      ? { label: "SSS Grade", chip: "text-black bg-gradient-to-r from-white via-slate-200 to-slate-400 shadow-[0_0_14px_rgba(255,255,255,0.6)]", tier: `SSS-Grade ${item.type === "frame" ? "Frame" : "Effect"}` }
      : isRare
      ? { label: "Extreme Rare", chip: "text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 shadow-[0_0_12px_rgba(217,70,239,0.5)]", tier: "Extreme Rare Effect" }
      : isUnique
      ? { label: `${(item as any).badge || "🐸"} Unique`, chip: "text-emerald-950 bg-gradient-to-r from-emerald-300 to-lime-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]", tier: "Unique Effect" }
      : { label: item.type === "frame" ? "Frame" : "Effect", chip: "border border-white/10 bg-white/10 text-slate-300", tier: item.type === "frame" ? "Avatar Frame" : "Avatar Effect" };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        key={item.id}
        className={`relative overflow-hidden rounded-3xl p-6 transition-all duration-300 group flex flex-col
          ${isSSS
            ? 'bg-gradient-to-b from-slate-200/10 to-black/60 border border-slate-200/40 shadow-[0_0_38px_rgba(255,255,255,0.3)] hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(255,255,255,0.45)]'
            : isRare
            ? 'bg-gradient-to-b from-purple-500/10 to-fuchsia-500/[0.04] border border-purple-500/40 shadow-[0_0_34px_rgba(168,85,247,0.3)] hover:-translate-y-2 hover:shadow-[0_0_44px_rgba(168,85,247,0.5)]'
            : isUnique
            ? 'bg-gradient-to-b from-emerald-500/10 to-lime-500/[0.04] border border-emerald-500/40 shadow-[0_0_28px_rgba(52,211,153,0.25)] hover:-translate-y-2 hover:shadow-[0_0_38px_rgba(52,211,153,0.4)]'
            : isActive
            ? 'bg-gradient-to-b from-white/10 to-white/5 border border-white/20 shadow-[0_8px_32px_rgba(255,255,255,0.05)]'
            : 'bg-white/[0.02] backdrop-blur-lg border border-white/5 hover:border-purple-500/40 hover:bg-white/[0.04] hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(168,85,247,0.15)]'}`}
      >
        {/* Subtle gradient overlay on hover */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${item.gradient}`} />

        {/* Rare: living amethyst sheen sweeping across the card */}
        {isRare && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(115deg, transparent 30%, rgba(217,70,239,0.14) 50%, transparent 70%)", backgroundSize: "220% 100%" }}
            animate={{ backgroundPosition: ["120% 0%", "-120% 0%"] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* SSS: a blinding white edge of light sweeping the darkness */}
        {isSSS && (
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(115deg, transparent 34%, rgba(255,255,255,0.2) 50%, transparent 66%)", backgroundSize: "220% 100%" }}
            animate={{ backgroundPosition: ["120% 0%", "-120% 0%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* ── Mini profile preview (click → full-screen live preview) ── */}
        <div
          onClick={() => setPreviewItem(item)}
          className="group/prev relative z-10 mb-4 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12] p-4 transition hover:border-white/25"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-[0.16]`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {/* hover: preview affordance */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-[1px] transition group-hover/prev:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white">
              <Eye className="h-4 w-4" /> Preview
            </span>
          </div>
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${rarity.chip}`}>
                {rarity.label}
              </span>
              {hasItem && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  <Check className="h-3 w-3" /> Owned
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-gradient-to-br from-purple-500 to-fuchsia-600 text-xl font-black text-white">
                  {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : (user.username?.[0]?.toUpperCase() || "?")}
                </div>
                {isPreviewable && (
                  <AvatarDecoration
                    frame={item.type === "frame" ? item.id : null}
                    effect={item.type === "effect" ? item.id : null}
                    size="lg"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`truncate text-lg font-black leading-tight bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                    {user.username || "your name"}
                  </span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                </div>
                <div className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{rarity.tier}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── product name + description ── */}
        <h3 className={`relative z-10 mb-1.5 text-xl font-black tracking-tight ${item.color}`}>{item.name}</h3>
        {(() => {
          const expanded = expandedDescs.has(item.id);
          const isLong = item.description.length > 100;
          return (
            <div className="relative z-10 mb-5 flex-1">
              <p className={`text-sm leading-relaxed text-slate-400 ${expanded ? "" : "line-clamp-3"}`}>{item.description}</p>
              {isLong && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleDesc(item.id); }}
                  className="mt-1 text-xs font-bold text-purple-400 transition hover:text-purple-300"
                >
                  {expanded ? "See less" : "See more"}
                </button>
              )}
            </div>
          );
        })()}

        {/* ── actions ── */}
        <div className="relative z-10 mt-auto flex flex-col gap-2">
          {!hasItem ? (
            (!isAdmin(user) && (user.arisePoints || 0) < item.price) ? (
              <button
                onClick={() => setShowBuyPoints(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all duration-300 border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:border-amber-400/50"
              >
                <Diamond className="h-4 w-4" /> {item.price.toLocaleString()} AP <span className="opacity-50">·</span> Buy Points
              </button>
            ) : (
              <button
                onClick={() => handlePurchase(item)}
                disabled={buyingId === item.id}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition-all duration-300 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-[1.02] hover:from-purple-500 hover:to-fuchsia-500 hover:shadow-[0_0_25px_rgba(217,70,239,0.6)]"
              >
                {buyingId === item.id ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Diamond className="h-4 w-4" /> {item.price.toLocaleString()} <span className="opacity-50">·</span> Acquire
                  </>
                )}
              </button>
            )
          ) : (
            <button
              onClick={() => handleToggle(item, !isActive)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-black transition-all duration-300 hover:scale-[1.02]
                ${isActive
                  ? "border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  : "border-white/10 bg-white/5 text-white hover:border-transparent hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"}`}
            >
              {isActive ? "Unequip" : "Equip"}
            </button>
          )}
          <button
            onClick={() => setGiftTarget(item)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-bold text-slate-300 transition hover:border-fuchsia-500/40 hover:text-white"
          >
            <Gift className="h-4 w-4" /> Gift to a friend
          </button>
        </div>
      </motion.div>
    );
  };

  const SECTIONS = [
    { key: "sss", title: "SSS Grade", blurb: "Beyond rarity. One exists — and it costs accordingly." },
    { key: "rare", title: "Extreme Rare", blurb: "The single rarest power on the platform. The whole profile, transformed." },
    { key: "frame", title: "Avatar Frames", blurb: "An animated ring that spins around your avatar — everywhere it appears." },
    { key: "effect", title: "Avatar Effects", blurb: "Floating particles around your avatar, plus a matching flourish across your whole profile." },
  ];

  const sectionItems = (key: string) =>
    key === "sss"
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

  const sectionData = SECTIONS.filter((s) => category === "all" || s.key === category).map((s) => ({
    ...s,
    items: sectionItems(s.key).filter(matchesFilters),
  }));
  const shownCount = sectionData.reduce((n, s) => n + s.items.length, 0);
  const filtersActive = query.trim() !== "" || owned !== "all" || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setOwned("all");
  };

  const TABS = [
    { key: "all" as const, label: "All", icon: LayoutGrid, count: SHOP_ITEMS.length },
    { key: "sss" as const, label: "SSS", icon: Target, count: sectionItems("sss").length },
    { key: "rare" as const, label: "Extreme Rare", icon: Zap, count: sectionItems("rare").length },
    { key: "frame" as const, label: "Frames", icon: Aperture, count: sectionItems("frame").length },
    { key: "effect" as const, label: "Effects", icon: Sparkles, count: sectionItems("effect").length },
  ];

  // What the user is wearing right now — quick glance + one-tap unequip.
  const equippedItems = SHOP_ITEMS.filter((it) => getActiveField(it.type) === it.id);

  // The donor's exclusive realm — only she sees it, and only she can toggle it.
  const isChosen = isCrimsonChosen(user);
  const crimsonOn = isChosen && isCrimsonActive(user.activeEffect);

  return (
    <PageTransition>
      {/* overflow-clip (not hidden) contains the glow blobs WITHOUT creating a
          scroll container, so the sticky shop toolbar below keeps working. */}
      <div className="min-h-screen bg-[#050505] pt-24 pb-24 text-white relative overflow-clip">
        {/* Background Ambient Glows */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-fuchsia-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[400px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none transform rotate-45" />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6"
          >
            <div>
              <h1 className="text-4xl md:text-6xl font-black flex items-center gap-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-500 drop-shadow-sm mb-2">
                <ShoppingBag className="w-10 h-10 md:w-14 md:h-14 text-fuchsia-500 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" /> 
                Arise Shop
              </h1>
              <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl">Dress up your avatar with animated frames and effects that follow you across Da Vinci — on your profile, your comments, and the nav bar.</p>
            </div>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.6)]">
                <Diamond className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">Your Balance</p>
                <p className="text-2xl font-black text-white">
                  {isLeadDev(user) ? (
                    <span className="text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]">∞ AP</span>
                  ) : (
                    `${displayArisePoints(user)} AP`
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowBuyPoints(true)}
                className="ml-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_0_16px_rgba(168,85,247,0.45)] transition hover:scale-105"
              >
                <Diamond className="h-4 w-4" /> Buy Points
              </button>
            </motion.div>
          </motion.div>

          {/* ── Hero: Complete Your Look ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-6 overflow-hidden rounded-3xl border border-purple-500/30 p-8 md:p-10"
            style={{ background: "radial-gradient(120% 140% at 12% 20%, #4c1d95 0%, #2e1065 45%, #140a2e 100%)" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 90% at 88% 50%, rgba(217,70,239,0.35), transparent 60%)" }} />
            <div className="relative max-w-xl">
              <h2 className="mb-3 text-3xl font-black tracking-tight md:text-4xl">Complete Your Look</h2>
              <p className="mb-6 text-base text-purple-100/80 md:text-lg">Cinematic profile effects and animated frames that take over your whole profile the moment someone opens it. Your profile called — it wants one.</p>
              <button
                onClick={() => jumpToCategory("rare")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-purple-950 transition hover:scale-105"
              >
                Explore Extreme Rares <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.section>

          {/* ── Collection feature cards ── */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { key: "sss" as const, label: "SSS · One Exists", blurb: "The pinnacle. One exists.", bg: "radial-gradient(120% 120% at 20% 20%, #3b0764, #1a0a2e)", color: "text-fuchsia-200" },
              { key: "rare" as const, label: "Extreme Rare", blurb: "Screen-devouring cinematics.", bg: "radial-gradient(120% 120% at 80% 30%, #6d28d9, #2e1065)", color: "text-purple-200" },
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => jumpToCategory(c.key)}
                className="group relative flex h-44 flex-col overflow-hidden rounded-2xl border border-white/10 p-6 text-left transition hover:-translate-y-1"
                style={{ background: c.bg }}
              >
                <div className={`relative text-2xl font-black italic tracking-tight ${c.color}`}>{c.label}</div>
                <p className="relative mt-1 text-sm text-white/60">{c.blurb}</p>
                <span className="relative mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-black text-[#1a0a2e] transition group-hover:gap-2.5">
                  Take me there <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>

          {/* ── Equipped now — what you're wearing, with one-tap unequip ── */}
          {equippedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-5 flex flex-wrap items-center gap-2"
            >
              <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-black">Equipped now</span>
              {equippedItems.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white backdrop-blur"
                >
                  <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${it.gradient}`} />
                  {it.name}
                  <button
                    onClick={() => handleToggle(it, false)}
                    title={`Unequip ${it.name}`}
                    className="text-slate-400 transition hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </motion.div>
          )}

          {/* ── Donor Exclusive: The Visceral Crimson Realm — visible only to the
              chosen. She wears it by default, may set it aside for any shop
              effect, and only she can summon or silence it. ── */}
          {isChosen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl p-6 mb-8 border border-red-600/50 bg-gradient-to-b from-red-900/25 to-black/60 shadow-[0_0_38px_rgba(220,38,38,0.28)]"
            >
              <motion.div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(115deg, transparent 34%, rgba(220,38,38,0.16) 50%, transparent 66%)", backgroundSize: "220% 100%" }}
                animate={{ backgroundPosition: ["120% 0%", "-120% 0%"] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="relative w-16 h-16 shrink-0">
                  <div className="relative z-10 w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 bg-gradient-to-br from-red-700 to-black">
                    {user.avatar && <img src={user.avatar} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <AvatarDecoration effect="effect_crimson" size="lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 mb-2 w-fit text-[11px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full text-white bg-gradient-to-r from-red-600 to-rose-800 shadow-[0_0_14px_rgba(220,38,38,0.6)]">
                    ♥ Donor Exclusive — Yours Alone
                  </span>
                  <h3 className="text-2xl font-black mb-1 text-red-400">The Visceral Crimson Realm</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Your gift-bound realm: a jagged cosmic halo, a churning red sea, and rising embers. It is yours forever — equip any shop effect to set it aside, and it returns the instant you unequip. Only you can summon or silence it.
                  </p>
                </div>
                <button
                  onClick={() => handleCrimsonToggle(!crimsonOn)}
                  className={`shrink-0 py-3.5 px-8 rounded-xl font-black transition-all duration-300 border hover:scale-[1.02] ${
                    crimsonOn
                      ? "bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20 hover:border-red-400"
                      : "bg-gradient-to-r from-red-600 to-rose-700 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] hover:from-red-500 hover:to-rose-600"
                  }`}
                >
                  {crimsonOn ? "Silence Realm" : "Summon Realm"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Toolbar: search, ownership, category tabs (not sticky — it scrolls
              away with the page so it never overlaps the item grid) ── */}
          <motion.div
            ref={gridRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 scroll-mt-24"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b0b10] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] md:p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {/* search */}
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search frames, effects…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm transition placeholder:text-slate-500 focus:border-purple-500/60 focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {/* ownership segmented control */}
                <div className="flex items-center gap-1 self-start rounded-xl border border-white/10 bg-white/5 p-1 md:self-auto">
                  {(
                    [
                      { key: "all", label: "Everything" },
                      { key: "unowned", label: "For sale" },
                      { key: "owned", label: "Owned" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => setOwned(o.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        owned === o.key ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* category tabs */}
              <div className="-mb-0.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TABS.map((t) => {
                  const TabIcon = t.icon;
                  const active = category === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setCategory(t.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
                        active
                          ? "border-transparent bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_16px_rgba(168,85,247,0.45)]"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-purple-500/40 hover:text-white"
                      }`}
                    >
                      <TabIcon className="h-4 w-4" />
                      {t.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                          active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* results summary when filtering */}
          {filtersActive && (
            <div className="mb-8 flex items-center gap-3 text-sm text-slate-400">
              <span>
                <b className="text-white">{shownCount}</b> item{shownCount === 1 ? "" : "s"} found
              </span>
              <button
                onClick={resetFilters}
                className="font-bold text-purple-300 underline-offset-2 transition hover:text-white hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}

          {/* ── Nothing matches ── */}
          {shownCount === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
              <Sparkles className="h-10 w-10 text-slate-600" />
              <p className="text-lg font-bold text-slate-300">Nothing matches those filters.</p>
              <p className="max-w-sm text-sm text-slate-500">
                Try a different search, or reset the filters to browse the whole collection.
              </p>
              <button
                onClick={resetFilters}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-2.5 font-bold text-white transition hover:scale-[1.03]"
              >
                Show everything
              </button>
            </div>
          )}

          {sectionData.map((section) => {
            const items = section.items;
            if (items.length === 0) return null;
            const isRare = section.key === "rare";
            const isSSSSection = section.key === "sss";
            return (
              <div key={section.key} className="mb-14">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-1.5 rounded-full ${isSSSSection ? "bg-gradient-to-b from-white to-slate-500 shadow-[0_0_16px_rgba(255,255,255,0.8)]" : isRare ? "bg-gradient-to-b from-fuchsia-300 to-purple-600 shadow-[0_0_14px_rgba(217,70,239,0.7)]" : "bg-gradient-to-b from-purple-400 to-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.5)]"}`} />
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{section.title}</h2>
                      <p className="text-slate-400 text-sm md:text-base">{section.blurb}</p>
                    </div>
                  </div>
                  {category === "all" && (
                    <button
                      onClick={() => setCategory(section.key as typeof category)}
                      className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-purple-200 transition hover:border-fuchsia-500/40 hover:text-white sm:inline-flex"
                    >
                      Shop all <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {items.map((item, i) => renderCard(item, i))}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Full-screen live preview: the item's REAL effect plays over a mock
          profile card, so buyers see exactly what they're buying. ── */}
      {previewItem &&
        createPortal(
          (() => {
            const pv = previewItem;
            const pOwned = getInventoryArray(pv.type).includes(pv.id);
            const pActive = getActiveField(pv.type) === pv.id;
            const pSSS = !!(pv as any).sss;
            const pRare = !pSSS && !!(pv as any).rare;
            const pUnique = !!(pv as any).unique;
            const pChip = pSSS
              ? { label: "SSS Grade", cls: "text-black bg-gradient-to-r from-white via-slate-200 to-slate-400" }
              : pRare
              ? { label: "Extreme Rare", cls: "text-white bg-gradient-to-r from-fuchsia-500 to-purple-600" }
              : pUnique
              ? { label: `${(pv as any).badge || "🐸"} Unique`, cls: "text-emerald-950 bg-gradient-to-r from-emerald-300 to-lime-300" }
              : { label: pv.type === "frame" ? "Frame" : "Effect", cls: "border border-white/10 bg-white/10 text-slate-300" };
            const canBuy = isAdmin(user) || (user.arisePoints || 0) >= pv.price;
            return (
              <>
                {/* Each layer is a TOP-LEVEL fixed element so its z-index competes
                    directly with the effect's own z-80 body-level canvas:
                    backdrop(75) < mock card(75) < effect canvas(80) < controls(90). */}
                {/* backdrop — dims the whole shop */}
                <div className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-sm" onClick={() => setPreviewItem(null)} />
                {/* mock profile card — the effect canvas (z-80) plays OVER it */}
                <div className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center p-4">
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="pointer-events-auto relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/15 bg-[#0d0d16] shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
                  >
                    {pv.type === "effect" && <ProfileEffect effect={pv.id} />}
                    <div className={`relative z-[2] h-28 bg-gradient-to-br ${pv.gradient} opacity-70`} />
                    <div className="relative z-[10] -mt-14 flex items-end gap-4 px-6 pb-6">
                      <div className="relative h-24 w-24 shrink-0">
                        <div className="relative z-10 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-[#0d0d16] bg-gradient-to-br from-purple-500 to-fuchsia-600 text-3xl font-black text-white">
                          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : user.username?.[0]?.toUpperCase() || "?"}
                        </div>
                        <AvatarDecoration frame={pv.type === "frame" ? pv.id : null} effect={pv.type === "effect" ? pv.id : null} size="lg" />
                      </div>
                      <div className="min-w-0 pb-3">
                        <div className={`truncate text-2xl font-black bg-gradient-to-r ${pv.gradient} bg-clip-text text-transparent`}>{user.username || "your name"}</div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live preview</div>
                      </div>
                    </div>
                  </motion.div>
                </div>
                {/* close */}
                <button
                  onClick={() => setPreviewItem(null)}
                  className="fixed right-5 top-5 z-[90] grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-xl text-white backdrop-blur transition hover:bg-white/10"
                >
                  ✕
                </button>
                {/* info + actions */}
                <div className="fixed inset-x-0 bottom-0 z-[90] p-5">
                  <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0b0b12]/90 p-5 shadow-2xl backdrop-blur-xl">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${pChip.cls}`}>{pChip.label}</span>
                      {pOwned && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          <Check className="h-3 w-3" /> Owned
                        </span>
                      )}
                    </div>
                    <h3 className={`mb-1 text-xl font-black ${pv.color}`}>{pv.name}</h3>
                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-400">{pv.description}</p>
                    <div className="flex gap-2">
                      {!pOwned ? (
                        !canBuy ? (
                          <button
                            onClick={() => { setPreviewItem(null); setShowBuyPoints(true); }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold transition border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                          >
                            <Diamond className="h-4 w-4" /> {pv.price.toLocaleString()} AP <span className="opacity-50">·</span> Buy Points
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchase(pv)}
                            disabled={buyingId === pv.id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold transition bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:from-purple-500 hover:to-fuchsia-500"
                          >
                            {buyingId === pv.id ? (
                              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : (
                              <>
                                <Diamond className="h-4 w-4" /> {pv.price.toLocaleString()} <span className="opacity-50">·</span> Acquire
                              </>
                            )}
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleToggle(pv, !pActive)}
                          className={`flex flex-1 items-center justify-center rounded-xl border py-3 font-black transition ${
                            pActive ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {pActive ? "Unequip" : "Equip"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setGiftTarget(pv);
                          setPreviewItem(null);
                        }}
                        title="Gift to a friend"
                        className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-300 transition hover:text-white"
                      >
                        <Gift className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })(),
          document.body
        )}

      {giftTarget && (
        <GiftModal
          item={{ id: giftTarget.id, name: giftTarget.name, price: giftTarget.price, gradient: giftTarget.gradient }}
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
