import { readFile, writeFile, rename } from "fs/promises";
import { join, basename } from "path";
import type { NextRequest } from "next/server";

const CONTENT_DIR = "/Users/matthewwilliams/Documents/Code/Projects/mpire.dev/content/projects";

function safePath(filename: string): string | null {
  const base = basename(filename);
  if (!base.endsWith(".mdx") || base !== filename) return null;
  return join(CONTENT_DIR, base);
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/files/[filename]">
) {
  const { filename } = await ctx.params;
  const filePath = safePath(filename);
  if (!filePath) return new Response("Invalid filename", { status: 400 });

  const content = await readFile(filePath, "utf-8");
  return new Response(content, { headers: { "Content-Type": "text/plain" } });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/files/[filename]">
) {
  const { filename } = await ctx.params;
  const filePath = safePath(filename);
  if (!filePath) return new Response("Invalid filename", { status: 400 });

  const body = await req.json();
  if (typeof body.content !== "string") {
    return new Response("Missing content", { status: 400 });
  }

  await writeFile(filePath, body.content, "utf-8");
  return Response.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/files/[filename]">
) {
  const { filename } = await ctx.params;
  const filePath = safePath(filename);
  if (!filePath) return new Response("Invalid filename", { status: 400 });

  const body = await req.json();
  if (typeof body.newName !== "string") {
    return new Response("Missing newName", { status: 400 });
  }

  const newBase = safePath(body.newName.endsWith(".mdx") ? body.newName : body.newName + ".mdx");
  if (!newBase) return new Response("Invalid newName", { status: 400 });

  await rename(filePath, newBase);
  return Response.json({ name: basename(newBase) });
}
