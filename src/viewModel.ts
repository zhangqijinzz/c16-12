import { useState, useSyncExternalStore } from 'react';
import { cropForRatio, makeVariant, moveCrop, resizeCrop } from './domain';
import { EMPTY_DOCUMENT, type FrameDocument, type GuideKey, type Ratio, type ViewState } from './model';
import type { FrameRepository } from './repository';
import type { ImageService } from './service';
import { availableStatus, documentStatus, editingStatus, errorStatus, loadingStatus, type AvailableMode, type Operation } from './status';

type Listener = () => void;

export class FrameSenseViewModel {
  private state: ViewState = {
    status: loadingStatus('initialization'),
    document: structuredClone(EMPTY_DOCUMENT),
    compareOpen: false,
  };
  private readonly listeners = new Set<Listener>();
  private operationToken = 0;

  constructor(private readonly repository: FrameRepository, private readonly imageService: ImageService) {}

  getSnapshot = (): ViewState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(next: Partial<ViewState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((listener) => listener());
  }

  private beginOperation(operation: Operation): number {
    const token = ++this.operationToken;
    this.patch({ status: loadingStatus(operation), compareOpen: false });
    return token;
  }

  private isCurrentOperation(token: number): boolean {
    return token === this.operationToken;
  }

  private canEditDocument(): boolean {
    if (this.state.document.image === null || this.state.status.phase === 'loading') return false;
    return this.state.status.phase !== 'error' || this.state.status.error?.source !== 'image';
  }

  private applyDocument(document: FrameDocument, message: string, mode: AvailableMode = 'editing'): void {
    this.operationToken += 1;
    const previousPhase = this.state.status.fallbackPhase;
    const successStatus = mode === 'available' ? availableStatus(document, message) : editingStatus(document, message);
    try {
      this.repository.save(document);
      this.patch({ document, status: successStatus, compareOpen: false });
    } catch {
      this.patch({
        document,
        status: errorStatus('save', '当前编辑仍保留在页面中，但还没有写入本地存储。请检查浏览器存储权限后重试。', mode === 'available' ? successStatus.fallbackPhase : previousPhase),
      });
    }
  }

  async initialize(): Promise<void> {
    const token = this.beginOperation('initialization');
    try {
      const document = await Promise.resolve(this.repository.load());
      if (!this.isCurrentOperation(token)) return;
      this.patch({ document, status: availableStatus(document) });
    } catch {
      if (!this.isCurrentOperation(token)) return;
      this.patch({ status: errorStatus('initialization', '本地历史状态无法读取。可重试，或先关闭提示继续新建工作。', 'ready') });
    }
  }

  async importImage(file: File): Promise<void> {
    if (this.state.status.phase === 'loading') return;

    const fallbackPhase = this.state.status.fallbackPhase;
    const token = this.beginOperation('import');
    try {
      const image = await this.imageService.readFile(file);
      if (!this.isCurrentOperation(token)) return;
      this.applyDocument({ ...structuredClone(EMPTY_DOCUMENT), image }, '图片已载入，可以开始构图。', 'available');
    } catch (error) {
      if (!this.isCurrentOperation(token)) return;
      this.patch({
        status: errorStatus('image', error instanceof Error ? error.message : '图片载入失败，请换一张图片重试。', fallbackPhase),
      });
    }
  }

  loadDemo(): void {
    this.applyDocument({ ...structuredClone(EMPTY_DOCUMENT), image: this.imageService.demo() }, '示例图片已载入。', 'available');
  }

  retrySave(): void {
    if (this.state.status.error?.source !== 'save') return;
    try {
      this.repository.save(this.state.document);
      const fallbackMode = this.state.status.fallbackPhase === 'editing' ? 'editing' : 'available';
      this.patch({ status: documentStatus(this.state.document, fallbackMode, '本地保存已恢复。') });
    } catch {
      this.patch({
        status: errorStatus('save', '当前编辑仍保留在页面中，但还没有写入本地存储。请检查浏览器存储权限后重试。', this.state.status.fallbackPhase),
      });
    }
  }

  dismissError(): void {
    const error = this.state.status.error;
    if (!error || error.source === 'save') return;
    const mode = this.state.status.fallbackPhase === 'editing' ? 'editing' : 'available';
    this.patch({ status: documentStatus(this.state.document, mode) });
  }

  toggleGuide(guide: GuideKey): void {
    if (!this.canEditDocument()) return;
    const document = { ...this.state.document, guides: { ...this.state.document.guides, [guide]: !this.state.document.guides[guide] } };
    this.applyDocument(document, '辅助层已更新。');
  }

  setRatio(ratio: Ratio): void {
    if (!this.canEditDocument()) return;
    const image = this.state.document.image;
    if (!image) return;
    const crop = cropForRatio(ratio, image.width / image.height, this.state.document.crop);
    this.applyDocument({ ...this.state.document, crop }, `${ratio === 'free' ? '自由' : ratio} 裁切已应用。`);
  }

  moveCrop(dx: number, dy: number): void {
    if (!this.canEditDocument()) return;
    this.applyDocument({ ...this.state.document, crop: moveCrop(this.state.document.crop, dx, dy) }, '裁切位置已调整。');
  }

  resizeCrop(width: number, height: number): void {
    if (!this.canEditDocument()) return;
    this.applyDocument({ ...this.state.document, crop: resizeCrop(this.state.document.crop, width, height) }, '裁切范围已调整。');
  }

  markSubject(x: number, y: number): void {
    if (!this.canEditDocument()) return;
    this.applyDocument({ ...this.state.document, subject: { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } }, '主体标记已更新。');
  }

  saveVariant(): void {
    if (!this.canEditDocument()) return;
    const id = `variant-${Date.now()}`;
    const variant = makeVariant(this.state.document.crop, id);
    const document = { ...this.state.document, variants: [...this.state.document.variants, variant].slice(-8) };
    this.applyDocument(document, `已保存裁切方案 ${document.variants.length}。`);
  }

  selectVariant(id: string): void {
    if (!this.canEditDocument()) return;
    const variant = this.state.document.variants.find((item) => item.id === id);
    if (!variant) return;
    this.applyDocument({ ...this.state.document, crop: { ...variant, id: 'current' } }, '已切换到保存的裁切方案。');
  }

  toggleCompare(): void {
    if (this.state.status.phase === 'loading' || this.state.status.error?.source === 'image') return;
    this.patch({ compareOpen: !this.state.compareOpen });
  }
}

export function useFrameSenseViewModel(repository: FrameRepository, imageService: ImageService): [FrameSenseViewModel, ViewState] {
  const [viewModel] = useState(() => new FrameSenseViewModel(repository, imageService));
  const state = useSyncExternalStore(viewModel.subscribe, viewModel.getSnapshot, viewModel.getSnapshot);
  return [viewModel, state];
}
