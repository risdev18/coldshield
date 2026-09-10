"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, animate } from "framer-motion";

export function AnimatedCounter({
  value,
  duration = 0.8,
  format = (v: number) => Math.round(v).toString()
}: {
  value: number;
  duration?: number;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionValue = useMotionValue(0);

  useEffect(() => {
    if (inView) {
      const controls = animate(motionValue, value, {
        duration: duration,
        ease: [0.16, 1, 0.3, 1], // emphasize curve from user spec
        onUpdate: (latest) => {
          if (ref.current) {
            ref.current.textContent = format(latest);
          }
        }
      });
      return controls.stop;
    }
  }, [inView, value, duration, motionValue, format]);

  return <span ref={ref}>{format(0)}</span>;
}
