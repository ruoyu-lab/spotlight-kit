export interface Labels {
  prev: string;
  next: string;
  finish: string;
  close: string;
  progress(current: number, total: number): string;
}

export const en: Labels = {
  prev: 'Back',
  next: 'Next',
  finish: 'Done',
  close: 'Close',
  progress: (current, total) => `${current} / ${total}`,
};

export const zhCN: Labels = {
  prev: '上一步',
  next: '下一步',
  finish: '完成',
  close: '关闭',
  progress: (current, total) => `${current} / ${total}`,
};
