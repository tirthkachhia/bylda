/** Runs in Chrome's isolated world only after the user clicks the extension.
 * Read visible DOM and exported media links; never intercept credentials/network traffic.
 */
export function scanReadyModePage() {
  if (location.protocol !== "https:" || !/(^|\.)(readymode|xencall)\.com$/i.test(location.hostname))
    throw new Error("Open ReadyMode Call Logs or a call recording, then click BYLDA again.");
  const visible = (el) =>
    !!(el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const duration = (s) => {
    const match = s.match(/(?:^|\s)(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\s|$)/);
    return match ? Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
  };
  const candidates = [];
  const seen = new Set();
  const links = document.querySelectorAll(
    "audio[src], audio source[src], a[href], [data-recording-url]",
  );
  for (const el of links) {
    if (candidates.length >= 100) break;
    const raw =
      el.getAttribute("data-recording-url") || el.getAttribute("src") || el.getAttribute("href");
    if (!raw) continue;
    let url;
    try {
      url = new URL(raw, location.href);
    } catch {
      continue;
    }
    const media =
      el.matches("audio, audio source, [data-recording-url]") ||
      /\.(mp3|mp4|m4a|wav|webm|ogg|flac)(?:$|[?#])/i.test(url.href) ||
      /recording|download.*(?:audio|mp3)|play.*recording/i.test(
        `${url.pathname} ${el.getAttribute("aria-label") || ""} ${el.textContent}`,
      );
    const transcriptFile = /\.(txt|vtt|srt)(?:$|[?#])/i.test(url.href);
    if (!media && !transcriptFile) continue;
    const row =
      el.closest(
        'tr, [role="row"], [data-call-id], [data-call-log-id], article, [role="dialog"]',
      ) ||
      el.closest("section") ||
      el.parentElement;
    if (!row || !visible(row)) continue;
    const rowText = clean(
      row.innerText ||
        Array.from(row.children, (child) => child.textContent).join(" ") ||
        row.textContent,
    );
    if (url.protocol !== "https:") continue;
    const id =
      row.getAttribute("data-call-id") ||
      row.getAttribute("data-call-log-id") ||
      el.getAttribute("data-call-id") ||
      url.searchParams.get("call_id") ||
      url.searchParams.get("call_log_id") ||
      url.searchParams.get("recording_id") ||
      url.searchParams.get("id") ||
      url.pathname;
    const identity = `${location.hostname}:${id}`;
    let item = candidates.find((c) => c.external_id === id);
    if (!item) {
      if (seen.has(identity)) continue;
      seen.add(identity);
      const transcriptEl = row.querySelector(
        '[data-transcript], [aria-label="Transcript"], .transcript, [data-testid="transcript"]',
      );
      const transcript =
        transcriptEl && visible(transcriptEl)
          ? (transcriptEl.innerText || transcriptEl.textContent || "").trim()
          : "";
      const time = row.querySelector("time[datetime]")?.getAttribute("datetime");
      item = {
        external_id: id,
        source_url: location.origin + location.pathname,
        label: rowText.slice(0, 180) || `ReadyMode call ${candidates.length + 1}`,
        duration: duration(rowText),
        started_at: time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : null,
        direction: /\binbound\b/i.test(rowText) ? "inbound" : "outbound",
        transcript,
        recording_url: "",
        transcript_url: "",
      };
      candidates.push(item);
    }
    if (transcriptFile) item.transcript_url = url.href;
    else if (!item.recording_url) item.recording_url = url.href;
  }
  // A call detail can expose a transcript without a recording link.
  for (const el of document.querySelectorAll(
    '[data-call-id] [data-transcript], [data-call-id] [aria-label="Transcript"]',
  )) {
    if (!visible(el)) continue;
    const row = el.closest("[data-call-id]");
    const id = row.getAttribute("data-call-id");
    if (!id || candidates.some((c) => c.external_id === id) || candidates.length >= 100) continue;
    const transcript = (el.innerText || el.textContent || "").trim();
    if (!transcript) continue;
    candidates.push({
      external_id: id,
      source_url: location.origin + location.pathname,
      label: `ReadyMode call ${id}`,
      transcript,
      duration: null,
      direction: "outbound",
      recording_url: "",
      transcript_url: "",
    });
  }
  return { calls: candidates, source: location.origin, scanned_at: new Date().toISOString() };
}
