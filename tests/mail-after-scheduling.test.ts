import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Vercel freezes a function the moment the response is returned, so a detached
 * `sendMail(...).then(...)` promise loses the mail entirely — the send just
 * never happened and nothing was logged. sendMailAsync must hand the work to
 * after() so the invocation stays alive until the mail is out.
 */
const h = vi.hoisted(() => ({
  queued: [] as (() => Promise<void>)[],
  mails: [] as any[],
  mailResult: { success: true } as any,
  throws: false,
  writes: [] as string[]
}));

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => { h.queued.push(cb); }
}));

vi.mock("@/lib/mail", () => ({
  sendMail: async (job: any) => {
    if (h.throws) throw new Error("socket closed");
    h.mails.push(job);
    return h.mailResult;
  }
}));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ run: async (sql: string) => { h.writes.push(sql); return { changes: 1 }; } })
}));

vi.mock("@/lib/id", () => ({ generateId: (p: string) => `${p}_1` }));

const { sendMailAsync } = await import("@/lib/mailAsync");

const flush = () => Promise.all(h.queued.map((cb) => cb()));

beforeEach(() => {
  h.queued.length = 0;
  h.mails.length = 0;
  h.writes.length = 0;
  h.mailResult = { success: true };
  h.throws = false;
});

describe("sendMailAsync", () => {
  it("does not send during the request — it only schedules", () => {
    sendMailAsync({ to: "a@b.c", subject: "S", htmlBody: "<p>hi</p>", context: "unit" });

    expect(h.queued).toHaveLength(1);
    expect(h.mails).toHaveLength(0);
  });

  it("sends every job that was scheduled before the response", async () => {
    sendMailAsync({ to: "a@b.c", subject: "S", htmlBody: "x" });
    sendMailAsync({ to: ["d@e.f", "g@h.i"], subject: "S2", htmlBody: "y", cc: "cm@x.y" });

    await flush();

    expect(h.mails).toHaveLength(2);
    expect(h.mails[1].cc).toBe("cm@x.y");
    expect(h.writes).toHaveLength(0);
  });

  it("audits a failed send so the gap is visible to admins", async () => {
    h.mailResult = { success: false, error: "relay refused" };

    sendMailAsync({ to: "a@b.c", subject: "S", htmlBody: "x", context: "leave-notify" });
    await flush();

    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]).toContain("mail_failure");
  });

  it("does not log a failure for a disabled or mocked send", async () => {
    for (const result of [{ success: true, disabled: true }, { success: true, mocked: true }]) {
      h.mailResult = result as any;
      sendMailAsync({ to: "a@b.c", subject: "S", htmlBody: "x" });
    }
    await flush();

    expect(h.mails).toHaveLength(2);
    expect(h.writes).toHaveLength(0);
  });

  it("keeps the response path safe when the transport throws", async () => {
    h.throws = true;

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMailAsync({ to: "a@b.c", subject: "S", htmlBody: "x", context: "unit" });

    // A throw inside after() must not reject back into the response path.
    await expect(flush().then(() => "settled")).resolves.toBe("settled");
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("sendMailAsync unhandled error (unit)"),
      expect.objectContaining({ message: "socket closed" })
    );
    errSpy.mockRestore();
  });

  it("leaves no detached sendMail chain in the mail helper", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/mailAsync.ts"), "utf8");
    // after() carries the work, and the send itself lives in dispatchMail so a
    // deferred block that still needs reads can call it without nesting a
    // second after(). One dispatcher, one transport call.
    expect(source).toContain("after(() => dispatchMail(job))");
    expect(source).not.toMatch(/sendMail\([\s\S]*?\)\s*\.then\(/);
    expect(source.match(/await sendMail\(\{/g)).toHaveLength(1);
  });
});
