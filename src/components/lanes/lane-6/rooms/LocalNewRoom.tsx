import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Button, DataBoundary, StateEmpty, StateError, SystemState } from "@/components/bylda";
import { useRooms, useViewer } from "@/lib/data";
import { LocalField, LocalSettingsNote } from "@/components/lanes/lane-5/settings/LocalSettings";
import { LocalPreferenceSwitch } from "@/components/lanes/lane-5/settings/LocalPreferences";
import { roomNameError } from "./dmModel";
function Draft({ slugs }: { slugs: string[] }) {
  const navigate = useNavigate();
  const [type, setType] = useState("Team room");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [posts, setPosts] = useState<string[]>([]);
  const close = () => void navigate({ to: "/app/rooms", search: true });
  const error = name ? roomNameError(name, slugs) : null;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-by-surface-scrim" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("room-draft-name")?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-by-card border border-by-border-strong bg-by-surface-raised text-by-text-primary shadow-by-float"
        >
          <header className="flex items-center justify-between border-b border-by-border-engraved px-[22px] py-4">
            <Dialog.Title className="type-ui-body-strong">Create a room</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close new room">
                Close
              </Button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="type-ui-small px-[22px] pt-4 text-by-text-secondary">
            Draft preview. Room creation and member selection aren't connected.
          </Dialog.Description>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5 p-[22px]">
            <fieldset>
              <legend className="type-ui-label mb-3 text-by-text-secondary">Type</legend>
              <div className="flex flex-wrap gap-2">
                {[
                  "Team room",
                  "Deal room",
                  "Topic / watch room",
                  "Coaching (private)",
                  "Announcements",
                ].map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={type === value ? "primary" : "secondary"}
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </fieldset>
            <LocalField
              label="Name"
              id="room-draft-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="room-name"
              aria-invalid={!!error}
              aria-describedby={error ? "room-name-error" : undefined}
            />
            {error && (
              <p id="room-name-error" role="alert" className="type-ui-small text-by-feedback-error">
                {error}
              </p>
            )}
            <LocalField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this room is for"
            />
            <fieldset>
              <legend className="type-ui-label mb-2 text-by-text-secondary">
                What should Bylda post here?
              </legend>
              {[
                "Daily brief for these members",
                "New patterns & regressions",
                "Strong / weak call examples",
                "Coaching assigned & results",
                "Friday digest",
              ].map((label) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <span className="type-ui-small">{label}</span>
                  <LocalPreferenceSwitch
                    label={label}
                    checked={posts.includes(label)}
                    onChange={(checked) =>
                      setPosts((values) =>
                        checked ? [...values, label] : values.filter((v) => v !== label),
                      )
                    }
                  />
                </div>
              ))}
            </fieldset>
            <LocalField label="Members" disabled placeholder="Membership selection unavailable" />
            <LocalSettingsNote title="DRAFT ONLY">
              Nothing is saved. Posting rules, private visibility and Slack mirroring require shared
              contracts.
            </LocalSettingsNote>
            <footer className="flex justify-end gap-2 border-t border-by-border-engraved pt-4">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button disabled>Create room</Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Loaded() {
  const q = useRooms();
  return (
    <DataBoundary
      query={q}
      empty={<Draft slugs={[]} />}
      error={() => (
        <StateError body="Room names couldn't be checked." onRetry={() => void q.refetch()} />
      )}
    >
      {(rooms) => <Draft slugs={rooms.map((r) => r.slug)} />}
    </DataBoundary>
  );
}
/** TODO(#73): fold accessible room draft dialog into kit; reuse #34 and #38 controls. */
export function LocalNewRoom() {
  const q = useViewer();
  return (
    <main className="p-7 text-by-text-primary">
      <h1 className="type-editorial-h1">Rooms</h1>
      <DataBoundary
        query={q}
        empty={<StateEmpty title="Sign in to create a room." />}
        error={() => (
          <StateError body="Access couldn't be checked." onRetry={() => void q.refetch()} />
        )}
      >
        {(v) =>
          ["manager", "owner", "admin"].includes(v.role) ? (
            <Loaded />
          ) : (
            <SystemState
              eyebrow="Y9 · ACCESS RESTRICTED"
              title="Room creation isn't available to your role."
            />
          )
        }
      </DataBoundary>
    </main>
  );
}
