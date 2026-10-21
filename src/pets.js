// Owned-pet helpers over store.js's `game.pets` / `game.equipped`, after Chop-trees-for-
// treasure's systems/pets.js: lookup, equip slots, sorting, and the Power multiplier the
// equipped pets give. Pure functions of the state passed in, so store.js can use them too.
import { EGG_SHOP, EGGS, RARITY_ORDER } from './config.js'

// Full data ({ name, emoji, color, chance, rarity, power }) for an owned pet { id, egg, name }.
export const petInfo = (pet) => EGG_SHOP[pet.egg]?.pets.find((p) => p.name === pet.name) ?? null

// Index key for a pet species (game.discovered).
export const petKey = (pet) => `${pet.egg}:${pet.name}`

export const isKnownPet = (egg, name) => !!EGG_SHOP[egg]?.pets.some((p) => p.name === name)

export const petSlots = () => EGGS.slots

// The equipped pets as owned-pet objects, at most petSlots().
export function equippedPets(state) {
  const byId = new Map(state.pets.map((p) => [p.id, p]))
  return state.equipped.slice(0, petSlots(state)).map((id) => byId.get(id)).filter(Boolean)
}

// 1 + the summed power of every equipped pet, e.g. 1.35 = "x1.35".
export function petMultiplier(state) {
  let m = 1
  for (const pet of equippedPets(state)) m += petInfo(pet)?.power ?? 0
  return m
}

const strength = (pet) => {
  const info = petInfo(pet)
  return info ? info.power * 10 + RARITY_ORDER.indexOf(info.rarity) * 0.001 : -1
}

// Owned pets, strongest first.
export const sortedPets = (pets) => [...pets].sort((a, b) => strength(b) - strength(a) || a.id - b.id)
