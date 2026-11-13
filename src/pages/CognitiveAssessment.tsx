import React, { useState, useEffect, useRef } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Brain, Clock, AlertTriangle, CheckCircle2, Target, Undo, BookOpen, Lightbulb } from 'lucide-react';
import AssessmentInstructions from '@/components/AssessmentInstructions';

const CognitiveAssessment = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('memory');
  // Memory game states
  const [memorySequence, setMemorySequence] = useState<string[]>([]);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [showSequence, setShowSequence] = useState(false);
  const [memoryGameActive, setMemoryGameActive] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [showMemoryInstructions, setShowMemoryInstructions] = useState(true);
  const [memoryStartTime, setMemoryStartTime] = useState<number | null>(null);

  // Attention test states
  const [attentionTestActive, setAttentionTestActive] = useState(false);
  const [attentionTarget, setAttentionTarget] = useState<{ x: number, y: number } | null>(null);
  const [attentionTargetsShown, setAttentionTargetsShown] = useState(0);
  const [attentionHits, setAttentionHits] = useState(0);
  const [attentionMisses, setAttentionMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [lastTargetTime, setLastTargetTime] = useState<number | null>(null);
  const [attentionResults, setAttentionResults] = useState<{
    totalTargets: number;
    hits: number;
    misses: number;
    averageReactionTime: number;
  } | null>(null);
  const [showAttentionInstructions, setShowAttentionInstructions] = useState(true);

  // Problem solving test states
  const [problemSolvingActive, setProblemSolvingActive] = useState(false);
  const [currentPattern, setCurrentPattern] = useState<number[][]>([]);
  const [currentSolution, setCurrentSolution] = useState<number | null>(null);
  const [puzzleType, setPuzzleType] = useState<'numeric' | 'sequence' | 'analogy' | 'addition' | 'subtraction'>('sequence');
  const [userSolution, setUserSolution] = useState<number | null>(null);
  const [patternsCompleted, setPatternsCompleted] = useState(0);
  const [correctPatterns, setCorrectPatterns] = useState(0);
  const [patternStartTime, setPatternStartTime] = useState<number | null>(null);
  const [totalPatternTime, setTotalPatternTime] = useState(0);

  const [puzzleOptions, setPuzzleOptions] = useState<number[]>([]);
  const [problemSolvingResults, setProblemSolvingResults] = useState<{
    correctPatterns: number;
    totalPatterns: number;
    averageTime: number;
    errorRate: number;
  } | null>(null);
  const [showProblemSolvingInstructions, setShowProblemSolvingInstructions] = useState(true);

  // Analysis results
  const [analysisResults, setAnalysisResults] = useState<string | null>(null);
  const [dyslexiaScore, setDyslexiaScore] = useState<number | null>(null);
  const [testScores, setTestScores] = useState<{
    memory: number | null;
    attention: number | null;
    problemSolving: number | null;
  }>({ memory: null, attention: null, problemSolving: null });

  // Load existing results on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cognitive_result');
      if (stored) {
        const data = JSON.parse(stored);

        let memoryScore = null;
        if (data.memory?.accuracy !== undefined) {
          memoryScore = Math.max(0, 100 - data.memory.accuracy);
        }

        let attentionScore = null;
        if (data.attention?.hitRate !== undefined) {
          // Reconstruct based on current formula: (100 - hitRate) * 0.8 + penalty
          const hitRate = data.attention.hitRate;
          const avgTime = data.attention.averageReactionTime || 0;
          const penalty = avgTime > 3000 ? 20 : avgTime > 1500 ? 10 : 0;
          const raw = (100 - hitRate) * 0.8 + penalty;
          attentionScore = Math.min(90, Math.max(10, raw));
        }

        let problemSolvingScore = null;
        if (data.problemSolving?.successRate !== undefined) {
          // Reconstruct based on current formula: (100 - success) * 0.4 + timeIndicator
          const success = data.problemSolving.successRate;
          const avgTime = data.problemSolving.averageTime || 0;
          const timeInd = avgTime > 20 ? 30 : avgTime > 15 ? 20 : 10;
          problemSolvingScore = Math.max(0, 100 - success) * 0.4 + timeInd;
        }

        setTestScores({
          memory: memoryScore,
          attention: attentionScore,
          problemSolving: problemSolvingScore
        });
      }
    } catch (e) {
      console.error("Failed to load past results", e);
    }
  }, []);
  const renderSimpleMarkdown = (md: string) => {
    const lines = (md || '').split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    const parseContent = (text: string) => {
      // Split by **text** pattern
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</span>;
        }
        return part;
      });
    };

    const pushList = () => {
      if (listItems.length) {
        elements.push(
          <ul className="space-y-2 my-3" key={`ul-${elements.length}`}>
            {listItems.map((li, i) => (
              <li key={i} className="flex items-start text-gray-700">
                <span className="mr-2 mt-2 w-1.5 h-1.5 bg-app-blue rounded-full flex-shrink-0"></span>
                <span className="flex-1">{parseContent(li)}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = (line || '').trim();
      if (!trimmed) {
        pushList();
        return;
      }

      if (trimmed.startsWith('### ')) {
        pushList();
        elements.push(
          <h3 key={`h3-${idx}`} className="text-lg font-semibold text-gray-900 mt-5 mb-3 flex items-center">
            {trimmed.slice(4)}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        pushList();
        elements.push(<h2 key={`h2-${idx}`} className="text-xl font-bold text-gray-900 mt-4 mb-3">{trimmed.slice(3)}</h2>);
        return;
      }

      if (trimmed.startsWith('- ')) {
        listItems.push(trimmed.slice(2));
        return;
      }

      elements.push(<p key={`p-${idx}`} className="my-2 text-gray-700 leading-relaxed">{parseContent(trimmed)}</p>);
    });

    pushList();
    return <div className="animate-fade-in">{elements}</div>;
  };

  // Colors for memory game
  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

  // Add a ref for the container
  const attentionContainerRef = useRef<HTMLDivElement | null>(null);

  // Add cleanup effect for timers
  const [targetTimeoutId, setTargetTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [disappearTimeoutId, setDisappearTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Clear analysis results when switching tabs
    setAnalysisResults(null);
  };

  const handleUndo = () => {
    if (userSequence.length > 0) {
      setUserSequence(prev => prev.slice(0, -1));
    }
  };


  // Cleanup function
  useEffect(() => {
    // Cleanup function to clear timers when component unmounts
    return () => {
      if (targetTimeoutId) clearTimeout(targetTimeoutId);
      if (disappearTimeoutId) clearTimeout(disappearTimeoutId);
    };
  }, [targetTimeoutId, disappearTimeoutId]);

  // Memory Game Functions
  const startMemoryGame = () => {
    setShowMemoryInstructions(false);
    setGameCompleted(false);
    setUserSequence([]);
    setMemoryGameActive(true);
    setAnalysisResults(null);
    generateSequence();
  };

  const generateSequence = () => {
    const newSequence = [];
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * colors.length);
      newSequence.push(colors[randomIndex]);
    }
    setMemorySequence(newSequence);
    setShowSequence(true);

    // Hide the sequence after random duration between 5-10 seconds
    // Random duration between 5000ms (5 seconds) and 10000ms (10 seconds)
    const displayDuration = Math.floor(Math.random() * 5000) + 5000; // 5000-10000ms
    setTimeout(() => {
      setShowSequence(false);
      setMemoryStartTime(Date.now());
    }, displayDuration);
  };

  const handleColorClick = (color: string) => {
    if (!memoryGameActive || showSequence) return;

    const newUserSequence = [...userSequence, color];
    setUserSequence(newUserSequence);

    // Check if user has completed the sequence
    if (newUserSequence.length === memorySequence.length) {
      checkMemoryResult(newUserSequence);
    }
  };

  const checkMemoryResult = (sequence: string[]) => {
    let correct = 0;

    // Count correct positions
    for (let i = 0; i < memorySequence.length; i++) {
      if (sequence[i] === memorySequence[i]) {
        correct++;
      }
    }

    const accuracy = Math.floor((correct / memorySequence.length) * 100);
    setGameCompleted(true);

    // Calculate time taken
    const endTime = Date.now();
    const timeTaken = memoryStartTime ? (endTime - memoryStartTime) / 1000 : 0;

    toast({
      title: "Memory Test Completed",
      description: `You recalled ${correct} out of ${memorySequence.length} colors correctly (${accuracy}%) in ${timeTaken.toFixed(1)}s.`,
    });

    // Calculate dyslexia likelihood based on memory performance
    // Inverse of accuracy: 0% accuracy = 100% risk, 100% accuracy = 0% risk
    const memoryDyslexiaIndicator = Math.max(0, 100 - accuracy);

    // Generate analysis results
    generateAnalysisResults('memory', {
      accuracy,
      correct,
      total: memorySequence.length,
      timeTaken: parseFloat(timeTaken.toFixed(1)),
      dyslexiaIndicator: memoryDyslexiaIndicator
    });
  };

  // Attention Test Functions
  const startAttentionTest = () => {
    setShowAttentionInstructions(false);
    // Clear any existing timers
    if (targetTimeoutId) clearTimeout(targetTimeoutId);
    if (disappearTimeoutId) clearTimeout(disappearTimeoutId);

    // Reset states
    setAttentionTestActive(true);
    setAttentionTargetsShown(0);
    setAttentionHits(0);
    setAttentionMisses(0);
    setReactionTimes([]);
    setAttentionResults(null);
    setAttentionTarget(null);
    setAnalysisResults(null);

    // Show first target immediately at random position
    const firstPosition = generateRandomPosition();
    setAttentionTarget(firstPosition);
    setLastTargetTime(Date.now());
    setAttentionTargetsShown(1);

    // Set up disappear timeout for first target
    const newDisappearTimeoutId = setTimeout(() => {
      if (attentionTestActive && attentionTarget !== null) {
        setAttentionTarget(null);
        setAttentionMisses(prev => prev + 1);
        // Check conditions before showing next target - first target is already shown
        if (1 < 10 && attentionHits < 5) {
          showNextTarget();
        } else {
          completeAttentionTest();
        }
      }
    }, 3000);

    setDisappearTimeoutId(newDisappearTimeoutId);
  };

  // Generate random target positions within the container bounds
  const generateRandomPosition = () => {
    const minX = 50;
    const maxX = 400;
    const minY = 50;
    const maxY = 250;

    return {
      x: Math.floor(Math.random() * (maxX - minX)) + minX,
      y: Math.floor(Math.random() * (maxY - minY)) + minY
    };
  };

  // Simplified showNextTarget function
  const showNextTarget = () => {
    console.log("showNextTarget called, current count:", attentionTargetsShown, "hits:", attentionHits);

    // Check if we've reached the limit (10 targets) or achieved 5 hits
    if (attentionTargetsShown >= 10) {
      console.log("Reached 10 targets limit, completing test");
      completeAttentionTest();
      return;
    }

    if (attentionHits >= 5) {
      console.log("Reached 5 hits limit, completing test");
      completeAttentionTest();
      return;
    }

    // Random delay between targets (1-3 seconds)
    const delay = Math.random() * 2000 + 1000;
    console.log("Setting up next target with delay:", delay);

    // Clear any existing timeout
    if (targetTimeoutId) clearTimeout(targetTimeoutId);

    // Set new timeout and save the ID
    const newTimeoutId = setTimeout(() => {
      if (!attentionTestActive) {
        console.log("Test no longer active, stopping");
        return;
      }

      console.log("Showing target number:", attentionTargetsShown + 1);

      // Generate random position for this target
      const position = generateRandomPosition();

      setAttentionTarget(position);
      setLastTargetTime(Date.now());
      setAttentionTargetsShown(prev => prev + 1);



      // Clear any existing disappear timeout
      if (disappearTimeoutId) clearTimeout(disappearTimeoutId);

      // Target disappears after 3 seconds if not clicked
      const newDisappearTimeoutId = setTimeout(() => {
        if (attentionTestActive && attentionTarget !== null) {
          console.log("Target disappeared, showing next");
          setAttentionTarget(null);
          setAttentionMisses(prev => prev + 1);
          // Check conditions before showing next target - use current values
          const currentTargetsShown = attentionTargetsShown + 1; // +1 because we just showed one
          if (currentTargetsShown < 10 && attentionHits < 5) {
            showNextTarget();
          } else {
            completeAttentionTest();
          }
        }
      }, 3000);

      setDisappearTimeoutId(newDisappearTimeoutId);
    }, delay);

    setTargetTimeoutId(newTimeoutId);
  };

  const handleTargetClick = () => {
    if (lastTargetTime === null || !attentionTarget) return;

    const reactionTime = Date.now() - lastTargetTime;
    setReactionTimes(prev => [...prev, reactionTime]);

    // Clear the target immediately to prevent double clicks
    setAttentionTarget(null);

    // Update hits count
    const newHits = attentionHits + 1;
    setAttentionHits(newHits);

    // Check if we should stop the test (5 hits reached)
    if (newHits >= 5) {
      // Clear any pending timers
      if (targetTimeoutId) clearTimeout(targetTimeoutId);
      if (disappearTimeoutId) clearTimeout(disappearTimeoutId);
      // Complete test immediately with the correct hit count
      setTimeout(() => {
        completeAttentionTestWithHits(newHits);
      }, 100);
      return;
    }

    // Only proceed to next target if we haven't reached the limit
    if (attentionTargetsShown < 10) {
      showNextTarget();
    } else {
      // We've shown 10 targets, complete the test
      setTimeout(() => {
        completeAttentionTest();
      }, 100);
    }
  };

  const completeAttentionTest = () => {
    completeAttentionTestWithHits(attentionHits);
  };

  const completeAttentionTestWithHits = (finalHits: number) => {
    // Clear timers
    if (targetTimeoutId) clearTimeout(targetTimeoutId);
    if (disappearTimeoutId) clearTimeout(disappearTimeoutId);

    setAttentionTestActive(false);

    // Ensure we have accurate count of total targets shown
    const totalTargetsShown = Math.min(attentionTargetsShown, 10);

    const avgReactionTime = reactionTimes.length > 0
      ? Math.floor(reactionTimes.reduce((acc, time) => acc + time, 0) / reactionTimes.length)
      : 0;

    const results = {
      totalTargets: totalTargetsShown,
      hits: finalHits, // Use the passed hit count
      misses: totalTargetsShown - finalHits,
      averageReactionTime: avgReactionTime
    };

    setAttentionResults(results);

    toast({
      title: "Attention Test Completed",
      description: `You responded to ${results.hits} out of ${results.totalTargets} targets with an average reaction time of ${results.averageReactionTime}ms.`,
    });

    // Calculate dyslexia likelihood based on attention performance
    const hitRate = (results.hits / 5) * 100; // Based on 5 hits maximum

    // Penalize only significantly slow reactions (adjusted for mouse/touch interaction)
    // Reaction time penalty is calculated for potential future use/display but NOT added to risk score
    // const reactionPenalty = results.averageReactionTime > 3000 ? 20 : results.averageReactionTime > 1500 ? 10 : 0;

    // Weight accuracy higher (80% of score) + reaction time (20% of score)
    // Clamp result between 10 and 90 to match UI text ranges
    // NEW LOGIC: Purely 100 - Hit Rate
    const attentionDyslexiaIndicator = Math.max(0, 100 - hitRate);

    // Generate analysis results
    generateAnalysisResults('attention', {
      hitRate,
      hits: results.hits,
      totalTargets: results.totalTargets,
      misses: results.misses,
      averageReactionTime: results.averageReactionTime,
      dyslexiaIndicator: attentionDyslexiaIndicator
    });
  };

  // Problem Solving Test Functions
  const startProblemSolvingTest = () => {
    setShowProblemSolvingInstructions(false);
    // Reset states
    setProblemSolvingActive(true);
    setCurrentPattern([]);
    setCurrentSolution(null);
    setUserSolution(null);
    setPatternsCompleted(0);
    setCorrectPatterns(0);
    setTotalPatternTime(0);
    setProblemSolvingResults(null);
    setAnalysisResults(null);
    setPuzzleOptions([]);

    // Generate first pattern
    generatePattern(0);
  };

  const generatePattern = (index?: number) => {
    // Determine puzzle type - Randomly select for each question as requested
    const puzzleTypes: Array<'numeric' | 'sequence' | 'analogy' | 'addition' | 'subtraction'> = [
      'numeric', 'sequence', 'analogy', 'addition', 'subtraction'
    ];

    // Random selection for variety
    const randomTypeIndex = Math.floor(Math.random() * puzzleTypes.length);
    const currentPuzzleType = puzzleTypes[randomTypeIndex];
    setPuzzleType(currentPuzzleType);

    let pattern: number[][] = [];
    let solution: number = 0;
    let options: number[] = [];

    switch (currentPuzzleType) {
      case 'addition':
        // Simple Addition (8-15 yr level)
        const add1 = Math.floor(Math.random() * 40) + 10; // 10-50
        const add2 = Math.floor(Math.random() * 40) + 10; // 10-50
        solution = add1 + add2;
        pattern = [[add1, add2]]; // Store operands

        options = [
          solution,
          solution + Math.floor(Math.random() * 5) + 1,
          solution - Math.floor(Math.random() * 5) - 1,
          solution + 10
        ];
        break;

      case 'subtraction':
        // Simple Subtraction (8-15 yr level)
        const sub1 = Math.floor(Math.random() * 50) + 20; // 20-70
        const sub2 = Math.floor(Math.random() * (sub1 - 10)) + 5; // Ensure positive result
        solution = sub1 - sub2;
        pattern = [[sub1, sub2]];

        options = [
          solution,
          solution + Math.floor(Math.random() * 3) + 1,
          solution - Math.floor(Math.random() * 3) - 1,
          solution + 5
        ];
        break;

      case 'numeric':
        // Simple Grid Number Pattern (e.g., constant row sums or increments)
        // Make it very easy: start 1-10, increment by 1, 2, 5, or 10
        const base = Math.floor(Math.random() * 10) + 1;
        const potentialIncs = [1, 2, 5, 10];
        const inc = potentialIncs[Math.floor(Math.random() * potentialIncs.length)];

        // 3x3 grid where numbers increase by 'inc'
        // Example: 1, 2, 3... or 5, 10, 15...
        for (let i = 0; i < 3; i++) {
          const row: number[] = [];
          for (let j = 0; j < 3; j++) {
            if (i === 2 && j === 2) {
              row.push(-1);
            } else {
              row.push(base + (i * 3 + j) * inc);
            }
          }
          pattern.push(row);
        }
        solution = base + 8 * inc;

        options = [
          solution,
          solution + inc,
          solution - inc,
          solution + inc * 2
        ];
        break;

      case 'sequence':
        // Simple Number Sequence
        const seqStart = Math.floor(Math.random() * 10) + 2;
        const seqInc = Math.floor(Math.random() * 5) + 2;

        const row: number[] = [];
        for (let i = 0; i < 4; i++) {
          row.push(seqStart + i * seqInc);
        }
        row.push(-1);
        solution = seqStart + 4 * seqInc;

        pattern = [row];

        options = [
          solution,
          solution + seqInc,
          solution - seqInc,
          solution + seqInc * 2
        ];
        break;

      case 'analogy':
        // Simple Logical Analogy (A -> B :: C -> ?)
        const aBase = Math.floor(Math.random() * 10) + 2;
        const factor = Math.floor(Math.random() * 3) + 2; // x2, x3, x4

        const aVal = aBase;
        const bVal = aVal * factor;
        const cVal = aBase + Math.floor(Math.random() * 5) + 1;
        solution = cVal * factor;

        pattern = [[aVal, bVal], [cVal, -1]];

        options = [
          solution,
          solution + factor,
          solution - factor,
          cVal + factor
        ];
        break;
    }

    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    setCurrentPattern(pattern);
    setCurrentSolution(solution);
    setPuzzleOptions(options);
    setPatternStartTime(Date.now());

    return options;
  };

  const handlePatternSelection = (selected: number) => {
    if (!patternStartTime) return;

    // Calculate time taken
    const timeTaken = (Date.now() - patternStartTime) / 1000; // in seconds
    setTotalPatternTime(prev => prev + timeTaken);

    // Check if correct
    const isCorrect = selected === currentSolution;
    if (isCorrect) {
      setCorrectPatterns(prev => prev + 1);
    }

    setUserSolution(selected);
    setPatternsCompleted(prev => prev + 1);

    // Show next pattern or complete test
    if (patternsCompleted < 4) {
      setTimeout(() => {
        setUserSolution(null);
        generatePattern();
      }, 1500);
    } else {
      completeProblemSolvingTest(isCorrect);
    }
  };

  const completeProblemSolvingTest = (lastPatternCorrect: boolean = false) => {
    setProblemSolvingActive(false);

    const finalCorrectPatterns = correctPatterns + (lastPatternCorrect ? 1 : 0);
    const totalPatterns = patternsCompleted + 1; // Include current pattern
    const errorRate = (totalPatterns - finalCorrectPatterns) / totalPatterns;
    const avgTime = totalPatternTime / totalPatterns;

    const results = {
      correctPatterns: finalCorrectPatterns,
      totalPatterns: totalPatterns,
      averageTime: parseFloat(avgTime.toFixed(1)),
      errorRate: parseFloat(errorRate.toFixed(2))
    };

    setProblemSolvingResults(results);

    toast({
      title: "Problem Solving Test Completed",
      description: `You solved ${results.correctPatterns} out of ${results.totalPatterns} patterns with an average time of ${results.averageTime} seconds per pattern.`,
    });

    // Calculate dyslexia likelihood based on problem solving performance
    // PURE ACCURACY BASED: 100 - Success Rate (e.g., 40% success = 60% risk)
    const successRate = (results.correctPatterns / results.totalPatterns) * 100;

    // Time indicator is calculated for reporting but NOT added to the risk score anymore
    // const timeIndicator = results.averageTime > 20 ? 30 : results.averageTime > 15 ? 20 : 10;

    const problemSolvingDyslexiaIndicator = Math.max(0, 100 - successRate);

    // Generate analysis results
    generateAnalysisResults('problem-solving', {
      successRate,
      correctPatterns: results.correctPatterns,
      totalPatterns: results.totalPatterns,
      averageTime: results.averageTime,
      errorRate: results.errorRate,
      dyslexiaIndicator: problemSolvingDyslexiaIndicator
    });
  };

  // Generate comprehensive analysis with dyslexia indicators
  const generateAnalysisResults = (testType: string, data: any) => {
    let dyslexiaIndicator = 0;

    // Update local test scores first
    const updatedTestScores = { ...testScores };

    switch (testType) {
      case 'memory':
        dyslexiaIndicator = data.dyslexiaIndicator;
        updatedTestScores.memory = dyslexiaIndicator;
        break;

      case 'attention':
        dyslexiaIndicator = data.dyslexiaIndicator;
        updatedTestScores.attention = dyslexiaIndicator;
        break;

      case 'problem-solving':
        dyslexiaIndicator = data.dyslexiaIndicator;
        updatedTestScores.problemSolving = dyslexiaIndicator;
        break;
    }

    setTestScores(updatedTestScores);

    // Calculate overall dyslexia percentage based on available indicators from ALL tests
    let totalScore = 0;
    let count = 0;

    if (updatedTestScores.memory !== null) { totalScore += updatedTestScores.memory; count++; }
    if (updatedTestScores.attention !== null) { totalScore += updatedTestScores.attention; count++; }
    if (updatedTestScores.problemSolving !== null) { totalScore += updatedTestScores.problemSolving; count++; }

    const newDyslexiaScore = count > 0 ? Math.min(Math.max(totalScore / count, 10), 90) : 0;

    // Set UI score to the CURRENT test result (clamped to match text display)
    // The "newDyslexiaScore" (average) is only used for localStorage/Dashboard
    const clampedScore = Math.min(Math.max(dyslexiaIndicator, 10), 90);
    setDyslexiaScore(clampedScore);

    let analysisText = '';

    // Use the current test's specific indicator for the text description to match the user's immediate context
    const currentTestRisk = dyslexiaIndicator;

    switch (testType) {
      case 'memory':
        analysisText = `
### Memory Assessment Result
- **Accuracy:** ${data.accuracy}% (${data.correct}/${data.total})
- **Recall Time:** ${data.timeTaken}s
- **Dyslexia Risk:** ${currentTestRisk > 65 ? 'High' : currentTestRisk > 35 ? 'Moderate' : 'Low'} (${Math.min(Math.max(currentTestRisk, 10), 90).toFixed(1)}%)
        `;
        break;

      case 'attention':
        analysisText = `
### Attention Assessment Result
- **Hit Rate:** ${data.hitRate.toFixed(1)}% (${data.hits}/5)
- **Average Reaction Time:** ${(data.averageReactionTime / 1000).toFixed(2)}s
- **Dyslexia Risk:** ${currentTestRisk > 65 ? 'High' : currentTestRisk > 35 ? 'Moderate' : 'Low'} (${Math.min(Math.max(currentTestRisk, 10), 90).toFixed(1)}%)
      `;
        break;

      case 'problem-solving':
        analysisText = `
### Problem Solving Assessment Result
- **Success Rate:** ${data.successRate.toFixed(1)}% (${data.correctPatterns}/${data.totalPatterns})
- **Average Time:** ${data.averageTime}s
- **Dyslexia Risk:** ${currentTestRisk > 65 ? 'High' : currentTestRisk > 35 ? 'Moderate' : 'Low'} (${Math.min(Math.max(currentTestRisk, 10), 90).toFixed(1)}%)
      `;
        break;
    }

    // Set simplified analysis text (removed the separate Dyslexia Assessment section as it's now integrated)
    setAnalysisResults(analysisText);
    try {
      // Persist summary for dashboard - preserve existing data and only update the current test type
      const prevStr = localStorage.getItem('cognitive_result');
      const prev = prevStr ? JSON.parse(prevStr) : {};

      const stored = {
        ...prev, // Preserve existing data
        dyslexiaScore: newDyslexiaScore,
        timestamp: Date.now()
      };

      // Only update the specific test type that was just completed
      if (testType === 'memory') {
        stored.memory = { accuracy: data.accuracy, timeTaken: data.timeTaken };
      } else if (testType === 'attention') {
        stored.attention = { hitRate: data.hitRate ?? 0, averageReactionTime: data.averageReactionTime ?? 0 };
      } else if (testType === 'problem-solving') {
        stored.problemSolving = { successRate: data.successRate ?? 0, averageTime: data.averageTime ?? 0, errorRate: data.errorRate ?? 0 };
      }

      localStorage.setItem('cognitive_result', JSON.stringify(stored));
      console.log('Stored cognitive data:', stored); // Debug log
    } catch { }
  };

  // Add CSS animation to the component for better reliability


  // Add an additional useEffect to ensure state is properly reset on test start


  return (
    <Layout>
      <div className="assessment-container animate-fade-in">
        <h1 className="page-title">Cognitive Assessment</h1>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Evaluate cognitive abilities including memory, attention span, and problem-solving skills
            through interactive digital tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardContent className="p-6">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="mb-6 w-full">
                    <TabsTrigger value="memory" className="flex-1">Memory</TabsTrigger>
                    <TabsTrigger value="attention" className="flex-1">Attention</TabsTrigger>
                    <TabsTrigger value="problem-solving" className="flex-1">Problem Solving</TabsTrigger>
                  </TabsList>

                  <TabsContent value="memory" className="mt-0 space-y-4">
                    <div className="mb-4">
                      {/* Active Game Area */}
                      {showMemoryInstructions ? (
                        <AssessmentInstructions
                          title="Memory Sequence Test"
                          description="Test your visual working memory by recalling sequences of colors. This helps identify memory retention capabilites."
                          steps={[
                            "Watch the sequence of colors highlighted on the screen",
                            "Wait for the sequence to complete",
                            "Repeat the sequence by clicking the colors in the same order",
                            "You will be scored on accuracy"
                          ]}
                          onStart={startMemoryGame}
                          icon={<Brain size={24} />}
                        />
                      ) : !memoryGameActive && !testScores.memory ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Brain className="text-indigo-600" size={40} />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Memory Assessment</h3>
                          <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Watch the sequence of colors and repeat them in the correct order.
                          </p>
                          <Button onClick={startMemoryGame} size="lg" className="px-8 bg-app-blue hover:bg-app-blue-dark">
                            Start Memory Test
                          </Button>
                        </div>
                      ) : showSequence ? (
                        <div className="space-y-4">
                          <div className="flex justify-center gap-2">
                            {memorySequence.map((color, index) => (
                              <div
                                key={index}
                                className="w-16 h-16 rounded-md"
                                style={{ backgroundColor: color }}
                              ></div>
                            ))}
                          </div>
                          <div className="text-center text-gray-500">
                            Memorize this sequence...
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-center text-gray-500 mb-4">
                            {gameCompleted
                              ? "Test completed! See your results in the analysis panel."
                              : "Now click the colors in the order they appeared."}
                          </p>

                          <div className="grid grid-cols-3 gap-4">
                            {colors.map((color) => (
                              <button
                                key={color}
                                onClick={() => handleColorClick(color)}
                                className="w-full h-16 rounded-md transition-transform hover:scale-105 disabled:opacity-50"
                                style={{ backgroundColor: color }}
                                disabled={gameCompleted}
                                aria-label={`Select color ${color}`}
                                title={`Select color ${color}`}
                              ></button>
                            ))}
                          </div>

                          <div className="mt-4 flex items-end justify-between">
                            <div>
                              <p className="text-sm mb-2">Your sequence ({userSequence.length}/{memorySequence.length}):</p>
                              <div className="flex gap-2">
                                {userSequence.map((color, index) => (
                                  <div
                                    key={index}
                                    className="w-8 h-8 rounded-md"
                                    style={{ backgroundColor: color }}
                                  ></div>
                                ))}
                                {Array(memorySequence.length - userSequence.length).fill(0).map((_, index) => (
                                  <div key={index} className="w-8 h-8 rounded-md bg-gray-200"></div>
                                ))}
                              </div>
                            </div>

                            <Button
                              onClick={handleUndo}
                              disabled={userSequence.length === 0 || gameCompleted}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-1"
                            >
                              <Undo size={16} /> Undo
                            </Button>
                          </div>

                          {gameCompleted && (
                            <Button
                              onClick={startMemoryGame}
                              className="w-full mt-4 bg-app-blue hover:bg-app-blue-dark"
                            >
                              Try Again
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="attention" className="mt-0 space-y-4">
                    <div className="mb-4">
                      {showAttentionInstructions ? (
                        <AssessmentInstructions
                          title="Attention Span Test"
                          description="Measure your sustained attention and reaction time by identifying visual targets. This helps assess focus and processing speed."
                          steps={[
                            "Click 'Start Assessment' to begin",
                            "Watch for red targets appearing in the box below",
                            "Click on each target as quickly as possible",
                            "The test ends after 10 targets or 5 hits"
                          ]}
                          onStart={startAttentionTest}
                          icon={<Target size={24} />}
                        />
                      ) : !attentionTestActive && !attentionResults ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Target className="text-orange-600" size={40} />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Attention Assessment</h3>
                          <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Click on the targets as they appear on the screen. Speed and accuracy both count!
                          </p>
                          <Button onClick={startAttentionTest} size="lg" className="bg-app-green hover:bg-app-green-dark">
                            Start Attention Test
                          </Button>
                        </div>
                      ) : attentionTestActive ? (
                        <div className="space-y-2">
                          <div
                            ref={attentionContainerRef}
                            className="p-6 border-2 border-gray-200 rounded-md relative bg-white overflow-hidden shadow-inner cursor-crosshair"
                            style={{ height: "320px", width: "100%", position: "relative" }}
                          >
                            {/* Target button with !important style to ensure visibility */}
                            {attentionTarget && (
                              <div
                                className="absolute"
                                style={{
                                  left: `${attentionTarget.x}px`,
                                  top: `${attentionTarget.y}px`,
                                  width: '56px',
                                  height: '56px',
                                  zIndex: 1000,
                                  pointerEvents: 'auto'
                                }}
                              >
                                <button
                                  className="w-full h-full rounded-full bg-green-600 shadow-lg hover:bg-green-500 flex items-center justify-center transform transition-transform active:scale-95"
                                  style={{
                                    boxShadow: '0 0 15px rgba(0, 255, 0, 0.8)',
                                    border: '3px solid white',
                                    position: 'relative',
                                    zIndex: 1000
                                  }}
                                  onClick={handleTargetClick}
                                  aria-label="Click target"
                                >
                                  <Target className="text-white" size={28} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Status info moved below */}
                          <div className="flex justify-between items-center text-sm font-medium text-gray-700">
                            <span>Targets: {Math.min(attentionTargetsShown, 10)}/10</span>
                            <span>Hits: {attentionHits}/5</span>
                          </div>
                          <Progress
                            className="w-full h-2 mb-2"
                            value={Math.max(attentionTargetsShown * (100 / 10), attentionHits * (100 / 5))}
                          />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border rounded-md">
                              <p className="text-sm text-gray-500">Hit Rate</p>
                              <p className="text-xl font-medium">{attentionResults?.hits}/5</p>
                              <Progress className="mt-2" value={(attentionResults?.hits || 0) / 5 * 100} />
                            </div>
                            <div className="p-4 border rounded-md">
                              <p className="text-sm text-gray-500">Average Reaction</p>
                              <p className="text-xl font-medium">{(attentionResults?.averageReactionTime! / 1000).toFixed(2)}s</p>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <div className="flex items-center text-red-500">
                              <AlertTriangle size={16} className="mr-1" />
                              <span className="text-sm">Missed: {attentionResults?.misses}</span>
                            </div>
                            <div className="flex items-center text-green-500">
                              <CheckCircle2 size={16} className="mr-1" />
                              <span className="text-sm">Hit: {attentionResults?.hits}</span>
                            </div>
                          </div>

                          <Button
                            onClick={startAttentionTest}
                            className="w-full mt-4 bg-app-green hover:bg-app-green-dark"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="problem-solving" className="mt-0 space-y-4">
                    <div className="mb-4">
                      {showProblemSolvingInstructions ? (
                        <AssessmentInstructions
                          title="Problem Solving Test"
                          description="Evaluate logical reasoning and pattern recognition skills through interactive puzzles."
                          steps={[
                            "You will see a series of logical puzzles (patterns, sequences, math)",
                            "Select the correct answer from the options provided",
                            "Complete all 5 questions to finish the assessment",
                            "Take your time to think through each problem"
                          ]}
                          onStart={startProblemSolvingTest}
                          icon={<Lightbulb size={24} />}
                        />
                      ) : !problemSolvingActive && !problemSolvingResults ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="text-green-600" size={40} />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Problem Solving Assessment</h3>
                          <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Complete pattern recognition and logical reasoning puzzles.
                          </p>
                          <Button onClick={startProblemSolvingTest} size="lg" className="bg-app-blue hover:bg-app-blue-dark">
                            Start Assessment
                          </Button>
                        </div>
                      ) : problemSolvingActive ? (
                        <div className="space-y-4 p-4 border rounded-md">
                          <div className="grid grid-cols-3 gap-2 mb-6">
                            {puzzleType === 'sequence' ? (
                              // Sequence puzzle display (horizontal)
                              <div className="col-span-3 flex justify-center items-center space-x-4">
                                {currentPattern[0].map((value, index) => (
                                  <div
                                    key={index}
                                    className={`flex items-center justify-center w-12 h-12 text-lg font-medium rounded ${value === -1 ? 'bg-gray-200 border border-dashed border-gray-400' : 'bg-gray-100'}`}
                                  >
                                    {value !== -1 ? value : '?'}
                                  </div>
                                ))}
                              </div>
                            ) : puzzleType === 'analogy' ? (
                              // Analogy puzzle display (A:B::C:?)
                              <div className="col-span-3">
                                <div className="flex justify-center items-center space-x-2 mb-3">
                                  <div className="flex items-center justify-center w-12 h-12 text-lg font-medium rounded bg-gray-100">
                                    {currentPattern[0][0]}
                                  </div>
                                  <div className="text-lg">:</div>
                                  <div className="flex items-center justify-center w-12 h-12 text-lg font-medium rounded bg-gray-100">
                                    {currentPattern[0][1]}
                                  </div>
                                  <div className="text-lg">::</div>
                                  <div className="flex items-center justify-center w-12 h-12 text-lg font-medium rounded bg-gray-100">
                                    {currentPattern[1][0]}
                                  </div>
                                  <div className="text-lg">:</div>
                                  <div className="flex items-center justify-center w-12 h-12 text-lg font-medium rounded bg-gray-200 border border-dashed border-gray-400">
                                    ?
                                  </div>
                                </div>
                              </div>
                            ) : puzzleType === 'addition' || puzzleType === 'subtraction' ? (
                              // Addition/Subtraction display
                              <div className="col-span-3 flex justify-center items-center space-x-4 mb-4">
                                <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold rounded bg-blue-50 text-app-blue">
                                  {currentPattern[0][0]}
                                </div>
                                <div className="text-2xl font-bold text-gray-400">
                                  {puzzleType === 'addition' ? '+' : '-'}
                                </div>
                                <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold rounded bg-blue-50 text-app-blue">
                                  {currentPattern[0][1]}
                                </div>
                                <div className="text-2xl font-bold text-gray-400">=</div>
                                <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold rounded bg-gray-100 border-2 border-dashed border-gray-300 text-gray-400">
                                  ?
                                </div>
                              </div>
                            ) : (
                              // Default grid pattern display (numeric)
                              currentPattern.map((row, rowIndex) => (
                                <React.Fragment key={rowIndex}>
                                  {row.map((value, colIndex) => (
                                    <div
                                      key={`${rowIndex}-${colIndex}`}
                                      className={`aspect-square flex items-center justify-center text-lg font-medium rounded ${value === -1 ? 'bg-gray-200 border border-dashed border-gray-400' : 'bg-gray-100'}`}
                                    >
                                      {value !== -1 ? value : '?'}
                                    </div>
                                  ))}
                                </React.Fragment>
                              ))
                            )}
                          </div>

                          <p className="text-center text-sm text-gray-500 mb-2">
                            {puzzleType === 'numeric' ? 'Select the number that completes the pattern' :
                              puzzleType === 'sequence' ? 'Select the next number in the sequence' :
                                puzzleType === 'analogy' ? 'Complete the analogy' :
                                  'Find the missing value in the pattern'}
                          </p>

                          <div className="bg-gray-50 p-2 rounded-md text-xs text-center text-gray-500 mb-3">
                            Puzzle type: {puzzleType === 'numeric' ? 'Number Pattern' :
                              puzzleType === 'sequence' ? 'Number Sequence' :
                                puzzleType === 'analogy' ? 'Logical Analogy' :
                                  puzzleType === 'addition' ? 'Addition' : 'Subtraction'}
                            &nbsp;({patternsCompleted + 1}/5)
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {puzzleOptions.map((value, index) => (
                              <button
                                key={index}
                                onClick={() => handlePatternSelection(value)}
                                className={`py-2 rounded text-white transition-colors duration-200
                                  ${userSolution === null
                                    ? 'bg-app-blue hover:bg-app-blue-dark'
                                    : value === currentSolution
                                      ? 'bg-green-500 hover:bg-green-600 ring-2 ring-offset-2 ring-green-500'
                                      : value === userSolution
                                        ? 'bg-red-500 hover:bg-red-600 ring-2 ring-offset-2 ring-red-500'
                                        : 'bg-app-blue opacity-50 cursor-not-allowed'
                                  }
                                `}
                                disabled={userSolution !== null}
                              >
                                {value}
                              </button>
                            ))}
                          </div>

                          <div className="mt-4">
                            <Progress
                              className="mb-2"
                              value={(patternsCompleted / 5) * 100}
                            />
                            <p className="text-center text-sm text-gray-500">
                              Puzzle {patternsCompleted + 1} of 5
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border rounded-md">
                              <p className="text-sm text-gray-500">Success Rate</p>
                              <p className="text-xl font-medium">
                                {problemSolvingResults?.correctPatterns}/{problemSolvingResults?.totalPatterns}
                              </p>
                              <Progress
                                className="mt-2"
                                value={(problemSolvingResults?.correctPatterns || 0) / (problemSolvingResults?.totalPatterns || 1) * 100}
                              />
                            </div>
                            <div className="p-4 border rounded-md">
                              <p className="text-sm text-gray-500">Average Time</p>
                              <p className="text-xl font-medium">{problemSolvingResults?.averageTime}s</p>
                            </div>
                          </div>



                          <Button
                            onClick={startProblemSolvingTest}
                            className="w-full mt-4 bg-app-blue hover:bg-app-blue-dark"
                          >
                            Try Again
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="h-full">
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-center mb-4">
                  <Brain className="text-app-blue mr-2" size={20} />
                  <h2 className="card-title">Analysis Results</h2>
                </div>

                <div className="flex-1 overflow-auto">
                  {analysisResults ? (
                    <div className="prose max-w-full">
                      {renderSimpleMarkdown(analysisResults)}
                      {dyslexiaScore !== null && (
                        <div className="mt-6 border-t pt-4">
                          <h3 className="text-lg font-medium mb-2">Dyslexia Indicator</h3>

                          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div
                              className={`h-4 rounded-full ${dyslexiaScore > 65 ? 'bg-red-500' :
                                dyslexiaScore > 35 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                              style={{ width: `${dyslexiaScore}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>Low (10%)</span>
                            <span>Moderate (50%)</span>
                            <span>High (90%)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-center p-8">
                      <div>
                        <p className="mb-2">No analysis results yet.</p>
                        <p className="text-sm">Complete one of the cognitive tests to see your results here.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout >
  );
};

export default CognitiveAssessment;
