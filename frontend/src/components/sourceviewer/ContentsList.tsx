import { ChevronRight } from "lucide-react";
import type { SectionIndexEntry } from "../../types";

interface Props {
  sections: SectionIndexEntry[];
  onPick: (anchor: string) => void;
}

export default function ContentsList({ sections, onPick }: Props) {
  return (
    <ul className="space-y-1 text-sm">
      {sections.map((s) => (
        <li key={s.anchor}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-gray-800 hover:bg-gray-50"
            onClick={() => onPick(s.anchor)}
          >
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1">{s.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
