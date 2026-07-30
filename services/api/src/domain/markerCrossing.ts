export interface PositionSample {
  riderId: string;
  timeSeconds: number;
  positionMeters: number;
}

export interface DetectedCrossing {
  riderId: string;
  crossedAtSeconds: number;
}

export function detectMarkerCrossings(
  markerPositionMeters: number,
  samples: readonly PositionSample[]
): readonly DetectedCrossing[] {
  const byRider = Map.groupBy(samples, (sample) => sample.riderId);
  const crossings: DetectedCrossing[] = [];

  for (const [riderId, riderSamples] of byRider) {
    const ordered = riderSamples.toSorted((left, right) => left.timeSeconds - right.timeSeconds);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (!previous || !current) {
        continue;
      }
      if (previous.positionMeters <= markerPositionMeters && current.positionMeters >= markerPositionMeters) {
        const distanceDelta = current.positionMeters - previous.positionMeters;
        const ratio = distanceDelta === 0 ? 0 : (markerPositionMeters - previous.positionMeters) / distanceDelta;
        const time = previous.timeSeconds + ratio * (current.timeSeconds - previous.timeSeconds);
        crossings.push({ riderId, crossedAtSeconds: Math.round(time) });
        break;
      }
    }
  }

  return crossings.toSorted((left, right) => left.crossedAtSeconds - right.crossedAtSeconds);
}

