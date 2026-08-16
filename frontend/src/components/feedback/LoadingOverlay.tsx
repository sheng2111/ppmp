import React from "react";
import { Loader2 } from "lucide-react";
import { colors } from "../../pages/admin/theme";

interface LoadingOverlayProps {
  message?: string;
  subtext?: string;
  children?: React.ReactNode;
}

/**
 * Full container overlay for blocking operations (APP generation, PDF
 * export, bulk archive). Use only when partial interaction would be harmful.
 */
export function LoadingOverlay({
  message = "Loading...",
  subtext,
  children,
}: LoadingOverlayProps) {
  return (
    <div className="relative" aria-busy="true">
      {children}
      {/* Scrim */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
        style={{ background: "rgba(15, 23, 42, 0.4)" }}
      >
        <div className="text-center p-6">
          <Loader2
            className="w-8 h-8 animate-spin mx-auto mb-3"
            style={{ color: "#FFFFFF" }}
          />
          <p
            className="text-sm font-semibold"
            style={{ color: "#FFFFFF" }}
          >
            {message}
          </p>
          {subtext && (
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>
              {subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
