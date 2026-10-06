import type { Ionicons } from '@expo/vector-icons';

export interface Essential {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Matches a seeded category name (src/database/seed/defaultCategories.ts). */
  categoryName: string;
}

/**
 * Everyday necessities suggested on Home when your own history has nothing
 * due. Deliberately no prices: the app doesn't know them, and a guessed
 * number would break the "never guess a number" rule. The card shows your
 * remaining budget for the category instead.
 */
export const ESSENTIALS: Essential[] = [
  { id: 'rice', name: 'Rice', icon: 'nutrition-outline', categoryName: 'Food' },
  { id: 'cooking-oil', name: 'Cooking oil', icon: 'flask-outline', categoryName: 'Food' },
  { id: 'drinking-water', name: 'Drinking water', icon: 'water-outline', categoryName: 'Food' },
  { id: 'soap', name: 'Soap & detergent', icon: 'sparkles-outline', categoryName: 'Shopping' },
  { id: 'toiletries', name: 'Toiletries', icon: 'basket-outline', categoryName: 'Shopping' },
  { id: 'phone-credit', name: 'Phone credit & data', icon: 'phone-portrait-outline', categoryName: 'Bills' },
  { id: 'cooking-gas', name: 'Cooking gas refill', icon: 'flame-outline', categoryName: 'Bills' },
  { id: 'electricity', name: 'Prepaid electricity', icon: 'flash-outline', categoryName: 'Bills' },
];
