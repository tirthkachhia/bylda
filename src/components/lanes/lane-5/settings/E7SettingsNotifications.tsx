import { useState } from "react";
import { Button, DataBoundary } from "@/components/bylda";
import { useNotificationPreferences, type NotificationPreferences } from "@/lib/data";
import {
  LocalSettingsLayout,
  LocalSettingsHeading,
  LocalSettingRow,
  LocalSelect,
  LocalSettingsTable,
  cell,
} from "./LocalSettings";
import {
  LocalPreferenceSwitch,
  LocalMissingPreference,
  LocalDraftNotice,
} from "./LocalPreferences";

const channels = [
  ["in_app", "In-app"],
  ["email", "Email"],
  ["slack", "Slack"],
] as const;
const labels: Record<string, string> = {
  daily_brief: "Daily brief",
  behavior_regression: "Behavior regression on my team",
  important_call: "Important call",
  coaching_completed: "Coaching acknowledged / completed",
  emerging_pattern: "Emerging pattern",
  integration_problem: "Integration problem",
  report_ready: "Report ready",
};
export function E7SettingsNotifications() {
  const query = useNotificationPreferences();
  return (
    <LocalSettingsLayout active="Notifications">
      <DataBoundary query={query}>
        {(preferences) => <NotificationForm preferences={preferences} />}
      </DataBoundary>
    </LocalSettingsLayout>
  );
}
function NotificationForm({ preferences }: { preferences: NotificationPreferences }) {
  const [channel, setChannel] = useState(preferences.channel);
  const [types, setTypes] = useState({ ...preferences.types });
  const [from, setFrom] = useState(preferences.quietHours?.from ?? "");
  const [to, setTo] = useState(preferences.quietHours?.to ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const changed =
    channel !== preferences.channel ||
    from !== (preferences.quietHours?.from ?? "") ||
    to !== (preferences.quietHours?.to ?? "") ||
    Object.keys(types).some((key) => types[key] !== preferences.types[key]);
  const keys = [...new Set([...Object.keys(labels), ...Object.keys(preferences.types)])];
  function save() {
    setMessage(
      (from && !to) || (!from && to)
        ? "Set both quiet-hour times or clear both. Nothing was saved."
        : "Notification saving isn't connected. Nothing was saved.",
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <LocalSettingsHeading
        title="Notifications"
        subtitle="Your personal preferences. Team routing lives in Delivery channels."
      />
      <LocalSettingsTable
        headings={["NOTIFY ME ABOUT", "IN-APP", "EMAIL", "SLACK", "PUSH"]}
        columnClasses={["w-[316px]", "w-[100px]", "w-[100px]", "w-[100px]"]}
      >
        {keys.map((key) => (
          <tr key={key}>
            <th scope="row" className={`${cell} font-normal`}>
              {labels[key] ?? key.replaceAll("_", " ")}
            </th>
            {channels.map(([id, name]) => (
              <td key={id} className={cell}>
                {id === channel && typeof types[key] === "boolean" ? (
                  <LocalPreferenceSwitch
                    label={`${labels[key] ?? key} · ${name}`}
                    checked={types[key]}
                    onChange={(checked) => {
                      setTypes({ ...types, [key]: checked });
                      setMessage(null);
                    }}
                  />
                ) : (
                  <span
                    aria-label={`${labels[key] ?? key} · ${name}: not specified`}
                    className="text-by-text-tertiary"
                  >
                    —
                  </span>
                )}
              </td>
            ))}
            <td className={cell}>
              <span
                aria-label={`${labels[key] ?? key} · Push: not specified`}
                className="text-by-text-tertiary"
              >
                —
              </span>
            </td>
          </tr>
        ))}
      </LocalSettingsTable>
      <p className="type-ui-small text-by-text-secondary">
        The shared settings support one delivery channel. Dashes mean not specified, not off.
        Changing the channel previews the same type preferences on that channel.
      </p>
      <LocalSettingRow label="Delivery channel">
        <LocalSelect
          label="Delivery channel"
          value={channels.find(([id]) => id === channel)?.[1] ?? channel}
          options={channels.map(([, name]) => name)}
          onChange={(name) => {
            const selected = channels.find(([, label]) => label === name);
            if (selected) setChannel(selected[0]);
            setMessage(null);
          }}
        />
      </LocalSettingRow>
      <LocalSettingRow
        label="Quiet hours"
        hint="Times use the shared preference format. Delivery behavior and brief exceptions are not specified."
      >
        <div className="flex shrink-0 items-center gap-2">
          <input
            type="time"
            aria-label="Quiet hours start"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setMessage(null);
            }}
            className="type-ui-small rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2 outline-none focus:ring-2 focus:ring-by-focus-ring"
          />
          <span aria-hidden="true">–</span>
          <input
            type="time"
            aria-label="Quiet hours end"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setMessage(null);
            }}
            className="type-ui-small rounded-by-control border border-by-border-strong bg-by-surface-raised px-3 py-2 outline-none focus:ring-2 focus:ring-by-focus-ring"
          />
        </div>
      </LocalSettingRow>
      <LocalSettingRow label="Batch low-priority items into the brief">
        <LocalMissingPreference />
      </LocalSettingRow>
      <div>
        <Button onClick={save}>Save</Button>
      </div>
      <LocalDraftNotice changed={changed} message={message} />
    </div>
  );
}
