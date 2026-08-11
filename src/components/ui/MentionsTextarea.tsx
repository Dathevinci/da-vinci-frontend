"use client";

import React, { useCallback, useRef } from "react";
import { CARET_KEYS, MentionUser, useMentionAutocomplete } from "@/components/ui/mentionSearch";

/**
 * A textarea that completes @mentions.
 *
 * Every other textarea prop passes straight through, which is load-bearing:
 * the community composer hands this an `onKeyDown` (⌘/Ctrl+Enter posts) and an
 * `autoFocus`, and the previous version declared neither — so it silently
 * dropped both and ⌘+Enter did nothing at all.
 *
 * The caller's onKeyDown only runs when the suggestion list did NOT consume the
 * key, so Enter picks a name while the list is open and posts when it isn't.
 */
type MentionsTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Search THIS closed set instead of the whole site — guild chat passes its
   *  roster, because the server only notifies that guild's members. */
  candidates?: MentionUser[];
};

export default function MentionsTextarea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onClick,
  onBlur,
  onFocus,
  disabled,
  candidates,
  ...rest
}: MentionsTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /**
   * Write a completed mention back out. The real element is mutated first so
   * the event the caller receives is a genuine one — parents read
   * `e.target.value` (and some slice it to a character cap), which a bare
   * `{ target: { value } }` literal could not support.
   */
  const setValue = useCallback(
    (next: string, caret: number) => {
      const el = ref.current;
      if (!el) return;
      el.value = next;
      onChange({ target: el, currentTarget: el } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
      window.setTimeout(() => {
        const node = ref.current;
        if (!node) return;
        node.focus();
        const pos = Math.min(caret, node.value.length);
        node.setSelectionRange(pos, pos);
      }, 0);
    },
    [onChange]
  );

  const mentions = useMentionAutocomplete<HTMLTextAreaElement>({
    elementRef: ref,
    setValue,
    disabled,
    candidates,
  });

  return (
    <>
      <textarea
        {...rest}
        {...mentions.fieldAria}
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e);
          mentions.sync();
        }}
        onKeyDown={(e) => {
          if (mentions.handleKeyDown(e)) return;
          onKeyDown?.(e);
        }}
        onKeyUp={(e) => {
          if (CARET_KEYS.has(e.key)) mentions.sync();
          onKeyUp?.(e);
        }}
        onClick={(e) => {
          mentions.sync();
          onClick?.(e);
        }}
        onFocus={(e) => {
          mentions.sync();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          // Option rows preventDefault on mousedown, so a click never blurs —
          // anything that reaches here is a real exit.
          mentions.close();
          onBlur?.(e);
        }}
      />
      {mentions.dropdown}
    </>
  );
}
