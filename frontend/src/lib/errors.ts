/**
 * Maps API/JS errors to human-readable user-facing messages.
 * Never renders raw err.message, stack traces, or backend SQL errors.
 */

const FRIENDLY_MESSAGES: Record<number, string> = {
  400: "Something isn't quite right. Please check your input and try again.",
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to do this. Contact an administrator if you believe this is a mistake.",
  404: "The requested resource was not found.",
  409: "A record with this information already exists.",
  422: "Please check your information and try again.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our end. Please try again in a moment.",
  502: "Something went wrong on our end. Please try again in a moment.",
  503: "Something went wrong on our end. Please try again in a moment.",
};

const NETWORK_MESSAGE = "Unable to connect. Check your internet connection and try again.";

/**
 * Known safe backend messages that can be shown directly to users.
 * All other backend messages are replaced with generic friendly text.
 */
const SAFE_DETAIL_PATTERNS = [
  /already exists/i,
  /not found/i,
  /required/i,
  /invalid/i,
];

function isSafeDetail(detail: unknown): boolean {
  if (typeof detail !== "string") return false;
  return SAFE_DETAIL_PATTERNS.some((p) => p.test(detail));
}

export function toUserMessage(err: unknown): string {
  // Network error (no response at all)
  if (
    err instanceof TypeError &&
    err.message.toLowerCase().includes("failed to fetch")
  ) {
    return NETWORK_MESSAGE;
  }

  // Axios-style error with response
  const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown } } };
  if (axiosErr.response) {
    const status = axiosErr.response.status;
    const detail = axiosErr.response.data?.detail;

    // Use safe backend messages when available
    if (isSafeDetail(detail)) {
      return detail as string;
    }

    // Map status to friendly message
    if (status && FRIENDLY_MESSAGES[status]) {
      return FRIENDLY_MESSAGES[status];
    }

    return "Something went wrong. Please try again.";
  }

  // Generic fallback
  return "Something went wrong. Please try again.";
}
