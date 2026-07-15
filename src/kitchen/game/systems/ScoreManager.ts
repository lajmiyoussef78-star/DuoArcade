export type ComboTier = "none" | "bronze" | "silver" | "gold" | "platinum";

export type MatchSnapshot = {
  score: number;
  served: number;
  walkouts: number;
  tips: number;
  burns: number;
  wrongServes: number;
  combo: number;
  maxCombo: number;
  comboTier: ComboTier;
  /** Match grade: 0–3 stars from performance %. */
  stars: 0 | 1 | 2 | 3;
  /** How well the run went vs a strong target — 0 to 100. */
  performancePercent: number;
  /** Short label for the results screen. */
  gradeLabel: string;
  xpEarned: number;
  coinsEarned: number;
  timeLeft: number;
  duration: number;
  ended: boolean;
};

export function comboTier(combo: number): ComboTier {
  if (combo >= 8) return "platinum";
  if (combo >= 6) return "gold";
  if (combo >= 4) return "silver";
  if (combo >= 2) return "bronze";
  return "none";
}

export function comboMultiplier(combo: number): number {
  const tier = comboTier(combo);
  if (tier === "platinum") return 1.6;
  if (tier === "gold") return 1.4;
  if (tier === "silver") return 1.25;
  if (tier === "bronze") return 1.1;
  return 1;
}

/**
 * Performance out of 100% for a finished (or live) match.
 * Tuned so a near-perfect solo run can hit 100% (3★ only at 100%).
 */
export function calcPerformancePercent(input: {
  score: number;
  served: number;
  walkouts: number;
  burns: number;
  wrongServes: number;
  tips: number;
  maxCombo: number;
}): number {
  const scorePct = Math.min(50, (input.score / 1000) * 50);
  const servePct = Math.min(25, (input.served / 8) * 25);
  const tipPct = Math.min(10, (input.tips / 180) * 10);
  const comboPct = Math.min(15, (input.maxCombo / 8) * 15);
  const penalty =
    input.walkouts * 6 + input.burns * 2.5 + input.wrongServes * 3;
  return Math.round(Math.max(0, Math.min(100, scorePct + servePct + tipPct + comboPct - penalty)));
}

export function gradeLabelFor(percent: number, stars: 0 | 1 | 2 | 3): string {
  if (stars === 3 || percent >= 100) return "Perfect service";
  if (stars === 2 || percent >= 70) return "Great service";
  if (stars === 1 || percent >= 40) return "Good service";
  if (percent >= 20) return "Needs practice";
  return "Kitchen closed early";
}

export function calcStars(input: {
  score: number;
  served: number;
  walkouts: number;
  burns?: number;
  wrongServes?: number;
  tips?: number;
  maxCombo?: number;
}): 0 | 1 | 2 | 3 {
  const percent = calcPerformancePercent({
    score: input.score,
    served: input.served,
    walkouts: input.walkouts,
    burns: input.burns ?? 0,
    wrongServes: input.wrongServes ?? 0,
    tips: input.tips ?? 0,
    maxCombo: input.maxCombo ?? 0,
  });
  if (input.served < 1 && percent < 15) return 0;
  // 3 stars only at a perfect 100% run
  if (percent >= 100) return 3;
  if (percent >= 70) return 2;
  if (percent >= 40) return 1;
  return 0;
}

export function calcRewards(input: {
  score: number;
  served: number;
  tips: number;
  maxCombo: number;
  stars: 0 | 1 | 2 | 3;
}): { xp: number; coins: number } {
  const xp =
    Math.floor(input.score / 10) +
    input.served * 15 +
    input.maxCombo * 8 +
    input.stars * 25;
  const coins =
    Math.floor(input.score / 20) +
    Math.floor(input.tips / 2) +
    input.served * 5 +
    input.stars * 10 +
    input.maxCombo * 2;
  return { xp: Math.max(0, xp), coins: Math.max(0, coins) };
}

export class ScoreManager {
  score = 0;
  served = 0;
  walkouts = 0;
  tips = 0;
  burns = 0;
  wrongServes = 0;
  combo = 0;
  maxCombo = 0;
  duration: number;
  timeLeft: number;
  ended = false;
  private closing = false;

  constructor(durationSec = 180) {
    this.duration = durationSec;
    this.timeLeft = durationSec;
  }

  get comboTier(): ComboTier {
    return comboTier(this.combo);
  }

  get isClosing(): boolean {
    return this.closing;
  }

  tick(deltaSec: number): void {
    if (this.ended) return;
    this.timeLeft = Math.max(0, this.timeLeft - deltaSec);
    this.closing = this.timeLeft <= 20;
    if (this.timeLeft <= 0) this.ended = true;
  }

  /** Apply base points from a successful serve; returns final awarded points. */
  registerServe(basePoints: number, tip: number): number {
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const awarded = Math.round(basePoints * comboMultiplier(this.combo));
    this.score += awarded;
    this.tips += tip;
    this.served += 1;
    return awarded;
  }

  registerWrongServe(): void {
    this.wrongServes += 1;
    this.combo = 0;
  }

  registerWalkout(count = 1): void {
    this.walkouts += count;
    this.score = Math.max(0, this.score - 40 * count);
    this.combo = 0;
  }

  registerBurn(): void {
    this.burns += 1;
    this.combo = 0;
  }

  snapshot(): MatchSnapshot {
    const performancePercent = calcPerformancePercent({
      score: this.score,
      served: this.served,
      walkouts: this.walkouts,
      burns: this.burns,
      wrongServes: this.wrongServes,
      tips: this.tips,
      maxCombo: this.maxCombo,
    });
    const stars = calcStars({
      score: this.score,
      served: this.served,
      walkouts: this.walkouts,
      burns: this.burns,
      wrongServes: this.wrongServes,
      tips: this.tips,
      maxCombo: this.maxCombo,
    });
    const { xp, coins } = calcRewards({
      score: this.score,
      served: this.served,
      tips: this.tips,
      maxCombo: this.maxCombo,
      stars,
    });
    return {
      score: this.score,
      served: this.served,
      walkouts: this.walkouts,
      tips: this.tips,
      burns: this.burns,
      wrongServes: this.wrongServes,
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboTier: this.comboTier,
      stars,
      performancePercent,
      gradeLabel: gradeLabelFor(performancePercent, stars),
      xpEarned: xp,
      coinsEarned: coins,
      timeLeft: this.timeLeft,
      duration: this.duration,
      ended: this.ended,
    };
  }
}
