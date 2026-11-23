// The sidebar's job pump: `later()` queues a job, `start()` runs it on the
// copy's timer after its delay. Jobs are drained into timers as soon as any
// are pending, then the pump waits again.
//
// Order matters: the wake resolver is dropped before the drain, so a `later()`
// that lands mid-drain cannot call a dead wake() and strand its job (and the
// render it was meant to fix) forever.
export class JobQueue {
  constructor() {
    this.jobs = [];
    this.wake = null;
  }

  later(ms, fn) {
    this.jobs.push({ ms, fn });
    if (this.wake) this.wake();
  }

  start(cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        if (!this.jobs.length) await new Promise((wake) => (this.wake = wake));
        this.wake = null;
        for (const job of this.jobs.splice(0)) {
          cx.timer.after(job.ms, (cx) => {
            job.fn();
            cx.notify();
          });
        }
      }
    });
  }

  stop() {
    this.jobs.length = 0;
    this.wake = null;
  }
}
