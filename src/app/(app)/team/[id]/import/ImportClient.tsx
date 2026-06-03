"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  CANONICAL_FIELDS,
  CANONICAL_LABELS,
  autoMap,
  REQUIRED_FIELDS,
  type CanonicalField,
} from "@/lib/import-schema";

type ParsedRow = Record<string, string | number | null>;

export function ImportClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [filename, setFilename] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, CanonicalField | "">>({});
  const [tournamentName, setTournamentName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setFilename(file.name);

    let parsedRows: ParsedRow[] = [];
    let parsedHeaders: string[] = [];

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = await file.text();
      const parsed = Papa.parse<ParsedRow>(text, {
        header: true,
        skipEmptyLines: "greedy",
      });
      parsedRows = parsed.data;
      parsedHeaders = parsed.meta.fields ?? [];
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: ParsedRow[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      parsedRows = data;
      parsedHeaders =
        data.length > 0 ? Object.keys(data[0]) : [];
    }
    setHeaders(parsedHeaders);
    setRows(parsedRows);
    const auto = autoMap(parsedHeaders);
    setMapping(
      Object.fromEntries(
        Object.entries(auto).map(([k, v]) => [k, v ?? ""]),
      ),
    );
  }

  async function commit() {
    setError(null);
    setBusy(true);

    const finalMapping: Record<string, string | null> = {};
    for (const [csvHeader, canonical] of Object.entries(mapping)) {
      finalMapping[csvHeader] = canonical === "" ? null : canonical;
    }
    const mappedFields = new Set(Object.values(finalMapping).filter(Boolean));
    for (const required of REQUIRED_FIELDS) {
      if (!mappedFields.has(required)) {
        setBusy(false);
        setError(`Map a column to "${CANONICAL_LABELS[required]}" before importing.`);
        return;
      }
    }
    if (!tournamentName.trim() || !startDate) {
      setBusy(false);
      setError("Tournament name and start date are required.");
      return;
    }

    const res = await fetch(`/api/teams/${teamId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentName,
        startDate,
        location: location || null,
        mapping: finalMapping,
        rows,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Import failed.");
      return;
    }
    const json = await res.json();
    router.push(`/team/${teamId}/tournament/${json.tournamentId}`);
    router.refresh();
  }

  const previewRows = rows.slice(0, 5);

  return (
    <div className="mt-6 space-y-6">
      {/* Step 1: upload */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          1. Choose file
        </h2>
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 px-6 py-10 transition-colors hover:border-slate-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-8 w-8 text-slate-500"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-cyan-300">Click to upload</span>{" "}
            CSV or .xlsx
          </div>
          <div className="text-xs text-slate-500">
            One row per player per match, or one row per player for tournament
            totals. Headers in row 1.
          </div>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
        {filename && (
          <div className="mt-3 text-xs text-slate-500">
            Loaded: <span className="text-slate-300">{filename}</span> ·{" "}
            {rows.length} rows, {headers.length} columns
          </div>
        )}
      </div>

      {headers.length > 0 && (
        <>
          {/* Step 2: tournament meta */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              2. Tournament details
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Tournament name</label>
                <input
                  className="input"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="2024-25 Spring Invitational"
                />
              </div>
              <div>
                <label className="label">Start date</label>
                <input
                  className="input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Location (optional)</label>
                <input
                  className="input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Markham Pan Am Centre"
                />
              </div>
            </div>
          </div>

          {/* Step 3: column mapping */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              3. Column mapping
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Auto-detected where possible. Player is required. No Match column?
              We roll every row into one &quot;Tournament Aggregate&quot; match -
              map your &quot;Matches Played&quot; column to Sets / matches played.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {headers.map((h) => {
                const selected = mapping[h] ?? "";
                const isRequiredAndUnset =
                  REQUIRED_FIELDS.includes(selected as CanonicalField) === false &&
                  REQUIRED_FIELDS.every(
                    (rf) =>
                      Object.values(mapping).filter((m) => m === rf).length > 0,
                  ) === false;
                return (
                  <div
                    key={h}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">
                        {h}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {previewRows
                          .map((r) => r[h])
                          .filter((v) => v !== "" && v !== null && v !== undefined)
                          .slice(0, 3)
                          .join(", ") || "-"}
                      </div>
                    </div>
                    <select
                      value={selected}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          [h]: e.target.value as CanonicalField | "",
                        })
                      }
                      className="input max-w-[160px] py-1 text-xs"
                    >
                      <option value="">- skip -</option>
                      {CANONICAL_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {CANONICAL_LABELS[f]}
                        </option>
                      ))}
                    </select>
                    {isRequiredAndUnset && (
                      <span className="text-xs text-red-300">!</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: preview */}
          {previewRows.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                4. Preview (first {previewRows.length} rows)
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      {headers.map((h) => {
                        const mapped = mapping[h];
                        return (
                          <th
                            key={h}
                            className={
                              "whitespace-nowrap px-2 py-1.5 text-left " +
                              (mapped
                                ? "text-cyan-300"
                                : "text-slate-500")
                            }
                          >
                            {h}
                            {mapped && (
                              <div className="text-[10px] font-normal text-slate-500">
                                → {CANONICAL_LABELS[mapped as CanonicalField]}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {previewRows.map((r, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="whitespace-nowrap px-2 py-1.5 text-slate-200"
                          >
                            {String(r[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setHeaders([]);
                setRows([]);
                setFilename(null);
                setMapping({});
              }}
              className="btn-secondary"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={busy}
              className="btn-primary"
            >
              {busy
                ? "Importing…"
                : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
