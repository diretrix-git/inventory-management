"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  /** Optional prefix, e.g. "$" */
  prefix?: string;
  /** Optional suffix, e.g. "%" */
  suffix?: string;
  /** Format the animated count value. Defaults to toLocaleString() */
  formatValue?: (value: number) => string;
  description?: string;
  icon?: React.ElementType;
  className?: string;
}

export function StatCard({
  title,
  value,
  prefix,
  suffix,
  formatValue,
  description,
  icon: Icon,
  className,
}: StatCardProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    // Animate count-up from 0 to value over 1.0–1.5s with easeOut
    const duration = value > 1000 ? 1.5 : 1.0;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate(latest) {
        setDisplayValue(latest);
      },
    });

    return () => controls.stop();
  }, [isInView, value]);

  const formatted = formatValue
    ? formatValue(displayValue)
    : Math.round(displayValue).toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-sm font-medium text-muted-foreground">
            {prefix}
          </span>
        )}
        <span
          ref={ref}
          className="text-3xl font-semibold tracking-tight text-foreground tabular-nums font-mono"
          aria-label={`${title}: ${value}`}
        >
          {formatted}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </motion.div>
  );
}
