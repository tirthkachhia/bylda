import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRep, repsQuery } from "@/lib/queries";

const NEW_REP = "__new__";

const control =
  "h-10 rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 text-[12px] font-semibold text-by-text-primary shadow-none focus:ring-2 focus:ring-by-focus-ring focus:ring-offset-0";

/**
 * Pick an existing rep or create a new one by name. Controlled: the parent owns
 * the selected rep id; this component only keeps the transient "new rep" form.
 */
export function RepPicker({
  organizationId,
  userId,
  value,
  onChange,
}: {
  organizationId: string;
  userId: string;
  value: string | null;
  onChange: (repId: string | null) => void;
}) {
  const qc = useQueryClient();
  const repsQ = useQuery({ ...repsQuery(organizationId), enabled: !!organizationId });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const rep = await createRep(organizationId, userId, name);
      await qc.invalidateQueries({ queryKey: ["reps", organizationId] });
      onChange(rep.id);
      setCreating(false);
      setName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create rep");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Select
        value={creating ? NEW_REP : (value ?? "")}
        onValueChange={(next) => {
          if (next === NEW_REP) {
            setCreating(true);
            onChange(null);
          } else {
            setCreating(false);
            onChange(next || null);
          }
        }}
      >
        <SelectTrigger aria-label="Rep" className={control}>
          <SelectValue placeholder="Choose a rep" />
        </SelectTrigger>
        <SelectContent className="rounded-by-menu border-by-border-engraved bg-by-surface-raised text-by-text-primary shadow-by-float">
          {(repsQ.data ?? []).map((rep) => (
            <SelectItem
              key={rep.id}
              value={rep.id}
              className="rounded-by-control text-[12px] focus:bg-by-surface-hover"
            >
              {rep.name}
            </SelectItem>
          ))}
          {(repsQ.data?.length ?? 0) > 0 && <SelectSeparator className="bg-by-border-engraved" />}
          <SelectItem
            value={NEW_REP}
            className="rounded-by-control text-[12px] font-semibold focus:bg-by-surface-hover"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New rep…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {creating && (
        <div className="flex gap-2">
          <input
            aria-label="New rep name"
            className={`${control} w-full font-normal outline-none`}
            placeholder="Rep name"
            value={name}
            maxLength={120}
            disabled={busy}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void add()}
            className="h-10 shrink-0 rounded-by-control bg-by-surface-control-dark px-4 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}
