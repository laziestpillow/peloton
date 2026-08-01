import type { ActivityStreamSample, RouteSummary } from "./models.js";
import type { StravaActivityStreams } from "../infrastructure/strava/StravaGateway.js";

export interface NormalizedActivityStreams {
  samples: readonly ActivityStreamSample[];
  routeSummary: RouteSummary;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`Strava stream contains invalid ${field}.`);
  }
  return value;
}

function optionalFiniteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function optionalLatLng(value: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(value) || value.length < 2 || !isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) {
    return null;
  }
  return { latitude: value[0], longitude: value[1] };
}

function emptyRouteSummary(polyline: string): RouteSummary {
  return {
    polyline,
    previewBounds: {
      southWest: { latitude: 0, longitude: 0 },
      northEast: { latitude: 0, longitude: 0 }
    }
  };
}

function routeSummaryFromSamples(samples: readonly ActivityStreamSample[], fallbackPolyline: string): RouteSummary {
  const located = samples.filter((sample): sample is ActivityStreamSample & { latitude: number; longitude: number } =>
    sample.latitude !== null && sample.longitude !== null
  );
  if (located.length === 0) {
    return emptyRouteSummary(fallbackPolyline);
  }

  const latitudes = located.map((sample) => sample.latitude);
  const longitudes = located.map((sample) => sample.longitude);
  return {
    polyline: fallbackPolyline,
    previewBounds: {
      southWest: { latitude: Math.min(...latitudes), longitude: Math.min(...longitudes) },
      northEast: { latitude: Math.max(...latitudes), longitude: Math.max(...longitudes) }
    }
  };
}

export function normalizeActivityStreams(streams: StravaActivityStreams, fallbackPolyline = ""): NormalizedActivityStreams {
  const sampleCount = Math.min(streams.time.length, streams.distance.length);
  if (sampleCount === 0) {
    throw new Error("Strava stream contains no time or distance samples.");
  }

  const samples = Array.from({ length: sampleCount }, (_, index): ActivityStreamSample => {
    const latLng = optionalLatLng(streams.latlng?.[index]);
    return {
      sequence: index,
      timeSeconds: Math.max(0, Math.trunc(requireFiniteNumber(streams.time[index], `time[${index}]`))),
      distanceMeters: Math.max(0, requireFiniteNumber(streams.distance[index], `distance[${index}]`)),
      latitude: latLng?.latitude ?? null,
      longitude: latLng?.longitude ?? null,
      altitudeMeters: optionalFiniteNumber(streams.altitude?.[index]),
      velocityMetersPerSecond: optionalFiniteNumber(streams.velocitySmooth?.[index])
    };
  });

  return {
    samples,
    routeSummary: routeSummaryFromSamples(samples, fallbackPolyline)
  };
}
