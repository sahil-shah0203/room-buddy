"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ContactShadows, PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { useRoomStore } from "@/store/roomStore";
import type { Item, FurnitureType, WallOpening, FloorType, RoomAppearance, CeilingItem } from "@/types/room";
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

// Ceiling light fixture
function CeilingLightModel({ item }: { item: CeilingItem }) {
  const fixtureHeight = 0.3;
  const radius = item.size / 2;

  return (
    <group position={[item.x, WALL_HEIGHT - fixtureHeight / 2, item.y]}>
      {/* Fixture base (flush with ceiling) */}
      <mesh>
        <cylinderGeometry args={[radius * 0.3, radius * 0.4, 0.1, 32]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Light dome/shade */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[radius, radius * 0.8, fixtureHeight, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={item.isOn ? item.lightColor : "#000000"}
          emissiveIntensity={item.isOn ? 0.5 : 0}
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Inner glow when on */}
      {item.isOn && (
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[radius * 0.5, 16, 16]} />
          <meshBasicMaterial color={item.lightColor} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Actual point light */}
      {item.isOn && (
        <pointLight
          position={[0, -0.5, 0]}
          intensity={item.lightIntensity * 3}
          color={item.lightColor}
          castShadow
          distance={30}
          decay={1.2}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.002}
          shadow-radius={4}
        />
      )}
    </group>
  );
}

// Ceiling fan (no light)
function CeilingFanModel({ item }: { item: CeilingItem }) {
  const hubRadius = 0.3;
  const bladeLength = item.size / 2 - hubRadius;
  const bladeWidth = 0.4;
  const dropHeight = 0.8;

  return (
    <group position={[item.x, WALL_HEIGHT - dropHeight, item.y]}>
      {/* Mounting rod */}
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.05, dropHeight, 8]} />
        <meshStandardMaterial color="#555555" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Motor housing */}
      <mesh position={[0, -dropHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[hubRadius, hubRadius * 0.8, 0.4, 32]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Fan blades (5 blades) */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos((angle * Math.PI) / 180) * (hubRadius + bladeLength / 2),
            -dropHeight / 2 - 0.1,
            Math.sin((angle * Math.PI) / 180) * (hubRadius + bladeLength / 2),
          ]}
          rotation={[0, (-angle * Math.PI) / 180, 0]}
          castShadow
        >
          <boxGeometry args={[bladeLength, 0.05, bladeWidth]} />
          <meshStandardMaterial color="#8B4513" roughness={0.7} />
        </mesh>
      ))}

      {/* Bottom cap */}
      <mesh position={[0, -dropHeight / 2 - 0.25, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.7} />
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

// 3D Outdoor environment - real grass ground, sky dome, and trees
function Outdoor3D({ roomCenter }: { roomCenter: [number, number] }) {
  const [cx, cz] = roomCenter;

  // Generate trees around all sides of the room for visibility from any window
  const treePositions = useMemo(() => {
    const trees: { x: number; z: number; scale: number }[] = [];
    // Trees on all four sides at various distances
    const distances = [15, 25, 35, 50];
    const sides = [
      { dx: 0, dz: -1 },  // North
      { dx: 0, dz: 1 },   // South
      { dx: -1, dz: 0 },  // West
      { dx: 1, dz: 0 },   // East
    ];
    sides.forEach(({ dx, dz }) => {
      distances.forEach((dist, di) => {
        const count = 3 + di; // More trees at greater distances
        for (let i = 0; i < count; i++) {
          const spread = 20 + di * 15;
          const perpOffset = (i - (count - 1) / 2) * (spread / count);
          trees.push({
            x: cx + dx * dist + dz * perpOffset + (Math.random() - 0.5) * 5,
            z: cz + dz * dist + dx * perpOffset + (Math.random() - 0.5) * 5,
            scale: 0.8 + Math.random() * 0.5,
          });
        }
      });
    });
    return trees;
  }, [cx, cz]);

  return (
    <group>
      {/* Large grass ground plane - extends far in all directions */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.05, cz]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#3a8f3a" roughness={0.95} />
      </mesh>

      {/* Sky dome */}
      <mesh position={[cx, 0, cz]}>
        <sphereGeometry args={[120, 32, 32]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
      </mesh>

      {/* Sun with glow */}
      <mesh position={[cx + 60, 70, cz - 60]}>
        <sphereGeometry args={[6, 16, 16]} />
        <meshBasicMaterial color="#FFF8DC" />
      </mesh>
      <pointLight position={[cx + 60, 70, cz - 60]} intensity={0.5} color="#FFF8DC" />

      {/* Clouds */}
      {[
        [cx - 30, 50, cz - 40],
        [cx + 40, 55, cz - 50],
        [cx - 10, 48, cz + 45],
        [cx + 50, 52, cz + 30],
      ].map(([x, y, z], i) => (
        <group key={`cloud-${i}`} position={[x, y, z]}>
          <mesh>
            <sphereGeometry args={[4, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <mesh position={[3, -0.5, 0]}>
            <sphereGeometry args={[3, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <mesh position={[-2.5, -0.3, 1]}>
            <sphereGeometry args={[2.5, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}

      {/* Trees distributed around the room */}
      {treePositions.map((tree, i) => (
        <group key={`tree-${i}`} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          {/* Tree trunk */}
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.5, 4, 8]} />
            <meshStandardMaterial color="#5D4037" roughness={0.9} />
          </mesh>
          {/* Tree foliage - layered for depth */}
          <mesh position={[0, 5.5, 0]} castShadow>
            <coneGeometry args={[2.5, 4, 8]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.9} />
          </mesh>
          <mesh position={[0, 7, 0]} castShadow>
            <coneGeometry args={[2, 3, 8]} />
            <meshStandardMaterial color="#388E3C" roughness={0.9} />
          </mesh>
          <mesh position={[0, 8.2, 0]} castShadow>
            <coneGeometry args={[1.3, 2, 8]} />
            <meshStandardMaterial color="#43A047" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Distant hills/mountains for horizon depth */}
      {[
        { x: cx - 80, z: cz - 100, scale: 1.2 },
        { x: cx + 80, z: cz - 90, scale: 1 },
        { x: cx, z: cz - 110, scale: 1.5 },
        { x: cx - 90, z: cz + 80, scale: 0.9 },
        { x: cx + 85, z: cz + 90, scale: 1.1 },
      ].map((hill, i) => (
        <mesh key={`hill-${i}`} position={[hill.x, 0, hill.z]} scale={[hill.scale * 30, hill.scale * 15, hill.scale * 30]}>
          <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#5a8f5a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// First-person controls - WASD movement + mouse look
function FirstPersonControls({ speed = 0.15 }: { speed?: number }) {
  const { camera, gl } = useThree();
  const keys = useRef<Set<string>>(new Set());
  const isMouseDown = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Initialize rotation from camera
    rotation.current.y = camera.rotation.y;
    rotation.current.x = camera.rotation.x;

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        isMouseDown.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const handleMouseUp = () => {
      isMouseDown.current = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;

      const deltaX = e.clientX - lastMouse.current.x;
      const deltaY = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      // Rotate camera
      rotation.current.y -= deltaX * 0.003;
      rotation.current.x -= deltaY * 0.003;
      // Clamp vertical rotation
      rotation.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotation.current.x));
    };
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const canvas = gl.domElement;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl, camera]);

  useFrame(() => {
    // Apply rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = rotation.current.y;
    camera.rotation.x = rotation.current.x;

    // Calculate movement direction based on camera facing
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    // WASD movement
    if (keys.current.has('w') || keys.current.has('arrowup')) {
      camera.position.addScaledVector(forward, speed);
    }
    if (keys.current.has('s') || keys.current.has('arrowdown')) {
      camera.position.addScaledVector(forward, -speed);
    }
    if (keys.current.has('a') || keys.current.has('arrowleft')) {
      camera.position.addScaledVector(right, -speed);
    }
    if (keys.current.has('d') || keys.current.has('arrowright')) {
      camera.position.addScaledVector(right, speed);
    }
    // Q/E for up/down
    if (keys.current.has('q')) {
      camera.position.y -= speed;
    }
    if (keys.current.has('e')) {
      camera.position.y += speed;
    }
  });

  return null;
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

// Wall segment with proper cutouts for openings
function WallWithOpenings({
  start,
  end,
  wallIndex,
  height,
  wallColor,
  openings,
}: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  wallIndex: number;
  height: number;
  wallColor: string;
  openings: WallOpening[];
}) {
  const baseboardColor = adjustColor(wallColor, -30);
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  // Perpendicular direction (pointing inward - towards room center)
  const perpX = -Math.sin(angle);
  const perpZ = Math.cos(angle);

  const midX = (start.x + end.x) / 2;
  const midZ = (start.y + end.y) / 2;

  // Get openings for this wall and sort by position
  const wallOpenings = openings
    .filter(o => o.wallIndex === wallIndex)
    .sort((a, b) => a.position - b.position);

  // Calculate wall segments around openings (segment-based approach - more reliable)
  const wallSegments = useMemo(() => {
    if (wallOpenings.length === 0) {
      // No openings - full wall
      return [{ start: 0, end: length, bottom: 0, top: height }];
    }

    const segments: { start: number; end: number; bottom: number; top: number }[] = [];
    let lastEnd = 0;

    wallOpenings.forEach((opening) => {
      const posAlongWall = opening.position * length;
      const halfWidth = opening.width / 2;
      const left = Math.max(0, posAlongWall - halfWidth);
      const right = Math.min(length, posAlongWall + halfWidth);
      const bottom = opening.fromFloor;
      const top = opening.fromFloor + opening.height;

      // Segment to the left of this opening
      if (left > lastEnd + 0.05) {
        segments.push({ start: lastEnd, end: left, bottom: 0, top: height });
      }

      // Segment above the opening
      if (top < height - 0.05) {
        segments.push({ start: left, end: right, bottom: top, top: height });
      }

      // Segment below the opening (for windows with fromFloor > 0)
      if (bottom > 0.05) {
        segments.push({ start: left, end: right, bottom: 0, top: bottom });
      }

      lastEnd = right;
    });

    // Segment after the last opening
    if (lastEnd < length - 0.05) {
      segments.push({ start: lastEnd, end: length, bottom: 0, top: height });
    }

    return segments;
  }, [length, height, wallOpenings]);

  // Calculate baseboard segments - skip doors
  const baseboardSegments = useMemo(() => {
    // Get door openings only
    const floorOpenings = wallOpenings
      .filter(o => o.type === "door")
      .sort((a, b) => a.position - b.position);

    if (floorOpenings.length === 0) {
      // No doors - full baseboard
      return [{ start: 0, end: length }];
    }

    const segments: { start: number; end: number }[] = [];
    let lastEnd = 0;

    floorOpenings.forEach((opening) => {
      const posAlongWall = opening.position * length;
      const halfWidth = opening.width / 2;
      const left = Math.max(0, posAlongWall - halfWidth);
      const right = Math.min(length, posAlongWall + halfWidth);

      // Segment before this door
      if (left > lastEnd + 0.05) {
        segments.push({ start: lastEnd, end: left });
      }

      lastEnd = right;
    });

    // Segment after the last door
    if (lastEnd < length - 0.05) {
      segments.push({ start: lastEnd, end: length });
    }

    return segments;
  }, [length, wallOpenings]);

  return (
    <group>
      {/* Wall segments */}
      {wallSegments.map((seg, idx) => {
        const segLength = seg.end - seg.start;
        const segHeight = seg.top - seg.bottom;
        const segCenterAlongWall = seg.start + segLength / 2;
        const segCenterY = seg.bottom + segHeight / 2;

        // Position along the wall from start point
        const posX = start.x + Math.cos(angle) * segCenterAlongWall;
        const posZ = start.y + Math.sin(angle) * segCenterAlongWall;

        return (
          <mesh
            key={`wall-seg-${idx}`}
            position={[posX, segCenterY, posZ]}
            rotation={[0, -angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[segLength, segHeight, 0.25]} />
            <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0} />
          </mesh>
        );
      })}

      {/* Baseboard segments - skip doors */}
      {baseboardSegments.map((seg, idx) => {
        const segLength = seg.end - seg.start;
        const segCenterAlongWall = seg.start + segLength / 2;
        const posX = start.x + Math.cos(angle) * segCenterAlongWall;
        const posZ = start.y + Math.sin(angle) * segCenterAlongWall;

        return (
          <mesh
            key={`baseboard-${idx}`}
            position={[posX, 0.15, posZ]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[segLength + 0.1, 0.3, 0.35]} />
            <meshStandardMaterial color={baseboardColor} roughness={0.7} metalness={0} />
          </mesh>
        );
      })}

      {/* Window/door frames and details */}
      {wallOpenings.map((opening) => {
        const posAlongWall = opening.position * length;
        const openingX = start.x + Math.cos(angle) * posAlongWall;
        const openingZ = start.y + Math.sin(angle) * posAlongWall;
        const openingY = opening.fromFloor + opening.height / 2;

        return (
          <group key={opening.id}>
            {opening.type === "window" ? (
              <>
                {/* Glass pane - transparent so you can see outdoor 3D */}
                <mesh
                  position={[openingX + perpX * 0.05, openingY, openingZ + perpZ * 0.05]}
                  rotation={[0, -angle, 0]}
                >
                  <planeGeometry args={[opening.width - 0.2, opening.height - 0.2]} />
                  <meshPhysicalMaterial
                    color="#88ccff"
                    transparent
                    opacity={0.15}
                    roughness={0}
                    metalness={0.1}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                {/* Window frame - 4 separate pieces */}
                {/* Top frame */}
                <mesh
                  position={[openingX + perpX * 0.13, openingY + opening.height / 2 - 0.1, openingZ + perpZ * 0.13]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[opening.width + 0.2, 0.15, 0.12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                {/* Bottom frame (window sill) */}
                <mesh
                  position={[openingX + perpX * 0.1, openingY - opening.height / 2 + 0.08, openingZ + perpZ * 0.1]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[opening.width + 0.3, 0.12, 0.2]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                {/* Left frame */}
                <mesh
                  position={[
                    openingX + perpX * 0.13 - Math.cos(angle) * (opening.width / 2),
                    openingY,
                    openingZ + perpZ * 0.13 - Math.sin(angle) * (opening.width / 2)
                  ]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.12, opening.height, 0.12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                {/* Right frame */}
                <mesh
                  position={[
                    openingX + perpX * 0.13 + Math.cos(angle) * (opening.width / 2),
                    openingY,
                    openingZ + perpZ * 0.13 + Math.sin(angle) * (opening.width / 2)
                  ]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.12, opening.height, 0.12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                {/* Window cross bars */}
                <mesh
                  position={[openingX + perpX * 0.08, openingY, openingZ + perpZ * 0.08]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.03, opening.height - 0.3, 0.02]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
                <mesh
                  position={[openingX + perpX * 0.08, openingY, openingZ + perpZ * 0.08]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[opening.width - 0.3, 0.03, 0.02]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.6} />
                </mesh>
              </>
            ) : (
              <>
                {/* Door frame */}
                {/* Top */}
                <mesh
                  position={[openingX + perpX * 0.13, opening.fromFloor + opening.height + 0.08, openingZ + perpZ * 0.13]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[opening.width + 0.25, 0.15, 0.15]} />
                  <meshStandardMaterial color="#654321" roughness={0.7} />
                </mesh>
                {/* Left */}
                <mesh
                  position={[
                    openingX + perpX * 0.13 - Math.cos(angle) * (opening.width / 2 + 0.05),
                    opening.fromFloor + opening.height / 2,
                    openingZ + perpZ * 0.13 - Math.sin(angle) * (opening.width / 2 + 0.05)
                  ]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.12, opening.height, 0.15]} />
                  <meshStandardMaterial color="#654321" roughness={0.7} />
                </mesh>
                {/* Right */}
                <mesh
                  position={[
                    openingX + perpX * 0.13 + Math.cos(angle) * (opening.width / 2 + 0.05),
                    opening.fromFloor + opening.height / 2,
                    openingZ + perpZ * 0.13 + Math.sin(angle) * (opening.width / 2 + 0.05)
                  ]}
                  rotation={[0, -angle, 0]}
                >
                  <boxGeometry args={[0.12, opening.height, 0.15]} />
                  <meshStandardMaterial color="#654321" roughness={0.7} />
                </mesh>
                {/* Door panel - closed, fills the full opening */}
                <mesh
                  position={[
                    openingX + perpX * 0.13,
                    opening.fromFloor + opening.height / 2,
                    openingZ + perpZ * 0.13
                  ]}
                  rotation={[0, -angle, 0]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[opening.width + 0.05, opening.height + 0.05, 0.12]} />
                  <meshStandardMaterial color="#8B4513" roughness={0.8} />
                </mesh>
                {/* Door handle */}
                <mesh
                  position={[
                    openingX + Math.cos(angle) * (opening.width / 2 - 0.4) + perpX * 0.16,
                    opening.fromFloor + opening.height / 2 - 0.3,
                    openingZ + Math.sin(angle) * (opening.width / 2 - 0.4) + perpZ * 0.16
                  ]}
                >
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
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
  return (
    <>
      {vertices.map((start, i) => {
        const end = vertices[(i + 1) % vertices.length];
        return (
          <WallWithOpenings
            key={i}
            start={start}
            end={end}
            wallIndex={i}
            height={height}
            wallColor={wallColor}
            openings={openings}
          />
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
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]} castShadow receiveShadow>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={ceilingColor} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function RoomScene({ fov }: { fov: number }) {
  const { room, items, selectedItemId, selectItem, moveItem, openings, appearance, ceilingItems } = useRoomStore();
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

  // Room center for outdoor environment positioning
  const roomCenter: [number, number] = [bbox.width / 2, bbox.depth / 2];

  return (
    <>
      {/* Camera - positioned inside the room at eye level */}
      <PerspectiveCamera
        makeDefault
        position={[bbox.width / 2, 5, bbox.depth * 0.85]}
        fov={fov}
        near={0.1}
      />

      {/* First-person controls: WASD movement + mouse drag to look */}
      <FirstPersonControls speed={0.2} />

      {/* Lighting - realistic interior setup */}
      {/* Ambient light for general illumination */}
      <ambientLight intensity={ceilingItems.some(c => c.isOn) ? 0.15 : 0.25} color="#b4c6e0" />

      {/* Noon sun - directly above, casts shadows that respect solid structures */}
      {/* Light passes through windows (transparent) but blocked by ceiling, walls, doors */}
      <directionalLight
        position={[bbox.width / 2, 50, bbox.depth / 2]}
        intensity={1.2}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      />

      {/* Sky/ground bounce light - subtle blue from sky, warm from floor */}
      <hemisphereLight args={["#87ceeb", "#f5e6d3", ceilingItems.some(c => c.isOn) ? 0.2 : 0.4]} />

      {/* Soft fill lights simulating indirect light (no shadows) */}
      <pointLight position={[1, 3, 1]} intensity={0.08} color="#fff8f0" distance={15} decay={2} castShadow={false} />
      <pointLight position={[bbox.width - 1, 3, bbox.depth - 1]} intensity={0.08} color="#fff8f0" distance={15} decay={2} castShadow={false} />

      {/* 3D Outdoor environment - visible through windows */}
      <Outdoor3D roomCenter={roomCenter} />

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

      {/* Ceiling items (lights and fans) */}
      {ceilingItems.map((item) =>
        item.type === "ceilingLight" ? (
          <CeilingLightModel key={item.id} item={item} />
        ) : (
          <CeilingFanModel key={item.id} item={item} />
        )
      )}

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

    </>
  );
}

export default function Room3DView() {
  const [fov, setFov] = useState(90);

  return (
    <div className="relative rounded-2xl border bg-gray-900 shadow-lg select-none overflow-hidden w-full h-full min-h-[600px]">
      {/* Zoom slider - floating overlay */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-3">
        <span className="text-xs text-white/70">FOV:</span>
        <input
          type="range"
          min="50"
          max="120"
          value={fov}
          onChange={(e) => setFov(Number(e.target.value))}
          className="w-24 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-white/50 w-8">{fov}°</span>
      </div>
      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
        <span className="text-xs text-white/60">WASD to move, drag to look</span>
      </div>
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={[1, 2]}
        style={{ width: "100%", height: "100%", minHeight: 600, display: "block" }}
      >
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#a8c8e8", 30, 80]} />
        <RoomScene fov={fov} />
      </Canvas>
    </div>
  );
}
