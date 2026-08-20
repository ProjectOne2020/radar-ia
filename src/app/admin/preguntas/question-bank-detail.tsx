"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

interface Question {
  id: string;
  question_text: string;
  active: boolean;
}

export default function QuestionBankDetail({
  rubro,
  country,
  questions,
}: {
  rubro: string;
  country: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, loadingKey: string) {
    setLoading(loadingKey);
    setError(null);
    const res = await fetch("/api/admin/question-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Error");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleAdd() {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const ok = await call({ action: "add", rubro, country, questions: lines }, "add");
    if (ok) setBulkText("");
  }

  return (
    <Panel raised className="mt-4">
      <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
        Preguntas: {rubro} / {country} ({questions.length})
      </h2>

      <div className="mt-3">
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Una pregunta por línea, usa {city} donde vaya la ciudad..."}
          rows={6}
          className="max-w-[700px] font-mono text-xs"
        />
        <div className="mt-2">
          <Button size="sm" onClick={handleAdd} disabled={loading !== null || bulkText.trim().length === 0}>
            {loading === "add" ? "Agregando..." : "Agregar preguntas"}
          </Button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-critical">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[700px] max-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
              <th className="px-4 py-3 font-medium">Pregunta</th>
              <th className="w-24 px-4 py-3 font-medium">Estado</th>
              <th className="w-40 px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className={cn("border-b border-border last:border-b-0", !q.active && "opacity-50")}>
                <td className="px-4 py-2.5 text-text">{q.question_text}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={q.active ? "good" : "neutral"}>{q.active ? "Activa" : "Inactiva"}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => call({ action: "toggle", id: q.id, active: !q.active }, `toggle-${q.id}`)}
                      disabled={loading !== null}
                      className="text-xs text-text-secondary hover:text-ink"
                    >
                      {q.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Eliminar esta pregunta?")) call({ action: "delete", id: q.id }, `delete-${q.id}`);
                      }}
                      disabled={loading !== null}
                      className="text-xs text-critical hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-text-muted">
                  Sin preguntas todavía para esta combinación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
