import { describe, expect, it } from 'vitest';
import { BrowserImageService } from '../service';

describe('BrowserImageService', () => {
  it('rejects a non-image file before attempting to decode it', async () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });
    await expect(new BrowserImageService().readFile(file)).rejects.toThrow('所选文件不是图片');
  });
});
