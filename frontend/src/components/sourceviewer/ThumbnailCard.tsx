import { FileText } from "lucide-react";

interface Props {
  label: string;
  excerpt: string;
  onClick: () => void;
}

export default function ThumbnailCard({ label, excerpt, onClick }: Props) {
  const lines = excerpt.split(" ").slice(0, 32).join(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-gray-300"
    >
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden />
        <div className="text-[11px] font-normal uppercase tracking-wide text-gray-500">{label}</div>
      </div>
      <div className="mt-2 max-h-16 overflow-hidden text-[10px] leading-snug text-gray-600">{lines || "—"}</div>
    </button>
  );
}
