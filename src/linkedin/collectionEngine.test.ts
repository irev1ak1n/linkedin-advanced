import { describe, expect, it } from "vitest";
import { createCollectionEngine } from "./collectionEngine";
import type { LinkedInProfile } from "../models/profile";

function profile(overrides: Partial<LinkedInProfile>): LinkedInProfile {
  return { experience: [], education: [], skills: [], projects: [], extracted: true, ...overrides };
}

/** A controllable fake clock/extractor/scroll-position harness so the engine's timing logic
 * can be tested deterministically, with no real timers and no DOM. */
function createHarness(initialKey: string | null) {
  let clock = 0;
  let key = initialKey;
  let extracted: LinkedInProfile = profile({});
  let nearEnd = false;
  const updates: { profileKey: string; profile: LinkedInProfile; status: string }[] = [];
  const resets: string[] = [];

  const engine = createCollectionEngine({
    now: () => clock,
    extractProfile: () => extracted,
    getProfileKey: () => key,
    isNearDocumentEnd: () => nearEnd,
    onUpdate: (profileKey, p, collection) => updates.push({ profileKey, profile: p, status: collection.status }),
    onReset: (profileKey) => resets.push(profileKey),
  });

  return {
    engine,
    advance: (ms: number) => {
      clock += ms;
    },
    setKey: (k: string | null) => {
      key = k;
    },
    setExtracted: (p: LinkedInProfile) => {
      extracted = p;
    },
    setNearEnd: (v: boolean) => {
      nearEnd = v;
    },
    updates,
    resets,
  };
}

describe("createCollectionEngine - basic accumulation", () => {
  it("reports an update the first time a profile is read", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].profileKey).toBe("alice");
  });

  it("does not report a duplicate update when nothing changed", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    h.engine.tick();
    h.engine.tick();
    expect(h.updates).toHaveLength(1);
  });

  it("reports a new update each time more content is found (natural DOM growth from scrolling)", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    h.setExtracted(profile({ headline: "Engineer", about: "I build things." }));
    h.engine.tick();
    expect(h.updates).toHaveLength(2);
    expect(h.updates[1].profile.about).toBe("I build things.");
  });

  it("never marks status settled while content is still changing, no matter how much time passes", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    h.setNearEnd(true);
    h.advance(100_000); // a long time, but content is about to change again
    h.setExtracted(profile({ headline: "Engineer", about: "New content just appeared." }));
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("collecting");
  });
});

describe("createCollectionEngine - settling", () => {
  it("settles only once BOTH a quiet period has passed AND the document end was reached", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("collecting");

    h.advance(3000); // quiet period alone
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("collecting"); // never reached the end

    h.setNearEnd(true);
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("settled");
  });

  it("never settles from a fixed timer alone while the document end has never been reached", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.engine.tick();
    h.advance(1_000_000);
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("collecting");
  });

  it("never settles merely because the document end was reached, without a quiet period", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.setNearEnd(true);
    h.engine.tick(); // reaches end on the very first tick, zero quiet time elapsed
    expect(h.engine.getCollectionState().status).toBe("collecting");
  });

  it("remembers having reached the document end even if the user scrolls back up", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Engineer" }));
    h.setNearEnd(true);
    h.engine.tick();
    h.setNearEnd(false); // scrolled back up
    h.advance(3000);
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("settled");
  });
});

describe("createCollectionEngine - profile navigation", () => {
  it("resets collection state when the profile identity changes", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Alice's headline", about: "About Alice" }));
    h.setNearEnd(true);
    h.engine.tick();
    h.advance(3000);
    h.engine.tick();
    expect(h.engine.getCollectionState().status).toBe("settled");

    h.setKey("bob");
    h.setExtracted(profile({ headline: "Bob's headline" }));
    h.engine.tick();

    expect(h.resets).toEqual(["alice", "bob"]); // "alice" was the very first profile ever seen, also a reset from nothing
    expect(h.engine.getCollectionState().status).toBe("collecting");
    expect(h.engine.getCollectionState().sectionsFound).toEqual(["headline"]);
  });

  it("never mixes evidence from two different profiles", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Alice", about: "Alice's about section" }));
    h.engine.tick();

    h.setKey("bob");
    h.setExtracted(profile({ headline: "Bob" }));
    h.engine.tick();

    const lastUpdate = h.updates[h.updates.length - 1];
    expect(lastUpdate.profile.about).toBeUndefined();
    expect(lastUpdate.profile.headline).toBe("Bob");
  });

  it("does nothing when there is no supported profile on the page, without resetting existing state", () => {
    const h = createHarness("alice");
    h.setExtracted(profile({ headline: "Alice" }));
    h.engine.tick();

    h.setKey(null);
    h.engine.tick();

    expect(h.engine.getProfileKey()).toBe("alice"); // unchanged, not reset to null
    expect(h.resets).toEqual(["alice"]); // only the original entry into "alice"
  });
});

describe("createCollectionEngine - determinism", () => {
  it("produces the same sequence of updates for the same sequence of inputs", () => {
    function run() {
      const h = createHarness("alice");
      h.setExtracted(profile({ headline: "Engineer" }));
      h.engine.tick();
      h.setExtracted(profile({ headline: "Engineer", about: "About text." }));
      h.engine.tick();
      h.setNearEnd(true);
      h.advance(3000);
      h.engine.tick();
      return h.updates.map((u) => ({ status: u.status, headline: u.profile.headline, about: u.profile.about }));
    }
    expect(run()).toEqual(run());
  });
});
