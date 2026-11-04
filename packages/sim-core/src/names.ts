import type { Rng } from "./rng";
const FIRST = ["Ada", "Bo", "Cleo", "Dax", "Esme", "Finn", "Gia", "Hux", "Ines", "Jory", "Kai", "Lena", "Milo", "Nova", "Ozzy", "Pia", "Quin", "Rhea", "Sol", "Tove", "Uma", "Vik", "Wren", "Xan", "Yara", "Zed"];
const LAST = ["Okafor", "Lindqvist", "Tanaka", "Ribeiro", "Novak", "Haddad", "Moreau", "Castillo", "Petrov", "Adeyemi", "Kowalski", "Silva", "Brandt", "Nakamura", "Duarte", "Voss"];
export function generateName(rng: Rng): string {
  return `${FIRST[rng.int(0, FIRST.length - 1)]} ${LAST[rng.int(0, LAST.length - 1)]}`;
}
