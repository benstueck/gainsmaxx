"use client";

import { useState, useTransition } from "react";
import { createRound } from "@/app/round/actions";
import { Input } from "@/components/ui/input";
import { BigButton } from "@/components/ui/big-button";
import { cn } from "@/lib/utils";

export function NewRoundForm() {
  const [numHoles, setNumHoles] = useState(18);
  const [courseName, setCourseName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-semibold">How many holes?</span>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[9, 18].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumHoles(n)}
              className={cn(
                "flex h-16 items-center justify-center rounded-app text-xl font-bold",
                numHoles === n
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-foreground",
              )}
            >
              {n} holes
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">
          Course <span className="font-normal text-muted">(optional)</span>
        </span>
        <Input
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="e.g. Pebble Beach"
        />
      </label>

      <BigButton
        block
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void createRound(numHoles, courseName);
          })
        }
      >
        {pending ? "Starting…" : "Start round"}
      </BigButton>
    </div>
  );
}
