"use client";
import { useState } from "react";

export function RiskExercise() {
  const [risk, setRisk] = useState(1);
  const [capital, setCapital] = useState(50000);
  const budget = (capital * risk) / 100;
  return (
    <div className="risk-exercise">
      <div className="exercise-header">
        <span>Position-sizing exercise</span>
        <span className="exercise-tag">Illustration</span>
      </div>
      <label className="capital-label" htmlFor="capital">
        Example account size
      </label>
      <div className="capital-input">
        <span aria-hidden="true">₹</span>
        <input
          id="capital"
          type="number"
          min="1000"
          max="10000000"
          step="1000"
          value={capital}
          onChange={(e) => setCapital(Math.min(10000000, Math.max(0, Number(e.target.value))))}
        />
      </div>
      <div className="risk-label">
        <label htmlFor="risk-input">Hypothetical risk per trade</label>
        <output htmlFor="risk-input">{risk.toFixed(1)}%</output>
      </div>
      <input
        id="risk-input"
        className="risk-range"
        type="range"
        min="0.5"
        max="2"
        step="0.5"
        value={risk}
        onChange={(e) => setRisk(Number(e.target.value))}
      />
      <div className="range-labels">
        <span>0.5%</span>
        <span>2.0%</span>
      </div>
      <div className="exercise-result" aria-live="polite">
        <span>Hypothetical risk budget</span>
        <strong>
          ₹{new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(budget)}
        </strong>
      </div>
      <p className="exercise-note">
        Account size × risk percentage. An arithmetic example, not a recommendation. Real losses can
        exceed a planned risk budget.
      </p>
    </div>
  );
}
