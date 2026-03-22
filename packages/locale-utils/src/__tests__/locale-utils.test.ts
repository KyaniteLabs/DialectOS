import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync, realpathSync } from "node:fs";
import { join } from "node:path";

// Types that should come from @espanol/types (currently placeholder)
export interface I18nEntry {
  key: string;
  value: string;
}

export interface LocaleDiff {
  missingInTarget: string[];
  extraInTarget: string[];
  commonKeys: string[];
}

// Mock fs module BEFORE importing the functions under test
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    statSync: vi.fn(),
    realpathSync: vi.fn(),
  };
});

// Security functions to mock
const validateJsonPath = vi.fn((path: string, options?: { mustExist?: boolean; checkSize?: boolean }) => {
  // Basic mock that returns the path
  return path;
});

const sanitizeErrorMessage = vi.fn((message: string) => {
  return message
    .replace(/\/[a-zA-Z0-9_\-\.\/~]+/g, "[path]")
    .replace(/\\[a-zA-Z0-9_\-\.\\]+/g, "[path]")
    .replace(/ENOENT/g, "file not found")
    .replace(/EACCES/g, "access denied")
    .replace(/EPERM/g, "permission denied");
});

const createSecureTempPath = vi.fn((parentDir: string) => {
  const randomSuffix = Math.random().toString(16).substring(2, 10);
  return join(parentDir, `.tmp_${randomSuffix}`);
});

// Mock the security module BEFORE importing
vi.mock("@espanol/security", () => ({
  validateJsonPath,
  sanitizeErrorMessage,
  createSecureTempPath,
}));

// Mock the types module BEFORE importing
vi.mock("@espanol/types", () => ({
  I18nEntry,
  LocaleDiff,
}));

// Import SecurityError and types from the actual implementation
import {
  readLocaleFile,
  diffLocales,
  writeLocaleFile,
  flattenLocale,
  unflattenLocale,
  SecurityError,
  ErrorCode,
  MAX_KEYS,
  MAX_RECURSION_DEPTH,
} from "../index";

// Mock the types module
vi.mock("@espanol/types", () => ({
  I18nEntry,
  LocaleDiff,
}));

describe("locale-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    vi.mocked(readFileSync).mockReturnValue("{}");
    vi.mocked(realpathSync).mockImplementation((path) => path.toString());
  });

  describe("readLocaleFile", () => {
    it("should read a flat JSON file and return I18nEntry array", () => {
      const mockJson = JSON.stringify({
        "home.title": "Inicio",
        "home.subtitle": "Bienvenido",
      });

      vi.mocked(readFileSync).mockReturnValue(mockJson);

      const result = readLocaleFile("/path/to/locale.json");

      expect(result).toEqual([
        { key: "home.title", value: "Inicio" },
        { key: "home.subtitle", value: "Bienvenido" },
      ]);
      expect(readFileSync).toHaveBeenCalled();
    });

    it("should read a nested JSON file and flatten it with dot notation", () => {
      const mockJson = JSON.stringify({
        nav: {
          home: "Inicio",
          about: "Acerca de",
        },
        footer: {
          links: {
            privacy: "Privacidad",
          },
        },
      });

      vi.mocked(readFileSync).mockReturnValue(mockJson);

      const result = readLocaleFile("/path/to/nested.json");

      expect(result).toEqual([
        { key: "nav.home", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
        { key: "footer.links.privacy", value: "Privacidad" },
      ]);
    });

    it("should throw on invalid JSON", () => {
      vi.mocked(readFileSync).mockReturnValue("invalid json {");

      expect(() => readLocaleFile("/path/to/invalid.json")).toThrow();
    });

    it("should throw on missing file", () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      expect(() => readLocaleFile("/path/to/missing.json")).toThrow();
    });

    it("should handle empty JSON object", () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));

      const result = readLocaleFile("/path/to/empty.json");

      expect(result).toEqual([]);
    });

    it("should validate that parsed value is an object", () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(["array", "values"]));

      expect(() => readLocaleFile("/path/to/array.json")).toThrow();
    });

    it("should validate that parsed value is not a primitive", () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify("string value"));

      expect(() => readLocaleFile("/path/to/primitive.json")).toThrow();
    });

    it("should check key count against MAX_KEYS", () => {
      // Create an object with MAX_KEYS + 1 entries
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < MAX_KEYS + 1; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(largeObj));

      expect(() => readLocaleFile("/path/to/large.json")).toThrow();
    });

    it("should accept exactly MAX_KEYS entries", () => {
      const largeObj: Record<string, string> = {};
      for (let i = 0; i < MAX_KEYS; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(largeObj));

      const result = readLocaleFile("/path/to/large.json");
      expect(result).toHaveLength(MAX_KEYS);
    });

    it("should call realpathSync after validation (TOCTOU fix)", () => {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ key: "value" }));
      vi.mocked(realpathSync).mockReturnValue("/real/path/to/locale.json");

      readLocaleFile("/path/to/locale.json");

      expect(realpathSync).toHaveBeenCalledWith("/path/to/locale.json");
    });
  });

  describe("writeLocaleFile", () => {
    beforeEach(() => {
      vi.mocked(renameSync).mockReturnValue(undefined);
    });

    it("should write valid JSON with default indentation", () => {
      const entries: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
      ];

      writeLocaleFile("/path/to/output.json", entries);

      expect(writeFileSync).toHaveBeenCalled();
      expect(renameSync).toHaveBeenCalled();
    });

    it("should write JSON with custom indentation", () => {
      const entries: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
      ];

      writeLocaleFile("/path/to/output.json", entries, 4);

      expect(writeFileSync).toHaveBeenCalled();
    });

    it("should preserve nesting structure for dot-separated keys", () => {
      const entries: I18nEntry[] = [
        { key: "nav.home", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
        { key: "footer.links.privacy", value: "Privacidad" },
      ];

      writeLocaleFile("/path/to/output.json", entries, 2);

      expect(writeFileSync).toHaveBeenCalled();
      expect(renameSync).toHaveBeenCalled();
    });

    it("should handle empty entries", () => {
      const entries: I18nEntry[] = [];

      writeLocaleFile("/path/to/output.json", entries);

      expect(writeFileSync).toHaveBeenCalled();
      expect(renameSync).toHaveBeenCalled();
    });

    it("should use createSecureTempPath for temp file", () => {
      const entries: I18nEntry[] = [{ key: "key", value: "value" }];

      writeLocaleFile("/path/to/output.json", entries);

      // Verify that a temp file with random suffix was used
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      const tempPath = writeCalls[0][0] as string;
      // Temp file should have .tmp_ prefix with random hex suffix
      expect(tempPath).toMatch(/\.tmp_[a-f0-9]+$/);
      expect(tempPath).toContain("/path/to");
    });

    it("should use O_EXCL flag (wx) for atomic write", () => {
      const entries: I18nEntry[] = [{ key: "key", value: "value" }];

      writeLocaleFile("/path/to/output.json", entries);

      // Check that writeFileSync was called with wx flag
      const writeCalls = vi.mocked(writeFileSync).mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      const options = writeCalls[0][2] as { flag?: string; mode?: number };
      expect(options.flag).toBe("wx");
    });

    it("should rename temp file to target atomically", () => {
      const entries: I18nEntry[] = [{ key: "key", value: "value" }];

      writeLocaleFile("/path/to/output.json", entries);

      expect(renameSync).toHaveBeenCalled();
      const renameCalls = vi.mocked(renameSync).mock.calls;
      expect(renameCalls.length).toBeGreaterThan(0);
      const [fromPath, toPath] = renameCalls[0];
      expect(fromPath).toMatch(/\.tmp_[a-f0-9]+$/);
      expect(toPath).toBe("/path/to/output.json");
    });

    it("should check key count against MAX_KEYS before writing", () => {
      const entries: I18nEntry[] = [];
      for (let i = 0; i < MAX_KEYS + 1; i++) {
        entries.push({ key: `key${i}`, value: `value${i}` });
      }

      expect(() => writeLocaleFile("/path/to/output.json", entries)).toThrow();
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("should call realpathSync on parent directory (TOCTOU fix)", () => {
      const entries: I18nEntry[] = [{ key: "key", value: "value" }];
      vi.mocked(realpathSync).mockReturnValue("/real/path/to");

      writeLocaleFile("/path/to/output.json", entries);

      expect(realpathSync).toHaveBeenCalledWith("/path/to");
    });

    it("should clean up temp file on error", () => {
      const entries: I18nEntry[] = [{ key: "key", value: "value" }];
      vi.mocked(writeFileSync).mockImplementation(() => {
        throw new Error("Write failed");
      });

      expect(() => writeLocaleFile("/path/to/output.json", entries)).toThrow();
      expect(rmSync).toHaveBeenCalled();
      const rmCalls = vi.mocked(rmSync).mock.calls;
      expect(rmCalls.length).toBeGreaterThan(0);
      const [tempPath, options] = rmCalls[0];
      expect(tempPath).toMatch(/\.tmp_[a-f0-9]+$/);
      expect(options).toEqual({ force: true });
    });
  });

  describe("flattenLocale", () => {
    it("should handle flat object", () => {
      const obj = {
        "home.title": "Inicio",
        "nav.about": "Acerca de",
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "home.title", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
      ]);
    });

    it("should handle nested object with dot notation", () => {
      const obj = {
        nav: {
          home: "Inicio",
          about: "Acerca de",
        },
        footer: {
          links: {
            privacy: "Privacidad",
            terms: "Términos",
          },
        },
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "nav.home", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
        { key: "footer.links.privacy", value: "Privacidad" },
        { key: "footer.links.terms", value: "Términos" },
      ]);
    });

    it("should handle nested object (2 levels)", () => {
      const obj = {
        level1: {
          level2a: "value1",
          level2b: "value2",
        },
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "level1.level2a", value: "value1" },
        { key: "level1.level2b", value: "value2" },
      ]);
    });

    it("should handle deeply nested object (5 levels)", () => {
      const obj = {
        a: {
          b: {
            c: {
              d: {
                e: "deep value",
              },
            },
          },
        },
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "a.b.c.d.e", value: "deep value" },
      ]);
    });

    it("should handle arrays", () => {
      const obj = {
        items: ["uno", "dos", "tres"],
        nested: {
          values: [1, 2, 3],
        },
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "items.0", value: "uno" },
        { key: "items.1", value: "dos" },
        { key: "items.2", value: "tres" },
        { key: "nested.values.0", value: "1" },
        { key: "nested.values.1", value: "2" },
        { key: "nested.values.2", value: "3" },
      ]);
    });

    it("should handle mixed nesting", () => {
      const obj = {
        nav: {
          home: "Inicio",
          items: ["a", "b"],
        },
        "flat.key": "value",
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "nav.home", value: "Inicio" },
        { key: "nav.items.0", value: "a" },
        { key: "nav.items.1", value: "b" },
        { key: "flat.key", value: "value" },
      ]);
    });

    it("should handle empty object", () => {
      const result = flattenLocale({});

      expect(result).toEqual([]);
    });

    it("should handle null values as empty string", () => {
      const obj = {
        nullKey: null,
        normalKey: "value",
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "nullKey", value: "" },
        { key: "normalKey", value: "value" },
      ]);
    });

    it("should handle null value in nested object", () => {
      const obj = {
        nested: {
          nullValue: null,
        },
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "nested.nullValue", value: "" },
      ]);
    });

    it("should throw SecurityError for deeply nested object (25+ levels)", () => {
      // Create an object nested 25 levels deep
      let obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < 25; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`] as Record<string, unknown>;
      }
      current.value = "too deep";

      expect(() => flattenLocale(obj)).toThrow(SecurityError);
      expect(() => flattenLocale(obj)).toThrow(/depth|exceeded/i);
    });

    it("should accept object at exactly MAX_RECURSION_DEPTH", () => {
      let obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < MAX_RECURSION_DEPTH; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`] as Record<string, unknown>;
      }
      current.value = "acceptable";

      expect(() => flattenLocale(obj)).not.toThrow();
    });

    it("should throw SecurityError for circular reference", () => {
      const obj: Record<string, unknown> = { a: {} };
      (obj.a as Record<string, unknown>).self = obj;

      expect(() => flattenLocale(obj)).toThrow(SecurityError);
      expect(() => flattenLocale(obj)).toThrow(/circular/i);
    });

    it("should throw SecurityError for indirect circular reference", () => {
      const obj: Record<string, unknown> = { a: {} };
      const middle: Record<string, unknown> = { b: {} };
      (obj.a as Record<string, unknown>).middle = middle;
      middle.b = obj;

      expect(() => flattenLocale(obj)).toThrow(SecurityError);
    });

    it("should handle arrays with objects", () => {
      const obj = {
        items: [
          { name: "Item 1", value: "1" },
          { name: "Item 2", value: "2" },
        ],
      };

      const result = flattenLocale(obj);

      expect(result).toEqual([
        { key: "items.0.name", value: "Item 1" },
        { key: "items.0.value", value: "1" },
        { key: "items.1.name", value: "Item 2" },
        { key: "items.1.value", value: "2" },
      ]);
    });

    it("should use custom maxDepth parameter", () => {
      const obj = {
        a: {
          b: {
            c: "value",
          },
        },
      };

      // With maxDepth=1, should throw (only 1 level of object nesting allowed)
      expect(() => flattenLocale(obj, 1)).toThrow(SecurityError);

      // With maxDepth=2, should work (2 levels of object nesting: a and b)
      expect(() => flattenLocale(obj, 2)).not.toThrow();

      // With maxDepth=5, should also work
      expect(() => flattenLocale(obj, 5)).not.toThrow();
    });
  });

  describe("unflattenLocale", () => {
    it("should reconstruct nested object from flat keys", () => {
      const entries: I18nEntry[] = [
        { key: "nav.home", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
        { key: "footer.links.privacy", value: "Privacidad" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        nav: {
          home: "Inicio",
          about: "Acerca de",
        },
        footer: {
          links: {
            privacy: "Privacidad",
          },
        },
      });
    });

    it("should handle dot-separated keys", () => {
      const entries: I18nEntry[] = [
        { key: "a.b.c.d", value: "deep" },
        { key: "a.b.e", value: "shallow" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        a: {
          b: {
            c: {
              d: "deep",
            },
            e: "shallow",
          },
        },
      });
    });

    it("should handle single-level keys", () => {
      const entries: I18nEntry[] = [
        { key: "title", value: "Título" },
        { key: "description", value: "Descripción" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        title: "Título",
        description: "Descripción",
      });
    });

    it("should handle empty entries", () => {
      const result = unflattenLocale([]);

      expect(result).toEqual({});
    });

    it("should detect numeric keys and create arrays", () => {
      const entries: I18nEntry[] = [
        { key: "items.0", value: "uno" },
        { key: "items.1", value: "dos" },
        { key: "items.2", value: "tres" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        items: ["uno", "dos", "tres"],
      });
    });

    it("should handle mixed structure", () => {
      const entries: I18nEntry[] = [
        { key: "title", value: "Main" },
        { key: "nav.home", value: "Inicio" },
        { key: "list.0", value: "first" },
        { key: "list.1", value: "second" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        title: "Main",
        nav: {
          home: "Inicio",
        },
        list: ["first", "second"],
      });
    });

    it("should handle arrays with non-sequential indices", () => {
      const entries: I18nEntry[] = [
        { key: "items.0", value: "first" },
        { key: "items.5", value: "sixth" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        items: ["first", undefined, undefined, undefined, undefined, "sixth"],
      });
    });

    it("should handle nested arrays", () => {
      const entries: I18nEntry[] = [
        { key: "matrix.0.0", value: "a" },
        { key: "matrix.0.1", value: "b" },
        { key: "matrix.1.0", value: "c" },
        { key: "matrix.1.1", value: "d" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        matrix: [
          ["a", "b"],
          ["c", "d"],
        ],
      });
    });

    it("should handle empty key", () => {
      const entries: I18nEntry[] = [
        { key: "", value: "empty key" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        "": "empty key",
      });
    });

    it("should handle trailing dots", () => {
      const entries: I18nEntry[] = [
        { key: "nav.", value: "trailing dot" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        nav: {
          "": "trailing dot",
        },
      });
    });

    it("should handle sparse arrays correctly", () => {
      const entries: I18nEntry[] = [
        { key: "arr.0", value: "zero" },
        { key: "arr.2", value: "two" },
      ];

      const result = unflattenLocale(entries);

      expect(result).toEqual({
        arr: ["zero", undefined, "two"],
      });
    });
  });

  describe("diffLocales", () => {
    it("should find missing keys in target", () => {
      const base: I18nEntry[] = [
        { key: "home.title", value: "Home" },
        { key: "home.subtitle", value: "Welcome" },
        { key: "nav.about", value: "About" },
      ];

      const target: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
        { key: "nav.about", value: "Acerca de" },
      ];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual(["home.subtitle"]);
      expect(result.extraInTarget).toEqual([]);
      expect(result.commonKeys).toEqual(["home.title", "nav.about"]);
    });

    it("should find extra keys in target", () => {
      const base: I18nEntry[] = [
        { key: "home.title", value: "Home" },
        { key: "nav.about", value: "About" },
      ];

      const target: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
        { key: "home.subtitle", value: "Bienvenido" },
        { key: "nav.about", value: "Acerca de" },
      ];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual([]);
      expect(result.extraInTarget).toEqual(["home.subtitle"]);
      expect(result.commonKeys).toEqual(["home.title", "nav.about"]);
    });

    it("should identify common keys", () => {
      const base: I18nEntry[] = [
        { key: "home.title", value: "Home" },
        { key: "home.subtitle", value: "Welcome" },
        { key: "nav.about", value: "About" },
      ];

      const target: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
        { key: "home.subtitle", value: "Bienvenido" },
        { key: "nav.contact", value: "Contacto" },
      ];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual(["nav.about"]);
      expect(result.extraInTarget).toEqual(["nav.contact"]);
      expect(result.commonKeys).toEqual(["home.title", "home.subtitle"]);
    });

    it("should handle empty base locale", () => {
      const base: I18nEntry[] = [];
      const target: I18nEntry[] = [
        { key: "home.title", value: "Inicio" },
      ];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual([]);
      expect(result.extraInTarget).toEqual(["home.title"]);
      expect(result.commonKeys).toEqual([]);
    });

    it("should handle empty target locale", () => {
      const base: I18nEntry[] = [
        { key: "home.title", value: "Home" },
      ];
      const target: I18nEntry[] = [];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual(["home.title"]);
      expect(result.extraInTarget).toEqual([]);
      expect(result.commonKeys).toEqual([]);
    });

    it("should handle both locales empty", () => {
      const base: I18nEntry[] = [];
      const target: I18nEntry[] = [];

      const result = diffLocales(base, target);

      expect(result.missingInTarget).toEqual([]);
      expect(result.extraInTarget).toEqual([]);
      expect(result.commonKeys).toEqual([]);
    });

    it("should handle duplicate keys in base", () => {
      const base: I18nEntry[] = [
        { key: "duplicate", value: "First" },
        { key: "duplicate", value: "Second" },
      ];
      const target: I18nEntry[] = [];

      const result = diffLocales(base, target);

      // Duplicates are treated as separate entries
      expect(result.missingInTarget).toEqual(["duplicate", "duplicate"]);
      expect(result.extraInTarget).toEqual([]);
      expect(result.commonKeys).toEqual([]);
    });
  });

  describe("integration: flattenLocale and unflattenLocale", () => {
    it("should be inverses of each other", () => {
      const original = {
        nav: {
          home: "Inicio",
          about: {
            title: "Acerca de",
            description: "Más información",
          },
        },
        items: ["uno", "dos"],
      };

      const flattened = flattenLocale(original);
      const unflattened = unflattenLocale(flattened);

      expect(unflattened).toEqual(original);
    });

    it("should preserve complex nested structures", () => {
      const original = {
        app: {
          name: "Mi App",
          version: "1.0.0",
        },
        nav: {
          main: {
            home: "Inicio",
            about: "Acerca de",
          },
          footer: {
            links: ["Privacidad", "Términos"],
          },
        },
      };

      const flattened = flattenLocale(original);
      const unflattened = unflattenLocale(flattened);

      expect(unflattened).toEqual(original);
    });
  });
});
