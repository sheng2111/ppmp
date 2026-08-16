import React from "react";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Base shimmer primitive. Renders a rounded rectangle with a left→right
 * shimmer sweep. Respects prefers-reduced-motion.
 */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-100 ${className}`}
      style={style}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_linear_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}

/**
 * Skeleton matching the shape of a signatory settings card (used during
 * initial page load on SignatorySettingsPage).
 */
export function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
      }}
    >
      {/* Section header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-64" />
      </div>
      {/* Two field rows */}
      {[1, 2].map((i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
      {/* Footer */}
      <div
        className="flex justify-end pt-4"
        style={{ borderTop: "1px solid #E2E8F0" }}
      >
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

/**
 * Skeleton matching a single table row.
 */
export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ flex: i === 0 ? "2" : "1" }}
        />
      ))}
    </div>
  );
}
