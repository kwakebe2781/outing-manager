import test from "node:test";
import assert from "node:assert/strict";
import { cleanMessages, localClock, parseStructuredText, validateState } from "../src/index.js";
test("validateState accepts GoPlan base data", () => {
  const input = { wishes: [{ id: "w1", title: "博物館" }], plans: [{ id: "p1", title: "おでかけ", date: "2026-12-01" }] };
  assert.equal(JSON.parse(validateState(input)).wishes.length, 1);
});
test("validateState rejects malformed data and too many items", () => {
  assert.throws(() => validateState({ wishes: "no", plans: [] }));
  assert.throws(() => validateState({ wishes: Array(501).fill({ title: "x" }), plans: [] }));
});
test("cleanMessages keeps bounded user and assistant messages", () => {
  const result = cleanMessages([{ role: "system", content: "x" }, { role: "user", content: "相談" }, { role: "assistant", content: "回答" }]);
  assert.deepEqual(result.map((x) => x.role), ["user", "assistant"]);
  assert.equal(cleanMessages([{ role: "user", content: "a".repeat(5000) }])[0].content.length, 4000);
});
test("parseStructuredText parses JSON object and rejects other text", () => {
  assert.deepEqual(parseStructuredText('{"answer":"ok"}'), { answer: "ok" });
  assert.equal(parseStructuredText("not json"), null);
});
test("localClock converts UTC to the supplied timezone", () => {
  const clock = localClock(new Date("2026-11-20T15:00:00.000Z"), "Asia/Tokyo");
  assert.equal(clock.date, "2026-11-21");
  assert.equal(clock.hour, 0);
});
