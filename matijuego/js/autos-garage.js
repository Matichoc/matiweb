// Garaje de Autos de Chocolate: autos que se compran con Matipuntos. Cada uno cambia el look y da ventajas
// (más Matipuntos por partida, nitro e imán más largos, escudo al partir), así que gastar bien sirve para ganar más.
// progress.garage = { owned: [ids], car: id }

import { spendCoins, saveProgress } from "./storage.js?v=630e2f1eb3";

export const CARS = [
  { id: "choco", name: "Choco Racer", icon: "🍫", price: 0, body: 0x64321b, trim: 0xd4216c, accent: 0xffc800, perks: "El de siempre", coin: 1, nitro: 1, magnet: 1, shield: false },
  { id: "alfajor", name: "Alfajor GT", icon: "🍪", price: 400, body: 0xe0b070, trim: 0xfff0d0, accent: 0x8a4b2c, perks: "+10% Matipuntos", coin: 1.1, nitro: 1, magnet: 1, shield: false },
  { id: "cupcake", name: "Cupcake Turbo", icon: "🧁", price: 900, body: 0xff8ab8, trim: 0xfff6e6, accent: 0x35c8ff, perks: "Nitro e imán +40%", coin: 1, nitro: 1.4, magnet: 1.4, shield: false },
  { id: "neon", name: "Neón Cacao", icon: "🌌", price: 1500, body: 0x2a1a5a, trim: 0x35f0ff, accent: 0xff3fa4, perks: "+15% Matipuntos · parte con escudo", coin: 1.15, nitro: 1, magnet: 1, shield: true, glow: 0x35f0ff },
  { id: "corona", name: "Corona Dorada", icon: "👑", price: 2100, body: 0xffc800, trim: 0xfff6c0, accent: 0xd4216c, perks: "+30% Matipuntos · nitro +50% · escudo", coin: 1.3, nitro: 1.5, magnet: 1.2, shield: true, glow: 0xffc800, crown: true },
];

export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];

export function garageOf(progress) {
  if (!progress.garage || typeof progress.garage !== "object") progress.garage = { owned: ["choco"], car: "choco" };
  const g = progress.garage;
  if (!Array.isArray(g.owned) || !g.owned.includes("choco")) g.owned = ["choco", ...(Array.isArray(g.owned) ? g.owned : [])];
  if (!g.owned.includes(g.car)) g.car = "choco";
  return g;
}

export const currentCar = (progress) => carById(garageOf(progress).car);

export function buyCar(progress, id) {
  const g = garageOf(progress);
  const car = carById(id);
  if (g.owned.includes(id) || car.id !== id) return false;
  if (!spendCoins(progress, car.price)) return false;
  g.owned.push(id);
  g.car = id;
  saveProgress(progress);
  return true;
}

export function equipCar(progress, id) {
  const g = garageOf(progress);
  if (!g.owned.includes(id)) return false;
  g.car = id;
  saveProgress(progress);
  return true;
}
