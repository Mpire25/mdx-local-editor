"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Uncaught error in editor:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-white dark:bg-black p-8">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#060606] shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1f1f1f]">
              <p className="text-sm font-semibold tracking-tight text-gray-900 dark:text-[#f5f5f5]">Something went wrong</p>
            </div>
            <div className="px-5 py-4 text-sm leading-relaxed text-gray-600 dark:text-[#b8b8b8]">
              <p className="mb-3">The editor crashed unexpectedly. Your files are safe — reload to continue.</p>
              <pre className="text-xs font-mono bg-gray-50 dark:bg-[#101010] border border-gray-100 dark:border-[#2a2a2a] rounded p-3 overflow-auto max-h-40 text-gray-500 dark:text-[#9a9a9a]">
                {this.state.error.message}
              </pre>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1f1f1f] flex justify-end">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-gray-700 dark:text-[#e5e5e5]"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
