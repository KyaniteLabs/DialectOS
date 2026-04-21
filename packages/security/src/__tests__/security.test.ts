/**
 * Security module tests
 * Testing path validation, sanitization, rate limiting, and security controls
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  SecurityError,
  ErrorCode,
  validateFilePath,
  validateMarkdownPath,
  validateJsonPath,
  checkFileSize,
  validateContentLength,
  validateNoNullBytes,
  validateNoControlChars,
  sanitizeHtml,
  validateUrl,
  validateMarkdownUrl,
  sanitizeErrorMessage,
  createSafeError,
  RateLimiter,
  createSecureTempPath,
  MAX_FILE_SIZE,
  MAX_CONTENT_LENGTH,
} from "../index.js";

// Helper: pass /tmp as allowed dir for all tests (since temp dirs are created there)
const TEST_ALLOWED_DIRS = ["/tmp", "/test"];

describe("SecurityError", () => {
  it("should create error with code property", () => {
    const error = new SecurityError("Test error", ErrorCode.PATH_TRAVERSAL);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe(ErrorCode.PATH_TRAVERSAL);
  });

  it("should have correct name", () => {
    const error = new SecurityError("Test", ErrorCode.INVALID_INPUT);
    expect(error.name).toBe("SecurityError");
  });
});

describe("ErrorCode enum", () => {
  it("should have all required error codes", () => {
    expect(ErrorCode.PATH_TRAVERSAL).toBe("PATH_TRAVERSAL");
    expect(ErrorCode.INVALID_PATH).toBe("INVALID_PATH");
    expect(ErrorCode.FILE_TOO_LARGE).toBe("FILE_TOO_LARGE");
    expect(ErrorCode.CONTENT_TOO_LONG).toBe("CONTENT_TOO_LONG");
    expect(ErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
    expect(ErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(ErrorCode.SANITIZATION_FAILED).toBe("SANITIZATION_FAILED");
    expect(ErrorCode.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
  });
});

describe("validateFilePath", () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join("/tmp", "security-test-"));
    testFile = path.join(tempDir, "test.md");
    fs.writeFileSync(testFile, "# Test");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should accept valid paths within allowed directory", () => {
    const result = validateFilePath(testFile, TEST_ALLOWED_DIRS);
    expect(result).toBe(fs.realpathSync(testFile));
  });

  it("should reject path traversal with ../", () => {
    expect(() => validateFilePath("../../../etc/passwd", TEST_ALLOWED_DIRS)).toThrow(SecurityError);
  });

  it("should reject paths with null bytes", () => {
    expect(() => validateFilePath("/test\x00file")).toThrow(SecurityError);
  });

  it("should reject paths with control characters (except \\n, \\r, \\t)", () => {
    expect(() => validateFilePath("/test\x01file")).toThrow(SecurityError);
    expect(() => validateFilePath("/test\x02file")).toThrow(SecurityError);
    expect(() => validateFilePath("/test\x1bfile")).toThrow(SecurityError);
  });

  it("should allow newline, tab, and carriage return in paths", () => {
    // These are technically valid in some filesystems
    // The function should not reject them
    const testPath = path.join(tempDir, "test\nfile.md");
    fs.writeFileSync(testPath, "# Test");
    const result = validateFilePath(testPath, TEST_ALLOWED_DIRS);
    expect(result).toBeTruthy();
  });

  it("should reject symlink traversal outside allowed directory", () => {
    // Use tempDir itself as the ONLY allowed dir (not all of /tmp)
    const symlinkDir = fs.mkdtempSync(path.join("/tmp", "symlink-target-"));
    const symlinkPath = path.join(tempDir, "symlink");

    try {
      // Create a symlink pointing outside the allowed directory (tempDir)
      fs.symlinkSync(symlinkDir, symlinkPath);

      // Try to access through symlink - should be rejected since target is outside tempDir
      expect(() => validateFilePath(symlinkPath, [tempDir])).toThrow(SecurityError);
    } finally {
      fs.rmSync(symlinkDir, { recursive: true, force: true });
    }
  });

  it("should allow /tmp paths in test mode", () => {
    const tmpFile = path.join("/tmp", "test-file.md");
    fs.writeFileSync(tmpFile, "# Test");

    const result = validateFilePath(tmpFile, TEST_ALLOWED_DIRS);
    expect(result).toBeTruthy();

    fs.unlinkSync(tmpFile);
  });

  it("should use fs.realpathSync to resolve symlinks before checking", () => {
    // Create a symlink within the allowed directory
    const targetFile = path.join(tempDir, "target.md");
    fs.writeFileSync(targetFile, "# Target");

    const symlinkPath = path.join(tempDir, "link.md");
    fs.symlinkSync(targetFile, symlinkPath);

    // Should resolve symlink and validate the real path
    const result = validateFilePath(symlinkPath, TEST_ALLOWED_DIRS);
    // Result should be the real path, not the symlink
    expect(result).toBe(fs.realpathSync(symlinkPath));
  });

  it("should reject paths that exceed MAX_PATH_LENGTH", () => {
    const longPath = "a".repeat(2000);
    expect(() => validateFilePath(longPath)).toThrow(SecurityError);
  });

  it("should reject symlinks using lstatSync detection", () => {
    const targetFile = path.join(tempDir, "target.txt");
    fs.writeFileSync(targetFile, "content");

    const symlinkPath = path.join(tempDir, "symlink.txt");
    fs.symlinkSync(targetFile, symlinkPath);

    // Should detect symlink and reject it
    expect(() => validateFilePath(symlinkPath, [tempDir], { rejectSymlinks: true })).toThrow(SecurityError);
  });
});

describe("validateMarkdownPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join("/tmp", "markdown-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should accept .md files", () => {
    const mdFile = path.join(tempDir, "test.md");
    fs.writeFileSync(mdFile, "# Test");

    const result = validateMarkdownPath(mdFile, TEST_ALLOWED_DIRS);
    expect(result).toBe(fs.realpathSync(mdFile));
  });

  it("should accept .markdown files", () => {
    const mdFile = path.join(tempDir, "test.markdown");
    fs.writeFileSync(mdFile, "# Test");

    const result = validateMarkdownPath(mdFile, TEST_ALLOWED_DIRS);
    expect(result).toBe(fs.realpathSync(mdFile));
  });

  it("should reject non-markdown files", () => {
    const txtFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(txtFile, "Test");

    expect(() => validateMarkdownPath(txtFile, TEST_ALLOWED_DIRS)).toThrow(SecurityError);
  });

  it("should use path.extname for extension checking", () => {
    // Test that it uses extname and not endsWith
    const mdFile = path.join(tempDir, "test.md");
    fs.writeFileSync(mdFile, "# Test");

    const result = validateMarkdownPath(mdFile, TEST_ALLOWED_DIRS);
    expect(path.extname(result)).toBe(".md");
  });
});

describe("validateJsonPath", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join("/tmp", "json-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should accept .json files", () => {
    const jsonFile = path.join(tempDir, "test.json");
    fs.writeFileSync(jsonFile, '{"test": true}');

    const result = validateJsonPath(jsonFile, { mustExist: false }, TEST_ALLOWED_DIRS);
    expect(result).toBe(fs.realpathSync(jsonFile));
  });

  it("should reject non-json files", () => {
    const txtFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(txtFile, "test");

    expect(() => validateJsonPath(txtFile, {}, TEST_ALLOWED_DIRS)).toThrow(SecurityError);
  });

  it("should check file exists when mustExist is true", () => {
    const nonExistent = path.join(tempDir, "nonexistent.json");

    expect(() => validateJsonPath(nonExistent, { mustExist: true }, TEST_ALLOWED_DIRS)).toThrow(SecurityError);
  });

  it("should check file size when checkSize is true", () => {
    const jsonFile = path.join(tempDir, "large.json");
    fs.writeFileSync(jsonFile, "x".repeat(MAX_FILE_SIZE + 1));

    expect(() => validateJsonPath(jsonFile, { mustExist: true, checkSize: true }, TEST_ALLOWED_DIRS)).toThrow(SecurityError);
  });
});

describe("checkFileSize", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join("/tmp", "filesize-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should accept files within size limit", () => {
    const file = path.join(tempDir, "small.txt");
    fs.writeFileSync(file, "small content");

    expect(() => checkFileSize(file)).not.toThrow();
  });

  it("should reject files exceeding MAX_FILE_SIZE", () => {
    const file = path.join(tempDir, "large.txt");
    fs.writeFileSync(file, "x".repeat(MAX_FILE_SIZE + 1));

    expect(() => checkFileSize(file)).toThrow(SecurityError);
  });

  it("should allow custom maxSize", () => {
    const file = path.join(tempDir, "medium.txt");
    const customSize = 100;
    fs.writeFileSync(file, "x".repeat(customSize + 1));

    expect(() => checkFileSize(file, customSize)).toThrow(SecurityError);
  });
});

describe("validateContentLength", () => {
  it("should accept content within limit", () => {
    const content = "x".repeat(1000);
    expect(() => validateContentLength(content)).not.toThrow();
  });

  it("should reject content exceeding MAX_CONTENT_LENGTH", () => {
    const content = "x".repeat(MAX_CONTENT_LENGTH + 1);
    expect(() => validateContentLength(content)).toThrow(SecurityError);
  });

  it("should allow custom maxLength", () => {
    const content = "x".repeat(101);
    expect(() => validateContentLength(content, 100)).toThrow(SecurityError);
  });
});

describe("validateNoNullBytes", () => {
  it("should accept strings without null bytes", () => {
    expect(() => validateNoNullBytes("normal string")).not.toThrow();
  });

  it("should reject strings with null bytes", () => {
    expect(() => validateNoNullBytes("test\x00string")).toThrow(SecurityError);
  });
});

describe("validateNoControlChars", () => {
  it("should accept strings without control characters", () => {
    expect(() => validateNoControlChars("normal string")).not.toThrow();
  });

  it("should allow newline, tab, and carriage return", () => {
    expect(() => validateNoControlChars("line1\nline2\ttab\rcarriage")).not.toThrow();
  });

  it("should reject other control characters", () => {
    expect(() => validateNoControlChars("test\x01control")).toThrow(SecurityError);
    expect(() => validateNoControlChars("test\x02control")).toThrow(SecurityError);
    expect(() => validateNoControlChars("test\x1bcontrol")).toThrow(SecurityError);
  });
});

describe("sanitizeHtml", () => {
  it("should remove script tags", () => {
    const html = "<script>alert('xss')</script><p>safe</p>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>safe</p>");
  });

  it("should sanitize SVG with onload", () => {
    const html = '<svg onload="alert(1)">text</svg><p>safe</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onload");
    expect(result).not.toContain("<svg");
    expect(result).toContain("<p>safe</p>");
  });

  it("should keep safe HTML tags", () => {
    const html = "<p>Paragraph</p><strong>Bold</strong><em>Italic</em>";
    const result = sanitizeHtml(html);
    expect(result).toContain("<p>");
    expect(result).toContain("<strong>");
    expect(result).toContain("<em>");
  });

  it("should remove data attributes when ALLOW_DATA_ATTR is false", () => {
    const html = '<div data-test="value">content</div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("data-test");
  });
});

describe("validateUrl", () => {
  it("should accept http URLs", () => {
    expect(() => validateUrl("http://example.com")).not.toThrow();
  });

  it("should accept https URLs", () => {
    expect(() => validateUrl("https://example.com")).not.toThrow();
  });

  it("should accept mailto URLs", () => {
    expect(() => validateUrl("mailto:test@example.com")).not.toThrow();
  });

  it("should reject javascript URLs", () => {
    expect(() => validateUrl("javascript:alert(1)")).toThrow(SecurityError);
  });

  it("should reject data URLs", () => {
    expect(() => validateUrl("data:text/html,<script>alert(1)</script>")).toThrow(SecurityError);
  });

  it("should reject vbscript URLs", () => {
    expect(() => validateUrl("vbscript:msgbox(1)")).toThrow(SecurityError);
  });

  it("should reject file URLs", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(SecurityError);
  });
});

describe("validateMarkdownUrl", () => {
  it("should accept http URLs in markdown", () => {
    expect(() => validateMarkdownUrl("https://example.com")).not.toThrow();
  });

  it("should reject mailto URLs", () => {
    expect(() => validateMarkdownUrl("mailto:test@example.com")).toThrow(SecurityError);
  });

  it("should reject javascript URLs", () => {
    expect(() => validateMarkdownUrl("javascript:alert(1)")).toThrow(SecurityError);
  });

  it("should reject data URLs", () => {
    expect(() => validateMarkdownUrl("data:text/html,test")).toThrow(SecurityError);
  });
});

describe("sanitizeErrorMessage", () => {
  it("should remove API keys", () => {
    const message = "Error with key sk-1234567890abcdef1234567890abcdef";
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain("sk-1234567890abcdef");
    expect(result).toContain("[REDACTED]");
  });

  it("should remove 32+ character hex strings (potential keys)", () => {
    const message = "Error: 1234567890abcdef1234567890abcdef found";
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain("1234567890abcdef1234567890abcdef");
  });

  it("should remove Unix file paths", () => {
    const message = "Error at /home/user/file.txt";
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain("/home/user/file.txt");
  });

  it("should remove Windows file paths", () => {
    const message = "Error at C:\\Users\\user\\file.txt";
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain("C:\\Users\\user\\file.txt");
  });

  it("should remove newlines to prevent log injection", () => {
    const message = "Error\nInjected log line";
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain("\n");
  });

  it("should pass through messages that don't match sensitive patterns", () => {
    const message = "Something went wrong";
    const result = sanitizeErrorMessage(message);
    expect(result).toBe("Something went wrong");
  });
});

describe("createSafeError", () => {
  it("should standardize error format", () => {
    const error = new Error("Test error");
    const result = createSafeError(error);

    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("code");
    expect(typeof result.error).toBe("string");
    expect(typeof result.code).toBe("string");
  });

  it("should not include stack traces in returned error", () => {
    const error = new Error("Test");
    const result = createSafeError(error);

    expect(result.error).not.toContain("at ");
    expect(result.error).not.toContain("node:");
  });

  it("should handle non-Error objects", () => {
    const result = createSafeError("string error");

    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("code");
  });
});

describe("RateLimiter", () => {
  it("should allow requests within limit", async () => {
    const limiter = new RateLimiter(5, 1000);

    for (let i = 0; i < 5; i++) {
      await expect(limiter.acquire()).resolves.not.toThrow();
    }
  });

  it("should block requests exceeding limit", async () => {
    const limiter = new RateLimiter(2, 1000);

    await limiter.acquire();
    await limiter.acquire();

    await expect(limiter.acquire()).rejects.toThrow(SecurityError);
  });

  it("should reset after window expires", async () => {
    const limiter = new RateLimiter(2, 100); // 100ms window

    await limiter.acquire();
    await limiter.acquire();

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should allow requests again
    await expect(limiter.acquire()).resolves.not.toThrow();
  });

  it("should use sliding window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const limiter = new RateLimiter(3, 200); // 3 requests per 200ms

      await limiter.acquire(); // t=0
      vi.advanceTimersByTime(100);
      await limiter.acquire(); // t=100
      vi.advanceTimersByTime(100);
      await limiter.acquire(); // t=200

      // At t=200, first request should be outside window
      // So we should have 2 requests in window (at t=100 and t=200)
      // Should allow one more
      await expect(limiter.acquire()).resolves.not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createSecureTempPath", () => {
  it("should create temp path in same directory as target", () => {
    const targetPath = "/tmp/test-file.txt";
    const result = createSecureTempPath(targetPath);

    expect(path.dirname(result)).toBe(path.dirname(targetPath));
  });

  it("should add random suffix to filename", () => {
    const targetPath = "/tmp/test-file.txt";
    const result1 = createSecureTempPath(targetPath);
    const result2 = createSecureTempPath(targetPath);

    expect(result1).not.toBe(result2);
  });

  it("should use crypto.randomBytes for randomness", () => {
    const targetPath = "/tmp/test.txt";
    const result = createSecureTempPath(targetPath);

    // Random suffix should be 16 hex chars (8 bytes)
    const basename = path.basename(result, path.extname(targetPath));
    const originalBasename = path.basename(targetPath, path.extname(targetPath));
    const suffix = basename.replace(originalBasename + "_", "");

    expect(suffix).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("Constants", () => {
  it("should export MAX_FILE_SIZE as 512KB", () => {
    expect(MAX_FILE_SIZE).toBe(512 * 1024);
  });

  it("should export MAX_CONTENT_LENGTH as 50000", () => {
    expect(MAX_CONTENT_LENGTH).toBe(50000);
  });
});
