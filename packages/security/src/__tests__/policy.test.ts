import { describe, it, expect, afterEach, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import {
  configureSecurity,
  validateFilePath,
  validateContentLength,
  SecurityError,
} from "../index.js";

describe("security policy (roast item 5)", () => {
  const savedEnv = process.env.ALLOWED_LOCALE_DIRS;

  afterEach(() => {
    configureSecurity({});
    process.env.ALLOWED_LOCALE_DIRS = savedEnv;
    vi.restoreAllMocks();
  });

  it("never treats the filesystem root as the working directory", () => {
    delete process.env.ALLOWED_LOCALE_DIRS;
    vi.spyOn(process, "cwd").mockReturnValue(path.parse(process.cwd()).root);
    expect(() => validateFilePath("/etc/hosts")).toThrow(SecurityError);
  });

  it("refuses the home directory as the working directory when the host says so", () => {
    delete process.env.ALLOWED_LOCALE_DIRS;
    vi.spyOn(process, "cwd").mockReturnValue(os.homedir());
    const dotfile = path.join(os.homedir(), ".ssh", "config");
    expect(() => validateFilePath(dotfile)).not.toThrow();
    configureSecurity({ allowHomeAsWorkingDir: false });
    expect(() => validateFilePath(dotfile)).toThrow(SecurityError);
  });

  it("an explicit allowed-dirs list replaces the working directory", () => {
    const project = path.join(os.homedir(), "some-project");
    vi.spyOn(process, "cwd").mockReturnValue(project);
    configureSecurity({ allowedDirs: ["/srv/locales"] });
    expect(() => validateFilePath(path.join(project, "es.json"))).toThrow(SecurityError);
    expect(validateFilePath("/srv/locales/es.json")).toBe("/srv/locales/es.json");
  });

  it("applies the configured content-length limit", () => {
    configureSecurity({ maxContentLength: 1000 });
    expect(() => validateContentLength("x".repeat(1001))).toThrow(SecurityError);
    configureSecurity({});
    expect(() => validateContentLength("x".repeat(1001))).not.toThrow();
  });
});
