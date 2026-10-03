import { getUploadStatusLabel, isImageAttachment } from './attachments.mapper';

describe('getUploadStatusLabel', () => {
  it('labels every status', () => {
    expect(getUploadStatusLabel('pending')).toBe('Waiting to upload');
    expect(getUploadStatusLabel('uploaded')).toBe('Backed up');
    expect(getUploadStatusLabel('failed')).toBe('Upload failed');
  });
});

describe('isImageAttachment', () => {
  it('recognizes image mime types', () => {
    expect(isImageAttachment('image/jpeg')).toBe(true);
    expect(isImageAttachment('image/png')).toBe(true);
  });

  it('rejects non-image mime types and null', () => {
    expect(isImageAttachment('application/pdf')).toBe(false);
    expect(isImageAttachment(null)).toBe(false);
  });
});
