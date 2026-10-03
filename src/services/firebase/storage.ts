import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseApp } from './app';

let storage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage {
  if (storage) return storage;
  storage = getStorage(getFirebaseApp());
  return storage;
}
