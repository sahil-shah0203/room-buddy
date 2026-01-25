"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { useRoomStore } from "@/store/roomStore";
import type { Item, FurnitureType, WallOpening, FloorType, RoomAppearance } from "@/types/room";
import { getBoundingBox } from "@/lib/geometry/polygon";
import * as THREE from "three";

// Furniture colors matching 2D view
const FURNITURE_COLORS: Record<FurnitureType, string> = {
  sofa: "#8b5cf6",
  bed: "#3b82f6",
  desk: "#f59e0b",
  chair: "#10b981",
  table: "#6366f1",
  rug: "#ec4899",
  dresser: "#78716c",
  tvStand: "#1f2937",
};

// Wall height
const WALL_HEIGHT = 9;

// Create outdoor texture (sky + grass)
function createOutdoorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 180);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(1, '#E0F6FF');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 256, 180);
  // Grass
  ctx.fillStyle = '#228B22';
  ctx.fillRect(0, 180, 256, 76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create floor texture based on type and color
function createFloorTexture(floorType: FloorType, floorColor: string, width: number, depth: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = floorColor;
  ctx.fillRect(0, 0, 512, 512);

  if (floorType === "wood") {
    const darker = adjustColor(floorColor, -20);
    ctx.fillStyle = darker;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(0, i * 64 + 62, 512, 2);
    }
  } else if (floorType === "tile") {
    const groutColor = adjustColor(floorColor, -30);
    ctx.strokeStyle = groutColor;
    ctx.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(512, i * 64);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, 512);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 4, depth / 4);
  texture.needsUpdate = true;
  return texture;
}

// Helper to adjust color brightness
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Individual furniture model components
function BedModel({ w, d, color }: { w: number; d: number; color: string }) {
  const frameHeight = 0.4;
  const mattressHeight = 0.8;
  const headboardHeight = 2.5;

  return (
    <group>
      {/* Bed frame */}
      <mesh position={[0, frameHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameHeight, d]} />
        <meshStandardMaterial color="#8B4513" roughness={0.8} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, frameHeight + mattressHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w - 0.2, mattressHeight, d - 0.2]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.9} />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, headboardHeight / 2, -d / 2 + 0.1]} castShadow receiveShadow>
        <boxGeometry args={[w, headboardHeight, 0.2]} />
        <meshStandardMaterial color="#654321" roughness={0.7} />
      </mesh>
      {/* Pillows */}
      <mesh position={[-w / 4, frameHeight + mattressHeight + 0.15, -d / 3]} castShadow>
        <boxGeometry args={[w / 3, 0.3, 0.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </mesh>
      <mesh position={[w / 4, frameHeight + mattressHeight + 0.15, -d / 3]} castShadow>
        <boxGeometry args={[w / 3, 0.3, 0.5]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} />
      </mesh>
      {/* Blanket */}
      <mesh position={[0, frameHeight + mattressHeight + 0.1, d / 6]} castShadow>
        <boxGeometry args={[w - 0.3, 0.15, d / 2]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
}

function SofaModel({ w, d, color }: { w: number; d: number; color: string }) {
  const seatHeight = 1.2;
  const backHeight = 1.8;
  const armWidth = 0.4;

  return (
    <group>
      {/* Base/seat */}
      <RoundedBox args={[w - armWidth * 2, seatHeight, d - 0.3]} radius={0.1} position={[0, seatHeight / 2, 0.15]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      {/* Back cushion */}
      <RoundedBox args={[w - armWidth * 2, backHeight - seatHeight, 0.5]} radius={0.1} position={[0, seatHeight + (backHeight - seatHeight) / 2, -d / 2 + 0.35]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      {/* Left armrest */}
      <RoundedBox args={[armWidth, backHeight * 0.7, d]} radius={0.08} position={[-w / 2 + armWidth / 2, backHeight * 0.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      {/* Right armrest */}
      <RoundedBox args={[armWidth, backHeight * 0.7, d]} radius={0.08} position={[w / 2 - armWidth / 2, backHeight * 0.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      {/* Seat cushions */}
      <RoundedBox args={[(w - armWidth * 2) / 2 - 0.1, 0.3, d - 0.6]} radius={0.05} position={[-(w - armWidth * 2) / 4, seatHeight + 0.15, 0.1]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[(w - armWidth * 2) / 2 - 0.1, 0.3, d - 0.6]} radius={0.05} position={[(w - armWidth * 2) / 4, seatHeight + 0.15, 0.1]} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
    </group>
  );
}

function ChairModel({ w, d, color }: { w: number; d: number; color: string }) {
  const seatHeight = 1.5;
  const backHeight = 1.2;
  const legRadius = 0.08;

  return (
    <group>
      {/* Seat */}
      <RoundedBox args={[w - 0.2, 0.25, d - 0.2]} radius={0.05} position={[0, seatHeight, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      {/* Backrest */}
      <RoundedBox args={[w - 0.3, backHeight, 0.15]} radius={0.05} position={[0, seatHeight + backHeight / 2 + 0.1, -d / 2 + 0.2]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([xSign, zSign], i) => (
        <mesh key={i} position={[xSign * (w / 2 - 0.2), seatHeight / 2, zSign * (d / 2 - 0.2)]} castShadow>
          <cylinderGeometry args={[legRadius, legRadius, seatHeight, 8]} />
          <meshStandardMaterial color="#654321" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function TableModel({ w, d, color }: { w: number; d: number; color: string }) {
  const tableHeight = 2.4;
  const topThickness = 0.15;
  const legSize = 0.15;

  return (
    <group>
      {/* Tabletop */}
      <RoundedBox args={[w, topThickness, d]} radius={0.03} position={[0, tableHeight, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </RoundedBox>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([xSign, zSign], i) => (
        <mesh key={i} position={[xSign * (w / 2 - 0.2), tableHeight / 2, zSign * (d / 2 - 0.2)]} castShadow>
          <boxGeometry args={[legSize, tableHeight, legSize]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function DeskModel({ w, d, color }: { w: number; d: number; color: string }) {
  const deskHeight = 2.4;
  const topThickness = 0.12;

  return (
    <group>
      {/* Desktop */}
      <mesh position={[0, deskHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topThickness, d]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Left panel */}
      <mesh position={[-w / 2 + 0.1, deskHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.15, deskHeight, d - 0.2]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.6} />
      </mesh>
      {/* Right drawer unit */}
      <mesh position={[w / 2 - 0.5, deskHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, deskHeight, d - 0.2]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.6} />
      </mesh>
      {/* Drawer handles */}
      {[0.5, 1.2, 1.9].map((y, i) => (
        <mesh key={i} position={[w / 2 - 0.1, y, d / 4]} castShadow>
          <boxGeometry args={[0.05, 0.1, 0.3]} />
          <meshStandardMaterial color="#888" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function DresserModel({ w, d, color }: { w: number; d: number; color: string }) {
  const height = 3.2;
  const drawerCount = 4;
  const drawerHeight = height / drawerCount - 0.08;

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, height, d]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Drawer fronts and handles */}
      {Array.from({ length: drawerCount }).map((_, i) => {
        const y = (i + 0.5) * (height / drawerCount);
        return (
          <group key={i}>
            <mesh position={[0, y, d / 2 + 0.01]}>
              <boxGeometry args={[w - 0.1, drawerHeight, 0.02]} />
              <meshStandardMaterial color="#5a5a5a" roughness={0.6} />
            </mesh>
            <mesh position={[0, y, d / 2 + 0.05]} castShadow>
              <boxGeometry args={[0.4, 0.08, 0.08]} />
              <meshStandardMaterial color="#aaa" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function TVStandModel({ w, d, color }: { w: number; d: number; color: string }) {
  const standHeight = 1.5;
  const tvHeight = 2;
  const tvThickness = 0.15;

  return (
    <group>
      {/* Stand cabinet */}
      <RoundedBox args={[w, standHeight, d]} radius={0.05} position={[0, standHeight / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.6} />
      </RoundedBox>
      {/* Cabinet doors line */}
      <mesh position={[0, standHeight / 2, d / 2 + 0.01]}>
        <boxGeometry args={[0.02, standHeight - 0.2, 0.02]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* TV */}
      <mesh position={[0, standHeight + tvHeight / 2 + 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, tvHeight, tvThickness]} />
        <meshStandardMaterial color="#111" roughness={0.3} />
      </mesh>
      {/* TV screen */}
      <mesh position={[0, standHeight + tvHeight / 2 + 0.1, tvThickness / 2 + 0.01]}>
        <boxGeometry args={[w * 0.85, tvHeight - 0.2, 0.01]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.1} metalness={0.1} />
      </mesh>
      {/* TV stand/base */}
      <mesh position={[0, standHeight + 0.05, 0]} castShadow>
        <boxGeometry args={[0.6, 0.1, 0.3]} />
        <meshStandardMaterial color="#222" roughness={0.4} />
      </mesh>
    </group>
  );
}

function RugModel({ w, d, color }: { w: number; d: number; color: string }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Rug border */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(w, d) / 2 - 0.3, Math.min(w, d) / 2 - 0.1, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function FurnitureItem3D({
  item,
  isSelected,
  onSelect,
}: {
  item: Item;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = item.color || FURNITURE_COLORS[item.type];

  // Position at corner (our data uses corner positioning)
  const posX = item.x + item.w / 2;
  const posZ = item.y + item.d / 2;

  const renderFurniture = () => {
    switch (item.type) {
      case "bed":
        return <BedModel w={item.w} d={item.d} color={color} />;
      case "sofa":
        return <SofaModel w={item.w} d={item.d} color={color} />;
      case "chair":
        return <ChairModel w={item.w} d={item.d} color={color} />;
      case "table":
        return <TableModel w={item.w} d={item.d} color={color} />;
      case "desk":
        return <DeskModel w={item.w} d={item.d} color={color} />;
      case "dresser":
        return <DresserModel w={item.w} d={item.d} color={color} />;
      case "tvStand":
        return <TVStandModel w={item.w} d={item.d} color={color} />;
      case "rug":
        return <RugModel w={item.w} d={item.d} color={color} />;
      default:
        return (
          <RoundedBox args={[item.w, 2, item.d]} radius={0.1} position={[0, 1, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.6} />
          </RoundedBox>
        );
    }
  };

  return (
    <group
      ref={groupRef}
      position={[posX, 0, posZ]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {renderFurniture()}

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(item.w, item.d) * 0.55, Math.max(item.w, item.d) * 0.65, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Floor({ width, depth, floorType, floorColor }: { width: number; depth: number; floorType: FloorType; floorColor: string }) {
  const floorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base color
    ctx.fillStyle = floorColor;
    ctx.fillRect(0, 0, 512, 512);

    if (floorType === "wood") {
      // Wood planks pattern
      const darker = adjustColor(floorColor, -20);
      ctx.fillStyle = darker;
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(0, i * 64 + 62, 512, 2);
      }
    } else if (floorType === "tile") {
      // Tile pattern
      const groutColor = adjustColor(floorColor, -30);
      ctx.strokeStyle = groutColor;
      ctx.lineWidth = 4;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 64);
        ctx.lineTo(512, i * 64);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * 64, 0);
        ctx.lineTo(i * 64, 512);
        ctx.stroke();
      }
    }
    // Carpet has no pattern, just solid color

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 4, depth / 4);
    return texture;
  }, [width, depth, floorType, floorColor]);

  const roughness = floorType === "carpet" ? 0.95 : floorType === "tile" ? 0.5 : 0.8;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={floorTexture} roughness={roughness} metalness={0} />
    </mesh>
  );
}

// Component for outdoor view through windows
function OutdoorView({ width, height, position, rotation }: { width: number; height: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const texture = useMemo(() => createOutdoorTexture(), []);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function PolygonFloor({ vertices, floorType, floorColor }: { vertices: { x: number; y: number }[]; floorType: FloorType; floorColor: string }) {
  // Calculate bounding box
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vertices.forEach(v => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    });
    return { minX, maxX, minY, maxY, width: maxX - minX, depth: maxY - minY };
  }, [vertices]);

  const floorTexture = useMemo(() => {
    return createFloorTexture(floorType, floorColor, bounds.width, bounds.depth);
  }, [bounds.width, bounds.depth, floorType, floorColor]);

  const roughness = floorType === "carpet" ? 0.95 : floorType === "tile" ? 0.5 : 0.8;

  // Use a plane with proper UVs instead of ShapeGeometry
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[bounds.minX + bounds.width / 2, 0.001, bounds.minY + bounds.depth / 2]}
      receiveShadow
    >
      <planeGeometry args={[bounds.width, bounds.depth]} />
      <meshStandardMaterial map={floorTexture} roughness={roughness} metalness={0} />
    </mesh>
  );
}

function Walls({
  vertices,
  height = WALL_HEIGHT,
  wallColor,
  openings
}: {
  vertices: { x: number; y: number }[];
  height?: number;
  wallColor: string;
  openings: WallOpening[];
}) {
  const baseboardColor = adjustColor(wallColor, -30);

  return (
    <>
      {vertices.map((start, i) => {
        const end = vertices[(i + 1) % vertices.length];
        const dx = end.x - start.x;
        const dz = end.y - start.y;
        const length = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dz, dx);
        const midX = (start.x + end.x) / 2;
        const midZ = (start.y + end.y) / 2;

        // Perpendicular direction (pointing inward - towards room center)
        const perpX = -Math.sin(angle);
        const perpZ = Math.cos(angle);

        // Get openings for this wall
        const wallOpenings = openings.filter(o => o.wallIndex === i);

        return (
          <group key={i}>
            {/* Main wall */}
            <mesh
              position={[midX, height / 2, midZ]}
              rotation={[0, -angle, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[length, height, 0.25]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0} />
            </mesh>
            {/* Baseboard */}
            <mesh
              position={[midX, 0.15, midZ]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[length + 0.1, 0.3, 0.35]} />
              <meshStandardMaterial color={baseboardColor} roughness={0.7} metalness={0} />
            </mesh>

            {/* Openings (windows/doors) */}
            {wallOpenings.map((opening) => {
              // Calculate position along the wall from start
              const posAlongWall = opening.position * length;
              const openingX = start.x + Math.cos(angle) * posAlongWall;
              const openingZ = start.y + Math.sin(angle) * posAlongWall;
              const openingY = opening.fromFloor + opening.height / 2;

              // Offset outward from wall (negative perpendicular = outward)
              const outwardX = -perpX;
              const outwardZ = -perpZ;

              return (
                <group key={opening.id}>
                  {opening.type === "window" ? (
                    <>
                      {/* Outdoor view behind window - sky and grass */}
                      <OutdoorView
                        width={opening.width - 0.2}
                        height={opening.height - 0.2}
                        position={[openingX + outwardX * 0.3, openingY, openingZ + outwardZ * 0.3]}
                        rotation={[0, -angle, 0]}
                      />
                      {/* Window frame */}
                      <mesh
                        position={[openingX + perpX * 0.14, openingY, openingZ + perpZ * 0.14]}
                        rotation={[0, -angle, 0]}
                      >
                        <boxGeometry args={[opening.width + 0.3, opening.height + 0.3, 0.08]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                      </mesh>
                      {/* Window glass - slightly tinted */}
                      <mesh
                        position={[openingX + perpX * 0.12, openingY, openingZ + perpZ * 0.12]}
                        rotation={[0, -angle, 0]}
                      >
                        <planeGeometry args={[opening.width - 0.1, opening.height - 0.1]} />
                        <meshStandardMaterial
                          color="#aaddff"
                          transparent
                          opacity={0.2}
                          roughness={0.1}
                        />
                      </mesh>
                      {/* Window cross bars */}
                      <mesh
                        position={[openingX + perpX * 0.15, openingY, openingZ + perpZ * 0.15]}
                        rotation={[0, -angle, 0]}
                      >
                        <boxGeometry args={[0.06, opening.height - 0.3, 0.04]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                      </mesh>
                      <mesh
                        position={[openingX + perpX * 0.15, openingY, openingZ + perpZ * 0.15]}
                        rotation={[0, -angle, 0]}
                      >
                        <boxGeometry args={[opening.width - 0.3, 0.06, 0.04]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.6} />
                      </mesh>
                    </>
                  ) : (
                    <>
                      {/* Dark area behind door */}
                      <mesh
                        position={[openingX + outwardX * 0.2, openingY, openingZ + outwardZ * 0.2]}
                        rotation={[0, -angle, 0]}
                      >
                        <planeGeometry args={[opening.width - 0.1, opening.height - 0.1]} />
                        <meshBasicMaterial color="#2a2a2a" />
                      </mesh>
                      {/* Door frame */}
                      <mesh
                        position={[openingX + perpX * 0.14, openingY, openingZ + perpZ * 0.14]}
                        rotation={[0, -angle, 0]}
                      >
                        <boxGeometry args={[opening.width + 0.4, opening.height + 0.2, 0.12]} />
                        <meshStandardMaterial color="#654321" roughness={0.7} />
                      </mesh>
                      {/* Door panel */}
                      <mesh
                        position={[openingX + perpX * 0.18, openingY, openingZ + perpZ * 0.18]}
                        rotation={[0, -angle, 0]}
                      >
                        <boxGeometry args={[opening.width - 0.15, opening.height - 0.15, 0.06]} />
                        <meshStandardMaterial color="#8B4513" roughness={0.8} />
                      </mesh>
                      {/* Door handle */}
                      <mesh
                        position={[
                          openingX + Math.cos(angle) * (opening.width / 2 - 0.4) + perpX * 0.22,
                          openingY - 0.5,
                          openingZ + Math.sin(angle) * (opening.width / 2 - 0.4) + perpZ * 0.22
                        ]}
                      >
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
                      </mesh>
                    </>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

function Ceiling({ vertices, height = WALL_HEIGHT, ceilingColor }: { vertices: { x: number; y: number }[]; height?: number; ceilingColor: string }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (vertices.length > 0) {
      s.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        s.lineTo(vertices[i].x, vertices[i].y);
      }
      s.closePath();
    }
    return s;
  }, [vertices]);

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={ceilingColor} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomScene() {
  const { room, items, selectedItemId, selectItem, moveItem, openings, appearance } = useRoomStore();
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const { camera, raycaster, gl } = useThree();
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const pointer = useRef(new THREE.Vector2());

  const bbox = getBoundingBox(room.shape);

  // Get vertices for walls and floor
  const vertices = room.shape.type === "polygon"
    ? room.shape.vertices.map(v => ({ x: v.x, y: v.y }))
    : [
        { x: 0, y: 0 },
        { x: room.shape.width, y: 0 },
        { x: room.shape.width, y: room.shape.depth },
        { x: 0, y: room.shape.depth },
      ];

  // Handle mouse move for dragging
  const handlePointerMove = (e: React.PointerEvent | PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (!isDragging || !draggedItem) return;

    const intersectPoint = new THREE.Vector3();
    raycaster.setFromCamera(pointer.current, camera);
    raycaster.ray.intersectPlane(floorPlane.current, intersectPoint);

    if (intersectPoint) {
      const item = items.find(i => i.id === draggedItem);
      if (item) {
        const newX = intersectPoint.x - item.w / 2;
        const newZ = intersectPoint.z - item.d / 2;
        moveItem(draggedItem, newX, newZ, { snap: true });
      }
    }
  };

  const handlePointerDown = (itemId: string) => {
    setIsDragging(true);
    setDraggedItem(itemId);
    selectItem(itemId);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDraggedItem(null);
  };

  // Add event listeners to canvas
  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => handlePointerUp();

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onUp);

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onUp);
    };
  }, [isDragging, draggedItem, items]);

  return (
    <>
      {/* Camera - positioned inside the room at eye level */}
      <PerspectiveCamera
        makeDefault
        position={[bbox.width / 2, 5, bbox.depth * 0.85]}
        fov={75}
        near={0.1}
      />

      {/* Lighting - interior lighting setup */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[bbox.width / 2, 15, bbox.depth / 2]}
        intensity={0.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0001}
      />
      {/* Fill lights from corners */}
      <pointLight position={[1, 7, 1]} intensity={0.3} />
      <pointLight position={[bbox.width - 1, 7, bbox.depth - 1]} intensity={0.3} />
      <hemisphereLight args={["#ffeeb1", "#080820", 0.5]} />

      {/* Floor */}
      {room.shape.type === "polygon" ? (
        <PolygonFloor vertices={vertices} floorType={appearance.floorType} floorColor={appearance.floorColor} />
      ) : (
        <Floor width={room.shape.width} depth={room.shape.depth} floorType={appearance.floorType} floorColor={appearance.floorColor} />
      )}

      {/* Walls */}
      <Walls vertices={vertices} wallColor={appearance.wallColor} openings={openings} />

      {/* Ceiling */}
      <Ceiling vertices={vertices} ceilingColor={appearance.ceilingColor} />

      {/* Contact shadows */}
      <ContactShadows
        position={[bbox.width / 2, 0.01, bbox.depth / 2]}
        opacity={0.5}
        scale={Math.max(bbox.width, bbox.depth) * 2}
        blur={2.5}
        far={15}
      />

      {/* Furniture items */}
      {items.map((item) => (
        <group
          key={item.id}
          onPointerDown={(e) => {
            e.stopPropagation();
            handlePointerDown(item.id);
          }}
        >
          <FurnitureItem3D
            item={item}
            isSelected={item.id === selectedItemId}
            onSelect={() => selectItem(item.id)}
          />
        </group>
      ))}

      {/* Click on floor to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bbox.width / 2, -0.01, bbox.depth / 2]}
        onClick={() => selectItem(null)}
        visible={false}
      >
        <planeGeometry args={[bbox.width * 3, bbox.depth * 3]} />
        <meshBasicMaterial />
      </mesh>

      {/* Orbit controls - configured for first-person look-around */}
      <OrbitControls
        makeDefault
        minPolarAngle={0.5}
        maxPolarAngle={Math.PI - 0.5}
        minDistance={0.1}
        maxDistance={0.1}
        target={[bbox.width / 2, 5, bbox.depth * 0.3]}
        enabled={!isDragging}
        enableDamping
        dampingFactor={0.05}
        enableZoom={false}
        enablePan={true}
        panSpeed={2}
        rotateSpeed={0.5}
      />
    </>
  );
}

export default function Room3DView() {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm select-none">
      <Canvas
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
        style={{ width: 640, height: 640, display: "block" }}
      >
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#87ceeb", 20, 60]} />
        <RoomScene />
      </Canvas>
    </div>
  );
}
