import type { ApiEnvelope } from "@/lib/types/traffic";

export async function readApi<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.status === "error") {
    const message =
      payload.status === "error" ? payload.error.message : "The request failed.";
    throw new Error(message);
  }

  return payload.data;
}
