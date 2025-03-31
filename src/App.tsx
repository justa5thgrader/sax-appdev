import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

// Define types for our data structures
interface Note {
  note: string;
  duration: number;
  time: number;
}

interface Song {
  title: string;
  notes: Note[];
  tempo: number;
  timeSignature: [number, number];
}

// Mapping for finger positions
type FingerPositionMap = {
  [key: string]: boolean[];
};

const SaxLearningApp = () => {
  // Updated fingerboard configuration for Alto Sax based on the chart
  // For each note, defines: [octaveKey, First finger, Second finger, Third finger, Fourth finger, Fifth finger, Sixth finger]
  // True = key is pressed/covered, False = key is open/not pressed
  const fingerPositions: FingerPositionMap = {
    // First register (lower octave)
    Bb1: [false, true, true, true, true, true, true],
    B1: [false, true, false, false, false, false, false],
    C1: [false, false, true, false, false, false, false],
    "C#1": [false, false, false, true, false, false, false],
    D1: [false, true, true, true, true, true, true],
    E1: [false, true, true, true, true, true, false],
    F1: [false, true, true, true, true, false, false],
    "F#1": [false, true, true, true, false, true, false],
    G1: [true, true, true, false, false, false, false],
    A1: [false, true, true, false, false, false, false],

    // Second register (higher octave - with octave key)
    B2: [true, true, false, false, false, false, false],
    C2: [true, false, true, false, false, false, false],
    "C#2": [true, false, true, false, false, false, false],
    D2: [true, true, true, true, false, true, true],
    E2: [true, true, true, true, true, true, false],
    F2: [true, true, true, true, true, false, false],
    "F#2": [true, true, true, true, false, true, false],
    G2: [true, true, true, true, false, false, false],
    A2: [true, true, true, false, false, false, false],
  };

  // State for music data
  const [song, setSong] = useState<Song>({
    title: "Alto Sax Basic Notes",
    notes: [
      { note: "C1", duration: 1, time: 0 },
      { note: "B1", duration: 1, time: 1 },
      { note: "D1", duration: 1, time: 2 },
      { note: "E1", duration: 1, time: 3 },
      { note: "F1", duration: 1, time: 4 },
      { note: "G1", duration: 1, time: 5 },
      { note: "B2", duration: 1, time: 6 },
      { note: "C2", duration: 1, time: 7 },
      { note: "D2", duration: 1, time: 8 },
      { note: "B2", duration: 1, time: 9 },
    ],
    tempo: 60,
    timeSignature: [4, 4],
  });

  // State for playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(10); // Total duration in seconds for 10 notes
  const [currentlyPlayingNote, setCurrentlyPlayingNote] = useState<
    string | null
  >(null);
  const lastPlayedNoteRef = useRef<string | null>(null);

  // State for editor mode
  const [editorMode, setEditorMode] = useState<boolean>(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // Initialize Tone.js synth and effects
  const [synth, setSynth] = useState<Tone.Synth | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);

  // Setup Tone.js synth with saxophone-like qualities
  useEffect(() => {
    // Create a synth that sounds somewhat like a saxophone
    const newSynth = new Tone.Synth({
      oscillator: {
        type: "sawtooth8",
      },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.8,
        release: 0.8,
      },
    }).toDestination();

    // Add some effects to make it sound more like a saxophone
    const reverb = new Tone.Reverb(1.5).toDestination();
    const feedbackDelay = new Tone.FeedbackDelay(0.3, 0.1).toDestination();

    // Connect synth to effects
    newSynth.connect(reverb);
    newSynth.connect(feedbackDelay);

    // Store the synth in state
    setSynth(newSynth);

    // Clean up function to dispose of synth when component unmounts
    return () => {
      newSynth.dispose();
      reverb.dispose();
      feedbackDelay.dispose();
    };
  }, []);

  // Initialize audio context on user interaction
  const initializeAudio = () => {
    if (!isAudioInitialized) {
      Tone.start();
      setIsAudioInitialized(true);
    }
  };

  // Playback logic with useEffect
  useEffect(() => {
    let animationId: number;
    let lastTime: number | null = null;

    const animate = (timestamp: number): void => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      setCurrentTime((prevTime) => {
        const newTime = Math.min(prevTime + deltaTime, duration);

        // Check if we've reached the end
        if (newTime >= duration) {
          setIsPlaying(false);
          return duration;
        }

        return newTime;
      });

      if (isPlaying) {
        animationId = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      lastTime = null; // Reset lastTime when starting playback
      animationId = requestAnimationFrame(animate);
    } else {
      // Stop any currently playing note when pausing
      if (synth && currentlyPlayingNote) {
        synth.triggerRelease();
        setCurrentlyPlayingNote(null);
      }
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, duration, synth, currentlyPlayingNote]);

  // Effect to handle automatic note playing
  useEffect(() => {
    if (!isPlaying || !synth || !isAudioInitialized) return;

    // Find the current note based on time
    const currentNote = getCurrentNote();

    // If we have a note and it's different from the last played note, play it
    if (currentNote && currentNote !== lastPlayedNoteRef.current) {
      // Release previous note if any
      if (currentlyPlayingNote) {
        synth.triggerRelease();
      }

      // Transpose the note up by TWO octaves for playback to maintain current pitch
      const transposedNote = currentNote.replace(/(\d+)$/, (_, octave) =>
        String(parseInt(octave) + 2)
      );
      const noteDuration =
        song.notes.find((n) => n.note === currentNote)?.duration || 1;
      synth.triggerAttackRelease(transposedNote, noteDuration);

      // Update state to track currently playing note
      setCurrentlyPlayingNote(currentNote);
      lastPlayedNoteRef.current = currentNote;
    } else if (!currentNote && currentlyPlayingNote) {
      // No current note, but something is playing - stop it
      synth.triggerRelease();
      setCurrentlyPlayingNote(null);
      lastPlayedNoteRef.current = null;
    }
  }, [currentTime, isPlaying, synth, isAudioInitialized, song.notes]);

  // Toggle playback
  const togglePlayback = (): void => {
    // Initialize audio if not already done
    if (!isAudioInitialized) {
      initializeAudio();
    }
    setIsPlaying(!isPlaying);
  };

  // Reset playback
  const resetPlayback = (): void => {
    setCurrentTime(0);
    setIsPlaying(false);
    if (synth && currentlyPlayingNote) {
      synth.triggerRelease();
      setCurrentlyPlayingNote(null);
      lastPlayedNoteRef.current = null;
    }
  };

  // Handle file upload
  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = (): void => {
        try {
          // Parse MIDI (simulated)
          const parsedSong: Song = {
            title:
              file.name.replace(".mid", "").replace(".midi", "") +
              " (Basic Notes)",
            notes: Array.from({ length: 8 }, (_, i) => ({
              note: ["Bb1", "C1", "D1", "Eb1", "F1", "G1", "Bb2", "C2"][
                Math.floor(Math.random() * 8)
              ],
              duration: 1,
              time: i,
            })),
            tempo: 60,
            timeSignature: [4, 4],
          };

          // Update song state
          setSong(parsedSong);
          setDuration(
            parsedSong.notes.reduce(
              (total, note) => Math.max(total, note.time + note.duration),
              0
            )
          );

          // Reset playback
          resetPlayback();

          alert(
            "MIDI file processed successfully! (Note: This is a demo with randomized notes)"
          );
        } catch (error) {
          console.error("Error parsing MIDI file:", error);
          alert("Failed to parse MIDI file. Please try another file.");
        }
      };

      reader.readAsArrayBuffer(file);
    }
  };

  // Progress bar click handler
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedTime = (x / rect.width) * duration;
    setCurrentTime(clickedTime);
  };

  // Progress bar component
  const renderProgressBar = () => {
    const progress = (currentTime / duration) * 100;

    return (
      <div
        className="progress-container h-4 bg-gray-700 rounded-full mb-4 cursor-pointer relative"
        onClick={handleProgressBarClick}
      >
        <div
          className="progress-bar h-full bg-red-500 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
        <div
          className="progress-handle absolute h-6 w-6 bg-white rounded-full -mt-1 shadow-lg"
          style={{
            left: `calc(${progress}% - 12px)`,
            top: "0",
            display: progress > 0 ? "block" : "none",
          }}
        ></div>
      </div>
    );
  };

  // Get current note based on time
  const getCurrentNote = (): string | null => {
    for (let i = 0; i < song.notes.length; i++) {
      const note = song.notes[i];
      if (currentTime >= note.time && currentTime < note.time + note.duration) {
        return note.note;
      }
    }
    return null;
  };

  // Get current note index
  const getCurrentNoteIndex = (): number => {
    for (let i = 0; i < song.notes.length; i++) {
      const note = song.notes[i];
      if (currentTime >= note.time && currentTime < note.time + note.duration) {
        return i;
      }
    }
    return -1;
  };

  // Type definition for parsed note
  interface ParsedNote {
    note: string;
    octave: number;
  }

  // Parse note and octave from note string (e.g., "C2" -> {note: "C", octave: 2})
  const parseNote = (noteString: string): ParsedNote => {
    const match = noteString.match(/([A-G][#b]?)(\d)/);
    if (match) {
      return {
        note: match[1],
        octave: parseInt(match[2]),
      };
    }
    return { note: noteString, octave: 1 };
  };

  // Calculate note vertical position based on note and octave
  const getNotePosition = (noteString: string): number => {
    const { note, octave } = parseNote(noteString);

    // Base positions for natural notes (adjust for your staff)
    const basePositions: Record<string, number> = {
      C: 100, // Middle C - ledger line below staff
      D: 88, // First space
      E: 80, // First line
      F: 65, // First space
      G: 45, // Second line
      A: 25, // Second space
      B: 5, // Third line
      Bb: 15, // Between B and A
      "C#": 95, // Between C and D
      Eb: 70, // Between E and F
      "F#": 55, // Between F and G
      "G#": 35, // Between G and A
    };

    // Extract base note (without accidental)
    const baseNote = note.replace("#", "").replace("b", "");
    let basePosition = basePositions[baseNote] || 65;

    // Adjust for accidentals
    if (note.includes("#")) {
      basePosition -= 5;
    } else if (note.includes("b")) {
      basePosition += 5;
    }

    // Adjust for octave - higher octave moves notes down on staff
    const octaveOffset = (octave - 1) * -80;

    return basePosition + octaveOffset;
  };

  // Render controls
  const renderControls = () => {
    return (
      <div className="controls flex items-center mb-4">
        <button
          onClick={togglePlayback}
          className="p-3 mr-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" ry="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" ry="1" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="5 3 19 12 5 21" />
            </svg>
          )}
        </button>
        <button
          onClick={resetPlayback}
          className="p-3 mr-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="19 20 9 12 19 4" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </svg>
        </button>
        <div className="time ml-2 font-mono">
          {Math.floor(currentTime / 60)
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor(currentTime % 60)
            .toString()
            .padStart(2, "0")}{" "}
          /
          {Math.floor(duration / 60)
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor(duration % 60)
            .toString()
            .padStart(2, "0")}
        </div>
        {!isAudioInitialized && (
          <div className="ml-4 text-yellow-400 text-sm">
            Click play to enable audio
          </div>
        )}
      </div>
    );
  };

  // Add note to song in editor
  const addNote = (): void => {
    if (!editingSong) return;

    const newNote: Note = {
      note: "C1", // Default to middle C in first octave
      duration: 1,
      time:
        editingSong.notes.length > 0
          ? Math.max(...editingSong.notes.map((n) => n.time + n.duration))
          : 0,
    };

    setEditingSong({
      ...editingSong,
      notes: [...editingSong.notes, newNote],
    });
  };

  // Update note in editor
  const updateNote = (
    index: number,
    property: keyof Note,
    value: string | number
  ): void => {
    if (!editingSong) return;

    const updatedNotes = [...editingSong.notes];
    updatedNotes[index] = {
      ...updatedNotes[index],
      [property]: value,
    };

    setEditingSong({
      ...editingSong,
      notes: updatedNotes,
    });
  };

  // Delete note in editor
  const deleteNote = (index: number): void => {
    if (!editingSong) return;

    const updatedNotes = editingSong.notes.filter((_, i) => i !== index);

    setEditingSong({
      ...editingSong,
      notes: updatedNotes,
    });
  };

  // Save song from editor
  const saveSong = (): void => {
    if (!editingSong) return;

    setSong(editingSong);
    setDuration(
      editingSong.notes.reduce(
        (total, note) => Math.max(total, note.time + note.duration),
        0
      )
    );
    setEditorMode(false);
    resetPlayback();
  };

  // Render editor
  const renderEditor = () => {
    if (!editingSong) return null;

    return (
      <div className="editor mt-6 p-4 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl">Song Editor</h2>
          <div>
            <button
              onClick={addNote}
              className="px-4 py-2 bg-green-500 text-white rounded mr-2"
            >
              Add Note
            </button>
            <button
              onClick={saveSong}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Save Song
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2">Song Title</label>
          <input
            type="text"
            value={editingSong.title}
            onChange={(e) =>
              setEditingSong({ ...editingSong, title: e.target.value })
            }
            className="w-full p-2 bg-gray-700 rounded text-white"
          />
        </div>

        <div className="note-editor">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2 rounded-tl">Note</th>
                <th className="p-2">Start Time (s)</th>
                <th className="p-2">Duration (s)</th>
                <th className="p-2 rounded-tr">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editingSong.notes.map((note, index) => (
                <tr key={index} className="border-t border-gray-700">
                  <td className="p-2">
                    <select
                      value={note.note}
                      onChange={(e) =>
                        updateNote(index, "note", e.target.value)
                      }
                      className="bg-gray-700 p-1 rounded"
                    >
                      <optgroup label="First Octave">
                        {Object.keys(fingerPositions)
                          .filter((noteName) => noteName.includes("1"))
                          .map((noteName) => (
                            <option key={noteName} value={noteName}>
                              {noteName}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Second Octave">
                        {Object.keys(fingerPositions)
                          .filter((noteName) => noteName.includes("2"))
                          .map((noteName) => (
                            <option key={noteName} value={noteName}>
                              {noteName}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={note.time}
                      onChange={(e) =>
                        updateNote(index, "time", parseFloat(e.target.value))
                      }
                      className="bg-gray-700 p-1 rounded w-20"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={note.duration}
                      onChange={(e) =>
                        updateNote(
                          index,
                          "duration",
                          parseFloat(e.target.value)
                        )
                      }
                      className="bg-gray-700 p-1 rounded w-20"
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteNote(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="sax-learning-app bg-gray-900 text-white min-h-screen w-full p-6">
      <h1 className="text-2xl mb-4">{song.title} - Alto Saxophone Tutorial</h1>

      {!editorMode && (
        <>
          <div className="flex gap-4 w-full">
            {/* Key labels section on the left */}
            <div className="w-48">
              {/* Key labels */}
              {[
                "Octave Key (Thumb)",
                "First Finger (Index)",
                "Second Finger (Middle)",
                "Third Finger (Ring)",
                "Fourth Finger (Left Pinky)",
                "Fifth Finger (Right Index)",
                "Sixth Finger (Right Middle)",
              ].map((label, index) => (
                <div key={index} className="flex items-center mb-6">
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mr-2 
                    ${
                      getCurrentNote() &&
                      fingerPositions[getCurrentNote()!]?.[index]
                        ? index === 0
                          ? "bg-blue-300 border-blue-500"
                          : "bg-yellow-300 border-yellow-500"
                        : "border-gray-300"
                    }`}
                  ></div>
                  <span className="text-sm whitespace-nowrap overflow-hidden text-gray-300">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Main staff and finger positions section */}
            <div className="flex-1">
              <div className="staff bg-gray-800 p-4 relative border border-gray-700 rounded-lg">
                {/* Staff section */}
                <div className="staff-lines relative h-[120px] mb-8">
                  {/* Staff lines */}
                  {[0, 1, 2, 3, 4].map((line) => (
                    <div
                      key={line}
                      className="absolute h-px bg-gray-500 w-full"
                      style={{ top: `${line * 20 + 20}px` }}
                    ></div>
                  ))}

                  {/* Notes on staff */}
                  {song.notes.map((note, index) => {
                    const top = getNotePosition(note.note) * 0.25;
                    // Adjust position calculation to center at 20% mark
                    const timeOffset = note.time - currentTime;
                    const left = `${20 + timeOffset * 20}%`; // 20% is our center point, move 20% per second
                    const width = `${(note.duration / duration) * 100}%`;
                    const isCurrent = index === getCurrentNoteIndex();
                    const { note: noteName, octave } = parseNote(note.note);

                    // Only show notes that are coming up or recently passed
                    if (timeOffset > -2 && timeOffset < 5) {
                      return (
                        <div
                          key={index}
                          className={`absolute flex flex-col items-center justify-center transition-all duration-200
                                    ${isCurrent ? "scale-110" : "scale-100"}`}
                          style={{
                            left: left,
                            top: top,
                            width: width,
                            maxWidth: "100px",
                            zIndex: isCurrent ? 10 : 1,
                          }}
                        >
                          <div
                            className={`text-lg font-bold ${
                              isCurrent ? "text-blue-400" : "text-white"
                            }`}
                          >
                            {noteName}
                            <span className="text-sm">{octave}</span>
                          </div>
                          <div
                            className={`text-2xl ${
                              isCurrent ? "text-blue-400" : "text-white"
                            }`}
                          >
                            ♩
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {/* Vertical line indicator at 20% from left */}
                  <div
                    className="absolute h-full w-px bg-red-500 z-20"
                    style={{ left: "20%" }}
                  ></div>
                </div>

                {/* Finger position circles and bars section */}
                <div className="finger-positions relative h-[350px]">
                  {/* Finger position bars */}
                  {getCurrentNote() &&
                    fingerPositions[getCurrentNote()!]?.map(
                      (isPressed, index) => (
                        <div
                          key={index}
                          className="absolute w-full"
                          style={{ top: `${index * 50}px` }}
                        >
                          {/* Circle indicator at 20% from left */}
                          <div
                            className={`absolute h-8 w-8 rounded-full border-2 flex items-center justify-center
                              ${
                                isPressed
                                  ? index === 0
                                    ? "bg-blue-300 border-blue-500"
                                    : "bg-yellow-300 border-yellow-500"
                                  : "border-gray-300"
                              }`}
                            style={{ left: "calc(20% - 16px)", top: "-4px" }}
                          />

                          {/* Bars for upcoming notes */}
                          {song.notes.map((note, noteIndex) => {
                            const notePositions =
                              fingerPositions[note.note] || [];
                            const isActiveForNote = notePositions[index];
                            // Match the note positioning logic
                            const timeOffset = note.time - currentTime;
                            const left = `${20 + timeOffset * 20}%`;
                            const widthPercent =
                              (note.duration / duration) * 100;

                            // Only show bars that are coming up or recently passed
                            if (
                              timeOffset > -2 &&
                              timeOffset < 5 &&
                              isActiveForNote
                            ) {
                              return (
                                <div
                                  key={noteIndex}
                                  className={`absolute h-8 ${
                                    index === 0
                                      ? "bg-blue-300"
                                      : "bg-yellow-300"
                                  } rounded-md opacity-80`}
                                  style={{
                                    left: left,
                                    width: `${widthPercent}%`,
                                  }}
                                ></div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )
                    )}
                </div>
              </div>
            </div>
          </div>

          {renderProgressBar()}
          {renderControls()}
        </>
      )}

      <div className="mt-6 flex space-x-4">
        <button
          onClick={() => {
            setEditorMode(!editorMode);
            // Initialize editing song if entering editor mode
            if (!editorMode) {
              setEditingSong({ ...song });
            }
          }}
          className={`px-4 py-2 rounded ${
            editorMode ? "bg-gray-500" : "bg-blue-500"
          } text-white`}
        >
          {editorMode ? "Exit Editor" : "Open Editor"}
        </button>
      </div>

      {editorMode ? (
        renderEditor()
      ) : (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl mb-2">Upload MIDI File</h2>
          <input
            type="file"
            accept=".mid,.midi"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
          />
          <p className="mt-2 text-sm text-gray-400">
            Upload a MIDI file to automatically generate a tutorial track
          </p>
        </div>
      )}
    </div>
  );
};

export default SaxLearningApp;
