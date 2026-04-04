import EditorPage from "./components/EditorPage";
import { ToastProvider } from "./components/ToastProvider";

export default function Home() {
  return (
    <ToastProvider>
      <EditorPage />
    </ToastProvider>
  );
}
