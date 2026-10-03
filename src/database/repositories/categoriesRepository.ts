import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Category, CategoryType } from '@/types/finance';

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  is_default: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    isDefault: row.is_default === 1,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCategories(type?: CategoryType): Promise<Category[]> {
  const db = await getDatabase();
  const rows = type
    ? await db.getAllAsync<CategoryRow>('SELECT * FROM categories WHERE deleted_at IS NULL AND type = ? ORDER BY name ASC', type)
    : await db.getAllAsync<CategoryRow>('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name ASC');
  return rows.map(mapRow);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapRow(row) : null;
}

export interface CreateCategoryInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  type: CategoryType;
  parentId?: string | null;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO categories (id, name, icon, color, type, is_default, parent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    input.name,
    input.icon ?? null,
    input.color ?? null,
    input.type,
    input.parentId ?? null,
    now,
    now,
  );
  const category = await getCategoryById(id);
  if (!category) throw new Error('Failed to create category');
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}
