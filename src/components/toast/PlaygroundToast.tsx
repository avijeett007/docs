"use client"

import { useToast } from "./ToasterProvider";
import { ToastType } from "./types";

export type ToastProps = {
  message: string;
  type: ToastType;
  onDismiss: () => void;
};

export const PlaygroundToast = () => {
  const { toastMessage, setToastMessage } = useToast();
  const color =
    toastMessage?.type === "error"
      ? "red"
      : toastMessage?.type === "success"
      ? "green"
      : "amber";

  if (!toastMessage) return null;

  return (
    <div
      className={`fixed z-50 text-sm break-words px-4 pr-12 py-2 bg-${color}-950 rounded-sm border border-${color}-800 text-${color}-400 top-4 left-4 right-4`}
    >
      <div>{toastMessage.message}</div>
      <button
        onClick={() => setToastMessage(null)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-300"
      >
        ✕
      </button>
    </div>
  );
};
