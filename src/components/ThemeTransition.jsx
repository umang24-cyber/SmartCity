import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeTransition() {
  const { isTransitioning } = useTheme();

  return (
    <div className={isTransitioning ? 'is-transitioning' : ''}>
      <div className="curtain curtain-left" />
      <div className="curtain curtain-right" />
    </div>
  );
}
