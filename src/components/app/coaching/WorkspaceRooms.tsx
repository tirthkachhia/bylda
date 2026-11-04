import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { organizationMembersQuery } from "@/lib/queries";
import {
  roomsQuery,
  createRoom,
  roomMessagesQuery,
  saveRoomMessage,
  deleteRoomMessage,
} from "@/lib/coaching/workspace";
export function WorkspaceRooms({ create = false }: { create?: boolean }) {
  const { currentOrgId, user } = useAuth(),
    org = currentOrgId ?? "";
  const qc = useQueryClient(),
    rooms = useQuery(roomsQuery(org)),
    members = useQuery(organizationMembersQuery(org));
  const [roomId, setRoomId] = useState(""),
    [form, setForm] = useState(create),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [privateRoom, setPrivateRoom] = useState(false),
    [memberIds, setMemberIds] = useState<string[]>([]),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const room = rooms.data?.find((r) => r.id === roomId) ?? rooms.data?.[0];
  const messages = useQuery(roomMessagesQuery(room?.id ?? ""));
  async function addRoom() {
    setBusy(true);
    setError("");
    try {
      const r = await createRoom({
        organization_id: org,
        name: name.trim(),
        description: description.trim(),
        visibility: privateRoom ? "private" : "workspace",
        member_ids: memberIds,
      });
      await qc.invalidateQueries({ queryKey: ["coaching-rooms", org] });
      setRoomId(r.id);
      setForm(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Room could not save.");
    } finally {
      setBusy(false);
    }
  }
  async function post() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await saveRoomMessage(room.id, body);
      setBody("");
      await qc.invalidateQueries({ queryKey: ["coaching-room-messages", room.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="figma-panel space-y-4">
      <div className="flex justify-between">
        <h1>Conversations</h1>
        <button className="figma-button" onClick={() => setForm((v) => !v)}>
          Create room
        </button>
      </div>
      {form && (
        <section className="space-y-3 rounded-xl border p-4">
          <label className="figma-field">
            Room name
            <input maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="figma-field">
            Description
            <textarea
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={privateRoom}
              onChange={(e) => setPrivateRoom(e.target.checked)}
            />
            Private room
          </label>
          {privateRoom && (
            <fieldset>
              <legend className="text-xs">Invite workspace members</legend>
              {members.data
                ?.filter((m) => m.user_id !== user?.id)
                .map((m) => (
                  <label key={m.user_id} className="flex gap-2 text-xs mt-2">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(m.user_id)}
                      onChange={(e) =>
                        setMemberIds((ids) =>
                          e.target.checked
                            ? [...ids, m.user_id]
                            : ids.filter((id) => id !== m.user_id),
                        )
                      }
                    />
                    {m.full_name ?? m.email ?? m.user_id}
                  </label>
                ))}
            </fieldset>
          )}
          <button
            className="figma-button"
            disabled={busy || !name.trim()}
            onClick={() => void addRoom()}
          >
            Save room
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {rooms.isPending ? (
        <p>Loading rooms…</p>
      ) : rooms.error ? (
        <p role="alert">
          Rooms could not load.{" "}
          <button className="underline" onClick={() => void rooms.refetch()}>
            Retry
          </button>
        </p>
      ) : (
        <>
          <nav className="figma-tabs">
            {rooms.data?.map((r) => (
              <button
                key={r.id}
                aria-pressed={room?.id === r.id}
                onClick={() => {
                  setRoomId(r.id);
                  setBody("");
                }}
              >
                {r.visibility === "private" ? "Private · " : "# "}
                {r.name}
              </button>
            ))}
          </nav>
          {room ? (
            <div className="space-y-4">
              <h2>{room.name}</h2>
              <p className="text-xs">{room.description}</p>
              {messages.error ? (
                <p role="alert">
                  Messages could not load.{" "}
                  <button onClick={() => void messages.refetch()}>Retry</button>
                </p>
              ) : messages.isPending ? (
                <p>Loading messages…</p>
              ) : (
                messages.data?.map((m) => (
                  <article key={m.id} className="rounded-lg border p-3">
                    <p className="text-[11px]">
                      {m.author_id === user?.id
                        ? "You"
                        : (members.data?.find((u) => u.user_id === m.author_id)?.full_name ??
                          "Workspace member")}{" "}
                      · {new Date(m.created_at).toLocaleString()}
                    </p>
                    <p className="my-2 whitespace-pre-wrap text-sm">{m.body}</p>
                    {m.author_id === user?.id && (
                      <button
                        className="text-xs underline"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Delete this message?"))
                            void deleteRoomMessage(m)
                              .then(() => messages.refetch())
                              .catch((e) => setError(e.message));
                        }}
                      >
                        Delete message
                      </button>
                    )}
                  </article>
                ))
              )}
              <label className="figma-field">
                Message
                <textarea
                  rows={3}
                  maxLength={10000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button
                className="figma-button"
                disabled={busy || !body.trim() || !!messages.error}
                onClick={() => void post()}
              >
                Post to room
              </button>
            </div>
          ) : (
            <p className="figma-empty">
              No rooms yet. Create one for your team's coaching discussion.
            </p>
          )}
        </>
      )}
    </section>
  );
}
