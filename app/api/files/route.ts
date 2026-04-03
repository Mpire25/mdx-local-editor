import { readdir } from "fs/promises";
import { join } from "path";

const CONTENT_DIR = "/Users/matthewwilliams/Documents/Code/Projects/mpire.dev/content/projects";

export async function GET() {
  const entries = await readdir(CONTENT_DIR);
  const files = entries.filter((f) => f.endsWith(".mdx"));
  return Response.json(files);
}
