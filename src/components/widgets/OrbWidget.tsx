"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createNoise3D } from "simplex-noise";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, PhoneCall, Loader2 } from 'lucide-react';
import { useUnifiedVoiceProvider } from '@/hooks/useUnifiedVoiceProvider';
import { WidgetConfig } from '@/providers/types';
import WidgetBranding from './WidgetBranding';
import InteractionHint from './InteractionHint';

interface OrbWidgetProps {
  config: WidgetConfig;
  onError?: (error: string) => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  previewMode?: boolean;
  // Real functionality props
  publicKey?: string;
  accessToken?: string;
  fetchCredentials?: () => Promise<{ publicKey?: string; accessToken?: string }>;
}

const OrbWidget: React.FC<OrbWidgetProps> = ({
  config,
  onError,
  onCallStart,
  onCallEnd,
  previewMode = false,
  publicKey,
  accessToken,
  fetchCredentials
}) => {
  const {
    isLoading,
    isConnected,
    isCallActive,
    volume,
    error,
    startCall,
    endCall,
    transcripts
  } = useUnifiedVoiceProvider({
    providerName: config.agentType,
    config: config.providerConfig,
    autoInitialize: !previewMode,
    previewMode,
    publicKey,
    accessToken,
    onCallStart,
    onCallEnd,
    onError: onError ? (err) => onError(err.message) : undefined
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshLambertMaterial | null>(null);
  const originalPositionsRef = useRef<any | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const noise = createNoise3D();

  // Update material color when config changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.set(config.customization.appearance.primaryColor);
    }
  }, [config.customization.appearance.primaryColor]);

  // Initialize Three.js visualization
  useEffect(() => {
    if (!containerRef.current) return;

    initViz();
    window.addEventListener("resize", onWindowResize);
    
    return () => {
      window.removeEventListener("resize", onWindowResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Handle volume changes and morphing
  useEffect(() => {
    if (ballRef.current) {
      if (volume > 0) {
        // Animate when we have volume, regardless of call state
        updateBallMorph(ballRef.current, volume);
      } else if (originalPositionsRef.current) {
        // Reset when volume is 0
        resetBallMorph(ballRef.current, originalPositionsRef.current);
      }
    }
  }, [volume, isCallActive]);

  // Handle call events
  useEffect(() => {
    if (isCallActive && onCallStart) {
      onCallStart();
    }
  }, [isCallActive, onCallStart]);

  useEffect(() => {
    if (!isCallActive && onCallEnd) {
      onCallEnd();
    }
  }, [isCallActive, onCallEnd]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const initViz = () => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(
      20,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.5,
      100
    );
    camera.position.set(0, 0, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    containerRef.current.appendChild(renderer.domElement);

    // Create the orb geometry (higher subdivision for smoother appearance)
    const geometry = new THREE.IcosahedronGeometry(10, 8);
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(config.customization.appearance.primaryColor),
      wireframe: true,
      transparent: true,
      opacity: 0.9
    });

    // Store material reference for color updates
    materialRef.current = material;

    const ball = new THREE.Mesh(geometry, material);
    
    // Store original positions for morphing
    const positions = ball.geometry.attributes.position;
    originalPositionsRef.current = positions.array.slice();

    group.add(ball);
    scene.add(group);

    // Add lighting (improved setup like VapiBlocks)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xffffff);
    spotLight.intensity = 0.9;
    spotLight.position.set(-10, 40, 20);
    spotLight.lookAt(ball.position);
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Store references
    rendererRef.current = renderer;
    sceneRef.current = scene;
    groupRef.current = group;
    cameraRef.current = camera;
    ballRef.current = ball;

    // Start render loop
    animate();
  };

  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Rotate the orb
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
      groupRef.current.rotation.x += 0.002;
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const updateBallMorph = (mesh: THREE.Mesh, volumeLevel: number) => {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute("position");
    const time = window.performance.now();

    for (let i = 0; i < positionAttribute.count; i++) {
      const vertex = new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i),
      );

      const offset = 10; // Radius of the icosahedron
      const amp = 2.5; // Dramatic effect
      vertex.normalize();
      const rf = 0.00001;
      const distance =
        offset +
        volumeLevel * 4 + // Amplify volume effect
        noise(
          vertex.x + time * rf * 7,
          vertex.y + time * rf * 8,
          vertex.z + time * rf * 9,
        ) *
          amp *
          volumeLevel;
      vertex.multiplyScalar(distance);

      positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  const resetBallMorph = (mesh: THREE.Mesh, originalPositions: Float32Array) => {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute("position");

    for (let i = 0; i < positionAttribute.count; i++) {
      positionAttribute.setXYZ(
        i,
        originalPositions[i * 3],
        originalPositions[i * 3 + 1],
        originalPositions[i * 3 + 2]
      );
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  const onWindowResize = () => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  // Get size dimensions based on config
  const getSizeDimensions = () => {
    const size = config.customization.behavior.size;
    switch (size) {
      case 'small':
        return { width: 160, height: 160, className: 'w-40 h-40' };
      case 'large':
        return { width: 320, height: 320, className: 'w-80 h-80' };
      case 'medium':
      default:
        return { width: 256, height: 256, className: 'w-64 h-64' };
    }
  };

  const sizeDimensions = getSizeDimensions();

  const handleToggleCall = async () => {


    if (isLoading) {
      return;
    }

    try {
      if (isCallActive) {
        await endCall();
      } else {

        // Fetch credentials if not available and fetchCredentials function is provided
        if (!publicKey && !accessToken && fetchCredentials) {
          try {
            await fetchCredentials();
          } catch (credError) {
            console.error('[OrbWidget] Failed to fetch credentials:', credError);
            if (onError) {
              onError('Failed to get call credentials. Please try again.');
            }
            return;
          }
        }

        await startCall();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle call';
      console.error('[OrbWidget] Call toggle error:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const getButtonIcon = () => {
    if (isLoading) {
      return <Loader2 size={24} className="animate-spin" />;
    }
    if (isCallActive) {
      return <PhoneCall size={24} />;
    }
    return <Mic size={24} />;
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-full"
      style={{ 
        backgroundColor: config.customization.appearance.backgroundColor,
        color: config.customization.appearance.textColor,
        borderRadius: `${config.customization.appearance.borderRadius}px`
      }}
    >
      {/* Welcome message */}
      {!isCallActive && config.customization.messages.welcomeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-center mb-4 px-4 z-10"
          style={{ color: config.customization.appearance.textColor }}
        >
          {config.customization.messages.welcomeMessage}
        </motion.div>
      )}

      {/* 3D Orb Container with Interactive Feedback */}
      <motion.div
        ref={containerRef}
        className={`${sizeDimensions.className} relative cursor-pointer`}
        onClick={handleToggleCall}
        whileHover={{
          scale: 1.05,
          filter: 'brightness(1.1)'
        }}
        whileTap={{
          scale: 0.95
        }}
        animate={{
          filter: isCallActive ? 'brightness(1.3) saturate(1.2)' : 'brightness(1.0)',
          scale: isCallActive ? 1.02 : 1.0
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut"
        }}
        style={{
          border: 'none',
          outline: 'none',
          boxShadow: isCallActive ? `0 0 30px ${config.customization.appearance.primaryColor}40` : 'none'
        }}
      />

      {/* Interactive Control Button */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{
          opacity: isLoading || isCallActive ? 1 : 0
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="bg-black bg-opacity-70 p-4 rounded-full backdrop-blur-sm"
          animate={{
            scale: isCallActive ? [1, 1.1, 1] : 1,
            backgroundColor: isCallActive ?
              `${config.customization.appearance.primaryColor}80` :
              'rgba(0, 0, 0, 0.7)'
          }}
          transition={{
            scale: {
              duration: 2,
              repeat: isCallActive ? Infinity : 0,
              ease: "easeInOut"
            },
            backgroundColor: { duration: 0.3 }
          }}
        >
          <motion.div
            animate={{
              rotate: isLoading ? 360 : 0,
              color: isCallActive ? 'white' : config.customization.appearance.primaryColor
            }}
            transition={{
              rotate: { duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" },
              color: { duration: 0.3 }
            }}
          >
            {getButtonIcon()}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Interaction Hint */}
      <InteractionHint
        config={config}
        isCallActive={isCallActive}
        isLoading={isLoading}
        position="bottom"
      />

      {/* Call status */}
      {isCallActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs mt-4 px-3 py-1 rounded-full"
          style={{
            backgroundColor: config.customization.appearance.primaryColor + '20',
            color: config.customization.appearance.primaryColor
          }}
        >
          {isConnected ? 'Connected' : 'Connecting...'}
        </motion.div>
      )}

      {/* Error display - only show in preview mode */}
      {error && previewMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-xs text-red-500 text-center px-4"
        >
          {error}
        </motion.div>
      )}

      {/* Widget Branding */}
      <WidgetBranding config={config} />
    </div>
  );
};

export default OrbWidget;
