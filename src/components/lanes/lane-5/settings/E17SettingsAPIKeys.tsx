import { DataBoundary } from "@/components/bylda";
import { useApiKeys } from "@/lib/data";
import {
  cell,
  LocalSettingsEmpty,
  LocalSettingsHeading,
  LocalSettingsTable,
} from "./LocalSettings";
import { LocalAccountAction, LocalAccountLayout, LocalAccountMissingRow } from "./LocalAccount";
import { displayDate } from "./accountModel";
export function E17SettingsAPIKeys() {
  return (
    <LocalAccountLayout active="API keys">
      <KeysContent />
    </LocalAccountLayout>
  );
}
function KeysContent() {
  const query = useApiKeys();
  return (
    <>
      <LocalSettingsHeading
        title="API keys"
        subtitle="Masked keys and their assigned scopes. Only the key suffix is shown."
        action={<LocalAccountAction label="Create key" variant="primary" />}
      />
      <DataBoundary query={query} empty={<LocalSettingsEmpty noun="API keys" />}>
        {(keys) => (
          <LocalSettingsTable
            headings={["NAME", "KEY", "SCOPES", "LAST USED"]}
            columnClasses={["w-[25%]", "w-[25%]", "w-[25%]", "w-[25%]"]}
          >
            {keys.map((key) => (
              <tr key={key.id}>
                <td className={cell}>
                  <span className="type-ui-body-strong">{key.label}</span>
                </td>
                <td className={`${cell} type-mono-data text-by-text-secondary`}>
                  •••• {key.last4}
                </td>
                <td className={cell}>
                  {key.scopes.length ? key.scopes.join(" · ") : "No scopes assigned"}
                </td>
                <td className={`${cell} type-mono-data text-by-text-secondary`}>
                  {key.lastUsedAt ? displayDate(key.lastUsedAt) : "Never used"}
                </td>
              </tr>
            ))}
          </LocalSettingsTable>
        )}
      </DataBoundary>
      <h2 className="type-ui-label">WEBHOOKS</h2>
      <LocalSettingsTable
        headings={["EVENT", "ENDPOINT", "STATUS"]}
        columnClasses={["w-[34%]", "w-[37%]", "w-[29%]"]}
      >
        <LocalAccountMissingRow columns={3}>
          Webhook settings aren't available yet.
        </LocalAccountMissingRow>
      </LocalSettingsTable>
    </>
  );
}
