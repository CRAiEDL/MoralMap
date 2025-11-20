"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { startIcon, endIcon } from "../markerIcons";
import { fetchRoute } from "../utils/fetchRoute";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DEFAULT_ROUTE_COLOR = "#1452EE";
const ALTERNATIVE_ROUTE_COLORS = ["#4B78F2", "#7897F6", "#A5B6FA", "#CFD9FD"];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src || markerIcon2x,
  iconUrl: markerIcon.src || markerIcon,
  shadowUrl: markerShadow.src || markerShadow,
});

const createNumberedIcon = (label) =>
  L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    html: `
      <svg width="36" height="36" viewBox="0 0 24 24">
        <path fill="${DEFAULT_ROUTE_COLOR}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <text x="12" y="16" text-anchor="middle" font-size="10" font-family="Arial" font-weight="bold" fill="#fff">${label}</text>
      </svg>
    `,
  });

function isValidCoord(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

const clampIndex = (idx, length) => {
  if (!length) return null;
  const value = typeof idx === "number" && idx >= 0 ? idx : 0;
  return Math.min(value, length - 1);
};

const makePolyline = (points, color, weight, routeIndex = null) => ({
  points: points.filter(isValidCoord),
  color,
  weight,
  routeIndex,
});

export default function ScenarioMapPreview({
  scenario,
  selection = {},
  onChange = () => {},
  className = "h-64 w-full",
}) {
  const startOptions = Array.isArray(scenario?.start)
    ? scenario.start.filter(isValidCoord)
    : [];
  const endOptions = Array.isArray(scenario?.end) ? scenario.end.filter(isValidCoord) : [];

  const startIndex = clampIndex(selection?.start, startOptions.length);
  const endIndex = clampIndex(selection?.end, endOptions.length);

  const activeStart = startIndex !== null ? startOptions[startIndex] : startOptions[0];
  const activeEnd = endIndex !== null ? endOptions[endIndex] : endOptions[0];

  const alternatives = Array.isArray(scenario?.choice_list) ? scenario.choice_list : [];

  const alternativeSelections = useMemo(
    () =>
      alternatives.map((route, routeIndex) => {
        const middlePoints = Array.isArray(route?.middle_point)
          ? route.middle_point.filter(isValidCoord)
          : [];

        return { route, routeIndex, middlePoints };
      }),
    [alternatives]
  );

  const [previewRoutes, setPreviewRoutes] = useState([]);

  const getMiddleIcon = useMemo(() => {
    const cache = new Map();
    return (index) => {
      const label = index + 1;
      if (!cache.has(label)) {
        cache.set(label, createNumberedIcon(label));
      }
      return cache.get(label);
    };
  }, []);

  useEffect(() => {
    if (!isValidCoord(activeStart) || !isValidCoord(activeEnd)) {
      setPreviewRoutes([]);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const defaultPoints = [activeStart, activeEnd].filter(isValidCoord);
    if (defaultPoints.length < 2) {
      setPreviewRoutes([]);
      return;
    }

    const buildFallbackRoute = (points, color, weight, routeIndex = null) => ({
      points: points.filter(isValidCoord),
      color,
      weight,
      routeIndex,
    });

    const loadRoutes = async () => {
      const fallbackRoutes = [
        buildFallbackRoute(defaultPoints, DEFAULT_ROUTE_COLOR, 6),
        ...alternativeSelections.map((selection, index) => {
          const points = [activeStart, ...selection.middlePoints, activeEnd].filter(isValidCoord);
          if (points.length < 2) return null;
          return buildFallbackRoute(
            points,
            ALTERNATIVE_ROUTE_COLORS[index % ALTERNATIVE_ROUTE_COLORS.length],
            4,
            selection.routeIndex
          );
        }),
      ];

      const fetches = fallbackRoutes.map((route) =>
        route ? fetchRoute(route.points, controller.signal).catch(() => null) : Promise.resolve(null)
      );

      const results = await Promise.all(fetches);
      if (cancelled) return;

      const builtRoutes = fallbackRoutes
        .map((route, idx) => {
          if (!route) return null;
          const fetched = results[idx];
          const points = Array.isArray(fetched) && fetched.length >= 2 ? fetched : route.points;
          return makePolyline(points, route.color, route.weight, route.routeIndex);
        })
        .filter(Boolean);

      setPreviewRoutes(builtRoutes);
    };

    loadRoutes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeStart, activeEnd, alternativeSelections]);

  const bounds = useMemo(() => {
    const coords = previewRoutes.flatMap((route) => route.points);
    if (coords.length >= 2) {
      return L.latLngBounds(coords);
    }
    if (coords.length === 1) {
      const [[lat, lng]] = coords;
      const delta = 0.01;
      return L.latLngBounds(
        [lat - delta, lng - delta],
        [lat + delta, lng + delta]
      );
    }
    return null;
  }, [previewRoutes]);

  const handleDrag = (type, routeIndex, middleIndex) => (event) => {
    const { lat, lng } = event.target.getLatLng();
    const coords = [lat, lng];

    if (type === "start") {
      const next = Array.isArray(scenario.start) ? scenario.start.slice() : [];
      const targetIndex = startIndex ?? 0;
      if (typeof targetIndex === "number") {
        next[targetIndex] = coords;
        onChange({ start: next });
      }
      return;
    }

    if (type === "end") {
      const next = Array.isArray(scenario.end) ? scenario.end.slice() : [];
      const targetIndex = endIndex ?? 0;
      if (typeof targetIndex === "number") {
        next[targetIndex] = coords;
        onChange({ end: next });
      }
      return;
    }

    if (type === "middle" && typeof routeIndex === "number") {
      const choiceList = Array.isArray(scenario.choice_list) ? scenario.choice_list.slice() : [];
      const route = choiceList[routeIndex];
      if (!route || !Array.isArray(route.middle_point)) return;
      const middleOptions = route.middle_point.slice();
      const targetIndex = typeof middleIndex === "number" && middleIndex >= 0 ? middleIndex : 0;
      middleOptions[targetIndex] = coords;
      choiceList[routeIndex] = { ...route, middle_point: middleOptions };
      onChange({ choice_list: choiceList });
    }
  };

  if (!activeStart || !activeEnd) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-sm text-gray-600 ${className}`}
      >
        Select valid start and end coordinates to preview the scenario.
      </div>
    );
  }

  const middleMarkers = alternativeSelections.flatMap(({ middlePoints, routeIndex }) =>
    middlePoints.map((position, middleIndex) => ({
      position,
      routeIndex,
      middleIndex,
      icon: getMiddleIcon(middleIndex),
    }))
  );

  const handleAddMiddle = (routeIndex) => (event) => {
    if (typeof routeIndex !== "number") return;
    const { lat, lng } = event.latlng || {};
    if (typeof lat !== "number" || typeof lng !== "number") return;

    const choiceList = Array.isArray(scenario.choice_list) ? scenario.choice_list.slice() : [];
    const route = choiceList[routeIndex];
    if (!route) return;

    const middlePoints = Array.isArray(route.middle_point)
      ? route.middle_point.filter(isValidCoord)
      : [];

    const nextMiddlePoints = [...middlePoints, [lat, lng]];

    choiceList[routeIndex] = {
      ...route,
      middle_point: nextMiddlePoints,
    };

    onChange({ choice_list: choiceList });
  };

  const handleMiddleContextMenu = (routeIndex, middleIndex) => (event) => {
    event.originalEvent?.preventDefault?.();
    event.originalEvent?.stopPropagation?.();

    if (typeof routeIndex !== "number") return;
    const choiceList = Array.isArray(scenario.choice_list) ? scenario.choice_list.slice() : [];
    const route = choiceList[routeIndex];
    if (!route || !Array.isArray(route.middle_point)) return;

    const nextMiddle = route.middle_point.filter((_, idx) => idx !== middleIndex);
    choiceList[routeIndex] = { ...route, middle_point: nextMiddle };
    onChange({ choice_list: choiceList });
  };

  return (
    <div className={className}>
      <div className="relative h-full w-full">
        <div className="absolute left-2 top-2 z-10 rounded bg-white/90 p-2 text-xs text-gray-700 shadow">
          <p className="font-semibold">Middle points</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Left click an alternative route to add a point.</li>
            <li>Drag a middle point marker to reposition it.</li>
            <li>Right click a middle point marker to delete it.</li>
          </ul>
        </div>
        <MapContainer
          bounds={bounds ?? undefined}
          center={bounds ? undefined : activeStart}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
          doubleClickZoom
          touchZoom
          boxZoom
          keyboard
          zoomControl={false}
        >
          <ZoomControl position="topright" />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <Marker
            position={activeStart}
            draggable
            icon={startIcon}
            eventHandlers={{ dragend: handleDrag("start") }}
          />
          <Marker
            position={activeEnd}
            draggable
            icon={endIcon}
            eventHandlers={{ dragend: handleDrag("end") }}
          />
          {middleMarkers.map(({ position, routeIndex, middleIndex, icon }) => (
            <Marker
              key={`middle-${routeIndex}-${middleIndex}`}
              position={position}
              draggable
              icon={icon}
              eventHandlers={{
                dragend: handleDrag("middle", routeIndex, middleIndex),
                contextmenu: handleMiddleContextMenu(routeIndex, middleIndex),
              }}
            />
          ))}
          {previewRoutes.map((route, index) => (
            <Polyline
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              positions={route.points}
              pathOptions={{ color: route.color, weight: route.weight, opacity: 0.9 }}
              eventHandlers={
                typeof route.routeIndex === "number"
                  ? {
                      click: handleAddMiddle(route.routeIndex),
                    }
                  : undefined
              }
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

