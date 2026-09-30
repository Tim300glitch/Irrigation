"use client";
/** In-app replacements for alert/confirm/prompt (native dialogs are blocked in embedded viewers). */
import { create } from "zustand";
import { useEffect, useRef, useState } from "react";
import { Button, Modal, inputCls } from "./ui";

interface Req {
  kind: "alert" | "confirm" | "prompt";
  message: string;
  value?: string;
  danger?: boolean;
  resolve: (v: unknown) => void;
}
const useAsk = create<{ req: Req | null }>(() => ({ req: null }));

function open<T>(r: Omit<Req, "resolve">): Promise<T> {
  return new Promise<T>((resolve) => useAsk.setState({ req: { ...r, resolve: resolve as (v: unknown) => void } }));
}

export const ask = {
  alert: (message: string) => open<void>({ kind: "alert", message }),
  confirm: (message: string, danger = false) => open<boolean>({ kind: "confirm", message, danger }),
  prompt: (message: string, value = "") => open<string | null>({ kind: "prompt", message, value }),
};

export function AskHost() {
  const req = useAsk((s) => s.req);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (req?.kind === "prompt") {
      setVal(req.value ?? "");
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [req]);
  if (!req) return null;
  const done = (v: unknown) => {
    useAsk.setState({ req: null });
    req.resolve(v);
  };
  const cancelValue = req.kind === "confirm" ? false : req.kind === "prompt" ? null : undefined;
  return (
    <Modal
      open
      onClose={() => done(cancelValue)}
      title={req.kind === "confirm" ? "Please confirm" : req.kind === "prompt" ? "Enter a value" : "DeltaLine"}
      width={440}
      footer={
        <>
          {req.kind !== "alert" && (
            <Button variant="ghost" onClick={() => done(cancelValue)}>
              Cancel
            </Button>
          )}
          <Button variant={req.danger ? "danger" : "primary"} onClick={() => done(req.kind === "prompt" ? val : true)} id="ask-ok">
            {req.kind === "confirm" && req.danger ? "Delete" : "OK"}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-slate-700">{req.message}</p>
      {req.kind === "prompt" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(val);
          }}
        >
          <input id="ask-input" ref={inputRef} className={`${inputCls} mt-3`} value={val} onChange={(e) => setVal(e.target.value)} />
        </form>
      )}
    </Modal>
  );
}
