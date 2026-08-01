import { detectMarkerCrossings, type PositionSample } from "./markerCrossing.js";
import type { ActivityStreamSample, ImportedActivity, MarkerCrossing, Stage } from "./models.js";

export interface ActivityStageMatch {
  stage: Stage;
  finishTimeSeconds: number;
  markerCrossings: readonly MarkerCrossing[];
}

export interface ActivityStageMatchOptions {
  stageStartWindowHours?: number;
  minimumDistanceCoverage?: number;
  geofenceTimeWindowSeconds?: number;
}

const earthRadiusMeters = 6371000;

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMetersBetween(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
): number {
  const deltaLatitude = degreesToRadians(right.latitude - left.latitude);
  const deltaLongitude = degreesToRadians(right.longitude - left.longitude);
  const leftLatitude = degreesToRadians(left.latitude);
  const rightLatitude = degreesToRadians(right.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function positionSamples(activity: ImportedActivity, samples: readonly ActivityStreamSample[]): readonly PositionSample[] {
  return samples.map((sample) => ({
    riderId: activity.riderId,
    timeSeconds: sample.timeSeconds,
    positionMeters: sample.distanceMeters
  }));
}

function interpolateTimeAtDistance(samples: readonly PositionSample[], distanceMeters: number): number | null {
  const ordered = samples.toSorted((left, right) => left.timeSeconds - right.timeSeconds);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current) {
      continue;
    }
    if (previous.positionMeters <= distanceMeters && current.positionMeters >= distanceMeters) {
      const distanceDelta = current.positionMeters - previous.positionMeters;
      const ratio = distanceDelta === 0 ? 0 : (distanceMeters - previous.positionMeters) / distanceDelta;
      return Math.round(previous.timeSeconds + ratio * (current.timeSeconds - previous.timeSeconds));
    }
  }
  return null;
}

function isNearMarker(
  stageMarker: Stage["orderedMarkers"][number],
  crossedAtSeconds: number,
  samples: readonly ActivityStreamSample[],
  timeWindowSeconds: number
): boolean {
  const locatedSamples = samples.filter((sample): sample is ActivityStreamSample & { latitude: number; longitude: number } =>
    sample.latitude !== null &&
    sample.longitude !== null &&
    Math.abs(sample.timeSeconds - crossedAtSeconds) <= timeWindowSeconds
  );
  if (locatedSamples.length === 0) {
    return false;
  }

  return Math.min(...locatedSamples.map((sample) => distanceMetersBetween(sample, stageMarker))) <= stageMarker.geofenceRadiusMeters;
}

function stageStartsNearActivity(activity: ImportedActivity, stage: Stage, stageStartWindowHours: number): boolean {
  const deltaMs = Math.abs(new Date(activity.startedAt).getTime() - new Date(stage.scheduledAt).getTime());
  return deltaMs <= stageStartWindowHours * 60 * 60 * 1000;
}

function distanceCoverage(activity: ImportedActivity, samples: readonly ActivityStreamSample[], stage: Stage): number {
  const maxSampleDistance = Math.max(0, ...samples.map((sample) => sample.distanceMeters));
  return Math.max(activity.distanceMeters, maxSampleDistance) / stage.route.distanceMeters;
}

export function matchActivityToStages(
  activity: ImportedActivity,
  samples: readonly ActivityStreamSample[],
  stages: readonly Stage[],
  options: ActivityStageMatchOptions = {}
): ActivityStageMatch | null {
  const stageStartWindowHours = options.stageStartWindowHours ?? 12;
  const minimumDistanceCoverage = options.minimumDistanceCoverage ?? 0.9;
  const geofenceTimeWindowSeconds = options.geofenceTimeWindowSeconds ?? 45;
  const positions = positionSamples(activity, samples);
  const candidates: ActivityStageMatch[] = [];

  for (const stage of stages) {
    if (!["scheduled", "active", "completed"].includes(stage.status)) {
      continue;
    }
    if (!stageStartsNearActivity(activity, stage, stageStartWindowHours)) {
      continue;
    }
    if (distanceCoverage(activity, samples, stage) < minimumDistanceCoverage) {
      continue;
    }

    const finishTimeSeconds = interpolateTimeAtDistance(positions, stage.route.distanceMeters);
    if (finishTimeSeconds === null) {
      continue;
    }

    const markerCrossings = stage.orderedMarkers.flatMap((marker): MarkerCrossing[] => {
      const [crossing] = detectMarkerCrossings(marker.positionMeters, positions);
      if (!crossing || !isNearMarker(marker, crossing.crossedAtSeconds, samples, geofenceTimeWindowSeconds)) {
        return [];
      }
      return [{ markerId: marker.id, riderId: activity.riderId, crossedAtSeconds: crossing.crossedAtSeconds }];
    });
    if (stage.orderedMarkers.length > 0 && markerCrossings.length === 0) {
      continue;
    }

    candidates.push({ stage, finishTimeSeconds, markerCrossings });
  }

  return candidates.toSorted((left, right) => right.markerCrossings.length - left.markerCrossings.length)[0] ?? null;
}
