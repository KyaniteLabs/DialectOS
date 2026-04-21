/**
 * Translation policy tests
 * Addresses GitHub issue #14
 */

import { describe, it, expect } from "vitest";
import {
  resolvePolicy,
  listPolicyProfiles,
  type PolicyProfile,
} from "../lib/translation-policy.js";

describe("translation policy", () => {
  describe("resolvePolicy", () => {
    it("should return strict preset", () => {
      const policy = resolvePolicy("strict");
      expect(policy.profile).toBe("strict");
      expect(policy.failurePolicy).toBe("strict");
      expect(policy.validateStructure).toBe(true);
      expect(policy.structureMode).toBe("strict");
      expect(policy.glossaryMode).toBe("strict");
      expect(policy.protectIdentities).toBe(true);
      expect(policy.resume).toBe(true);
    });

    it("should return balanced preset", () => {
      const policy = resolvePolicy("balanced");
      expect(policy.profile).toBe("balanced");
      expect(policy.failurePolicy).toBe("allow-partial");
      expect(policy.validateStructure).toBe(true);
      expect(policy.structureMode).toBe("warn");
      expect(policy.glossaryMode).toBe("strict");
      expect(policy.protectIdentities).toBe(true);
      expect(policy.resume).toBe(true);
    });

    it("should return permissive preset", () => {
      const policy = resolvePolicy("permissive");
      expect(policy.profile).toBe("permissive");
      expect(policy.failurePolicy).toBe("allow-partial");
      expect(policy.validateStructure).toBe(false);
      expect(policy.structureMode).toBe("warn");
      expect(policy.glossaryMode).toBe("off");
      expect(policy.protectIdentities).toBe(false);
      expect(policy.resume).toBe(false);
    });

    it("should default to balanced when no profile given", () => {
      const policy = resolvePolicy();
      expect(policy.profile).toBe("balanced");
    });

    it("should allow individual overrides", () => {
      const policy = resolvePolicy("strict", {
        failurePolicy: "allow-partial",
        validateStructure: false,
      });
      expect(policy.profile).toBe("strict");
      expect(policy.failurePolicy).toBe("allow-partial");
      expect(policy.validateStructure).toBe(false);
      // Other strict values remain
      expect(policy.structureMode).toBe("strict");
      expect(policy.glossaryMode).toBe("strict");
    });

    it("should throw for unknown profile", () => {
      expect(() => resolvePolicy("unknown" as PolicyProfile)).toThrow(
        /Unknown policy profile/
      );
    });
  });

  describe("listPolicyProfiles", () => {
    it("should return all profiles with descriptions", () => {
      const profiles = listPolicyProfiles();
      expect(profiles).toHaveLength(3);
      expect(profiles.map((p) => p.name)).toEqual([
        "strict",
        "balanced",
        "permissive",
      ]);
      expect(profiles[0].description).toContain("production");
      expect(profiles[1].description).toContain("CI");
      expect(profiles[2].description).toContain("drafts");
    });
  });
});
