import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonListHeader,
  IonLabel,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { BackupConfig, EMPTY_CONFIG, useBackupStore } from "../storages/backupStore";
import { useHabitStore } from "../storages/zustandStore";
import { hashHabits, syncFromRemote, runBackup } from "../services/s3Backup";

type Props = { isOpen: boolean; onClose: () => void };

const INTERVALS = [
  { label: "Off", value: 0 },
  { label: "Every 15 minutes", value: 15 },
  { label: "Every hour", value: 60 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every day", value: 1440 },
];

const FIELDS: { key: keyof BackupConfig; label: string; placeholder?: string; type?: "text" | "password" | "url" }[] = [
  { key: "endpoint", label: "Endpoint", placeholder: "https://<account-id>.r2.cloudflarestorage.com", type: "url" },
  { key: "region", label: "Region", placeholder: "auto" },
  { key: "bucket", label: "Bucket" },
  { key: "accessKeyId", label: "Access key ID" },
  { key: "secretAccessKey", label: "Secret access key", type: "password" },
  { key: "objectKey", label: "File name in bucket", placeholder: "habits-backup.json" },
];

const BackupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { config, intervalMinutes, lastBackupAt, lastBackedUpHash, status, lastError } = useBackupStore(
    useShallow((s) => ({
      config: s.config,
      intervalMinutes: s.intervalMinutes,
      lastBackupAt: s.lastBackupAt,
      lastBackedUpHash: s.lastBackedUpHash,
      status: s.status,
      lastError: s.lastError,
    })),
  );
  const habits = useHabitStore((s) => s.habits);

  const [draft, setDraft] = useState<BackupConfig>(config ?? EMPTY_CONFIG);
  const [toast, setToast] = useState<string | null>(null);

  // Reset the form to the saved values each time the modal opens.
  useEffect(() => {
    if (isOpen) setDraft(config ?? EMPTY_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const syncing = status === "syncing";
  const canSave = !!(draft.endpoint.trim() && draft.bucket.trim() && draft.accessKeyId.trim() && draft.secretAccessKey);
  const upToDate = !!config && lastBackedUpHash === hashHabits(habits);
  const lastBackupText = lastBackupAt ? new Date(lastBackupAt).toLocaleString() : null;

  const statusText = (() => {
    if (!config) return "Not set up. Save your bucket details to start backing up.";
    if (syncing) return "Syncing…";
    if (status === "error") return lastError ?? "Something went wrong.";
    if (!lastBackupText) return "Never backed up.";
    return upToDate
      ? `Backed up. Last backup: ${lastBackupText}`
      : `Changes not backed up yet. Last backup: ${lastBackupText}`;
  })();

  const handleSave = async () => {
    useBackupStore.getState().setConfig({
      endpoint: draft.endpoint.trim(),
      region: draft.region.trim() || "auto",
      bucket: draft.bucket.trim(),
      accessKeyId: draft.accessKeyId.trim(),
      secretAccessKey: draft.secretAccessKey,
      objectKey: draft.objectKey.trim() || "habits-backup.json",
    });

    // Connecting: merge what's in the bucket (new habits in, deleted habits out), then back up.
    const result = await syncFromRemote();
    if (result === null) return; // error is shown in the status line
    const ok = await runBackup();
    if (!ok) return;
    const { added, removed } = result;
    const parts = [
      added > 0 && `restored ${added} habit${added === 1 ? "" : "s"}`,
      removed > 0 && `removed ${removed} deleted elsewhere`,
    ].filter(Boolean);
    setToast(parts.length ? `Connected: ${parts.join(", ")}.` : "Connected and backed up.");
  };

  const handleBackupNow = async () => {
    const ok = await runBackup();
    if (ok) setToast("Backup complete.");
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar className="ion-padding-horizontal">
            <IonTitle>Backup</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onClose}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent className="ion-padding">
          <IonList lines="full" inset>
            <IonListHeader>
              <IonLabel className="ion-padding-horizontal">Status</IonLabel>
            </IonListHeader>
            <IonItem>
              {syncing && <IonSpinner name="dots" slot="start" />}
              <IonLabel className="ion-text-wrap" color={status === "error" ? "danger" : undefined}>
                {statusText}
              </IonLabel>
            </IonItem>
            <IonItem lines="none">
              <IonButton slot="end" fill="solid" disabled={!config || syncing} onClick={handleBackupNow}>
                Back up now
              </IonButton>
            </IonItem>
          </IonList>

          <IonList lines="full" inset>
            <IonListHeader>
              <IonLabel className="ion-padding-horizontal">Automatic backup</IonLabel>
            </IonListHeader>
            <IonItem>
              <IonSelect
                label="Back up"
                value={intervalMinutes}
                disabled={!config}
                onIonChange={(e) => useBackupStore.getState().setIntervalMinutes(Number(e.detail.value))}
              >
                {INTERVALS.map((i) => (
                  <IonSelectOption key={i.value} value={i.value}>
                    {i.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonNote className="ion-padding-horizontal">
              Runs while the app is open, and only when something has changed.
            </IonNote>
          </IonList>

          <IonList lines="full" inset>
            <IonListHeader>
              <IonLabel className="ion-padding-horizontal">S3 bucket</IonLabel>
            </IonListHeader>
            {FIELDS.map((f) => (
              <IonItem key={f.key}>
                <IonInput
                  label={f.label}
                  labelPlacement="stacked"
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={draft[f.key]}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  onIonInput={(e) => setDraft((d) => ({ ...d, [f.key]: String(e.detail.value ?? "") }))}
                />
              </IonItem>
            ))}
          </IonList>

          <IonButton expand="block" disabled={!canSave || syncing} onClick={handleSave}>
            {config ? "Save changes" : "Save and connect"}
          </IonButton>
          {config && (
            <IonButton
              expand="block"
              fill="clear"
              color="danger"
              disabled={syncing}
              onClick={() => {
                useBackupStore.getState().setConfig(null);
                useBackupStore.getState().setIntervalMinutes(0);
                setDraft(EMPTY_CONFIG);
              }}
            >
              Disconnect
            </IonButton>
          )}
        </IonContent>
      </IonModal>

      <IonToast isOpen={!!toast} message={toast ?? ""} duration={2500} onDidDismiss={() => setToast(null)} />
    </>
  );
};

export default BackupModal;
