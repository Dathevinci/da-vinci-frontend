"use client";

import { useRef, useState } from "react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/components/ui/Toast";
import { isCrimsonChosen, resolveActiveEffect, CRIMSON_OFF } from "./CrimsonRealm";
import { getEffectMeta } from "@/lib/effectMeta";

/**
 * The single owner of `activeEffect` for the navbar. Call it once and pass the
 * result down — nothing else in the header should read `user.activeEffect`.
 *
 * Four traps this closes:
 *
 * 1. It resolves through `resolveActiveEffect`, never the raw field. For the
 *    crimson chosen, an EMPTY slot means crimson is ON, so reading the raw
 *    field shows her nothing while her profile blazes red. Conversely a normal
 *    account holding "effect_crimson" must show nothing.
 * 2. `updateProfile` never throws — it catches internally and returns
 *    { success:false, message }. So we check `.success`; a try/catch here would
 *    be dead code that reports failures as successes.
 * 3. `pending` is a WRAPPER object, not `string | null`, so "None is pending"
 *    and "nothing is pending" don't collapse into the same value and the None
 *    row can't flicker back mid-flight.
 * 4. The toast name is resolved inside equip(), not from row scope.
 */
export function useEffectSlot() {
  const { user, updateProfile } = useUser();
  const { toast } = useToast();

  const chosen = !!user && isCrimsonChosen(user);
  const effective = user ? resolveActiveEffect(user, (user as any).activeEffect) : undefined;

  // For the chosen, clearing the slot re-defaults to crimson — "off" has to be
  // the literal sentinel. For everyone else, null is off. Not interchangeable.
  const offValue = chosen ? CRIMSON_OFF : null;

  const [pending, setPending] = useState<{ value: string | null } | null>(null);
  // The state `pending` is captured at render time, so two clicks landing in the
  // same tick both read `null` and both fire a PATCH — `disabled={busy}` only
  // takes effect after React re-renders. A ref latches synchronously.
  const inFlight = useRef(false);
  const shown = pending ? pending.value : effective ?? null;

  const equip = async (id: string | null) => {
    if (inFlight.current) return; // serialize — guard before any state write
    inFlight.current = true;
    const value = id ?? offValue;
    const name = id ? getEffectMeta(id)?.name ?? "that effect" : null;

    setPending({ value: id });
    const res = await updateProfile({ activeEffect: value } as any);
    setPending(null);
    inFlight.current = false;

    if (!res?.success) toast(res?.message || "Couldn't change your effect", "error");
    else toast(name ? `Equipped ${name}` : "Effect removed", "success");
  };

  return { effective, shown, equip, busy: pending !== null, chosen };
}

export type EffectSlot = ReturnType<typeof useEffectSlot>;
