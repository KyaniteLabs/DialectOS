import { describe, it, expect } from "vitest";
import {
  SpanishDialect,
  DialectInfo,
  ALL_SPANISH_DIALECTS,
  DEFAULT_DIALECT,
  ProviderName,
  TranslationRequest,
  TranslationResult,
  FormalityLevel,
  DeepLFormality,
  DEEPL_FORMALITY_MAP,
  I18nEntry,
  LocaleDiff,
  FormalityIssue,
  GenderNeutralStrategy,
  VariantResult,
  BatchTranslationResult,
  MarkdownSectionType,
  MarkdownSection,
  ParsedMarkdown,
  TranslatedMarkdown,
  GlossaryEntry,
  languageCodeSchema,
  dialectSchema,
  providerNameSchema,
  formalitySchema,
  translationRequestSchema,
  batchTargetsSchema,
} from "../index";

describe("Type Definitions", () => {
  describe("Spanish Dialects", () => {
    it("should have exactly 25 dialects", () => {
      expect(ALL_SPANISH_DIALECTS).toHaveLength(25);
    });

    it("should have DEFAULT_DIALECT as 'es-ES'", () => {
      expect(DEFAULT_DIALECT).toBe("es-ES");
    });

    it("should include all 25 dialect codes", () => {
      const expected = [
        "es-ES", "es-MX", "es-AR", "es-CO", "es-CU",
        "es-PE", "es-CL", "es-VE", "es-UY", "es-PY",
        "es-BO", "es-EC", "es-GT", "es-HN", "es-SV",
        "es-NI", "es-CR", "es-PA", "es-DO", "es-PR",
        "es-GQ", "es-US", "es-PH", "es-BZ", "es-AD",
      ];
      expect(ALL_SPANISH_DIALECTS).toEqual(expect.arrayContaining(expected));
    });

    it("should allow constructing DialectInfo", () => {
      const dialectInfo: DialectInfo = {
        code: "es-ES",
        name: "Spanish (Spain)",
        description: "Castilian Spanish from Spain",
      };
      expect(dialectInfo.code).toBe("es-ES");
      expect(dialectInfo.name).toBe("Spanish (Spain)");
      expect(dialectInfo.description).toBe("Castilian Spanish from Spain");
    });
  });

  describe("Formality", () => {
    it("should have all 3 formality levels in DEEPL_FORMALITY_MAP", () => {
      expect(DEEPL_FORMALITY_MAP).toHaveProperty("formal");
      expect(DEEPL_FORMALITY_MAP).toHaveProperty("informal");
      expect(DEEPL_FORMALITY_MAP).toHaveProperty("auto");
    });

    it("should map formal to 'more'", () => {
      expect(DEEPL_FORMALITY_MAP.formal).toBe("more");
    });

    it("should map informal to 'less'", () => {
      expect(DEEPL_FORMALITY_MAP.informal).toBe("less");
    });

    it("should map auto to 'default'", () => {
      expect(DEEPL_FORMALITY_MAP.auto).toBe("default");
    });
  });

  describe("Translation Types", () => {
    it("should allow constructing TranslationRequest", () => {
      const request: TranslationRequest = {
        text: "Hello",
        sourceLang: "en",
        targetLang: "es",
        dialect: "es-ES",
        formality: "formal",
        context: "Greeting",
        provider: "deepl",
      };
      expect(request.text).toBe("Hello");
      expect(request.provider).toBe("deepl");
    });

    it("should allow constructing TranslationResult", () => {
      const result: TranslationResult = {
        translatedText: "Hola",
        detectedLanguage: "en",
        provider: "deepl",
        dialect: "es-ES",
      };
      expect(result.translatedText).toBe("Hola");
    });
  });

  describe("I18n Types", () => {
    it("should allow constructing I18nEntry", () => {
      const entry: I18nEntry = {
        key: "hello",
        value: "Hola",
      };
      expect(entry.key).toBe("hello");
    });

    it("should allow constructing LocaleDiff", () => {
      const diff: LocaleDiff = {
        missingInTarget: ["key1"],
        extraInTarget: ["key2"],
        commonKeys: ["key3"],
      };
      expect(diff.missingInTarget).toContain("key1");
    });

    it("should allow constructing FormalityIssue", () => {
      const issue: FormalityIssue = {
        key: "greeting",
        value: "Hola",
        suggestion: "Use 'Hola' for formal contexts",
      };
      expect(issue.key).toBe("greeting");
    });
  });

  describe("Gender Neutral Types", () => {
    it("should allow constructing VariantResult", () => {
      const variant: VariantResult = {
        adapted: true,
        changes: ["Changed 'amigos' to 'amigues'"],
      };
      expect(variant.adapted).toBe(true);
    });

    it("should allow constructing BatchTranslationResult", () => {
      const batch: BatchTranslationResult = {
        directory: "/locales",
        baseLocale: "en",
        targets: ["es-ES", "es-MX"],
        totalKeys: 10,
        totalTranslated: 20,
        errors: [],
      };
      expect(batch.totalKeys).toBe(10);
    });
  });

  describe("Markdown Types", () => {
    it("should allow constructing MarkdownSection", () => {
      const section: MarkdownSection = {
        type: "paragraph",
        content: "Hello world",
        raw: "Hello world",
        translatable: true,
      };
      expect(section.type).toBe("paragraph");
    });

    it("should allow constructing ParsedMarkdown", () => {
      const parsed: ParsedMarkdown = {
        sections: [],
        translatableSections: 5,
        codeBlockCount: 2,
        linkCount: 3,
      };
      expect(parsed.translatableSections).toBe(5);
    });

    it("should allow constructing TranslatedMarkdown", () => {
      const translated: TranslatedMarkdown = {
        translated: "Hola mundo",
        sectionsProcessed: 5,
        codeBlocksPreserved: 2,
        linksPreserved: 3,
      };
      expect(translated.translated).toBe("Hola mundo");
    });
  });

  describe("Glossary Types", () => {
    it("should allow constructing GlossaryEntry", () => {
      const entry: GlossaryEntry = {
        term: "computer",
        translation: "ordenador",
        category: "technology",
      };
      expect(entry.term).toBe("computer");
    });
  });
});

describe("Zod Validation Schemas", () => {
  describe("languageCodeSchema", () => {
    it("should accept valid language codes", () => {
      expect(() => languageCodeSchema.parse("en")).not.toThrow();
      expect(() => languageCodeSchema.parse("es")).not.toThrow();
      expect(() => languageCodeSchema.parse("es-ES")).not.toThrow();
      expect(() => languageCodeSchema.parse("en-US")).not.toThrow();
    });

    it("should reject invalid language codes", () => {
      expect(() => languageCodeSchema.parse("e")).toThrow();
      expect(() => languageCodeSchema.parse("ENG")).toThrow();
      expect(() => languageCodeSchema.parse("es-")).toThrow();
      expect(() => languageCodeSchema.parse("-ES")).toThrow();
      expect(() => languageCodeSchema.parse("")).toThrow();
    });
  });

  describe("dialectSchema", () => {
    it("should accept all 20 valid dialects", () => {
      ALL_SPANISH_DIALECTS.forEach((dialect) => {
        expect(() => dialectSchema.parse(dialect)).not.toThrow();
      });
    });

    it("should reject invalid dialects", () => {
      expect(() => dialectSchema.parse("es-XX")).toThrow();
      expect(() => dialectSchema.parse("en-US")).toThrow();
      expect(() => dialectSchema.parse("")).toThrow();
      expect(() => dialectSchema.parse("es-XX")).toThrow();
    });
  });

  describe("providerNameSchema", () => {
    it("should accept valid providers", () => {
      expect(() => providerNameSchema.parse("llm")).not.toThrow();
      expect(() => providerNameSchema.parse("deepl")).not.toThrow();
      expect(() => providerNameSchema.parse("libre")).not.toThrow();
      expect(() => providerNameSchema.parse("mymemory")).not.toThrow();
    });

    it("should reject invalid providers", () => {
      expect(() => providerNameSchema.parse("google")).toThrow();
      expect(() => providerNameSchema.parse("")).toThrow();
      expect(() => providerNameSchema.parse("deeplx")).toThrow();
      expect(() => providerNameSchema.parse("deepl-free")).toThrow();
    });
  });

  describe("formalitySchema", () => {
    it("should accept valid formality levels", () => {
      expect(() => formalitySchema.parse("formal")).not.toThrow();
      expect(() => formalitySchema.parse("informal")).not.toThrow();
      expect(() => formalitySchema.parse("auto")).not.toThrow();
    });

    it("should reject invalid formality levels", () => {
      expect(() => formalitySchema.parse("semi-formal")).toThrow();
      expect(() => formalitySchema.parse("")).toThrow();
      expect(() => formalitySchema.parse("casual")).toThrow();
    });
  });

  describe("translationRequestSchema", () => {
    const validRequest = {
      text: "Hello",
      sourceLang: "en",
      targetLang: "es",
    };

    it("should accept valid translation requests", () => {
      expect(() => translationRequestSchema.parse(validRequest)).not.toThrow();
    });

    it("should accept requests with optional fields", () => {
      const requestWithOptional = {
        ...validRequest,
        dialect: "es-ES",
        formality: "formal",
        context: "Greeting",
        provider: "deepl",
      };
      expect(() => translationRequestSchema.parse(requestWithOptional)).not.toThrow();
    });

    it("should reject empty text", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, text: "" })
      ).toThrow();
    });

    it("should reject empty sourceLang", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, sourceLang: "" })
      ).toThrow();
    });

    it("should reject empty targetLang", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, targetLang: "" })
      ).toThrow();
    });

    it("should reject invalid language codes", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, sourceLang: "e" })
      ).toThrow();
    });

    it("should reject invalid dialect", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, dialect: "es-XX" })
      ).toThrow();
    });

    it("should reject invalid formality", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, formality: "casual" })
      ).toThrow();
    });

    it("should reject invalid provider", () => {
      expect(() =>
        translationRequestSchema.parse({ ...validRequest, provider: "google" })
      ).toThrow();
    });
  });

  describe("batchTargetsSchema", () => {
    it("should accept valid target arrays", () => {
      expect(() => batchTargetsSchema.parse(["es-ES"])).not.toThrow();
      expect(() => batchTargetsSchema.parse(["es-ES", "es-MX", "es-AR"])).not.toThrow();
    });

    it("should accept array with all 25 dialects", () => {
      expect(() => batchTargetsSchema.parse(ALL_SPANISH_DIALECTS)).not.toThrow();
    });

    it("should reject empty arrays", () => {
      expect(() => batchTargetsSchema.parse([])).toThrow();
    });

    it("should reject arrays with more than 25 dialects", () => {
      const tooMany = [...ALL_SPANISH_DIALECTS, "es-ES"];
      expect(() => batchTargetsSchema.parse(tooMany)).toThrow();
    });

    it("should reject arrays with invalid dialects", () => {
      expect(() => batchTargetsSchema.parse(["es-ES", "es-XX"])).toThrow();
    });
  });
});
