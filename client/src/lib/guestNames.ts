const ADJECTIVES = [
  "Strong",
  "Powerful",
  "Beautiful",
  "Brilliant",
  "Radiant",
  "Cosmic",
  "Stellar",
  "Luminous",
  "Celestial",
  "Infinite",
  "Eternal",
  "Mighty",
  "Noble",
  "Wise",
  "Swift",
  "Bold",
  "Fierce",
  "Graceful",
  "Majestic",
  "Serene",
];

const ASTRONOMICAL_NAMES = [
  "Nebula",
  "Andromeda",
  "Quasar",
  "Sirius",
  "Centauri",
  "Vega",
  "Orion",
  "Polaris",
  "Cassiopeia",
  "Phoenix",
  "Draco",
  "Lyra",
  "Perseus",
  "Cygnus",
  "Aquila",
  "Hercules",
  "Gemini",
  "Pegasus",
  "Hydra",
  "Pulsar",
  "Supernova",
  "Aurora",
  "Nova",
  "Cosmos",
  "Galaxy",
  "Meteor",
  "Comet",
  "Eclipse",
];

export function generateGuestName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const astronomical = ASTRONOMICAL_NAMES[Math.floor(Math.random() * ASTRONOMICAL_NAMES.length)];
  return `${adjective} ${astronomical}`;
}

export function isGuestName(name: string): boolean {
  const parts = name.split(" ");
  if (parts.length !== 2) return false;
  return ADJECTIVES.includes(parts[0]) && ASTRONOMICAL_NAMES.includes(parts[1]);
}
