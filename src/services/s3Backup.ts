import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { BackupConfig, useBackupStore } from "../storages/backupStore";
import { HabitType, useHabitStore } from "../storages/zustandStore";

type BackupFile = {
  version: 1;
  exportedAt: string;
  habits: HabitType[];
  /** id -> ISO deletion date. Optional so backups made before this field existed still load. */
  deleted?: Record<string, string>;
};

const TOMBSTONE_MAX_AGE_DAYS = 90;

function makeClient(c: BackupConfig) {
  return new S3Client({
    region: c.region || "auto",
    endpoint: c.endpoint || undefined,
    forcePathStyle: true, // works with R2, MinIO, Backblaze, etc.
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // Newer SDK versions add CRC32 checksums by default, which some
    // S3-compatible providers reject. Only send them when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** Cheap fingerprint of the habit list, used to tell whether anything changed since the last backup. */
export function hashHabits(habits: HabitType[]): string {
  const s = JSON.stringify(habits);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function fetchRemote(config: BackupConfig): Promise<BackupFile | null> {
  try {
    const res = await makeClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: config.objectKey }));
    const text = await res.Body?.transformToString();
    if (!text) return null;
    const parsed = JSON.parse(text) as BackupFile;
    if (!Array.isArray(parsed.habits)) throw new Error("Backup file has an unexpected format");
    return parsed;
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null; // nothing backed up yet
    throw e;
  }
}

/**
 * Pulls the remote backup and merges it into this device:
 * - habits whose IDs aren't on the device are added (unless deleted locally),
 * - habits deleted on another device are removed.
 * Returns the counts, or null if the request failed.
 */
export async function syncFromRemote(): Promise<{ added: number; removed: number } | null> {
  const { config, setSyncing, recordPullSuccess, recordError } = useBackupStore.getState();
  if (!config) return { added: 0, removed: 0 };

  setSyncing();
  try {
    const remote = await fetchRemote(config);
    const result = useHabitStore.getState().mergeRemote(remote?.habits ?? [], remote?.deleted ?? {});
    recordPullSuccess();
    return result;
  } catch (e) {
    recordError(errorMessage(e));
    return null;
  }
}

let inFlight: Promise<boolean> | null = null;

/** Uploads all habits. With onlyIfChanged, skips the upload when nothing changed since the last backup. */
export function runBackup(opts: { onlyIfChanged?: boolean } = {}): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { config, lastBackedUpHash, setSyncing, recordSuccess, recordError } = useBackupStore.getState();
    if (!config) return false;

    useHabitStore.getState().pruneDeleted(TOMBSTONE_MAX_AGE_DAYS);
    const { habits, deletedIds } = useHabitStore.getState();
    const hash = hashHabits(habits);
    if (opts.onlyIfChanged && hash === lastBackedUpHash) return true;

    setSyncing();
    try {
      const body: BackupFile = { version: 1, exportedAt: new Date().toISOString(), habits, deleted: deletedIds };
      await makeClient(config).send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: config.objectKey,
          Body: JSON.stringify(body),
          ContentType: "application/json",
        }),
      );
      recordSuccess(hash);
      return true;
    } catch (e) {
      recordError(errorMessage(e));
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** True when auto-backup is on, the interval has elapsed, and there are unsaved changes. */
export function isBackupDue(): boolean {
  const { config, intervalMinutes, lastBackupAt, lastBackedUpHash } = useBackupStore.getState();
  if (!config || intervalMinutes <= 0) return false;
  if (hashHabits(useHabitStore.getState().habits) === lastBackedUpHash) return false;
  if (!lastBackupAt) return true;
  return Date.now() - new Date(lastBackupAt).getTime() >= intervalMinutes * 60_000;
}
