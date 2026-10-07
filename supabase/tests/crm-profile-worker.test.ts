import { afterEach, expect, test, vi } from "vitest";
import { generateWorkerProfile } from "../functions/_shared/crm-profile-worker";

const schema = {
  type: "object", required: ["base_profile", "fields"], properties: {
    base_profile: { type: "string", enum: ["insurance", "solar"] },
    fields: { type: "array", items: { type: "object", required: ["key"], properties: { key: { type: "string" } } } },
  },
};
const request = (industry: string) => ({ systemPrompt: "CRM setup", userPrompt: industry, tool: { parameters: schema }, maxTokens: 1800 });
afterEach(() => vi.unstubAllGlobals());

test.each([["insurance", "coverage_goal"], ["solar", "roof_ownership"]])("preserves tailored %s fields and sends user JWT", async (industry, field) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ provider: "cloudflare-workers-ai", model: "test-model", answer: JSON.stringify({ base_profile: industry, fields: [{ key: field }] }) })));
  vi.stubGlobal("fetch", fetchMock);
  const result = await generateWorkerProfile(request(industry), "Bearer test-user-jwt");
  expect(result.toolResult.fields).toEqual([{ key: field }]);
  expect(result.model).toBe("cloudflare-workers-ai:test-model");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://ai.usebylda.com");
  expect(options.headers.Authorization).toBe("Bearer test-user-jwt");
  expect(JSON.parse(options.body).message).toContain(industry);
});

test.each(["not JSON", '{"base_profile":"solar","fields":[]}', '{"base_profile":"fake","fields":[{"key":"x"}]}', '{"base_profile":"solar","fields":[null]}'])("rejects invalid generation: %s", async (answer) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ provider: "cloudflare-workers-ai", answer }))));
  await expect(generateWorkerProfile(request("solar"), "Bearer test")).rejects.toThrow();
});

test.each([401, 429, 502])("does not substitute a template on HTTP %s", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failed", { status })));
  await expect(generateWorkerProfile(request("solar"), "Bearer test")).rejects.toThrow(status === 401 ? /session/ : /failed/);
});
