const $ = (sel) => document.querySelector(sel);
const form = $("#form");
const urlInput = $("#url");
const probeBtn = $("#probe");
const downloadBtn = $("#download");
const probeResult = $("#probeResult");

function showProbe(info) {
  probeResult.classList.remove("hidden");
  if (!info.ok) {
    probeResult.innerHTML = `<strong>Error:</strong> ${info.error || "Unknown error"}`;
    downloadBtn.disabled = true;
    return;
  }
  const size = info.contentLength ? (info.contentLength / (1024*1024)).toFixed(2) + " MB" : "Unknown";
  const allowed = info.isLikelyVideo && !info.tooLarge;
  downloadBtn.disabled = !allowed;

  probeResult.innerHTML = `
    <div class="row"><div class="label">Filename</div><div class="value">${info.filename || "-"}</div></div>
    <div class="row"><div class="label">Type</div><div class="value">${info.contentType || "-"}</div></div>
    <div class="row"><div class="label">Size</div><div class="value">${size}</div></div>
    <div class="row"><div class="label">Ready</div><div class="value">${allowed ? "Yes" : "No"}</div></div>
  `;
}

probeBtn.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  probeResult.classList.add("hidden");
  const res = await fetch("/probe?url=" + encodeURIComponent(url));
  showProbe(await res.json());
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  window.location.href = "/download?url=" + encodeURIComponent(url);
});
