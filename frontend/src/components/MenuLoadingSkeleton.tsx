"use client";

import { motion } from "framer-motion";

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 snap-start basis-[calc((100%_-_0.5rem)/2)] sm:basis-[calc((100%_-_1rem)/3)] overflow-hidden rounded-2xl border border-[#cfc39f] bg-[#fffdf6]/60 p-3" aria-hidden="true">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="skeleton h-3.5 w-14" />
        <div className="skeleton h-5 w-5 rounded-full" />
      </div>
      <div className="skeleton h-4 w-20 mb-1" />
      <div className="skeleton h-3 w-28 mt-0.5" />
      <div className="flex gap-1 mt-2">
        <div className="skeleton h-4.5 w-12 rounded-full" />
        <div className="skeleton h-4.5 w-12 rounded-full" />
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-[#dfd3ae]/40 pt-2">
        <div className="skeleton h-3 w-10" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonSection({ delay = 0 }: { delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="organic-card mb-5 overflow-visible rounded-3xl border border-[#cfc39f] p-3.5 lg:p-4" aria-hidden="true"
    >
      <div className="flex items-start gap-2.5 mb-3 px-1">
        <div className="skeleton grid h-9 w-9 flex-none place-items-center rounded-full">
          <div className="h-4 w-4 rounded-sm" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="skeleton h-5 w-28" />
        </div>
        <div className="ml-auto pt-0.5">
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
      </div>

      <div className="relative -mx-3.5 overflow-hidden rounded-2xl lg:-mx-4">
        <div className="flex gap-2 px-4 pb-2 pt-0.5 lg:px-14">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>

      <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
        <div className="skeleton h-1.5 w-5 rounded-full" />
        <div className="skeleton h-1.5 w-1.5 rounded-full" />
        <div className="skeleton h-1.5 w-1.5 rounded-full" />
      </div>
    </motion.section>
  );
}

export function MenuLoadingSkeleton() {
  return (
    <div className="px-4 pt-4 lg:pt-6">
      <SkeletonSection delay={0} />
      <SkeletonSection delay={0.08} />
      <SkeletonSection delay={0.16} />
      <SkeletonSection delay={0.24} />

      <div className="flex items-center gap-2 rounded-2xl border border-[#cfc39f] px-4 py-3 mb-5">
        <div className="skeleton h-4 w-4" />
        <div className="skeleton h-4 w-32" />
      </div>
    </div>
  );
}
