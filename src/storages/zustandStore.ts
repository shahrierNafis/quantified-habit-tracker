import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ionicStorage } from "./ionicStorage";

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
  /** Tombstones: id -> ISO date the habit was deleted. Synced so deletions aren't undone by a pull. */
  deletedIds: Record<string, string>;
  /** Applies a remote backup: drops habits deleted elsewhere, adds habits that are new here. */
  mergeRemote: (remoteHabits: HabitType[], remoteDeleted: Record<string, string>) => { added: number; removed: number };
  pruneDeleted: (maxAgeDays: number) => void;
  addHabit: (habit: Partial<HabitType>) => void;
  addToHabit: (id: string, number: number, addToToday?: boolean) => void;
  updateHabit: (id: string, habit: Partial<HabitType>) => void;
  removeHabit: (id: string) => void;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      deletedIds: {},
      mergeRemote: (remoteHabits, remoteDeleted) => {
        const { habits, deletedIds } = get();
        const today = new Date().toLocaleDateString();

        const tombstones = { ...remoteDeleted, ...deletedIds };

        // Habits deleted on another device
        const kept = habits.filter((h) => !(h.id in remoteDeleted));
        const keptIds = new Set(kept.map((h) => h.id));

        // Habits that only exist remotely and haven't been deleted anywhere
        const added = remoteHabits
          .filter((h) => h?.id && h?.name && !keptIds.has(h.id) && !(h.id in tombstones))
          .map((h) => ({
            ...h,
            // same day-rollover rule applied on load
            todaysNumber: h.today === today ? h.todaysNumber : 0,
            today,
          }));

        set({ habits: [...kept, ...added], deletedIds: tombstones });
        return { added: added.length, removed: habits.length - kept.length };
      },
      pruneDeleted: (maxAgeDays) => {
        const cutoff = Date.now() - maxAgeDays * 86_400_000;
        set((state) => ({
          deletedIds: Object.fromEntries(
            Object.entries(state.deletedIds).filter(([, at]) => new Date(at).getTime() >= cutoff),
          ),
        }));
      },
      addHabit: ({
        id = crypto.randomUUID(), // Date.now().toString()
        name,
        todaysNumber = 0,
        today = new Date().toLocaleDateString(),

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
          const today = new Date().toLocaleDateString();

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
          deletedIds: { ...state.deletedIds, [id]: new Date().toISOString() },
        }));
      },
    }),
    {
      name: "ionic-habit-storage",
      storage: createJSONStorage(() => ionicStorage),
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Migrate from version 0 to version 1
          const migratedState = {
            ...(persistedState as HabitState),
            habits: (persistedState as HabitState).habits.map((habit) => ({
              ...habit,
              todaysNumber: habit.today === new Date().toISOString().split("T")[0] ? habit.todaysNumber : 0,
              today: new Date().toLocaleDateString(),
            })),
          };
          return migratedState;
        }
        return persistedState;
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error || !state) return;

          const today = new Date().toLocaleDateString();

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
