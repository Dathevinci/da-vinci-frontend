"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * PICK ME DOWN — INFINITY GACHA · the hub world.
 *
 * A low-poly 3D guild hall (Three.js, lazy-loaded so nothing else on the
 * site pays for it) with a flat pixel-sprite hero walking between stations.
 * The contrast IS the aesthetic: 2D pixel people in solid 3D rooms.
 *
 * The hub owns NO game state. Every station is a door into the mode that
 * already owns its rules — the altar is the pack page, the gate is Dungeon
 * Dispatch, the arena is Card Duels. What the hub adds is the WORLD: one
 * place where the whole game visibly lives, with live signs (injured cards
 * in the infirmary, a run still underground, duels waiting on your move).
 *
 * Controls: tap/click the floor to walk, WASD/arrows too. Walk close to a
 * station and its pixel panel opens; ENTER goes through the door.
 */

type Station = {
  id: string; label: string; sub: string; route: string;
  x: number; z: number; tint: number; live?: string;
};

export default function GameHubPage() {
  const router = useRouter();
  const { user } = useUser();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState<Station | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<Record<string, string>>({});
  const liveRef = useRef<Record<string, string>>({});
  useEffect(() => { liveRef.current = live; }, [live]);

  // ── live signs: what each station would tell you before you walk over ──
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [dgn, duels] = await Promise.all([
          fetch(`${API_URL}/api/dungeon/status/${user.id}`).then((r) => r.json()).catch(() => null),
          fetch(`${API_URL}/api/duels/mine/${user.id}`).then((r) => r.json()).catch(() => null),
        ]);
        const next: Record<string, string> = {};
        if (dgn?.success) {
          const cards = dgn.data.cards || [];
          const injured = cards.filter((c: any) => c.dgnInjured && !c.dgnDead).length;
          const dead = cards.filter((c: any) => c.dgnDead).length;
          next.infirmary = dead > 0 ? `${dead} AWAITING REVIVAL` : injured > 0 ? `${injured} RESTING` : "ALL HEALTHY";
          next.gate = dgn.data.activeRun ? "A PARTY IS UNDERGROUND" : "THE GATE IS OPEN";
          next.barracks = `${cards.length} UNITS`;
        }
        if (duels?.success) {
          const mine = duels.data?.duels || [];
          const myTurn = mine.filter((d: any) => d.status === "ACTIVE" && d.turnUserId === user.id).length;
          next.arena = myTurn > 0 ? `${myTurn} DUEL${myTurn === 1 ? "" : "S"} ON YOUR MOVE` : "CHALLENGERS WANTED";
        }
        setLive(next);
      } catch { /* signs stay generic */ }
    })();
  }, [user?.id]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let dead = false;
    let raf = 0;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE: any = await import("three");
      if (dead || !mountRef.current) return;

      const W = () => mount.clientWidth;
      const H = () => mount.clientHeight;

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W(), H());
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d0a18);
      scene.fog = new THREE.Fog(0x0d0a18, 18, 34);

      const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 100);

      scene.add(new THREE.AmbientLight(0x8878c8, 0.75));
      const sun = new THREE.DirectionalLight(0xffe9b0, 0.9);
      sun.position.set(6, 12, 4);
      scene.add(sun);

      // ── pixel canvas textures ── everything hand-drawn at tiny sizes and
      // magnified with NearestFilter: that's the whole art budget.
      const pixelTexture = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 32, h = 32) => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d")!;
        draw(ctx, w, h);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        return t;
      };

      // checkerboard floor
      const floorTex = pixelTexture((ctx) => {
        ctx.fillStyle = "#171226"; ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = "#1e1834";
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) ctx.fillRect(x * 4, y * 4, 4, 4);
      });
      floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(10, 10);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshLambertMaterial({ map: floorTex })
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      // walls — a simple hall
      const wallMat = new THREE.MeshLambertMaterial({ color: 0x231c3e });
      const mkWall = (wd: number, x: number, z: number, ry: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(wd, 4, 0.6), wallMat);
        m.position.set(x, 2, z); m.rotation.y = ry; scene.add(m);
      };
      mkWall(40, 0, -14, 0); mkWall(40, 0, 14, 0); mkWall(28, -18, 0, Math.PI / 2); mkWall(28, 18, 0, Math.PI / 2);

      // pixel-text label sprite
      const labelSprite = (text: string, tint = "#ffd23e") => {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 64;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "rgba(10,7,20,.85)"; ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = tint; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 252, 60);
        ctx.fillStyle = tint; ctx.font = "bold 22px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, 128, 34);
        const t = new THREE.CanvasTexture(c);
        t.magFilter = THREE.NearestFilter;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
        s.scale.set(3.2, 0.8, 1);
        return s;
      };

      // ── stations ── each a chunky pedestal + crystal + floating sign
      const stations: Station[] = [
        { id: "altar",     label: "ARISE ALTAR",   sub: "Summon new cards",            route: "/cards",       x: -12, z: -8,  tint: 0xc07dff },
        { id: "gate",      label: "DUNGEON GATE",  sub: "Dispatch a party",            route: "/dungeon",     x: 0,   z: -11, tint: 0xff8a5f },
        { id: "arena",     label: "DUEL ARENA",    sub: "Stake and fight — always safe", route: "/duels",     x: 12,  z: -8,  tint: 0xff5f5f },
        { id: "synth",     label: "SYNTHESIZER",   sub: "Craft, dust, foil, level",    route: "/cards",       x: -12, z: 6,   tint: 0x5fd18a },
        { id: "infirmary", label: "INFIRMARY",     sub: "Heal and revive the fallen",  route: "/dungeon",     x: 12,  z: 6,   tint: 0x9be8ff },
        { id: "barracks",  label: "BARRACKS",      sub: "The whole roster",            route: "/cards",       x: 0,   z: 9,   tint: 0xffd23e },
      ];
      const stationMeshes: { s: Station; group: any }[] = [];
      for (const s of stations) {
        const g = new THREE.Group();
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 1.5, 0.5, 6),
          new THREE.MeshLambertMaterial({ color: 0x2a2347 })
        );
        base.position.y = 0.25;
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7),
          new THREE.MeshLambertMaterial({ color: s.tint, emissive: s.tint, emissiveIntensity: 0.55 })
        );
        crystal.position.y = 1.6;
        const sign = labelSprite(s.label, "#" + s.tint.toString(16).padStart(6, "0"));
        sign.position.y = 3.1;
        g.add(base, crystal, sign);
        g.position.set(s.x, 0, s.z);
        scene.add(g);
        stationMeshes.push({ s, group: g });
      }

      // ── the hero ── an 8-bit person on a billboard, drawn right here
      const heroTex = pixelTexture((ctx) => {
        ctx.clearRect(0, 0, 16, 24);
        const P = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
        P(5, 1, 6, 5, "#2b2340");   // hair
        P(5, 5, 6, 4, "#e8c39a");   // face
        P(6, 6, 1, 1, "#1a1420"); P(9, 6, 1, 1, "#1a1420"); // eyes
        P(4, 9, 8, 7, "#7a5cff");   // tunic
        P(3, 9, 1, 5, "#e8c39a"); P(12, 9, 1, 5, "#e8c39a"); // arms
        P(5, 16, 2, 6, "#2a2347"); P(9, 16, 2, 6, "#2a2347"); // legs
        P(4, 22, 3, 2, "#1a1420"); P(9, 22, 3, 2, "#1a1420"); // boots
      }, 16, 24);
      const hero = new THREE.Sprite(new THREE.SpriteMaterial({ map: heroTex, transparent: true }));
      hero.scale.set(1.4, 2.1, 1);
      hero.position.set(0, 1.05, 2);
      scene.add(hero);

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 8),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.01;
      scene.add(shadow);

      // ── movement ──
      const target = new THREE.Vector3(0, 0, 2);
      const keys: Record<string, boolean> = {};
      const ray = new THREE.Raycaster();
      const ptr = new THREE.Vector2();
      const onPointer = (ev: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
        ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ptr, camera);
        const hit = ray.intersectObject(floor)[0];
        if (hit) target.set(
          Math.max(-16, Math.min(16, hit.point.x)), 0,
          Math.max(-12, Math.min(12, hit.point.z))
        );
      };
      const onKey = (down: boolean) => (ev: KeyboardEvent) => { keys[ev.key.toLowerCase()] = down; };
      const kd = onKey(true), ku = onKey(false);
      renderer.domElement.addEventListener("pointerdown", onPointer);
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);

      const onResize = () => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      };
      window.addEventListener("resize", onResize);

      const clock = new THREE.Clock();
      let nearId: string | null = null;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(0.05, clock.getDelta());
        const t = clock.elapsedTime;

        // keyboard steers by nudging the walk target
        const spd = 7 * dt;
        if (keys.w || keys.arrowup) target.z -= spd * 2;
        if (keys.s || keys.arrowdown) target.z += spd * 2;
        if (keys.a || keys.arrowleft) target.x -= spd * 2;
        if (keys.d || keys.arrowright) target.x += spd * 2;
        target.x = Math.max(-16, Math.min(16, target.x));
        target.z = Math.max(-12, Math.min(12, target.z));

        // walk — constant speed, pixel-hero bob while moving
        const dx = target.x - hero.position.x;
        const dz = target.z - hero.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          const step = Math.min(dist, 5 * dt);
          hero.position.x += (dx / dist) * step;
          hero.position.z += (dz / dist) * step;
          hero.position.y = 1.05 + Math.abs(Math.sin(t * 10)) * 0.08;
        } else {
          hero.position.y = 1.05 + Math.sin(t * 2.2) * 0.02;
        }
        shadow.position.x = hero.position.x;
        shadow.position.z = hero.position.z;

        // crystals idle-spin in chunky steps — smooth rotation would look modern
        for (const { group } of stationMeshes) {
          const crystal = group.children[1];
          crystal.rotation.y = Math.floor(t * 4) * (Math.PI / 8);
          crystal.position.y = 1.6 + Math.sin(t * 2 + group.position.x) * 0.08;
        }

        // camera follows at a fixed pitch, lerped
        camera.position.x += (hero.position.x - camera.position.x) * 0.06;
        camera.position.y += (hero.position.y + 7.5 - camera.position.y) * 0.06;
        camera.position.z += (hero.position.z + 9.5 - camera.position.z) * 0.06;
        camera.lookAt(hero.position.x, 1, hero.position.z);

        // proximity → open/close the station panel
        let found: Station | null = null;
        for (const { s, group } of stationMeshes) {
          const d = Math.hypot(group.position.x - hero.position.x, group.position.z - hero.position.z);
          if (d < 3.1) { found = s; break; }
        }
        const foundId = found?.id ?? null;
        if (foundId !== nearId) {
          nearId = foundId;
          setNear(found ? { ...found, live: liveRef.current[found.id] } : null);
        }

        renderer.render(scene, camera);
      };
      camera.position.set(0, 8.5, 11.5);
      tick();
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("keydown", kd);
        window.removeEventListener("keyup", ku);
        renderer.domElement.removeEventListener("pointerdown", onPointer);
        renderer.dispose();
        if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      };
    })();

    return () => { dead = true; if (cleanup) cleanup(); };
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0d0a18] text-[#e8e3d0]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* title card — the game's name lives here */}
      <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 text-center sm:top-20">
        <p className="font-pixel text-[8px] tracking-widest text-[#8f86b8]">DA VINCI PRESENTS</p>
        <h1 className="font-pixel mt-2 text-lg leading-relaxed text-[#ffd23e] sm:text-2xl" style={{ textShadow: "3px 3px 0 #3a2b00" }}>
          PICK ME DOWN
        </h1>
        <p className="font-pixel mt-1 text-[9px] text-[#f0abfc]">∞ INFINITY GACHA ∞</p>
      </div>

      {!ready && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#0d0a18]">
          <p className="font-pixel text-[10px] text-[#ffd23e]">BUILDING THE GUILD HALL...</p>
        </div>
      )}

      {/* hint */}
      <p className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 text-center font-mono text-[11px] text-[#6b6390] sm:bottom-6">
        tap the floor to walk · WASD works too · walk up to a station
      </p>

      {/* ── station panel ── the 2D half of the hybrid */}
      {near && (
        <div className="absolute bottom-28 left-1/2 z-20 w-[min(92vw,380px)] -translate-x-1/2 sm:bottom-16"
          style={{ background: "#1a1530", border: "3px solid #ffd23e", boxShadow: "0 4px 0 0 #0a0714" }}>
          <div className="p-3">
            <p className="font-pixel text-[10px] leading-relaxed text-[#ffd23e]">{near.label}</p>
            <p className="mt-1 font-mono text-[11px] text-[#b9aee0]">{near.sub}</p>
            {near.live && <p className="mt-1 font-mono text-[11px] font-bold text-[#9be8ff]">◈ {near.live}</p>}
            <button
              onClick={() => router.push(near.route)}
              className="font-pixel mt-3 w-full px-3 py-2.5 text-[9px] text-[#ffe9a3]"
              style={{ background: "#7a5c00", border: "3px solid #ffd23e", boxShadow: "0 3px 0 0 #0a0714" }}>
              ▶ ENTER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
