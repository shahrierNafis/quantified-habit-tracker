import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { cloudDoneOutline, cloudOfflineOutline, cloudUploadOutline } from "ionicons/icons";
// import ExploreContainer from '../components/ExploreContainer';
import "./Home.css";
import Habit from "../components/Habit";
import BackupModal from "../components/BackupModal";
import { useHabitStore } from "../storages/zustandStore";
import { useBackupStore } from "../storages/backupStore";
import { hashHabits, isBackupDue, syncFromRemote, runBackup } from "../services/s3Backup";
import { useShallow } from "zustand/shallow";
import { useEffect, useRef, useState } from "react";

const Home: React.FC = () => {
  const habits = useHabitStore(useShallow((state) => state.habits));
  const [backupOpen, setBackupOpen] = useState(false);

  const config = useBackupStore((s) => s.config);
  const intervalMinutes = useBackupStore((s) => s.intervalMinutes);
  const lastBackedUpHash = useBackupStore((s) => s.lastBackedUpHash);
  const backupError = useBackupStore((s) => s.status === "error");

  // Load local data first, then pull habits that exist only in the bucket.
  useEffect(() => {
    (async () => {
      await useHabitStore.persist.rehydrate();
      await useBackupStore.persist.rehydrate();
      if (useBackupStore.getState().config) await syncFromRemote();
    })();
  }, []);

  // Automatic backup: on a timer, and when the app comes back to the foreground
  // (mobile WebViews throttle timers while in the background).
  useEffect(() => {
    if (!config || intervalMinutes <= 0) return;

    const tick = () => {
      if (isBackupDue()) runBackup({ onlyIfChanged: true });
    };
    const id = setInterval(tick, Math.min(intervalMinutes, 5) * 60_000); // re-check at least every 5 min
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [config, intervalMinutes]);

  const backupIcon = !config
    ? cloudUploadOutline
    : backupError
      ? cloudOfflineOutline
      : lastBackedUpHash === hashHabits(habits)
        ? cloudDoneOutline
        : cloudUploadOutline;
  const addHabitAlert = useRef<HTMLIonAlertElement | null>(null);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const inputElement = addHabitAlert.current?.querySelector("input");
      if (event.key === "Enter" && addHabitAlert.current && inputElement && document.activeElement === inputElement) {
        useHabitStore.getState().addHabit({ name: inputElement.value, todaysNumber: 0 });
        inputElement.value = "";
        addHabitAlert.current.dismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="ion-padding-horizontal">
          <IonTitle>Quantified Habit Tracker</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Backup settings" onClick={() => setBackupOpen(true)}>
              <IonIcon slot="icon-only" icon={backupIcon} color={backupError ? "danger" : undefined} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Quantified Habit Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonButton
          id="present-alert"
          expand="block"
          // onClick={() => }
        >
          Add Habit
        </IonButton>
        <IonAlert
          ref={addHabitAlert}
          trigger="present-alert"
          header="Add Habit"
          buttons={[
            { text: "Cancel", role: "cancel" },
            {
              text: "ADD",
              handler: (alertData) => {
                {
                  useHabitStore.getState().addHabit({ name: alertData.name, todaysNumber: 0 });
                }
              },
            },
          ]}
          inputs={[
            {
              name: "name",
              placeholder: "Name",
              type: "text",
            },
          ]}
        ></IonAlert>
        <IonContent className="ion-padding">
          {habits.map((habit) => (
            <Habit key={habit.id} habit={habit} />
          ))}
        </IonContent>
      </IonContent>

      <BackupModal isOpen={backupOpen} onClose={() => setBackupOpen(false)} />
    </IonPage>
  );
};

export default Home;
