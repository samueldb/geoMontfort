import { Copc } from 'copc';
import { createLazPerf } from 'laz-perf';
import proj4 from 'proj4';
import { lazPerfWasmDataUri } from '../vendor/maplibre-copc-layer';

const CLASSIFICATION_COLORS = {
  0: [0.6, 0.6, 0.6],
  1: [0.7, 0.7, 0.7],
  2: [0.55, 0.35, 0.2],
  3: [0.18, 0.55, 0.22],
  4: [0.12, 0.4, 0.12],
  5: [0.75, 0.85, 0.32],
  6: [0.9, 0.2, 0.2],
  7: [0.05, 0.1, 0.4],
  8: [0.85, 0.85, 0.9],
  9: [0.1, 0.75, 0.95],
  10: [0.1, 0.45, 0.95],
  11: [0.95, 0.65, 0.15],
  12: [1, 0.2, 0.7],
  13: [0.6, 0.15, 0.75],
  14: [0.2, 0.85, 0.8],
  15: [0.95, 0.1, 0.1],
  16: [0.55, 0.3, 0.15],
  17: [0.95, 0.5, 0.2],
  18: [0.5, 0.8, 0.95],
};

const metadataCache = new Map();
let lazPerfPromise;

function toCssColor(r, g, b) {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function getClassificationColor(classification) {
  const color = CLASSIFICATION_COLORS[classification];
  if (color) {
    return color;
  }
  return [
    ((classification * 73 + 41) % 255) / 255,
    ((classification * 151 + 89) % 255) / 255,
    ((classification * 199 + 123) % 255) / 255,
  ];
}

function getLazPerf() {
  if (!lazPerfPromise) {
    lazPerfPromise = createLazPerf({
      locateFile: () => lazPerfWasmDataUri,
    });
  }
  return lazPerfPromise;
}

function getNodeBounds(cube, nodeId) {
  const [depth, ix, iy, iz] = nodeId.split('-').map(Number);
  const divisor = 2 ** depth;
  const sizeX = (cube[3] - cube[0]) / divisor;
  const sizeY = (cube[4] - cube[1]) / divisor;
  const sizeZ = (cube[5] - cube[2]) / divisor;
  const minX = cube[0] + sizeX * ix;
  const minY = cube[1] + sizeY * iy;
  const minZ = cube[2] + sizeZ * iz;
  return {
    minX,
    minY,
    minZ,
    maxX: minX + sizeX,
    maxY: minY + sizeY,
    maxZ: minZ + sizeZ,
  };
}

async function loadAllHierarchyNodes(url, rootPage) {
  const pages = [rootPage];
  const visitedPages = new Set();
  const nodes = {};

  while (pages.length) {
    const page = pages.pop();
    const pageKey = `${page.pageOffset}:${page.pageLength}`;
    if (visitedPages.has(pageKey)) {
      continue;
    }
    visitedPages.add(pageKey);

    const subtree = await Copc.loadHierarchyPage(url, page);
    Object.assign(nodes, subtree.nodes);
    Object.values(subtree.pages).forEach((nextPage) => {
      pages.push(nextPage);
    });
  }

  return nodes;
}

async function getCopcMetadata(url) {
  if (!metadataCache.has(url)) {
    metadataCache.set(url, (async () => {
      const copc = await Copc.create(url);
      if (!copc.wkt) {
        throw new Error(`WKT missing for ${url}`);
      }

      const nodes = await loadAllHierarchyNodes(url, copc.info.rootHierarchyPage);
      const nodeEntries = Object.entries(nodes).map(([nodeId, node]) => ({
        nodeId,
        node,
        bounds: getNodeBounds(copc.info.cube, nodeId),
      }));

      return {
        url,
        copc,
        projection: proj4(copc.wkt),
        nodeEntries,
      };
    })());
  }

  return metadataCache.get(url);
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.y >= rect.minY &&
    point.y <= rect.maxY
  );
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, c) {
  return (
    Math.min(a.x, c.x) <= b.x &&
    b.x <= Math.max(a.x, c.x) &&
    Math.min(a.y, c.y) <= b.y &&
    b.y <= Math.max(a.y, c.y)
  );
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 === 0 && onSegment(a, c, b)) {
    return true;
  }
  if (o2 === 0 && onSegment(a, d, b)) {
    return true;
  }
  if (o3 === 0 && onSegment(c, a, d)) {
    return true;
  }
  if (o4 === 0 && onSegment(c, b, d)) {
    return true;
  }

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared < 1e-9) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function distanceSegmentToSegment(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) {
    return 0;
  }

  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b),
  );
}

function distanceSegmentToRect(start, end, rect) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) {
    return 0;
  }

  const corners = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  return edges.reduce((minDistance, [edgeStart, edgeEnd]) => (
    Math.min(minDistance, distanceSegmentToSegment(start, end, edgeStart, edgeEnd))
  ), Number.POSITIVE_INFINITY);
}

function getColorForPoint({ colorMode, pointIndex, view, elevation, cubeMinZ, cubeRangeZ }) {
  switch (colorMode) {
    case 'height': {
      const normalizedHeight = cubeRangeZ > 0 ? (elevation - cubeMinZ) / cubeRangeZ : 0;
      const r = Math.min(1, Math.max(0, normalizedHeight * 2));
      const g = Math.min(
        1,
        Math.max(0, normalizedHeight > 0.5 ? 2 - normalizedHeight * 2 : normalizedHeight * 2),
      );
      const b = Math.min(1, Math.max(0, 1 - normalizedHeight * 2));
      return toCssColor(r, g, b);
    }
    case 'intensity': {
      if (view.dimensions.Intensity) {
        const getIntensity = view.getter('Intensity');
        const value = getIntensity(pointIndex) / 65535;
        return toCssColor(value, value, value);
      }
      return toCssColor(1, 1, 1);
    }
    case 'classification': {
      const classification = view.dimensions.Classification
        ? view.getter('Classification')(pointIndex)
        : 0;
      const [r, g, b] = getClassificationColor(classification);
      return toCssColor(r, g, b);
    }
    case 'rgb':
    default: {
      if (view.dimensions.Red && view.dimensions.Green && view.dimensions.Blue) {
        const getRed = view.getter('Red');
        const getGreen = view.getter('Green');
        const getBlue = view.getter('Blue');
        return toCssColor(
          getRed(pointIndex) / 65535,
          getGreen(pointIndex) / 65535,
          getBlue(pointIndex) / 65535,
        );
      }
      return toCssColor(1, 1, 1);
    }
  }
}

async function mapWithConcurrency(items, limit, iteratee) {
  const results = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async (_, workerIndex) => {
    for (let index = workerIndex; index < items.length; index += limit) {
      results[index] = await iteratee(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function getLineLength(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export async function extractCopcProfile({
  urls,
  cutPoints,
  bufferMeters,
  colorMode,
  minElevation = 500,
  maxElevation = 2500,
  maxDisplayPoints = 12000,
}) {
  const validUrls = urls.filter(Boolean);
  if (cutPoints.length !== 2 || validUrls.length === 0) {
    return {
      points: [],
      totalPoints: 0,
      displayedPoints: 0,
      length: 0,
      minElevation,
      maxElevation,
      bufferMeters,
      minFilterElevation: minElevation,
      maxFilterElevation: maxElevation,
      selectedNodeCount: 0,
      processedNodeCount: 0,
    };
  }

  const lazPerf = await getLazPerf();
  const metadataList = await Promise.all(validUrls.map((url) => getCopcMetadata(url)));
  const matchingPoints = [];
  let selectedNodeCount = 0;
  let processedNodeCount = 0;
  let profileLength = 0;

  await mapWithConcurrency(metadataList, 2, async ({ url, copc, projection, nodeEntries }) => {
    const [startProjected, endProjected] = cutPoints.map(([lng, lat]) => {
      const [x, y] = projection.forward([lng, lat]);
      return { x, y };
    });

    profileLength = Math.max(profileLength, getLineLength(startProjected, endProjected));
    const cubeMinZ = copc.info.cube[2];
    const cubeRangeZ = copc.info.cube[5] - cubeMinZ;
    const selectedNodes = nodeEntries.filter(({ bounds }) => {
      if (bounds.maxZ < minElevation || bounds.minZ > maxElevation) {
        return false;
      }
      return distanceSegmentToRect(startProjected, endProjected, bounds) <= bufferMeters;
    });

    selectedNodeCount += selectedNodes.length;

    const include = ['X', 'Y', 'Z'];
    if (colorMode === 'rgb') {
      include.push('Red', 'Green', 'Blue');
    }
    if (colorMode === 'intensity') {
      include.push('Intensity');
    }
    if (colorMode === 'classification') {
      include.push('Classification');
    }

    for (const { node } of selectedNodes) {
      const view = await Copc.loadPointDataView(url, copc, node, {
        lazPerf,
        include,
      });
      processedNodeCount += 1;

      const getX = view.getter('X');
      const getY = view.getter('Y');
      const getZ = view.getter('Z');
      const dx = endProjected.x - startProjected.x;
      const dy = endProjected.y - startProjected.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 1e-9) {
        continue;
      }

      for (let index = 0; index < node.pointCount; index += 1) {
        const elevation = getZ(index);
        if (elevation < minElevation || elevation > maxElevation) {
          continue;
        }

        const pointX = getX(index);
        const pointY = getY(index);
        const t = ((pointX - startProjected.x) * dx + (pointY - startProjected.y) * dy) / lengthSquared;
        if (t < 0 || t > 1) {
          continue;
        }

        const projectedX = startProjected.x + t * dx;
        const projectedY = startProjected.y + t * dy;
        const distanceToAxis = Math.hypot(pointX - projectedX, pointY - projectedY);
        if (distanceToAxis > bufferMeters) {
          continue;
        }

        matchingPoints.push({
          distance: t * Math.sqrt(lengthSquared),
          elevation,
          color: getColorForPoint({
            colorMode,
            pointIndex: index,
            view,
            elevation,
            cubeMinZ,
            cubeRangeZ,
          }),
        });
      }
    }
  });

  matchingPoints.sort((left, right) => left.distance - right.distance);
  const samplingStep = Math.max(1, Math.ceil(matchingPoints.length / maxDisplayPoints));
  const displayPoints = matchingPoints.filter((_, index) => index % samplingStep === 0);
  const elevations = displayPoints.map((point) => point.elevation);

  return {
    points: displayPoints,
    totalPoints: matchingPoints.length,
    displayedPoints: displayPoints.length,
    length: profileLength,
    minElevation: elevations.length ? Math.min(...elevations) : minElevation,
    maxElevation: elevations.length ? Math.max(...elevations) : maxElevation,
    bufferMeters,
    minFilterElevation: minElevation,
    maxFilterElevation: maxElevation,
    selectedNodeCount,
    processedNodeCount,
  };
}
