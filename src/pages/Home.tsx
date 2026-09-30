import { IonAlert, IonButton, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
// import ExploreContainer from '../components/ExploreContainer';
import "./Home.css";
import Habit from "../components/Habit";
import { useHabitStore } from "../storages/zustandStore";
import { useShallow } from "zustand/shallow";
import { useEffect } from "react";

const Home: React.FC = () => {
  const habits = useHabitStore(useShallow((state) => state.habits));
  useEffect(() => {
    useHabitStore.persist.rehydrate();

    return () => {};
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Blank</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
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
          trigger="present-alert"
          header="Add Habit"
          buttons={[
            { text: "Cancel", role: "cancel" },
            {
              text: "ADD",
              handler: (alertData) => {
                useHabitStore.getState().addHabit({ name: alertData.name, todaysNumber: 0 });
              },
            },
          ]}
          inputs={[
            {
              name: "name",

              placeholder: "Name",
            },
          ]}
        ></IonAlert>
        <IonContent className="ion-padding">
          {habits.map((habit) => (
            <Habit key={habit.id} habit={habit} />
          ))}
        </IonContent>
      </IonContent>
    </IonPage>
  );
};

export default Home;
