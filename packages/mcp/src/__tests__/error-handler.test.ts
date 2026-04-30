import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Global Error Handler", () => {
  let handlers: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    handlers = new Map();
    vi.spyOn(process, "on").mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return process;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register 4 process event handlers", async () => {
    const { setupGlobalHandlers } = await import("../lib/error-handler.js");
    setupGlobalHandlers();

    expect(handlers.has("uncaughtException")).toBe(true);
    expect(handlers.has("unhandledRejection")).toBe(true);
    expect(handlers.has("SIGINT")).toBe(true);
    expect(handlers.has("SIGTERM")).toBe(true);
  }, 10000);

  it("should handle uncaughtException with sanitized error", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const { setupGlobalHandlers } = await import("../lib/error-handler.js");
    setupGlobalHandlers();

    const handler = handlers.get("uncaughtException")!;
    handler(new Error("test error"));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should handle unhandledRejection with sanitized error without killing the server", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const { setupGlobalHandlers } = await import("../lib/error-handler.js");
    setupGlobalHandlers();

    const handler = handlers.get("unhandledRejection")!;
    handler(new Error("test rejection"));

    // Unhandled rejections should not kill the long-running MCP server
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("should handle SIGINT for graceful shutdown", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const { setupGlobalHandlers } = await import("../lib/error-handler.js");
    setupGlobalHandlers();

    const handler = handlers.get("SIGINT")!;
    handler();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("should handle SIGTERM for graceful shutdown", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const { setupGlobalHandlers } = await import("../lib/error-handler.js");
    setupGlobalHandlers();

    const handler = handlers.get("SIGTERM")!;
    handler();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
