import type { ActivityStreamSample, RiderProfile, Stage, StageActivityResult, StageMarkerCrossing, StageRecap } from "./models.js";

export interface StageRecapInput {
  stage: Stage;
  riders: readonly RiderProfile[];
  activityResults: readonly StageActivityResult[];
  samplesByActivityId: ReadonlyMap<string, readonly ActivityStreamSample[]>;
  markerCrossings: readonly StageMarkerCrossing[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sampleAtOrBefore(samples: readonly ActivityStreamSample[], timeSeconds: number): ActivityStreamSample | null {
  let current: ActivityStreamSample | null = null;
  for (const sample of samples) {
    if (sample.timeSeconds > timeSeconds) {
      break;
    }
    current = sample;
  }
  return current;
}

export function materializeStageRecap(input: StageRecapInput): StageRecap {
  const resultByRider = new Map(input.activityResults.map((result) => [result.riderId, result]));
  const riders = input.riders.filter((rider) => resultByRider.has(rider.id));
  const finishTimes = input.activityResults.map((result) => result.finishTimeSeconds);
  const sampleTimes = [...input.samplesByActivityId.values()].flatMap((samples) => samples.map((sample) => sample.timeSeconds));
  const crossingTimes = input.markerCrossings.map((crossing) => crossing.crossedAtSeconds);
  const durationSeconds = Math.max(0, ...finishTimes, ...sampleTimes, ...crossingTimes);

  if (riders.length === 0 || durationSeconds === 0) {
    return {
      stageId: input.stage.id,
      durationSeconds,
      riders,
      markers: input.stage.orderedMarkers,
      timeline: []
    };
  }

  const frameTimes = [...new Set([0, ...sampleTimes, ...crossingTimes, durationSeconds])]
    .filter((timeSeconds) => Number.isInteger(timeSeconds) && timeSeconds >= 0 && timeSeconds <= durationSeconds)
    .toSorted((left, right) => left - right);

  const timeline = frameTimes.map((timeSeconds) => ({
    timeSeconds,
    positions: riders.flatMap((rider) => {
      const result = resultByRider.get(rider.id);
      if (!result) {
        return [];
      }
      const samples = input.samplesByActivityId.get(result.activityId) ?? [];
      const sample = sampleAtOrBefore(samples, timeSeconds);
      const markerEvent = input.markerCrossings.find((crossing) => crossing.riderId === rider.id && crossing.crossedAtSeconds === timeSeconds);
      return [{
        riderId: rider.id,
        positionMeters: clamp(sample?.distanceMeters ?? 0, 0, input.stage.route.distanceMeters),
        speedMetersPerSecond: sample?.velocityMetersPerSecond ?? 0,
        markerEventId: markerEvent?.markerId ?? null
      }];
    })
  }));

  return {
    stageId: input.stage.id,
    durationSeconds,
    riders,
    markers: input.stage.orderedMarkers,
    timeline
  };
}
