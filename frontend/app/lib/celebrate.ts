/**
 * A tiny broadcast channel for celebrations, so anything anywhere in the app
 * can set one off without threading callbacks through every component.
 */
export type Intensity = "spark" | "bronze" | "silver" | "gold";

export interface Celebration {
  id: number;
  intensity: Intensity;
  title: string;
  flavour: string;
  icon?: string;
}

type Listener = (item: Celebration) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function onCelebrate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function celebrate(item: Omit<Celebration, "id">) {
  counter += 1;
  const full = { ...item, id: counter };
  listeners.forEach((listener) => listener(full));
}

/**
 * Unpredictable encouragement. Logging an entry has a one-in-five chance of a
 * small flourish — enough that it stays a surprise, never so often that it
 * becomes wallpaper. Deliberately not tied to spending less: it rewards the
 * act of recording, which is the habit worth building.
 */
const NUDGES = [
  "Written down. That is the whole trick.",
  "Another one caught in the act.",
  "The ledger grows honest.",
  "Noticed, named, recorded.",
  "That is how a month stays under control.",
  "Small entry, real habit.",
  "You are still here. That matters more than the number.",
  "One more line the future you will thank you for.",
];

export function maybeSpark(chance = 0.2) {
  if (Math.random() >= chance) return false;
  celebrate({
    intensity: "spark",
    title: NUDGES[Math.floor(Math.random() * NUDGES.length)],
    flavour: "",
  });
  return true;
}
