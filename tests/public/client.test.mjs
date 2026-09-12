import test from "node:test";
import assert from "node:assert/strict";
import { createOpenSourceClient } from "@pageon/api-client/public";
import { OPEN_SOURCE_TRANSFORM_URL } from "@pageon/protocol/public";

test("public client uses the official anonymous endpoint and stable contract", async () => {
  const client = createOpenSourceClient({ fetch: async (url, options) => {
    assert.equal(url, OPEN_SOURCE_TRANSFORM_URL);
    assert.equal(options.credentials, "omit");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("lang"), "zh");
    assert.equal(options.body.get("fileName"), "test.html");
    assert.equal(options.body.get("premium"), null);
    return Response.json({ previewHtml: "<p>test</p>", exportTemplate: "<p>test</p>", transformVersion: 1, stats: { editableCount: 1 } });
  } });
  assert.equal((await client.transform(new File(["<p>test</p>"], "test.html"), { lang: "zh" })).stats.editableCount, 1);
});

test("client preserves errors and supports an alternate service without extra auth", async () => {
  const client = createOpenSourceClient({ endpoint: "http://localhost:3000/api/open-source/transform", fetch: async url => {
    assert.ok(url.startsWith("http://localhost:3000/"));
    return Response.json({ error: "rate-limited" }, { status: 429 });
  } });
  await assert.rejects(client.transform(new File(["hi"], "test.html")), error => error.code === "rate-limited" && error.status === 429);
});
