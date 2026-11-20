import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "goplan-cloud.js"), "utf8");
const start = source.indexOf("function mergeCollection(");
const end = source.indexOf("\nfunction stampLocalChanges", start);
assert.ok(start >= 0 && end > start, "Could not locate cloud merge implementation");

const implementation = source.slice(start, end);
const { mergeCloud } = new Function(
  "function clone(value){return JSON.parse(JSON.stringify(value||{}));}\n" +
  implementation +
  "\nreturn { mergeCloud };"
)();

const cases = [
  ["merge concurrent wishes and plans", () => {
    const merged = mergeCloud(
      { wishes: [{ id: "w1", title: "A", _updatedAt: 10 }], plans: [{ id: "p1", title: "P1", _updatedAt: 10, date: "2026-12-01" }], updatedAt: 10 },
      { wishes: [{ id: "w2", title: "B", _updatedAt: 11 }], plans: [{ id: "p2", title: "P2", _updatedAt: 11, date: "2026-12-02" }], updatedAt: 11 }
    );
    assert.equal(merged.wishes.length, 2);
    assert.equal(merged.plans.length, 2);
  }],
  ["do not resurrect deleted wishes", () => {
    const merged = mergeCloud(
      { wishes: [], plans: [], tombstones: [{ id: "w1", collection: "wishes", deletedAt: 20 }], updatedAt: 20 },
      { wishes: [{ id: "w1", title: "A", _updatedAt: 10 }], plans: [], updatedAt: 10 }
    );
    assert.equal(merged.wishes.length, 0);
  }],
  ["merge separate PLANI conversations", () => {
    const merged = mergeCloud(
      { aiConversations: [{ id: "c1", updatedAt: 10, messages: [] }], updatedAt: 10 },
      { aiConversations: [{ id: "c2", updatedAt: 11, messages: [] }], updatedAt: 11 }
    );
    assert.equal(merged.aiConversations.length, 2);
  }],
  ["do not resurrect deleted PLANI conversations", () => {
    const merged = mergeCloud(
      { aiConversations: [], aiTombstones: [{ type: "conversation", key: "c1", deletedAt: 20 }], updatedAt: 20 },
      { aiConversations: [{ id: "c1", updatedAt: 10, messages: [] }], updatedAt: 10 }
    );
    assert.equal(merged.aiConversations.length, 0);
  }],
  ["do not resurrect deleted saved AI plans", () => {
    const merged = mergeCloud(
      { savedAiPlans: [], aiTombstones: [{ type: "plan", key: "p1", deletedAt: 20 }], updatedAt: 20 },
      { savedAiPlans: [{ id: "p1", savedAt: 10 }], updatedAt: 10 }
    );
    assert.equal(merged.savedAiPlans.length, 0);
  }],
  ["do not resurrect deleted AI memories", () => {
    const merged = mergeCloud(
      { aiMemories: [], aiMemoryTimes: {}, aiTombstones: [{ type: "memory", key: "remember me", deletedAt: 20 }], updatedAt: 20 },
      { aiMemories: ["remember me"], aiMemoryTimes: { "remember me": 10 }, updatedAt: 10 }
    );
    assert.equal(merged.aiMemories.length, 0);
  }],
  ["allow re-saving a previously deleted AI memory", () => {
    const merged = mergeCloud(
      { aiMemories: ["remember me"], aiMemoryTimes: { "remember me": 30 }, updatedAt: 30 },
      { aiMemories: [], aiMemoryTimes: {}, aiTombstones: [{ type: "memory", key: "remember me", deletedAt: 20 }], updatedAt: 20 }
    );
    assert.deepEqual(merged.aiMemories, ["remember me"]);
  }],
  ["preserve legacy conversations and memories without timestamps", () => {
    const merged = mergeCloud(
      { aiConversations: [{ id: "legacy-chat", messages: [] }], aiMemories: ["legacy-memory"], updatedAt: 10 },
      { aiConversations: [], aiMemories: [], updatedAt: 5 }
    );
    assert.equal(merged.aiConversations.length, 1);
    assert.deepEqual(merged.aiMemories, ["legacy-memory"]);
  }],
  ["device-only wallpaper cannot erase shared wallpaper", () => {
    const merged = mergeCloud(
      { wallpaper: null, updatedAt: 30 },
      { wallpaper: { color: "#abcabc", syncEnabled: true, updatedAt: 20 }, updatedAt: 20 }
    );
    assert.equal(merged.wallpaper.color, "#abcabc");
  }],
  ["wallpaper conflict is resolved by wallpaper timestamp", () => {
    const merged = mergeCloud(
      { wallpaper: { color: "#aaaaaa", syncEnabled: true, updatedAt: 10 }, updatedAt: 100 },
      { wallpaper: { color: "#bbbbbb", syncEnabled: true, updatedAt: 20 }, updatedAt: 20 }
    );
    assert.equal(merged.wallpaper.color, "#bbbbbb");
  }]
];

for (const [name, run] of cases) {
  try { run(); }
  catch (error) {
    console.error("FAIL:", name);
    throw error;
  }
}
console.log("Cloud merge tests passed: " + cases.length);
