import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSenseViewModel } from '../viewModel';
import { EMPTY_DOCUMENT, type FrameDocument, type ImageAsset } from '../model';
import type { FrameRepository } from '../repository';
import type { ImageService } from '../service';

class MemoryRepository implements FrameRepository {
  document: FrameDocument = structuredClone(EMPTY_DOCUMENT);
  fail = false;
  load() { return structuredClone(this.document); }
  save(document: FrameDocument) { if (this.fail) throw new Error('no storage'); this.document = structuredClone(document); }
}

class FakeImageService implements ImageService {
  asset: ImageAsset = { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' };
  fail = false;
  readFile() { return this.fail ? Promise.reject(new Error('所选文件不是图片，请选择有效的图片文件。')) : Promise.resolve(this.asset); }
  demo() { return this.asset; }
}

describe('FrameSenseViewModel', () => {
  let repository: MemoryRepository;
  let images: FakeImageService;
  let vm: FrameSenseViewModel;

  beforeEach(() => {
    repository = new MemoryRepository();
    images = new FakeImageService();
    vm = new FrameSenseViewModel(repository, images);
  });

  it('initializes empty and loads a demo image', async () => {
    await vm.initialize();
    expect(vm.getSnapshot().status.phase).toBe('ready');
    vm.loadDemo();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
    expect(repository.document.image).not.toBeNull();
    expect(vm.getSnapshot().status.phase).toBe('available');
    vm.toggleGuide('center');
    expect(vm.getSnapshot().status.phase).toBe('editing');
  });

  it('updates guides, subject, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.markSubject(0.2, 0.8);
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.subject).toEqual({ x: 0.2, y: 0.8 });
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().status.phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().status.error?.message).toContain('本地存储');
  });

  it('keeps an import error until it is dismissed or a later image operation succeeds', async () => {
    vm.loadDemo();
    images.fail = true;
    await vm.importImage(new File(['not an image'], 'notes.txt', { type: 'text/plain' }));

    expect(vm.getSnapshot().status.phase).toBe('error');
    expect(vm.getSnapshot().status.error?.source).toBe('image');
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');

    vm.moveCrop(0.1, 0.1);
    expect(vm.getSnapshot().status.phase).toBe('error');
    expect(vm.getSnapshot().status.error?.source).toBe('image');
    expect(vm.getSnapshot().document.crop.x).toBe(0);

    vm.dismissError();
    expect(vm.getSnapshot().status.phase).toBe('available');
    expect(vm.getSnapshot().status.error).toBeNull();

    images.fail = true;
    await vm.importImage(new File(['bad'], 'bad.txt', { type: 'text/plain' }));
    expect(vm.getSnapshot().status.error?.source).toBe('image');
    images.fail = false;
    await vm.importImage(new File(['image'], 'ok.png', { type: 'image/png' }));
    expect(vm.getSnapshot().status.phase).toBe('available');
    expect(vm.getSnapshot().status.error).toBeNull();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
  });

  it('keeps a save failure until retry saves successfully', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().status.error?.source).toBe('save');

    vm.toggleGuide('center');
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().status.error?.source).toBe('save');

    vm.dismissError();
    expect(vm.getSnapshot().status.error?.source).toBe('save');

    repository.fail = false;
    vm.retrySave();
    expect(vm.getSnapshot().status.phase).toBe('available');
    expect(vm.getSnapshot().status.error).toBeNull();
    expect(repository.document.image?.name).toBe('test.svg');
  });
});
