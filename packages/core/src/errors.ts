/** A step's target did not appear in time and the step is configured with `onMissing: 'stop'`. */
export class TargetNotFoundError extends Error {
  readonly stepId: string;

  constructor(stepId: string, timeout: number) {
    super(`Target of step "${stepId}" was not found within ${timeout}ms`);
    this.name = 'TargetNotFoundError';
    this.stepId = stepId;
  }
}
