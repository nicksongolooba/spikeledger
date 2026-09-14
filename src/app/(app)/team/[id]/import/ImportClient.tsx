"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  CANONICAL_FIELDS,
  CANONICAL_LABELS,
  autoMap,
  REQUIRED_FIELDS,
  type CanonicalField,
} from "@/lib/import-schema";
import { cn } from "@/lib/utils";

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
    <div className="mt-8 space-y-6">
      {/* Step 1: upload */}
      <div className="card p-5">
        <StepHeading n={1} title="Choose a file" />
        <label className="mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-navy-400 hover:bg-navy-50">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-navy-700">
            <Upload size={20} strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-orange-700">Choose a file</span>{" "}
            - CSV or .xlsx
          </span>
          <span className="max-w-md text-xs text-slate-500">
            One row per player per match, or one row per player for tournament
            totals. Headers in row 1.
          </span>
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
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600">
            <FileSpreadsheet
              size={14}
              strokeWidth={2}
              className="text-navy-700"
              aria-hidden
            />
            <span className="font-semibold text-slate-900">{filename}</span>
            <span>
              · {rows.length} rows, {headers.length} columns
            </span>
          </div>
        )}
      </div>

      {headers.length > 0 && (
        <>
          {/* Step 2: tournament meta */}
          <div className="card p-5">
            <StepHeading n={2} title="Tournament details" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            <StepHeading
              n={3}
              title="Match the columns"
              hint={
                <>
                  Matched automatically where the headers were obvious. Player
                  is required. No Match column? Every row rolls into one
                  &quot;Tournament Aggregate&quot; match - map your &quot;Matches
                  Played&quot; column to Sets / matches played.
                </>
              }
            />
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
                    className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
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
                      <span
                        className="shrink-0 text-red-600"
                        title="A required column is still unmapped"
                      >
                        <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                        <span className="sr-only">
                          A required column is still unmapped
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: preview */}
          {previewRows.length > 0 && (
            <div className="card p-5">
              <StepHeading
                n={4}
                title={`Preview the first ${previewRows.length} rows`}
                hint="Mapped columns are highlighted. Skipped ones stay grey and are ignored."
              />
              <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {headers.map((h) => {
                        const mapped = mapping[h];
                        return (
                          <th
                            key={h}
                            className={cn(
                              "whitespace-nowrap px-2 py-2 text-left align-top font-semibold",
                              mapped ? "text-orange-700" : "text-slate-500",
                            )}
                          >
                            {h}
                            {mapped && (
                              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-normal text-slate-500">
                                <ArrowRight size={10} strokeWidth={2} aria-hidden />
                                {CANONICAL_LABELS[mapped as CanonicalField]}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((r, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="whitespace-nowrap px-2 py-1.5 text-slate-800"
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
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle
                size={16}
                strokeWidth={2}
                className="mt-0.5 shrink-0"
                aria-hidden
              />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
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
              <RotateCcw size={16} strokeWidth={2} aria-hidden />
              Start over
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={busy}
              className="btn-primary"
            >
              <Check size={18} strokeWidth={2} aria-hidden />
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

// Numbered step title used by every card in the import flow.
function StepHeading({
  n,
  title,
  hint,
}: {
  n: number;
  title: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="stat-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold leading-7 text-slate-900">
          {title}
        </h2>
        {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      </div>
    </div>
  );
}
