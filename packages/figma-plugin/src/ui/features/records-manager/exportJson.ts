import { state } from "../../state";

export function exportRecordsAsJson(): void {
  const blob = new Blob(
    [JSON.stringify({ version: 1, mappings: state.mappings }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "component-records.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
