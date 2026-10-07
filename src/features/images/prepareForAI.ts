import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { LLMImage } from '@/ai/llm/types';
import type { PickedFile } from '@/features/attachments/attachments.service';

/** Longest side sent to the model: enough to read a receipt or SMS, small enough to upload quickly. */
const MAX_SIDE = 1600;

/** A photo, downscaled and re-encoded as JPEG base64, ready to send to a vision model. */
export async function prepareImageForAI(file: PickedFile): Promise<LLMImage> {
  let image = await ImageManipulator.manipulate(file.uri).renderAsync();
  // Picker results carry their size; a shared image doesn't, so measure the rendered one.
  const width = file.width ?? image.width;
  const height = file.height ?? image.height;
  if (Math.max(width, height) > MAX_SIDE) {
    image = await ImageManipulator.manipulate(file.uri)
      .resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE })
      .renderAsync();
  }
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!result.base64) throw new Error('Could not read that picture.');
  return { base64: result.base64, mediaType: 'image/jpeg' };
}
