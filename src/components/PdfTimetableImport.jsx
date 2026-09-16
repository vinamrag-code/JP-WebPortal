import { useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { rankBatches, suggestElectives } from "@/lib/timetable/subjectMatching";
import { buildSchedule, classesOn } from "@/lib/timetable/schedule";
import { saveSchedule } from "@/lib/timetable/timetableStore";
import { formatMinutes } from "@/lib/timetable/today";

/**
 * Upload the official timetable PDF and turn it into a personal schedule: parse → pick batch (suggested from
 * registered subjects) → pick electives (auto-detected, editable) → preview → save.
 */
export default function PdfTimetableImport({ registeredSubjects = [], onSaved }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | parsing | ready | saving
  const [fileName, setFileName] = useState(null);
  const [parsed, setParsed] = useState(null); // { entries, batches, electives, warnings }
  const [batch, setBatch] = useState("");
  const [selectedElectives, setSelectedElectives] = useState([]);

  const suggestedBatches = useMemo(
    () => (parsed ? rankBatches(parsed.entries, registeredSubjects) : []),
    [parsed, registeredSubjects],
  );

  const schedulePreview = useMemo(() => {
    if (!parsed || !batch) return null;
    try {
      return buildSchedule(parsed.entries, { batch, electiveCodes: selectedElectives, registeredSubjects });
    } catch {
      return null;
    }
  }, [parsed, batch, selectedElectives, registeredSubjects]);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setStatus("parsing");
    try {
      // pdf.js is a large dependency, only needed on this page for this one action: load it on demand
      // rather than in the app's main bundle.
      const [{ parseTimetablePdf }, { default: pdfjs }] = await Promise.all([
        import("@/lib/timetable/pdfTimetableParser"),
        import("@/lib/timetable/pdfjsBrowser"),
      ]);
      const bytes = await file.arrayBuffer();
      const result = await parseTimetablePdf(bytes, pdfjs);
      if (result.entries.length === 0) {
        showErrorToast("Timetable", "Couldn't find a timetable grid in this PDF.");
        setStatus("idle");
        return;
      }
      setParsed(result);
      const ranked = rankBatches(result.entries, registeredSubjects);
      setBatch(ranked[0]?.batch ?? result.batches[0] ?? "");
      setSelectedElectives(suggestElectives(result.electives, registeredSubjects));
      setStatus("ready");
    } catch (err) {
      showErrorToast("Timetable", err?.message || "Failed to read the PDF.");
      setStatus("idle");
    }
  };

  const toggleElective = (code) => {
    setSelectedElectives((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSave = () => {
    if (!schedulePreview) return;
    setStatus("saving");
    try {
      saveSchedule({ ...schedulePreview, fileName });
      showSuccessToast("Timetable", `Saved ${schedulePreview.classes.length} classes for ${batch}.`);
      onSaved?.(schedulePreview);
    } catch (err) {
      showErrorToast("Timetable", err?.message || "Couldn't save the timetable.");
      setStatus("ready");
    }
  };

  return (
    <Card className="shadow-sm border-border/50 rounded-lg" data-testid="pdf-import">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <FileText className="w-4 h-4" /> Import timetable from PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={status === "parsing" || status === "saving"}>
            {status === "parsing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {status === "parsing" ? "Reading PDF…" : "Choose PDF"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            data-testid="pdf-file-input"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {fileName && status !== "idle" && <span className="text-xs text-muted-foreground truncate">{fileName}</span>}
        </div>

        {parsed && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Your batch</p>
                <Select value={batch} onValueChange={setBatch}>
                  <SelectTrigger data-testid="batch-select"><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {parsed.batches.map((b) => {
                      const rank = suggestedBatches.find((r) => r.batch === b);
                      return (
                        <SelectItem key={b} value={b}>
                          {b}{rank ? ` — matches ${rank.matched}/${rank.total} of your subjects` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {suggestedBatches[0] && suggestedBatches[0].batch === batch && (
                  <p className="text-[11px] text-muted-foreground">Suggested from your registered subjects.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Electives</p>
                <div className="flex flex-wrap gap-2">
                  {parsed.electives.map((code) => (
                    <button
                      key={code}
                      type="button"
                      data-testid={`elective-${code}`}
                      onClick={() => toggleElective(code)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-colors ${
                        selectedElectives.includes(code)
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {parsed.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{parsed.warnings.length} spot{parsed.warnings.length === 1 ? "" : "s"} in the PDF needed a guess</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                  <p className="mt-1">Check these classes after saving; you can fix anything by tapping it.</p>
                </AlertDescription>
              </Alert>
            )}

            {schedulePreview && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Preview — {schedulePreview.classes.length} classes/week
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <div key={d} className="space-y-1">
                      {classesOn(schedulePreview, d).map((c) => (
                        <div key={c.id} className="p-1.5 rounded bg-muted/30 border border-border/50">
                          <div className="font-bold truncate">{c.name ?? c.code}</div>
                          <div className="text-muted-foreground">{formatMinutes(c.startMinutes)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={!schedulePreview || status === "saving"} data-testid="save-schedule">
              {status === "saving" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save timetable
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

PdfTimetableImport.propTypes = {
  registeredSubjects: PropTypes.array,
  onSaved: PropTypes.func,
};
