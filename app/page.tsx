import EditorPage from "./components/EditorPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ToastProvider";

export default function Home() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <EditorPage />
      </ToastProvider>
    </ErrorBoundary>
  );
}
