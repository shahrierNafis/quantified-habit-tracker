import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ionicStorage } from "./ionicStorage";

export type BackupConfig = {
  endpoint: string; // e.g. https://<account-id>.r2.cloudflarestorage.com (leave empty for AWS)
  region: string; // "auto" for R2, otherwise e.g. "us-east-1"
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  objectKey: string; // file name inside the bucket
};

export const EMPTY_CONFIG: BackupConfig = {
  endpoint: "",
  region: "auto",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  objectKey: "habits-backup.json",
};

export type SyncStatus = "idle" | "syncing" | "error";

interface BackupState {
  config: BackupConfig | null;
  /** 0 = automatic backup off */
  intervalMinutes: number;
  lastBackupAt: string | null; // ISO date of last successful upload
  lastBackedUpHash: string | null; // fingerprint of the habits that were uploaded
  status: SyncStatus; // not persisted
  lastError: string | null; // not persisted

  setConfig: (config: BackupConfig | null) => void;
  setIntervalMinutes: (minutes: number) => void;
  setSyncing: () => void;
  recordSuccess: (hash: string) => void;
  recordPullSuccess: () => void;
  recordError: (message: string) => void;
}

export const useBackupStore = create<BackupState>()(
  persist(
    (set) => ({
      config: null,
      intervalMinutes: 0,
      lastBackupAt: null,
      lastBackedUpHash: null,
      status: "idle",
      lastError: null,

      setConfig: (config) => set({ config, lastError: null, status: "idle" }),
      setIntervalMinutes: (intervalMinutes) => set({ intervalMinutes }),
      setSyncing: () => set({ status: "syncing", lastError: null }),
      recordSuccess: (hash) =>
        set({ status: "idle", lastError: null, lastBackupAt: new Date().toISOString(), lastBackedUpHash: hash }),
      recordPullSuccess: () => set({ status: "idle", lastError: null }),
      recordError: (message) => set({ status: "error", lastError: message }),
    }),
    {
      name: "ionic-habit-backup-settings",
      storage: createJSONStorage(() => ionicStorage),
      partialize: (state) => ({
        config: state.config,
        intervalMinutes: state.intervalMinutes,
        lastBackupAt: state.lastBackupAt,
        lastBackedUpHash: state.lastBackedUpHash,
      }),
    },
  ),
);
