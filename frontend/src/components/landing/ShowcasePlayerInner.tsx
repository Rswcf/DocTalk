"use client";

import React from "react";
import { Player } from "@remotion/player";
import ProductShowcase from "./ProductShowcase";
import { FPS, TOTAL_FRAMES } from "./showcaseData";

interface ShowcasePlayerInnerProps {
  isDark: boolean;
}

export default function ShowcasePlayerInner({ isDark }: ShowcasePlayerInnerProps) {
  return (
    <Player
      component={ProductShowcase}
      inputProps={{ isDark }}
      durationInFrames={TOTAL_FRAMES}
      compositionWidth={960}
      compositionHeight={540}
      fps={FPS}
      autoPlay
      loop
      style={{ width: "100%", height: "100%" }}
      controls={false}
    />
  );
}
