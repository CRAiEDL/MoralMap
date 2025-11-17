import React, { useEffect, useState, useRef } from "react";
import { useMap, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import { startIcon, endIcon } from "./markerIcons";
import { fetchRoute } from "./utils/fetchRoute";

const Routing = ({
  from,
  to,
  alternatives = [],
  defaultTimeMinutes,
  selectedIndex,
  setSelectedIndex,
  consentGiven,
  setMapPoints,
  setRoutes,
}) => {
  const map = useMap();
  const [localRoutes, setLocalRoutes] = useState([]);
  const polylineRefs = useRef([]);

  useEffect(() => {
    if (!map || !from || !to) return;

    const controller = new AbortController();

    async function loadRoutes() {
      const tasks = [fetchRoute([from, to], controller.signal)];
      alternatives.forEach((alt) => {
        if (alt.middle) {
          tasks.push(fetchRoute([from, alt.middle, to], controller.signal));
        }
      });

      const results = await Promise.all(tasks);
      const newRoutes = results.map((coords, idx) => {
        if (!coords) return null;
        const total =
          idx === 0
            ? defaultTimeMinutes
            : alternatives[idx - 1]?.totalTimeMinutes;
        return { coords, totalTimeMinutes: total };
      });

      setLocalRoutes(newRoutes);
    }

    loadRoutes();

    return () => {
      controller.abort();
      setLocalRoutes([]);
    };
  }, [map, from, to, alternatives, defaultTimeMinutes]);

  useEffect(() => {
    if (!map || !consentGiven) return;

    const updatePoints = () => {
      const newPoints = localRoutes.map((route) => {
        if (!route?.coords) return null;
        const mid = route.coords[Math.floor(route.coords.length / 2)];
        const point = map.latLngToContainerPoint(L.latLng(mid[0], mid[1]));
        return { x: point.x, y: point.y };
      });

      setMapPoints(newPoints);
      setRoutes(localRoutes);
    };

    map.on("move", updatePoints);
    map.on("zoom", updatePoints);
    updatePoints();

    return () => {
      map.off("move", updatePoints);
      map.off("zoom", updatePoints);
    };
  }, [map, localRoutes, consentGiven, setMapPoints, setRoutes]);

  useEffect(() => {
    const bringToFront = () => {
      const selectedPolyline = polylineRefs.current[selectedIndex];
      if (selectedPolyline?.bringToFront) {
        selectedPolyline.bringToFront();
      }
    };

    // Defer ordering to ensure polylines are mounted before adjusting z-index
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(bringToFront);
    } else {
      setTimeout(bringToFront, 0);
    }
  }, [selectedIndex, localRoutes]);

  return (
    <>
      <Marker position={from} icon={startIcon} />
      <Marker position={to} icon={endIcon} />

      {localRoutes.map((route, i) =>
        route?.coords ? (
          <Polyline
            key={i}
            positions={route.coords}
            pathOptions={{
              color: i === selectedIndex ? "#1452EE" : "#BCCEFB",
              weight: i === selectedIndex ? 7 : 5,
              opacity: 1,
            }}
            eventHandlers={{
              click: () => setSelectedIndex(i),
            }}
            ref={(el) => {
              if (el) polylineRefs.current[i] = el;
            }}
          />
        ) : null
      )}
    </>
  );
};

export default Routing;
