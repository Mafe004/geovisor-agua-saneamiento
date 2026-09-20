import React from 'react';
import Svg, { Path, Circle, Ellipse, Line } from 'react-native-svg';

interface MascotAndiProps {
  size?: number;
}

// Mascota "Andi" (martín pescador) — aparece solo en estados de error/offline
// duros, nunca en el flujo normal.
export default function MascotAndi({ size = 190 }: MascotAndiProps) {
  const height = size * (220 / 240);
  return (
    <Svg viewBox="0 0 240 220" width={size} height={height}>
      <Ellipse cx={120} cy={205} rx={55} ry={6} fill="#06434A22" />
      <Path d="M55 150 L25 145 L30 175 L60 175 Z" fill="#085862" />
      <Path d="M40 155 L18 158 L25 175 L45 172 Z" fill="#06434A" />
      <Path d="M75 80 Q60 100 55 145 Q60 185 110 195 Q160 188 175 155 Q185 110 165 80 Q140 60 105 60 Q85 60 75 80 Z" fill="#0E8B95" />
      <Path d="M120 95 Q140 115 155 145 Q140 160 115 155 Q105 130 110 105 Z" fill="#085862" />
      <Path d="M100 125 Q90 140 95 175 Q110 195 130 192 Q145 175 140 145 Q130 125 100 125 Z" fill="#D2693A" />
      <Path d="M85 100 Q105 115 130 115 Q150 113 165 100 Q160 118 130 122 Q105 122 85 110 Z" fill="#FFFFFF" />
      <Circle cx={135} cy={75} r={52} fill="#0E8B95" />
      <Path d="M105 35 Q120 18 145 18 Q170 22 180 50 Q175 38 155 32 Q135 28 115 38 Z" fill="#085862" />
      <Circle cx={150} cy={68} r={11} fill="#FFFFFF" />
      <Circle cx={151} cy={68} r={7} fill="#0E1416" />
      <Circle cx={153} cy={66} r={2.5} fill="#FFFFFF" />
      <Path d="M175 78 L222 78 L175 90 Z" fill="#8C4322" />
      <Path d="M175 90 L222 80 L175 92 Z" fill="#5C2A0F" />
      <Circle cx={155} cy={92} r={6} fill="#D2693A" opacity={0.35} />
      <Line x1={105} y1={195} x2={100} y2={210} stroke="#8C4322" strokeWidth={3} strokeLinecap="round" />
      <Line x1={135} y1={195} x2={140} y2={210} stroke="#8C4322" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
