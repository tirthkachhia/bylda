import { useState } from "react";
import { Button, DataBoundary } from "@/components/bylda";
import { useObjectionLibrary, type ObjectionLibraryItem } from "@/lib/data";
import {
  cell,
  LocalField,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsNote,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalMethodologyAction, LocalMethodologyLayout, LocalTextarea } from "./LocalMethodology";
import { LocalDraftNotice } from "./LocalPreferences";
export function E13MethodologyObjectionLibrary() {
  const query = useObjectionLibrary();
  const [draft, setDraft] = useState<Pick<
    ObjectionLibraryItem,
    "label" | "category" | "recommendedResponse"
  > | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <LocalMethodologyLayout active="Objection library">
      <LocalSettingsHeading
        title="Objection library"
        subtitle="Bylda classifies objections into these types. Unclassified counts aren't available."
        action={
          <div className="flex gap-2">
            <LocalMethodologyAction
              label="Review unclassified"
              variant="secondary"
              reason="Unclassified objections aren't available yet."
            />
            <Button
              onClick={() => {
                setMessage(null);
                setDraft({ label: "", category: "", recommendedResponse: "" });
              }}
            >
              Add objection
            </Button>
          </div>
        }
      />
      <DataBoundary query={query} empty={<LocalSettingsEmpty noun="objections" />}>
        {(items) => (
          <LocalSettingsTable
            headings={["OBJECTION", "EXAMPLE PHRASES", "SEEN", "RECOMMENDED HANDLING"]}
            columnClasses={["w-[25%]", "w-[33%]", "w-[10%]", "w-[32%]"]}
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td className={cell}>
                  <button
                    type="button"
                    className="type-ui-body-strong text-left hover:underline focus-visible:outline-by-focus-ring"
                    onClick={() => {
                      setMessage(null);
                      setDraft({
                        label: item.label,
                        category: item.category,
                        recommendedResponse: item.recommendedResponse,
                      });
                    }}
                    aria-label={`Edit ${item.label}`}
                  >
                    {item.label}
                  </button>
                  <p className="type-ui-small text-by-text-tertiary">{item.category}</p>
                </td>
                <td className={cell}>—</td>
                <td className={cell}>{item.seenCount}</td>
                <td className={cell}>{item.recommendedResponse}</td>
              </tr>
            ))}
          </LocalSettingsTable>
        )}
      </DataBoundary>
      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage("Saving objections isn't connected yet. Nothing was saved.");
          }}
          className="flex flex-col gap-4 rounded-by-card border border-by-border-engraved bg-by-surface-raised p-4"
        >
          <h2 className="type-ui-title">Objection draft</h2>
          <LocalField
            label="OBJECTION"
            value={draft.label}
            required
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <LocalField
            label="CATEGORY"
            value={draft.category}
            required
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
          <LocalTextarea
            label="RECOMMENDED HANDLING"
            value={draft.recommendedResponse}
            required
            onChange={(e) => setDraft({ ...draft, recommendedResponse: e.target.value })}
          />
          <div className="flex gap-2">
            <Button type="submit">Save objection</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <LocalDraftNotice changed message={message} />
        </form>
      )}
      <LocalSettingsNote title="SUGGESTED">
        Suggested clusters and example phrases aren't supplied yet. Seen counts have no reporting
        window, so they aren't labeled as a monthly total.
      </LocalSettingsNote>
    </LocalMethodologyLayout>
  );
}
