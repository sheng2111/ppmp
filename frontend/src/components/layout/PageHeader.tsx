import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { gradients } from "../../pages/admin/theme";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  variant?: "default" | "dark";
}

export default function PageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
  variant = "default",
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    }
  };

  const background =
    variant === "dark"
      ? "linear-gradient(135deg, #1e3a6e 0%, #1a56a0 50%, #2471c8 100%)"
      : gradients.header;

  return (
    <div
      className="rounded-2xl px-5 sm:px-6 py-5 mb-6 flex items-center justify-between gap-3 shadow-[0_4px_14px_rgba(2,132,199,0.18)]"
      style={{ background }}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {subtitle && (
          <p className="text-white/85 text-[15px] mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {(backTo || onBack) && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Back
          </button>
        )}
      </div>
    </div>
  );
}
