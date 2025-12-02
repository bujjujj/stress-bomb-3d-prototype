## Stress Bomb 3D
A 3D physics sandbox built with React and Three.js. This project features a custom-built projectile engine, procedural audio synthesis, and an optimized game loop running at a locked 60 FPS within the browser.
(Optional: Add a screenshot of the game here later!)

# How to Play
The game focuses on satisfying ballistics and destruction. You are placed in a "Golden Hour" canyon with a variety of geometric targets.

Left Click (Hold): Charge your throw.

Visuals: Watch the crosshair shrink and the projectile glow red as power increases.

Left Click (Release): Fire!

Bomb: Heavy gravity, high arc, explosive impact. Destroys targets on hit.

Dart: Low gravity, high velocity, precision flight. Sticks into walls and targets.

# Tech Stack & Key Features
Three.js & React: Leverages useRef for direct DOM manipulation, ensuring the high-frequency game loop runs independently of the React render cycle to prevent stutter.

Custom Physics Engine: Implemented manual velocity, gravity, air resistance (drag), and collision detection math for ballistic trajectories.

Web Audio API: Zero external audio assets. All sound effects (launch pop, whoosh, deep bass explosions, woody thunks) are synthesized in real-time using Oscillators and Gain Nodes.

Procedural Destruction: Targets fracture into debris particles upon impact using reverse-iteration loops for efficient memory management.

Visual Polish: Features "Golden Hour" lighting, directional shadow mapping, and dynamic camera shake effects based on impact force.

# Future Roadmap
This prototype serves as a proof-of-concept for a larger destruction-based game.

- Porting mechanics to Unity for PhysX integration.

- Advanced mesh fracturing (Voronoi shattering).

- Multiplayer competitive modes.