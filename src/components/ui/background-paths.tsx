"use client";

import { motion } from "framer-motion";
import React from "react";

interface FloatingPathsProps {
    position: number;
    primaryColor: string;
    secondaryColor: string;
}

function FloatingPaths({ position, primaryColor, secondaryColor }: FloatingPathsProps) {
    // Generate more paths with wider coverage
    const paths = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        d: `M-${480 - i * 8 * position} -${289 + i * 8}C-${
            480 - i * 8 * position
        } -${289 + i * 8} -${412 - i * 8 * position} ${316 - i * 8} ${
            252 - i * 8 * position
        } ${443 - i * 8}C${716 - i * 8 * position} ${570 - i * 8} ${
            784 - i * 8 * position
        } ${975 - i * 8} ${784 - i * 8 * position} ${975 - i * 8}`,
        color: i % 2 === 0 ? primaryColor : secondaryColor,
        width: 0.5 + i * 0.03,
    }));

    return (
        <div className="absolute inset-0 pointer-events-none">
            <svg
                className="w-full h-full pointer-events-none"
                viewBox="-500 -300 2000 1200"
                preserveAspectRatio="xMidYMid slice"
                fill="none"
            >
                <title>Background Paths</title>
                {paths.map((path) => (
                    <motion.path
                        key={path.id}
                        d={path.d}
                        stroke={path.color}
                        strokeWidth={path.width}
                        strokeOpacity={0.1 + path.id * 0.01}
                        initial={{ pathLength: 0.3, opacity: 0.6 }}
                        animate={{
                            pathLength: 1,
                            opacity: [0.3, 0.6, 0.3],
                            pathOffset: [0, 1, 0],
                        }}
                        transition={{
                            duration: 20 + Math.random() * 10,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "linear",
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

interface BackgroundPathsProps {
    primaryColor: string;
    secondaryColor: string;
}

export function BackgroundPaths({
    primaryColor = "#3B82F6",
    secondaryColor = "#10B981",
}: BackgroundPathsProps) {
    return (
        <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
            <FloatingPaths position={1} primaryColor={primaryColor} secondaryColor={secondaryColor} />
            <FloatingPaths position={-1} primaryColor={secondaryColor} secondaryColor={primaryColor} />
        </div>
    );
}
