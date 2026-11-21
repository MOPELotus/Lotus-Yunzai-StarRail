// Scheduling semantics follow HSR_Nous scheduler.py at 00185dd (MIT).
export const ACTION_DISTANCE = 10_000;
const MIN_SPEED = 1e-6;
const READY_EPSILON = 1e-9;
export type TurnKind = "normal" | "normal_extra" | "countdown";

export interface ScheduledActor {
  readonly id: string;
  readonly stats: { readonly spd: number };
}

export interface ScheduledTurn<T extends ScheduledActor = ScheduledActor> {
  readonly actor: T;
  readonly kind: TurnKind;
  readonly time: number;
}

interface Entry<T> {
  readonly actor: T;
  readonly tie: number;
  distance: number;
  speed: number;
  time: number;
  frozen: boolean;
  waveResetExempt: boolean;
  countdown?: { left: number; speed: number };
}

export class ActionScheduler<T extends ScheduledActor> {
  readonly #entries = new Map<string, Entry<T>>();
  readonly #slots: Entry<T>[] = [];
  readonly #extra: { entry: Entry<T>; kind: Exclude<TurnKind, "normal"> }[] = [];
  #clock = 0;

  constructor(actors: readonly T[]) {
    for (const [tie, actor] of actors.entries()) this.#add(actor, tie);
  }

  get clock(): number { return this.#clock; }

  addActor(actor: T): void {
    this.#add(actor, this.#slots.length + 1);
  }

  rejoinActor(actor: T): void {
    const old = this.#entry(actor.id);
    old.frozen = true;
    this.#entries.delete(actor.id);
    this.addActor(actor);
  }

  #add(actor: T, tie: number): void {
    if (this.#entries.has(actor.id)) throw new Error("Duplicate scheduled actor " + actor.id);
    const speed = Math.max(actor.stats.spd, MIN_SPEED);
    const entry = {
      actor, tie, speed, distance: ACTION_DISTANCE, time: this.#clock + ACTION_DISTANCE / speed,
      frozen: false, waveResetExempt: false,
    };
    this.#entries.set(actor.id, entry);
    this.#slots.push(entry);
  }

  #entry(id: string): Entry<T> {
    const entry = this.#entries.get(id);
    if (!entry) throw new Error("Unknown scheduled actor " + id);
    return entry;
  }

  #speed(entry: Entry<T>): number {
    return entry.countdown?.speed ?? Math.max(entry.speed, MIN_SPEED);
  }

  #eta(entry: Entry<T>): number {
    return this.#clock + entry.distance / this.#speed(entry);
  }

  speedOf(id: string): number | undefined { return this.#entries.get(id)?.speed; }
  freeze(id: string): void { this.#entry(id).frozen = true; }
  unfreeze(id: string): void { this.#entry(id).frozen = false; }
  exemptFromWaveReset(id: string): void { this.#entry(id).waveResetExempt = true; }

  grantExtraTurn(id: string, kind: Exclude<TurnKind, "normal"> = "normal_extra"): void {
    this.#extra.push({ entry: this.#entry(id), kind });
  }

  grantCountdown(id: string, turns: number, speed: number, initialRatio = 1): void {
    const entry = this.#entry(id);
    entry.countdown = { left: turns, speed: Math.max(speed, MIN_SPEED) };
    entry.distance = ACTION_DISTANCE * Math.min(Math.max(initialRatio, 0), 1);
    entry.time = this.#eta(entry);
  }

  formExitEta(id: string): number | undefined {
    const entry = this.#entries.get(id);
    if (entry?.countdown) {
      const countdown = entry.countdown;
      return this.#clock + (entry.distance + (countdown.left - 1) * ACTION_DISTANCE) / countdown.speed;
    }
  }

  nextActor(): ScheduledTurn<T> | undefined {
    const extra = this.#extra.shift();
    if (extra) return { actor: extra.entry.actor, kind: extra.kind, time: this.#clock };
    if (!this.#slots.some(entry => !entry.frozen)) return undefined;

    // Preserve the absolute key for each queued actor. Recomputing all keys after
    // every pop changes equal-AV order when subtraction introduces a rounding error.
    while (true) {
      let next: Entry<T> | undefined;
      for (const entry of this.#slots) {
        if (!next || entry.time < next.time || (entry.time === next.time && entry.tie < next.tie)) next = entry;
      }
      if (!next) return undefined;
      const delta = next.time - this.#clock;
      if (delta > 0) {
        for (const entry of this.#slots) {
          entry.distance = Math.max(0, entry.distance - delta * this.#speed(entry));
        }
      }
      this.#clock = next.time;
      next.distance = ACTION_DISTANCE;
      const kind = next.countdown ? "countdown" : "normal";
      if (!next.frozen && next.countdown && --next.countdown.left <= 0) delete next.countdown;
      next.time = this.#eta(next);
      if (!next.frozen) return { actor: next.actor, kind, time: this.#clock };
    }
  }

  preview(limit = 10): ScheduledTurn<T>[] {
    const extra = this.#extra.filter(item => !item.entry.frozen)
      .map(({ entry, kind }) => ({ actor: entry.actor, kind, time: this.#clock }));
    const regular: ScheduledTurn<T>[] = [...this.#entries.values()].filter(entry => !entry.frozen)
      .map(entry => ({ entry, time: this.#eta(entry) }))
      .sort((a, b) => a.time - b.time || a.entry.tie - b.entry.tie)
      .map(({ entry, time }) => ({ actor: entry.actor, kind: entry.countdown ? "countdown" : "normal", time }));
    return [...extra, ...regular].slice(0, limit);
  }

  resetActionGauge(exceptCountdown = false): void {
    for (const entry of this.#slots) {
      if (exceptCountdown && (entry.countdown || entry.waveResetExempt)) continue;
      entry.distance = ACTION_DISTANCE;
      entry.time = this.#eta(entry);
    }
  }

  advanceAction(id: string, ratio: number): void {
    const entry = this.#entry(id);
    if (entry.distance <= READY_EPSILON) return;
    entry.distance = Math.max(0, entry.distance - ACTION_DISTANCE * ratio);
    entry.time = this.#eta(entry);
  }

  delayAction(id: string, ratio: number): void {
    const entry = this.#entry(id);
    entry.distance += ACTION_DISTANCE * ratio;
    entry.time = this.#eta(entry);
  }

  actNow(id: string): void {
    const entry = this.#entry(id);
    entry.distance = 0;
    entry.time = this.#clock;
  }

  undoGaugeReset(id: string): void {
    const entry = this.#entry(id);
    const distance = entry.distance - ACTION_DISTANCE;
    entry.distance = distance > READY_EPSILON ? distance : ACTION_DISTANCE;
    entry.time = this.#eta(entry);
  }

  changeSpeed(id: string, speed: number): void {
    if (speed <= 0) return;
    const entry = this.#entry(id);
    entry.speed = speed;
    entry.time = this.#eta(entry);
  }
}
