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
  // Map note names to frequencies for playback
  const noteToFrequency = (noteName: string): number => {
    // Alto saxophone note to frequency mapping (in concert pitch)
    const noteMap: Record<string, number> = {
      // First register
      C1: 349.23, // Concert Eb (E flat)
      D1: 392.0, // Concert F
      E1: 440.0, // Concert G
      F1: 466.16, // Concert Ab (A flat)
      G1: 523.25, // Concert Bb (B flat)

      // Second register (octave higher)
      C2: 698.46, // Concert Eb (E flat), one octave higher
      D2: 784.0, // Concert F, one octave higher
      E2: 880.0, // Concert G, one octave higher
      F2: 932.33, // Concert Ab (A flat), one octave higher
      G2: 1046.5, // Concert Bb (B flat), one octave higher
    };

    return noteMap[noteName] || 440; // Default to A440 if note not found
  };

  // Fingerboard configuration for Alto Sax - Simplified for beginners
  // For each note, defines: [octaveKey, First finger, Second finger, Third finger]
  const fingerPositions: FingerPositionMap = {
    // First register basic notes (no octave key)
    C1: [false, false, true, false], // Second finger only
    D1: [false, true, true, true], // All three fingers
    E1: [false, true, true, false], // First and second fingers
    F1: [false, true, false, false], // First finger only
    G1: [false, false, false, true], // Third finger only

    // Second register basic notes (with octave key)
    C2: [true, false, true, false], // Octave key + second finger
    D2: [true, true, true, true], // Octave key + all three fingers
    E2: [true, true, true, false], // Octave key + first and second fingers
    F2: [true, true, false, false], // Octave key + first finger
    G2: [true, false, false, true], // Octave key + third finger
  };

  // State for music data
  const [song, setSong] = useState<Song>({
    title: "Alto Sax Basic Notes",
    notes: [
      { note: "C1", duration: 1, time: 0 },
      { note: "D1", duration: 1, time: 1 },
      { note: "E1", duration: 1, time: 2 },
      { note: "F1", duration: 1, time: 3 },
      { note: "G1", duration: 1, time: 4 },
      { note: "C2", duration: 1, time: 5 },
      { note: "D2", duration: 1, time: 6 },
      { note: "E2", duration: 1, time: 7 },
      { note: "F2", duration: 1, time: 8 },
      { note: "G2", duration: 1, time: 9 },
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
      const noteFreq = noteToFrequency(currentNote);

      // Release previous note if any
      if (currentlyPlayingNote) {
        synth.triggerRelease();
      }

      // Play the new note
      const noteDuration =
        song.notes.find((n) => n.note === currentNote)?.duration || 1;
      synth.triggerAttackRelease(noteFreq, noteDuration);

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
              note: ["C1", "D1", "E1", "F1", "G1", "C2", "D2", "E2"][
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

  // Handle progress bar click to seek
  const handleProgressBarClick = (
    e: React.MouseEvent<HTMLDivElement>
  ): void => {
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const seekPercentage = clickX / progressBarWidth;
    const seekTime = seekPercentage * duration;

    setCurrentTime(seekTime);
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

  // Render staff with notes
  const renderStaff = () => {
    const currentNoteIndex = getCurrentNoteIndex();

    // Parse note and octave from note string (e.g., "C2" -> {note: "C", octave: 2})
    const parseNote = (noteString: string): ParsedNote => {
      const match = noteString.match(/([A-G][♭♯]?)(\d)/);
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
        C: 100,
        D: 90,
        E: 80,
        F: 70,
        G: 60,
        A: 50,
        B: 40,
      };

      // Extract base note (without accidental)
      const baseNote = note.charAt(0);
      const basePosition = basePositions[baseNote] || 70;

      // Adjust for octave - lower octave is higher on the staff
      const octaveOffset = (octave - 1) * -70;

      return basePosition + octaveOffset;
    };

    return (
      <div className="staff bg-gray-800 p-4 mb-4 relative border border-gray-700 rounded-lg">
        <div className="staff-lines relative h-80">
          {[0, 1, 2, 3, 4].map((line) => (
            <div
              key={line}
              className="absolute h-px bg-gray-500 w-full"
              style={{ top: `${line * 20 + 40}px` }}
            ></div>
          ))}

          {/* Position notes on the staff */}
          {song.notes.map((note, index) => {
            // Get vertical position
            const top = getNotePosition(note.note);

            // Calculate horizontal position
            const left = `${(note.time / duration) * 100}%`;
            const width = `${(note.duration / duration) * 100}%`;

            // Is this the current note?
            const isCurrent = index === currentNoteIndex;

            // Parse note for display
            const { note: noteName, octave } = parseNote(note.note);

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
                  className={`text-2xl font-bold ${
                    isCurrent ? "text-blue-400" : "text-white"
                  }`}
                >
                  {noteName}
                  <span className="text-sm">{octave}</span>
                </div>
                <div
                  className={`text-4xl ${
                    isCurrent ? "text-blue-400" : "text-white"
                  }`}
                >
                  ♩
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          <div
            className="absolute h-full w-px bg-red-500 z-20"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // Render finger position indicators
  const renderFingerPositions = () => {
    const currentNote = getCurrentNote();
    const positions = currentNote
      ? fingerPositions[currentNote]
      : Array(4).fill(false);

    // Calculate the visible portion of the timeline
    const noteTimelineWidth = "calc(100% - 150px)";

    // Key labels for saxophone - simplified version
    const keyLabels = [
      "Octave Key (Thumb)",
      "First Finger",
      "Second Finger",
      "Third Finger",
    ];

    return (
      <div className="finger-positions mb-6 mt-8">
        {positions?.map((isPressed, index) => (
          <div
            key={index}
            className="finger-row flex items-center mb-6 relative"
          >
            {/* Key label and circle indicator on the left */}
            <div className="flex items-center w-40">
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mr-2 
                           ${
                             isPressed
                               ? index === 0
                                 ? "bg-blue-300 border-blue-500"
                                 : "bg-yellow-300 border-yellow-500"
                               : "border-gray-300"
                           }`}
              ></div>
              <span className="text-sm whitespace-nowrap overflow-hidden text-gray-300">
                {keyLabels[index]}
              </span>
            </div>

            {/* Horizontal bars */}
            <div
              className="bars-container relative"
              style={{ width: noteTimelineWidth }}
            >
              {song.notes.map((note, noteIndex) => {
                // Check if this note requires this finger position
                const notePositions = fingerPositions[note.note] || [];
                const isActiveForNote = notePositions[index];

                // Position and width calculations
                const startPercent = (note.time / duration) * 100;
                const widthPercent = (note.duration / duration) * 100;

                return isActiveForNote ? (
                  <div
                    key={noteIndex}
                    className={`absolute h-8 ${
                      index === 0 ? "bg-blue-300" : "bg-yellow-300"
                    } rounded-md`}
                    style={{
                      left: `${startPercent}%`,
                      width: `${widthPercent}%`,
                      top: 0,
                    }}
                  ></div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Progress bar
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
      note: "C2", // Default to middle C in second octave
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
    <div className="sax-learning-app bg-gray-900 text-white p-6 rounded-lg max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">{song.title} - Alto Saxophone Tutorial</h1>

      {!editorMode && (
        <>
          {renderStaff()}
          {renderFingerPositions()}
          {renderProgressBar()}
          {renderControls()}
        </>
      )}

      <div className="mt-6 flex space-x-4">
        <button
          onClick={() => setEditorMode(!editorMode)}
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
