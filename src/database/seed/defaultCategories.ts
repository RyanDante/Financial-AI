export interface DefaultCategorySeed {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
}

/** Icon names reference Ionicons (bundled with Expo via @expo/vector-icons). */
export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Food', icon: 'restaurant', color: '#F2545B', type: 'expense' },
  { name: 'Transport', icon: 'car', color: '#3DDCFF', type: 'expense' },
  { name: 'Entertainment', icon: 'film', color: '#7C5CFC', type: 'expense' },
  { name: 'Shopping', icon: 'bag', color: '#F5A524', type: 'expense' },
  { name: 'Bills', icon: 'receipt', color: '#9D9DAB', type: 'expense' },
  { name: 'Education', icon: 'school', color: '#3FC98B', type: 'expense' },
  { name: 'Health', icon: 'medkit', color: '#F2545B', type: 'expense' },
  { name: 'Gaming', icon: 'game-controller', color: '#7C5CFC', type: 'expense' },
  { name: 'Subscriptions', icon: 'repeat', color: '#3DDCFF', type: 'expense' },
  { name: 'Other', icon: 'ellipsis-horizontal', color: '#6B6B78', type: 'expense' },
  { name: 'Salary', icon: 'cash', color: '#3FC98B', type: 'income' },
  { name: 'Other Income', icon: 'trending-up', color: '#3FC98B', type: 'income' },
];
