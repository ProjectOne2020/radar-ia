"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ marginTop: 16 }}>
      <h2>
        Preguntas: {rubro} / {country} ({questions.length})
      </h2>

      <div style={{ marginTop: 12 }}>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Una pregunta por línea, usa {city} donde vaya la ciudad..."}
          rows={6}
          style={{ width: "100%", maxWidth: 700, fontFamily: "monospace", fontSize: 13 }}
        />
        <div>
          <button onClick={handleAdd} disabled={loading !== null || bulkText.trim().length === 0}>
            {loading === "add" ? "Agregando..." : "Agregar preguntas"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, maxWidth: 900 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Pregunta</th>
            <th style={{ width: 90 }}>Estado</th>
            <th style={{ width: 140 }}></th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} style={{ borderBottom: "1px solid #eee", opacity: q.active ? 1 : 0.5 }}>
              <td style={{ fontSize: 13, padding: "4px 0" }}>{q.question_text}</td>
              <td style={{ fontSize: 12 }}>{q.active ? "Activa" : "Inactiva"}</td>
              <td>
                <button
                  onClick={() => call({ action: "toggle", id: q.id, active: !q.active }, `toggle-${q.id}`)}
                  disabled={loading !== null}
                  style={{ fontSize: 12, marginRight: 6 }}
                >
                  {q.active ? "Desactivar" : "Activar"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar esta pregunta?")) call({ action: "delete", id: q.id }, `delete-${q.id}`);
                  }}
                  disabled={loading !== null}
                  style={{ fontSize: 12 }}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {questions.length === 0 && (
            <tr>
              <td colSpan={3} style={{ fontSize: 13, color: "#888", padding: "8px 0" }}>
                Sin preguntas todavía para esta combinación.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
