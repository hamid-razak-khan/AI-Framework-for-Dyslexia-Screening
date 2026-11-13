import React, { useState, useEffect, useRef } from 'react';
import { Target } from 'lucide-react';

interface AttentionTestResults {
  totalTargets: number;
  hits: number;
  misses: number;
  averageReactionTime: number;
}

const MAX_TARGETS = 10;
const MAX_HITS = 5;

const AttentionTestExample = () => {
  // State management
  const [testActive, setTestActive] = useState(false);
  const [currentTarget, setCurrentTarget] = useState<{ x: number; y: number } | null>(null);
  const [targetsShown, setTargetsShown] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [lastTargetTime, setLastTargetTime] = useState<number | null>(null);
  const [results, setResults] = useState<AttentionTestResults | null>(null);

  // Timer management
  const [targetTimeoutId, setTargetTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [disappearTimeoutId, setDisappearTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (targetTimeoutId) clearTimeout(targetTimeoutId);
      if (disappearTimeoutId) clearTimeout(disappearTimeoutId);
    };
  }, [targetTimeoutId, disappearTimeoutId]);

  // Generate random position within container bounds
  const generateRandomPosition = () => {
    const minX = 50;
    const maxX = 400;
    const minY = 50;
    const maxY = 250;

    return {
      x: Math.floor(Math.random() * (maxX - minX)) + minX,
      y: Math.floor(Math.random() * (maxY - minY)) + minY,
    };
  };

  // Start the attention test
  const startTest = () => {
    if (targetTimeoutId) clearTimeout(targetTimeoutId);
    if (disappearTimeoutId) clearTimeout(disappearTimeoutId);

    setTestActive(true);
    setTargetsShown(0);
    setHits(0);
    setMisses(0);
    setReactionTimes([]);
    setResults(null);
    setCurrentTarget(null);

    showNextTarget();
  };

  // Show next target
  const showNextTarget = () => {
    if (targetsShown >= MAX_TARGETS || hits >= MAX_HITS) {
      completeTest();
      return;
    }

    const delay = Math.random() * 2000 + 1000;

    if (targetTimeoutId) clearTimeout(targetTimeoutId);

    const newTimeoutId = setTimeout(() => {
      if (!testActive) return;

      const position = generateRandomPosition();
      setCurrentTarget(position);
      setLastTargetTime(Date.now());
      setTargetsShown((prev) => prev + 1);

      const newDisappearTimeoutId = setTimeout(() => {
        if (testActive && currentTarget !== null) {
          setCurrentTarget(null);
          setMisses((prev) => prev + 1);

          if (targetsShown + 1 < MAX_TARGETS && hits < MAX_HITS) {
            showNextTarget();
          } else {
            completeTest();
          }
        }
      }, 3000);

      setDisappearTimeoutId(newDisappearTimeoutId);
    }, delay);

    setTargetTimeoutId(newTimeoutId);
  };

  // Handle target click
  const handleTargetClick = () => {
    if (lastTargetTime === null || !currentTarget) return;

    const reactionTime = Date.now() - lastTargetTime;
    setReactionTimes((prev) => [...prev, reactionTime]);

    setCurrentTarget(null);

    const newHits = hits + 1;
    setHits(newHits);

    if (newHits >= MAX_HITS) {
      if (targetTimeoutId) clearTimeout(targetTimeoutId);
      if (disappearTimeoutId) clearTimeout(disappearTimeoutId);
      setTimeout(() => {
        completeTestWithHits(newHits);
      }, 100);
      return;
    }

    if (targetsShown < MAX_TARGETS) {
      showNextTarget();
    } else {
      setTimeout(() => {
        completeTest();
      }, 100);
    }
  };

  // Complete the test
  const completeTest = () => {
    completeTestWithHits(hits);
  };

  const completeTestWithHits = (finalHits: number) => {
    if (targetTimeoutId) clearTimeout(targetTimeoutId);
    if (disappearTimeoutId) clearTimeout(disappearTimeoutId);

    setTestActive(false);

    const avgReactionTime =
      reactionTimes.length > 0
        ? Math.floor(reactionTimes.reduce((acc, time) => acc + time, 0) / reactionTimes.length)
        : 0;

    const testResults: AttentionTestResults = {
      totalTargets: Math.min(targetsShown, MAX_TARGETS),
      hits: finalHits,
      misses: Math.min(targetsShown, MAX_TARGETS) - finalHits,
      averageReactionTime: avgReactionTime,
    };

    setResults(testResults);
  };

  // Dyslexia evaluation function
  const evaluateDyslexiaRisk = (results: AttentionTestResults) => {
    let riskScore = 0;

    // Example: longer reaction time increases risk
    if (results.averageReactionTime > 2000) riskScore += 2;

    // Many misses compared to hits
    if (results.misses > results.hits) riskScore += 2;

    // Very few hits
    if (results.hits <= 2) riskScore += 1;

    if (riskScore >= 4) return "High Risk of Dyslexia (needs further assessment)";
    if (riskScore >= 2) return "Moderate Risk of Dyslexia";
    return "Low Risk of Dyslexia";
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Attention Test</h1>

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Click on targets as they appear on the screen. This test evaluates your reaction time and focus.
        </p>

        {!testActive && !results ? (
          <button
            onClick={startTest}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Start Attention Test
          </button>
        ) : testActive ? (
          <div
            ref={containerRef}
            className="p-6 border-2 border-gray-200 rounded-md relative bg-white overflow-hidden shadow-inner"
            style={{ height: '320px', width: '100%', position: 'relative' }}
          >
            {currentTarget && (
              <div
                className="absolute"
                style={{
                  left: `${currentTarget.x}px`,
                  top: `${currentTarget.y}px`,
                  width: '56px',
                  height: '56px',
                  zIndex: 1000,
                  pointerEvents: 'auto',
                }}
              >
                <button
                  className="w-full h-full rounded-full bg-green-600 shadow-lg hover:bg-green-500 flex items-center justify-center transition-colors"
                  style={{
                    boxShadow: '0 0 15px rgba(0, 255, 0, 0.8)',
                    border: '3px solid white',
                    position: 'relative',
                    zIndex: 1000,
                  }}
                  onClick={handleTargetClick}
                  aria-label="Click target"
                >
                  <Target className="text-white" size={28} />
                </button>
              </div>
            )}

            {/* Progress indicator */}
            <div className="absolute bottom-4 left-0 right-0 text-center text-sm font-medium text-gray-600 z-10">
              Targets: {Math.min(targetsShown, MAX_TARGETS)}/{MAX_TARGETS} | Hits: {hits}/{MAX_HITS}
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-200 z-10">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.max((targetsShown / MAX_TARGETS) * 100, (hits / MAX_HITS) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Test Results</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-md">
                <p className="text-sm text-gray-500">Hit Rate</p>
                <p className="text-xl font-medium">
                  {results?.hits}/{MAX_HITS}
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded">
                  <div
                    className="h-full bg-green-600 rounded"
                    style={{
                      width: `${((results?.hits || 0) / MAX_HITS) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 border rounded-md">
                <p className="text-sm text-gray-500">Average Reaction Time</p>
                <p className="text-xl font-medium">{results?.averageReactionTime}ms</p>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <div className="flex items-center text-red-500">
                <span>Missed: {results?.misses}</span>
              </div>
              <div className="flex items-center text-green-500">
                <span>Hit: {results?.hits}</span>
              </div>
            </div>

            {/* Dyslexia Risk Assessment */}
            {results && (
              <div className="p-4 border rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-2">Dyslexia Risk Assessment</h3>
                <p className={`text-sm font-medium ${
                  evaluateDyslexiaRisk(results).includes('High') ? 'text-red-600' :
                  evaluateDyslexiaRisk(results).includes('Moderate') ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {evaluateDyslexiaRisk(results)}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  <p>Risk factors considered:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Reaction time &gt; 2000ms: {results.averageReactionTime > 2000 ? 'Yes' : 'No'}</li>
                    <li>More misses than hits: {(results.misses > results.hits) ? 'Yes' : 'No'}</li>
                    <li>Very few hits (≤2): {(results.hits <= 2) ? 'Yes' : 'No'}</li>
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={startTest}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttentionTestExample;