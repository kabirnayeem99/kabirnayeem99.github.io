import { computeLegacyBuildTimestamp } from "../lib/build-timestamp";
import SERVICE_WORKER from "../sw/service-worker.ts?worker-script";

export function GET(): Response {
  const { iso } = computeLegacyBuildTimestamp();
  const version = iso.replace(/\D/g, "").slice(0, 14);
  // The worker (src/sw/service-worker.ts) names its caches after this build's version.
  const content = `const CACHE_VERSION = ${JSON.stringify(version)};\n${SERVICE_WORKER}\n`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
