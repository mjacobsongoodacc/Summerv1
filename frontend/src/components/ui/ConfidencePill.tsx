interface Props {
  confidence?: number | null;
}

/** Lightweight badge for future model confidence scores from ingest. */
export default function ConfidencePill({ confidence }: Props) {
  const label =
    confidence == null ? "—" : `${Math.round(confidence * 100)}% conf.`;
  return (
    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide text-gray-500">
      {label}
    </span>
  );
}
