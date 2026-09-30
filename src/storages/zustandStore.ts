import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { Storage } from "@ionic/storage";

// 1. Initialize Ionic Storage
const store = new Storage();
const initStorage = async () => {
  await store.create();
};
initStorage();

// 2. Create the custom StateStorage adapter
const ionicStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await store.get(name);
    return value ? JSON.stringify(value) : null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Zustand's persist passes a stringified JSON value
    await store.set(name, JSON.parse(value));
  },
  removeItem: async (name: string): Promise<void> => {
    await store.remove(name);
  },
};

// 3. Create your Zustand store with the persist middleware
export type HabitType = {
  name: string;
  id: string;
  todaysNumber: number;
  today: string;
  total: number;
  sizeOfCycle: number;
};
interface HabitState {
  habits: HabitType[];
  addHabit: (habit: Partial<HabitType>) => void;
  addToHabit: (id: string, number: number, addToToday?: boolean) => void;
  updateHabit: (id: string, habit: Partial<HabitType>) => void;
  removeHabit: (id: string) => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (set, get) => ({
      habits: [],
      addHabit: ({
        id = crypto.randomUUID(), // Date.now().toString()
        name,
        todaysNumber = 0,
        today = new Date().toISOString().split("T")[0],
        total = 0,
        sizeOfCycle = 1000,
      }) => {
        set((state) => ({
          habits: [...state.habits, { id, name, todaysNumber, today, total, sizeOfCycle } as HabitType],
        }));
      },
      updateHabit: (id, updatedHabit) => {
        set((state) => ({
          habits: state.habits.map((habit) => (habit.id === id ? { ...habit, ...updatedHabit } : habit)),
        }));
      },
      addToHabit: (id, number, addToToday = true) => {
        set((state) => {
          const today = new Date().toISOString().split("T")[0];
          return {
            habits: state.habits.map((habit) =>
              habit.id === id
                ? {
                    ...habit,
                    todaysNumber: addToToday
                      ? habit.today === today
                        ? habit.todaysNumber + number
                        : number
                      : habit.todaysNumber,
                    total: habit.total + number,
                    today,
                  }
                : habit,
            ),
          };
        });
      },
      removeHabit: (id) => {
        set((state) => ({
          habits: state.habits.filter((habit) => habit.id !== id),
        }));
      },
    }),
    {
      name: "ionic-habit-storage",
      storage: createJSONStorage(() => ionicStorage),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error || !state) return;

          const today = new Date().toISOString().split("T")[0];

          // ✅ Use the store setter, not the raw state object
          useHabitStore.setState({
            habits: state.habits.map((habit) => ({
              ...habit,
              todaysNumber: habit.today === today ? habit.todaysNumber : 0,
              today,
            })),
          });
        };
      },
    },
  ),
);
