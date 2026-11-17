import { allowedMediaUrl, importCall, parseConnection, plainTranscript } from "./core.js";
import { scanReadyModePage } from "./collector.js";
const $ = (id) => document.getElementById(id);
let connection = (await chrome.storage.local.get("connection")).connection;
const scanId = new URL(location.href).searchParams.get("scan");
let scan = (await chrome.storage.session.get(scanId))[scanId] || {
  calls: [],
  error: "Open ReadyMode and click the BYLDA extension to scan calls.",
};
await chrome.storage.session.remove(scanId);
let rows = [],
  running = false;
function status(id, text, error = false) {
  $(id).textContent = text;
  $(id).className = error ? "error" : "success";
}
function showConnection() {
  status(
    "connection-status",
    connection
      ? `Connected to ${connection.workspace}. Connection expires after 30 days; create a new code to rotate it.`
      : "No workspace connected.",
  );
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function render() {
  $("calls").replaceChildren();
  rows = [];
  status(
    "scan-status",
    scan.error ||
      `${scan.calls.length} call${scan.calls.length === 1 ? "" : "s"} found${scan.source ? ` on ${scan.source}` : ""}. Only calls loaded on that page are included.`,
    !!scan.error,
  );
  if (!scan.calls.length)
    $("calls").append(
      node(
        "p",
        "Open ReadyMode Call Logs, load the desired calls, and click the extension again. Play a recording to expose its download link, or add a call below.",
      ),
    );
  for (const [index, call] of scan.calls.entries()) {
    const article = node("article");
    const checkLabel = node("label", "", "check");
    const selected = node("input");
    selected.type = "checkbox";
    selected.checked = call.selected !== false;
    checkLabel.append(selected, node("span", call.label, "call-title"));
    const meta = node(
      "p",
      `${call.duration == null ? "Duration unavailable" : `${call.duration}s`} · ${call.transcript ? "Transcript available" : "Recording will be transcribed"}`,
      "meta",
    );
    const label = node("label", "Transcript (review or paste)");
    const transcript = node("textarea");
    transcript.rows = 3;
    transcript.value = call.transcript || "";
    transcript.maxLength = 100000;
    transcript.id = `transcript-${index}`;
    label.htmlFor = transcript.id;
    const fileLabel = node("label", "Attach recording or transcript (optional)");
    const file = node("input", "", "file");
    file.id = `file-${index}`;
    file.type = "file";
    file.accept = ".mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac,.txt,.vtt,.srt";
    fileLabel.htmlFor = file.id;
    const audioLabel = node("label", "", "check");
    const includeAudio = node("input");
    includeAudio.type = "checkbox";
    includeAudio.checked = call.include_recording ?? !!call.recording_url;
    audioLabel.append(includeAudio, node("span", "Import the recording too, when available"));
    const rowStatus = node("p", "Ready to import", "row-status");
    article.append(checkLabel, meta, audioLabel, label, transcript, fileLabel, file);
    if (call.local_file) article.append(node("p", `Attached: ${call.local_file.name}`, "meta"));
    article.append(rowStatus);
    $("calls").append(article);
    rows.push({ call, selected, transcript, file, includeAudio, rowStatus });
  }
}
$("connect").onclick = async () => {
  try {
    connection = parseConnection($("connection").value);
    await chrome.storage.local.set({ connection });
    $("connection").value = "";
    showConnection();
  } catch (error) {
    status("connection-status", error.message, true);
  }
};
$("forget").onclick = async () => {
  connection = null;
  await chrome.storage.local.remove("connection");
  $("connection").value = "";
  showConnection();
};
$("rescan").onclick = async () => {
  if (running) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: scan.tab_id },
      func: scanReadyModePage,
    });
    if (!results[0]?.result)
      throw new Error("Could not read the page. Click the extension again from ReadyMode.");
    scan = { ...results[0].result, tab_id: scan.tab_id };
    render();
  } catch (error) {
    status("scan-status", error.message, true);
  }
};
$("add").onclick = () => {
  const id = $("manual-id").value.trim(),
    url = $("manual-url").value.trim();
  try {
    const parsed = new URL(url);
    if (
      !id ||
      parsed.protocol !== "https:" ||
      !/(^|\.)(readymode|xencall)\.com$/i.test(parsed.hostname)
    )
      throw new Error("Enter a call ID and HTTPS ReadyMode page URL.");
    // Preserve current edits when adding another call.
    for (const row of rows) {
      row.call.transcript = row.transcript.value;
      row.call.selected = row.selected.checked;
      row.call.include_recording = row.includeAudio.checked;
      row.call.local_file = row.file.files[0] || row.call.local_file;
    }
    scan.calls.push({
      external_id: id,
      source_url: url,
      label: `ReadyMode call ${id}`,
      transcript: "",
      duration: null,
      direction: "outbound",
    });
    scan.error = null;
    render();
    $("manual-id").value = "";
  } catch (error) {
    status("scan-status", error.message, true);
  }
};
$("import").onclick = async () => {
  if (running) return;
  if (!connection || !$("consent").checked)
    return status("import-status", "Connect a workspace and confirm permission first.", true);
  const selectedRows = rows.filter((r) => r.selected.checked);
  if (!selectedRows.length) return status("import-status", "Select at least one call.", true);
  // Ask for only the exact media origins needed by this batch, during the click gesture.
  try {
    const origins = [
      ...new Set(
        selectedRows.flatMap((r) => {
          if (r.file.files[0] || r.call.local_file) return [];
          const urls = [];
          if (!r.transcript.value.trim() && r.call.transcript_url) urls.push(r.call.transcript_url);
          if (
            r.call.recording_url &&
            (r.includeAudio.checked || (!r.transcript.value.trim() && !r.call.transcript_url))
          )
            urls.push(r.call.recording_url);
          return urls.map((value) => `${allowedMediaUrl(value).origin}/*`);
        }),
      ),
    ];
    if (origins.length && !(await chrome.permissions.request({ origins })))
      return status(
        "import-status",
        "Recording access was declined. Attach downloaded files to import instead.",
        true,
      );
  } catch (error) {
    return status("import-status", error.message, true);
  }
  running = true;
  document.querySelectorAll("button,input,textarea").forEach((el) => {
    el.disabled = true;
  });
  let completed = 0,
    failed = 0;
  const activeConnection = { ...connection };
  for (const row of selectedRows) {
    try {
      let file = row.file.files[0] || row.call.local_file,
        transcript = row.transcript.value.trim();
      if (file && /\.(txt|srt|vtt)$/i.test(file.name)) {
        if (file.size > 500000) throw new Error("Transcript file is too large.");
        transcript = plainTranscript(await file.text());
        file = null;
      }
      if (!transcript && !file && row.call.transcript_url) {
        row.rowStatus.textContent = "Downloading transcript…";
        const response = await fetch(allowedMediaUrl(row.call.transcript_url).href, {
          credentials: "include",
          redirect: "error",
        });
        if (!response.ok || /text\/html/i.test(response.headers.get("Content-Type") || ""))
          throw new Error("Transcript download failed. Download it manually and attach it.");
        if (Number(response.headers.get("Content-Length")) > 500000)
          throw new Error("Transcript file is too large.");
        transcript = plainTranscript(await response.text());
      }
      if (transcript.length > 100000) throw new Error("Transcript exceeds 100,000 characters.");
      const result = await importCall(
        activeConnection,
        { ...row.call, include_recording: row.includeAudio.checked },
        {
          file,
          transcript,
          onStage: (text) => {
            row.rowStatus.textContent = text;
          },
        },
      );
      row.rowStatus.textContent =
        result.warning ||
        (result.transcription_status === "queued"
          ? "Imported · transcription queued"
          : result.analysis_queued
            ? "Imported · analysis queued"
            : "Transcript imported");
      row.rowStatus.className = "row-status success";
      row.selected.checked = false;
      completed++;
    } catch (error) {
      row.rowStatus.textContent = error.message;
      row.rowStatus.className = "row-status error";
      failed++;
    }
    status(
      "import-status",
      `${completed} imported · ${failed} failed · ${selectedRows.length - completed - failed} remaining`,
      failed > 0,
    );
  }
  running = false;
  document.querySelectorAll("button,input,textarea").forEach((el) => {
    el.disabled = false;
  });
};
window.addEventListener("beforeunload", (event) => {
  if (running) {
    event.preventDefault();
    event.returnValue = "";
  }
});
showConnection();
render();
