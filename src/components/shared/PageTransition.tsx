"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps page content with an opacity + vertical translate entry animation.
 * Duration: 150–600ms range (using 400ms for a balanced feel).
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("h-full", className)}
    >
      {children}
    </motion.div>
  );
}
