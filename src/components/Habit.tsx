import React, { useCallback, useRef, useState } from "react";
import { IonButtons, IonButton, IonModal, IonHeader, IonToolbar, IonTitle, IonInput, IonAlert } from "@ionic/react";
import { Minus, Plus, X } from "lucide-react";
import { HabitType, useHabitStore } from "../storages/zustandStore";
import { useEffect } from "react";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { VolumeButtons } from "@capacitor-community/volume-buttons";

function Habit(props: { habit: HabitType }) {
  const modal = useRef<HTMLIonModalElement>(null);
  const input = useRef<HTMLIonInputElement>(null);
  const [openSetSizeOfCycleAlert, setOpenSetSizeOfCycleAlert] = useState<string | null>(null);

  const handleIncrement = useCallback(() => {
    useHabitStore.getState().addToHabit(props.habit.id, 1, true);
    Haptics.notification({ type: NotificationType.Success });
  }, [props.habit.id]);

  const handleDecrement = useCallback(() => {
    useHabitStore.getState().addToHabit(props.habit.id, -1, true);
    Haptics.notification({ type: NotificationType.Warning });
  }, [props.habit.id]);
  useEffect(() => {
    // Watch for volume button events
    VolumeButtons.watchVolume(
      {
        disableSystemVolumeHandler: false, // Optional: set true on iOS to prevent default volume change
        suppressVolumeIndicator: false, // Optional: set true on Android to hide system overlay
      },
      (callback) => {
        if (callback.direction === "up") handleIncrement();
        if (callback.direction === "down") handleDecrement();
      },
    ).catch((e) => console.warn("Volume button watch failed", e));

    return () => {};
  }, [handleDecrement, handleIncrement]);
  const setNumberToAdd = useRef<HTMLIonAlertElement | null>(null);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const inputElement = setNumberToAdd.current?.querySelector("input");
      if (event.key === "Enter" && setNumberToAdd.current && inputElement && document.activeElement === inputElement) {
        useHabitStore.getState().addToHabit(props.habit.id, parseInt(inputElement.value) || 1, true);
        inputElement.value = "";
        setNumberToAdd.current.dismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <IonButton id={"open-modal" + props.habit.id} size="large" className="ion-margin">
        {props.habit.name}
      </IonButton>
      <IonModal ref={modal} trigger={"open-modal" + props.habit.id}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => modal.current?.dismiss()}>
                <X />
              </IonButton>
            </IonButtons>
            <IonTitle>
              <IonInput
                labelPlacement="stacked"
                ref={input}
                type="text"
                placeholder="Habit name"
                value={props.habit.name}
                onIonInput={(e) => {
                  useHabitStore.getState().updateHabit(props.habit.id, { name: e.detail.value! });
                }}
              />
            </IonTitle>
            <IonButton id={"delete-habit" + props.habit.id} className="ion-margin-end" slot="end" color="danger">
              DELETE
            </IonButton>
            <IonAlert
              trigger={"delete-habit" + props.habit.id}
              buttons={[
                { text: "Cancel", role: "cancel" },
                {
                  text: "DELETE",
                  handler: () => {
                    modal.current?.dismiss();
                    useHabitStore.getState().removeHabit(props.habit.id);
                  },
                },
              ]}
              message="Are you sure?"
            ></IonAlert>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding flex flex-col gap-2 h-full">
          <div className="grid grid-cols-6">
            {[
              { capitalized: "TODAY", camelCase: "todaysNumber", kebabCase: "todays-number" },
              { capitalized: "TOTAL", camelCase: "total", kebabCase: "total" },
            ].map((item) => (
              <>
                <ApplyAttributes attributes={{ fill: "clear" }}>
                  <IonButton className="" disabled>
                    {item.capitalized}:
                  </IonButton>
                  <IonButton onClick={() => setOpenSetSizeOfCycleAlert(props.habit.id)}>
                    {props.habit.sizeOfCycle}
                  </IonButton>

                  <IonButton disabled>
                    <X />
                  </IonButton>
                  <IonButton disabled>
                    {(props.habit[item.camelCase as "total" | "todaysNumber"] / props.habit.sizeOfCycle).toFixed(2)}
                  </IonButton>
                  <IonButton disabled>=</IonButton>
                  <IonButton id={`set-${item.kebabCase}` + props.habit.id}>
                    {props.habit[item.camelCase as "total" | "todaysNumber"]}
                  </IonButton>
                </ApplyAttributes>
                <IonAlert
                  header="Set Size Of Cycle"
                  isOpen={openSetSizeOfCycleAlert === props.habit.id}
                  buttons={[
                    {
                      text: "Cancel",
                      role: "cancel",
                      handler: () => setOpenSetSizeOfCycleAlert(null),
                    },
                    {
                      text: "SET",
                      handler: (alertData) => {
                        useHabitStore
                          .getState()
                          .updateHabit(props.habit.id, { sizeOfCycle: parseInt(alertData.sizeOfCycle) || 1000 });
                        setOpenSetSizeOfCycleAlert(null);
                      },
                    },
                  ]}
                  inputs={[
                    {
                      name: "sizeOfCycle",
                      type: "number",
                      value: props.habit.sizeOfCycle,
                      placeholder: "Size Of Cycle",
                    },
                  ]}
                ></IonAlert>
                <IonAlert
                  trigger={`set-${item.kebabCase}` + props.habit.id}
                  header={`Set ${item.capitalized} Number`}
                  buttons={[
                    { text: "Cancel", role: "cancel" },
                    {
                      text: "SET",
                      handler: (alertData) => {
                        useHabitStore
                          .getState()
                          .addToHabit(
                            props.habit.id,
                            parseInt(alertData[item.camelCase]) -
                              props.habit[item.camelCase as "total" | "todaysNumber"] || 0,
                            item.camelCase === "todaysNumber",
                          );
                      },
                    },
                  ]}
                  inputs={[
                    {
                      name: item.camelCase,
                      type: "number",
                      value: props.habit[item.camelCase as "total" | "todaysNumber"],
                      placeholder: `${item.capitalized} Number`,
                    },
                  ]}
                ></IonAlert>
              </>
            ))}
          </div>
          <IonButton className="w-full ion-margin-top flex-1" onClick={handleIncrement}>
            <Plus />
          </IonButton>
          {/* Move the grid styling to a wrapping div element */}
          <div className="grid grid-cols-2 gap-2">
            <IonButton id={"set-number-to-add" + props.habit.id} className="w-full">
              <Plus />
              <IonAlert
                ref={setNumberToAdd}
                header="Set Number to Add"
                trigger={"set-number-to-add" + props.habit.id}
                buttons={[
                  {
                    text: "Cancel",
                    role: "cancel",
                  },
                  {
                    text: "SET",
                    handler: (alertData) => {
                      useHabitStore.getState().addToHabit(props.habit.id, parseInt(alertData.toAdd) || 1, true);
                    },
                  },
                ]}
                inputs={[
                  {
                    name: "toAdd",
                    type: "number",
                    value: 10,
                    placeholder: "Set Number To Add",
                  },
                ]}
              ></IonAlert>
            </IonButton>
            <IonButton color={"danger"} className="w-full" onClick={handleDecrement}>
              <Minus />
            </IonButton>
          </div>
        </div>
      </IonModal>
    </>
  );
}

export default Habit;

import { ReactNode, isValidElement } from "react";

interface ParentProps {
  children: ReactNode;
  attributes?: { [key: string]: string }; // The attribute you want to pass down
}

export const ApplyAttributes = ({ children, attributes }: ParentProps) => {
  return (
    <>
      {React.Children.map(children, (child) => {
        // Check if the child is a valid React element before cloning
        if (isValidElement(child)) {
          return React.cloneElement(child, {
            // Attach your new attribute/prop here
            ...attributes,
          });
        }
        return child;
      })}
    </>
  );
};
