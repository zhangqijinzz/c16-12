import type { ErrorSource, FrameDocument, Phase, StablePhase, WorkStatus } from './model';

export type Operation = 'initialization' | 'import';
export type AvailableMode = 'available' | 'editing';
type NonErrorPhase = StablePhase;

const LOADING_MESSAGES: Record<Operation, string> = {
  initialization: '正在恢复上次工作状态…',
  import: '正在载入图片，请稍候。',
};

const TOP_LABELS: Record<Phase, string> = {
  loading: '载入中…',
  ready: '可用',
  available: '可用',
  editing: '编辑中',
  error: '需要注意',
};

const ERROR_TITLES: Record<ErrorSource, string> = {
  initialization: '读取历史状态失败',
  image: '图片载入失败',
  save: '本地保存失败',
};

export function loadingStatus(operation: Operation): WorkStatus {
  return { phase: 'loading', message: LOADING_MESSAGES[operation], error: null, fallbackPhase: 'ready' };
}

export function documentStatus(document: FrameDocument, mode: AvailableMode = 'editing', message?: string): WorkStatus {
  const phase: NonErrorPhase = document.image ? mode : 'ready';
  return {
    phase,
    message: message ?? (document.image ? '图片已载入，可以开始构图。' : '欢迎来到 FrameSense，先载入示例或导入图片。'),
    error: null,
    fallbackPhase: phase,
  };
}

export function availableStatus(document: FrameDocument, message?: string): WorkStatus {
  return documentStatus(document, 'available', message);
}

export function editingStatus(document: FrameDocument, message: string): WorkStatus {
  return documentStatus(document, 'editing', message);
}

export function errorStatus(source: ErrorSource, message: string, fallbackPhase: NonErrorPhase = 'ready'): WorkStatus {
  return { phase: 'error', message: ERROR_TITLES[source], error: { source, message }, fallbackPhase };
}

export function topStatusLabel(status: WorkStatus): string {
  return TOP_LABELS[status.phase];
}

export function statusMessage(status: WorkStatus): string {
  if (status.error) {
    return `${status.message}：${status.error.message}`;
  }
  return status.message;
}

export function workspaceLabel(status: WorkStatus, hasImage: boolean): string {
  if (status.phase === 'loading') return 'LOADING';
  if (status.phase === 'error') return 'ERROR';
  return hasImage ? (status.phase === 'editing' ? 'EDITING' : 'AVAILABLE') : 'READY';
}
