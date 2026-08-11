"use client";

import React, { useCallback, useRef } from "react";
import { CARET_KEYS, useMentionAutocomplete } from "@/components/ui/mentionSearch";

/**
 * A single-line input that completes @mentions.
 *
 * `onChange` takes the STRING, not the event — that is the existing contract
 * every caller is written against, so it stays. Every other input prop (style,
 * maxLength, autoFocus…) passes through.
 *
 * Enter picks a name while the list is open and submits when it isn't, which is
 * the behaviour a chat-style box needs to keep.
 */
type MentionsInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onSubmit"
> & {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
};

export default function MentionsInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onKeyUp,
  onClick,
  onBlur,
  onFocus,
  disabled,
  className,
  ...rest
}: MentionsInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  const setValue = useCallback(
    (next: string, caret: number) => {
      onChange(next);
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

  const mentions = useMentionAutocomplete<HTMLInputElement>({
    elementRef: ref,
    setValue,
    disabled,
  });

  return (
    <div className="relative min-w-0 flex-1">
      <input
        {...rest}
        {...mentions.fieldAria}
        ref={ref}
        type="text"
        value={value}
        disabled={disabled}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          mentions.sync();
        }}
        onKeyDown={(e) => {
          if (mentions.handleKeyDown(e)) return;
          if (e.key === "Enter" && !e.shiftKey && onSubmit) {
            e.preventDefault();
            onSubmit();
            return;
          }
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
          mentions.close();
          onBlur?.(e);
        }}
      />
      {mentions.dropdown}
    </div>
  );
}
