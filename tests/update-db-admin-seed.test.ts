import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedAdminOnly } from "@/lib/seed";
import { verifyPassword } from "@/lib/auth";
import { GET, POST } from "@/app/api/update-db/route";
import { NextRequest } from "next/server";

describe("seedAdminOnly", () => {
  let mockRunCalls: { sql: string; params: any[] }[] = [];
  let mockDb: any;

  beforeEach(() => {
    mockRunCalls = [];
    mockDb = {
      run: vi.fn(async (sql: string, ...params: any[]) => {
        const flattened = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        mockRunCalls.push({ sql, params: flattened });
        return { changes: 1 };
      }),
      all: vi.fn(async () => []),
      get: vi.fn(async () => undefined)
    };
  });

  it("seeds only admin_users and users, skipping all dummy data", async () => {
    const res = await seedAdminOnly(mockDb, {
      email: "test.admin@university.edu",
      name: "Super Admin",
      password: "adminPassword123!"
    });

    expect(res.success).toBe(true);
    expect(res.email).toBe("test.admin@university.edu");
    expect(res.role).toBe("admin");

    // Only 2 SQL statements should be executed: 1 for admin_users, 1 for users
    expect(mockRunCalls.length).toBe(2);

    // 1. admin_users
    const adminUserCall = mockRunCalls.find(c => c.sql.includes("admin_users"));
    expect(adminUserCall).toBeDefined();
    expect(adminUserCall?.params[0]).toBe("admin_1");
    expect(adminUserCall?.params[1]).toBe("Super Admin");
    expect(adminUserCall?.params[2]).toBe("test.admin@university.edu");

    // 2. users (auth table)
    const usersCall = mockRunCalls.find(c => c.sql.includes("INSERT INTO users"));
    expect(usersCall).toBeDefined();
    expect(usersCall?.params[0]).toBe("admin_1");
    expect(usersCall?.params[1]).toBe("test.admin@university.edu");
    // Verify password hash
    const storedHash = usersCall?.params[2];
    expect(storedHash).toMatch(/^pbkdf2\$210000\$/);
    expect(verifyPassword("adminPassword123!", storedHash)).toBe(true);

    // Ensure NO mock/curriculum/students statements were executed
    const hasStudentCall = mockRunCalls.some(c => c.sql.includes("students"));
    const hasCurriculaCall = mockRunCalls.some(c => c.sql.includes("curricul"));
    const hasSlotCall = mockRunCalls.some(c => c.sql.includes("slots"));

    expect(hasStudentCall).toBe(false);
    expect(hasCurriculaCall).toBe(false);
    expect(hasSlotCall).toBe(false);
  });
});

describe("/api/update-db route security", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/update-db", {
      method: "GET"
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects unauthorized POST requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/update-db", {
      method: "POST",
      body: JSON.stringify({ action: "schema" })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
