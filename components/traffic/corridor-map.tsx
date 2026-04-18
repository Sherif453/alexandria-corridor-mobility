"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";

import type { TrafficSegmentPayload } from "@/lib/types/traffic";
import {
  formatCongestionLabel,
  getCongestionTone,
} from "@/components/traffic/format";

type CorridorMapProps = {
  segments: Array<
    Pick<
      TrafficSegmentPayload,
      "segmentId" | "roadName" | "latitude" | "longitude" | "order" | "observation"
    >
  >;
  congestionBySegmentId?: Record<string, string | null>;
  popupDetailBySegmentId?: Record<string, string>;
  popupLabel?: string;
};

const markerClasses = {
  green: "corridor-marker corridor-marker--low",
  amber: "corridor-marker corridor-marker--medium",
  red: "corridor-marker corridor-marker--high",
  slate: "corridor-marker corridor-marker--unknown",
};

export function CorridorMap({
  segments,
  congestionBySegmentId,
  popupDetailBySegmentId,
  popupLabel = "Congestion",
}: CorridorMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let disposed = false;

    async function renderMap() {
      const leaflet = await import("leaflet");

      if (!containerRef.current || disposed) {
        return;
      }

      if (!mapRef.current) {
        mapRef.current = leaflet
          .map(containerRef.current, {
            attributionControl: true,
            scrollWheelZoom: false,
            zoomControl: false,
          })
          .setView([31.218, 29.94], 13);

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          })
          .addTo(mapRef.current);

        leaflet.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
      }

      layerRef.current?.remove();
      layerRef.current = leaflet.layerGroup().addTo(mapRef.current);

      const locatedSegments = segments.filter(
        (segment) => segment.latitude !== null && segment.longitude !== null,
      );
      const latLngs = locatedSegments.map(
        (segment) => [segment.latitude as number, segment.longitude as number] as [number, number],
      );

      if (latLngs.length > 1) {
        leaflet
          .polyline(latLngs, {
            color: "#0e4f4b",
            dashArray: "8 8",
            opacity: 0.86,
            weight: 5,
          })
          .addTo(layerRef.current);
      }

      for (const segment of locatedSegments) {
        const label =
          congestionBySegmentId?.[segment.segmentId] ??
          segment.observation?.congestionLabel ??
          null;
        const tone = getCongestionTone(label);
        const detail = popupDetailBySegmentId?.[segment.segmentId];
        const marker = leaflet
          .marker([segment.latitude as number, segment.longitude as number], {
            icon: leaflet.divIcon({
              className: "",
              html: `<div class="${markerClasses[tone]}">${segment.order}</div>`,
              iconAnchor: [14, 14],
              iconSize: [28, 28],
            }),
          })
          .bindPopup(
            `<strong>${segment.roadName}</strong><br/>Area ${segment.order}<br/>Congestion: ${
              formatCongestionLabel(label)
            }${detail ? `<br/>${popupLabel}: ${detail}` : ""}`,
          );

        marker.addTo(layerRef.current);
      }

      if (latLngs.length > 0) {
        mapRef.current.fitBounds(leaflet.latLngBounds(latLngs), {
          padding: [36, 36],
          maxZoom: 15,
        });
      }
    }

    void renderMap();

    return () => {
      disposed = true;
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, [segments, congestionBySegmentId, popupDetailBySegmentId, popupLabel]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-sm">
      <div ref={containerRef} className="h-[24rem] w-full sm:h-[32rem]" />
    </div>
  );
}
