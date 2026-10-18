import * as React from "react";
import { useEffect, useRef, useState } from "react";

export interface DecodeTextProps {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  // total time for the scramble to resolve, left to right
  duration?: number;
  // occasionally re-decode so the one tier-1 heading on screen stays findable
  idleDecode?: boolean;
  // wait before decoding, e.g. until the panel has powered on; read on mount only
  delay?: number;
}

const GLYPHS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789#/<>=+";
const TICK = 40;
// idle re-runs are quicker than the entrance
const IDLE_DURATION = 400;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const scramble = (text: string, resolved: number) =>
  text
    .split("")
    .map((ch, i) => (i < resolved || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
    .join("");

// Tier-1 headline reveal: characters decode left to right like a terminal
// readout. The real text holds the layout so wrapping never jumps.
export default function DecodeText({
  text,
  as: Tag = "span",
  className = "",
  duration = 650,
  idleDecode,
  delay = 0,
}: DecodeTextProps) {
  const startDelay = useRef(delay).current;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    let ticker: number | undefined;
    let idle: number | undefined;

    const decode = (length: number, wait: number, onDone?: () => void) => {
      const start = performance.now() + wait;
      setShown(scramble(text, 0));
      ticker = window.setInterval(() => {
        const t = Math.max(0, Math.min(1, (performance.now() - start) / length));
        if (t < 1) {
          setShown(scramble(text, Math.floor(t * text.length)));
          return;
        }
        window.clearInterval(ticker);
        setShown(null);
        onDone?.();
      }, TICK);
    };

    const scheduleIdle = () => {
      idle = window.setTimeout(() => decode(IDLE_DURATION, 0, scheduleIdle), 9000 + Math.random() * 6000);
    };

    decode(duration, startDelay, idleDecode ? scheduleIdle : undefined);

    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(idle);
    };
  }, [text, duration, idleDecode, startDelay]);

  const El = Tag as any;
  return (
    <El className={`decode ${className}`} aria-label={text}>
      <span className={shown ? "decode__hold" : undefined} aria-hidden="true">
        {text}
      </span>
      {shown && (
        <span className="decode__scramble" aria-hidden="true">
          {shown}
        </span>
      )}
    </El>
  );
}
