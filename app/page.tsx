import { readdir } from "fs/promises";
import EditorPage from "./components/EditorPage";

export const dynamic = "force-dynamic";

const CONTENT_DIR =
  "/Users/matthewwilliams/Documents/Code/Projects/mpire.dev/content/projects";

export default async function Home() {
  const entries = await readdir(CONTENT_DIR);
  const files = entries.filter((f) => f.endsWith(".mdx")).sort();
  return <EditorPage files={files} />;
}
