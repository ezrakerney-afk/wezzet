// Wezzet Pro soft limits for tools that run in the browser. Counts one use; throws with a friendly message when today's free cap is used up.
// Does nothing while limits are switched off on the server. If the check can't be reached, the tool still runs.
export async function wzUse(tool) {
  let r;
  try {
    r = await fetch("/api/chat/use", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool }) });
  } catch { return; }
  if (r.status !== 429) return;
  const d = await r.json().catch(() => ({}));
  throw new Error(d.error || "You've hit today's free limit. Get Wezzet Pro for unlimited use at wezzet.com/pro.");
}
