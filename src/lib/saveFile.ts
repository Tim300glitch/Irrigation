/**
 * Offer a generated file to the user. Inside a hosted Claude artifact the viewer
 * blocks plain download links, so the platform's `downloads` capability is used
 * there; everywhere else a normal browser download is triggered.
 */
type DownloadsApi = { save: (r: { filename: string; data: Blob | string }) => Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

let downloadsPromise: Promise<DownloadsApi | null> | null = null;

function hostDownloads(): Promise<DownloadsApi | null> {
  if (!downloadsPromise) {
    const host = (globalThis as { claude?: ClaudeHost }).claude;
    downloadsPromise = host?.use ? (host.use("downloads") as Promise<DownloadsApi | null>).catch(() => null) : Promise.resolve(null);
  }
  return downloadsPromise;
}

export async function saveFile(data: Blob | string, filename: string): Promise<void> {
  const dl = await hostDownloads();
  if (dl) {
    try {
      await dl.save({ filename, data });
    } catch {
      // declined or unavailable: nothing else to do inside the viewer
    }
    return;
  }
  const blob = typeof data === "string" ? new Blob([data]) : data;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
