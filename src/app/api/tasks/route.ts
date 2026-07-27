import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    let tasks = await db.all("SELECT * FROM kam_tasks ORDER BY created_at DESC");
    
    if (tasks.length === 0) {
      // Auto-seed default tasks
      await db.run(
        "INSERT INTO kam_tasks (id, title, collegeId, priority, status, dueDate) VALUES (?, ?, ?, ?, ?, ?)",
        ["1", "Resolve test 2 pending mark entries", "college_1", "high", "pending", "2026-07-05"]
      );
      await db.run(
        "INSERT INTO kam_tasks (id, title, collegeId, priority, status, dueDate) VALUES (?, ?, ?, ?, ?, ?)",
        ["2", "Verify room 103 discrepancy in Lecture schedule", "college_1", "medium", "pending", "2026-07-10"]
      );
      tasks = await db.all("SELECT * FROM kam_tasks ORDER BY created_at DESC");
    }

    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, title, collegeId, assigned_cam_id, description, priority, status, dueDate } = body;

    if (!title || !dueDate) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const taskId = id || "t_" + Date.now();
    await db.run(
      "INSERT OR REPLACE INTO kam_tasks (id, title, collegeId, assigned_cam_id, description, priority, status, dueDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [taskId, title, collegeId || null, assigned_cam_id || null, description || null, priority || "medium", status || "pending", dueDate]
    );

    return NextResponse.json({ success: true, task: { id: taskId, title, collegeId, assigned_cam_id, description, priority, status, dueDate } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();
    const { id, status, title, priority, dueDate, assigned_cam_id, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Task ID is required" }, { status: 400 });
    }

    if (status) {
      await db.run("UPDATE kam_tasks SET status = ? WHERE id = ?", [status, id]);
    }
    if (assigned_cam_id !== undefined) {
      await db.run("UPDATE kam_tasks SET assigned_cam_id = ? WHERE id = ?", [assigned_cam_id, id]);
    }
    if (description !== undefined) {
      await db.run("UPDATE kam_tasks SET description = ? WHERE id = ?", [description, id]);
    }
    if (title) {
      await db.run("UPDATE kam_tasks SET title = ? WHERE id = ?", [title, id]);
    }
    if (priority) {
      await db.run("UPDATE kam_tasks SET priority = ? WHERE id = ?", [priority, id]);
    }
    if (dueDate) {
      await db.run("UPDATE kam_tasks SET dueDate = ? WHERE id = ?", [dueDate, id]);
    }

    const updated = await db.get("SELECT * FROM kam_tasks WHERE id = ?", [id]);
    return NextResponse.json({ success: true, task: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Task ID is required" }, { status: 400 });
    }

    await db.run("DELETE FROM kam_tasks WHERE id = ?", [id]);
    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
