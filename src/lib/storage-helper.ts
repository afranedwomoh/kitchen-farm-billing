import { supabase } from "@/integrations/supabase/client";

/** Upload a file to a private bucket and return the object path. */
export async function uploadToBucket(bucket: string, file: File, prefix = ""): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${prefix}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Returns a long-lived signed URL for a stored object path. */
export async function getSignedUrl(bucket: string, path: string | null | undefined, expiresIn = 60 * 60 * 24 * 7): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/** Fetch an image URL and convert to data URL (needed for html2canvas + jsPDF cross-origin). */
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
