// FFmpeg ends many unrelated failures with identical summary lines. Keep the
// specific cause and expose the complete retained log rather than that footer.
const footer=/^(?:Conversion failed!?|Error while processing the decoded data.*|Error reinitializing filters!?)$/i;
export function encoderFailure(logs) {
 const lines=logs.map(s=>String(s).trim()).filter(Boolean);
 const candidates=lines.filter(line=>!footer.test(line)&&/error|invalid|failed|memory|not found|no stream|cannot|could not|unable|unsupported|too (?:large|many)|dimensions|resource temporarily unavailable/i.test(line));
 return candidates.slice(0,4).join('\n')||lines.filter(line=>!footer.test(line)&&!/^frame=/.test(line)).slice(-8).join('\n')||'The encoder stopped without an error log.';
}
