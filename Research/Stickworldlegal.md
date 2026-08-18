\documentclass[11pt, a4paper]{article}

% --- UNIVERSAL PREAMBLE BLOCK ---
\usepackage[a4paper, top=2.5cm, bottom=2.5cm, left=2cm, right=2cm]{geometry}
\usepackage{fontspec}

\usepackage[english, bidi=basic, provide=*]{babel}

\babelprovide[import, onchar=ids fonts]{english}

% Set default/Latin font to Sans Serif in the main (rm) slot
\babelfont{rm}{Noto Sans}

\usepackage{amsmath}
\usepackage{booktabs}
\usepackage{tabularx}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref} % hyperref must be last

\title{\textbf{Stickworld Tournament}\\ \Large Legal Framework \& Game Concepts Report}
\author{Game Design \& Legal Research Consultant}
\date{\today}

\begin{document}

\maketitle

\section{Legal Framework: Avoiding Infringement in Game Development}

In video game jurisprudence (specifically under the \textbf{Idea-Expression Dichotomy} codified in copyright law, such as 17 U.S.C. \S~102(b) and international Berne Convention standards), \textbf{game mechanics, physics rules, mathematical algorithms, and abstract concepts are not protectable by copyright}.

Copyright protects only the specific, original \textbf{expression} of an idea:
\begin{itemize}
    \item \textbf{What is protectable:} Proprietary source code, specific art assets, bespoke animations, original sound effects/music, unique character names, trade dress, and specific, handcrafted level geometry.
    \item \textbf{What is unprotectable:} General gameplay loops (e.g., trajectory aiming, grappling hooks, lane-pushing RTS), ragdoll joint physics formulas, generic stick figure silhouettes, and common genre tropes (sc\`{e}nes \`{a} faire).
    \item \textbf{Trademark protection:} Distinct from copyright, you must ensure game titles, logos, and UI branding do not cause consumer confusion with registered trademarks (e.g., do not use names like \textit{Stick War}, \textit{Xiao Xiao}, or \textit{Fancy Pants}).
\end{itemize}

\vspace{0.5cm}

\section{Game Concepts}

\subsection{1. Vector Brawl (Arena Ragdoll Combat)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
Two to four players control physics-driven stick figures on dynamically destructible platforms. Combat relies on rigid-body physics, momentum, and recoil: striking while falling or swinging multiplies knockback damage. Random procedural hazards (collapsing floors, laser grids) force players into close-quarters combat. 
\begin{itemize}
    \item \textit{Multiplayer Structure:} 1v1 Ranked Duels or 4-player Free-For-All with sudden-death rounds (first to 5 round victories). Short 30-to-60 second rounds maximize competitive engagement.
\end{itemize}

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Stick Fight: The Game} and \textit{Supreme Duelist Stickman}. \textbf{Safe Harbor:} Emulate the general mechanic of active ragdoll brawling and floating physics. Do not rip sound effects, level files, or weapon designs. Create an original active-ragdoll joint hierarchy (e.g., custom PD-controller balance system) rather than copying joint parameters, and use procedurally generated vector arenas instead of mimicking the exact layout of existing maps.

\begin{verbatim}
[Input: Move / Jump / Aim] 
       |
       v
[Active Ragdoll Engine] --(PD Controller Balance)--> [Rigid Body Collision]
       |                                                     |
       v                                                     v
[Weapon Recoil & Momentum] ------------------------> [Server State Sync]
\end{verbatim}

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} WebGL via Pixi.js or Three.js. \textit{Physics:} Rapier2D (compiled to WebAssembly). \textit{Networking:} Client-side prediction with rollback netcode using WebRTC DataChannels (via geckos.io) to minimize input latency.

\vspace{0.5cm}

\subsection{2. Ballistic Trajectory (Wind-Affected Archery Duels)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A turn-based or simultaneous-fire 1v1 duel where players adjust angle, draw strength, and calculate wind resistance to eliminate their opponent. Headshots yield one-hit eliminations; body hits impair movement speed. Competitive ladders feature blind-firing modes where enemy positions are obscured by terrain fog until revealed by reconnaissance arrows.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Bowman} and \textit{Stickman Archer}. \textbf{Safe Harbor:} Ballistic projectile math ($y = v_0 t \sin(\theta) - \frac{1}{2}gt^2$) is basic physics and entirely unprotectable. Avoid copying proprietary HUD elements. Implement original arrow mechanics (e.g., gravity-well arrows, ricochet surfaces) and unique terrain destruction models.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} HTML5 2D Canvas API or Phaser 3. \textit{Physics:} Custom lightweight projectile integrator (Verlet or Euler integration) reducing bundle size. \textit{Networking:} Authoritative server running Node.js with WebSockets; turn-based states require zero client prediction.

\vspace{0.5cm}

\subsection{3. Tether Sprint (Momentum Grapple Racing)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A high-velocity horizontal race where players hook onto static and moving pivot points to build momentum through centrifugal force. 8-player simultaneous ghost or collision-enabled racing. Precision timing on hook release grants a boost multiplier.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Stickman Hook}. \textbf{Safe Harbor:} The pendulum motion mechanic ($F = -mg \sin(\theta)$) is public domain. Do not clone level sequences, visual trampolines, or costume assets. Differentiate by building a multi-lane, branching obstacle course focused on racing lines and player collision.

\begin{verbatim}
       [Hook Attachment Point]
                 o
                / \
  Rope Length  /   \  Centrifugal Force
              /     \
             o       o ---> Release Vector (Velocity + Boost)
       [Player A]  [Player B]
\end{verbatim}

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Pixi.js for hardware-accelerated 2D sprite batching. \textit{Physics:} Matter.js utilizing Distance Constraints. \textit{Networking:} Server-relayed WebSockets updating transform vectors at 30 Hz with Hermite spline interpolation.

\vspace{0.5cm}

\subsection{4. Stick Commander (Lane-Based Micro-RTS)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A side-scrolling real-time strategy tug-of-war. Players balance economic management with military unit production to destroy the enemy's base statue. ``Hero Control'' mode allows the player to manually take direct control of any single stickman unit to execute manual parries or flanking maneuvers.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Stick War: Legacy}. \textbf{Safe Harbor:} The 2D side-scrolling tug-of-war mechanic is a standard RTS subgenre. Do not use the exact unit classes, names (e.g., ``Archidon''), or lore of Inamorta. Implement original unit classes (e.g., kinetic shielders, sappers) and an original techno-feudal aesthetic.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Phaser 3. \textit{Logic Engine:} Gridless deterministic spatial partitioning using an Entity-Component-System (ECS). \textit{Networking:} Deterministic Lockstep Netcode over WebRTC DataChannels.

\vspace{0.5cm}

\subsection{5. Kinetic Parkour (Flow Platformer Time-Trials)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A momentum-based platformer where slopes, wall-runs, slides, and precision vaulting dictate player speed. Features asynchronous ghost races and real-time head-to-head sprint heats. Maintaining high speed fills a ``Flow Meter'' that increases air control.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Fancy Pants Adventures} and \textit{Vex}. \textbf{Safe Harbor:} Smooth B\'{e}zier-curve terrain and momentum physics cannot be copyrighted. Avoid imitating hand-drawn squiggly vector art or recognizable custom clothing. Use an angular, neon-vector or brutalist aesthetic.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Pixi.js with dynamic B\'{e}zier curve mesh rendering. \textit{Physics:} Custom 2D kinematic character controller. \textit{Networking:} WebSockets for positional sync; global leaderboards utilize cryptographically signed input arrays.

\vspace{0.5cm}

\subsection{6. Scope \& Signal (Asymmetric Sniper Duel)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
Two snipers are placed in a dense, living stickman city environment filled with AI civilian stick figures. Players must deduce which stickman is their human opponent based on behavioral anomalies while managing weapon sway, bullet drop, and muzzle flash exposure.

\begin{verbatim}
[Dense Procedural City (100+ AI Stickmen)]
        |
        +-- Player 1 (Aiming Scope: Wind, Sway, Elevation)
        |       |
        |       +--> [Identifies Anomalous Movement] --> [Fires Bullet]
        |                                                     |
        +-- Player 2 (Disguised in Crowd) <-------------------+
\end{verbatim}

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Tactical Assassin} and \textit{Clear Vision}. \textbf{Safe Harbor:} Sniper zoom and bullet drop physics are universal gaming mechanisms. Avoid narrative plots or character names from classic hitman games. Build the game around emergent multiplayer deception.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Three.js or Babylon.js. \textit{Physics Engine:} Raycasting calculations executed in Web Workers. \textit{Networking:} Authoritative server-client model on Node.js to prevent map-hacking.

\vspace{0.5cm}

\subsection{7. Demolition Ragdoll (Physics Joust \& Impact Derby)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
Players pilot crude, physics-based vehicles down steep, hazard-filled decline ramps toward each other. At impact, players trigger an ejection mechanic, launching their stickman into an active ragdoll state. Points are awarded based on kinetic energy transfer ($KE = \frac{1}{2}mv^2$) and breaking opponent limbs.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Stickman Dismounting} and \textit{Ragdoll Hit}. \textbf{Safe Harbor:} Ragdoll impact formulas are abstract concepts. Do not copy sound effects, UI, or proprietary prop models. Introduce active mid-air body contortion controls.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Pixi.js utilizing skeletal bone transformation matrices. \textit{Physics:} Box2D (WASM) for wheel-suspension joints. \textit{Networking:} State-synchronization via WebSockets with dead-reckoning extrapolation.

\vspace{0.5cm}

\subsection{8. Kinetic Vault (Physics-Based Precision Athletics)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A ragdoll sports challenge where players control independent limb joints using simultaneous key bindings to run, plant a vaulting pole, or launch a javelin. Real-time 1v1 Olympic-style heats require precise micro-adjustments to joint angles.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{QWOP} and \textit{The Spear Stickman}. \textbf{Safe Harbor:} Controlling ragdoll joints via segmented keyboard inputs is an unprotectable control scheme. Avoid copying character sprites or exact joint limits. Use modern vector aesthetics.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Standard HTML5 Canvas or SVG rendering. \textit{Physics:} Planck.js configured with revolute motor joints. \textit{Networking:} Input-stream broadcast via WebRTC DataChannels.

\vspace{0.5cm}

\subsection{9. Flow-State Dojo (Frame-Data Melee Duelist)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A high-speed 2D martial arts combat game focused on directional rhythm, frame data, parries, and counter-attacks. Attacks operate on strict startup, active, and recovery frames. Players read opponent animation cues to execute blocks and lethal counter-strikes.

\begin{verbatim}
Attacker:   [Startup Frames] ---> [Active Hitbox Frame] ---> [Recovery]
                                           |
                                     (Collision Check)
                                           |
Defender:   [Block / Parry]  <-------------+-------------> [Unprotected Hit]
            (Attacker Stunned)                             (Lethal Damage)
\end{verbatim}

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Xiao Xiao} and \textit{Stickman Kombat 2D}. \textbf{Safe Harbor:} Martial arts choreography cannot be owned. Do not replicate original animation sequences frame-for-frame from classic animations. Develop original combat procedural keyframing.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Pixi.js utilizing Spine2D web runtime. \textit{Physics:} Custom 2D AABB Hitbox/Hurtbox state machine (fixed 60 Hz). \textit{Networking:} GGPO-style Rollback Netcode via WebAssembly/WebRTC.

\vspace{0.5cm}

\subsection{10. Corporate Ladder (Environmental Brawler)}
\textbf{Core Gameplay \& Competitive Mechanics:}\\
A satirical multi-floor physics brawler where players battle through corporate office environments, weaponizing office supplies (staplers, rolling chairs, monitors). 2v2 Team Brawls or 4-player King of the Hill. Players acquire modular physics-based combat buffs between floors.

\noindent\textbf{Inspiration \& Copyright Strategy:}\\
Inspired by \textit{Stick It to the Stickman}. \textbf{Safe Harbor:} The satirical office combat theme is an unprotectable high-level premise. Do not duplicate upgrade cards, UI layouts, or bespoke weapon animations. Construct your own environmental interaction systems.

\noindent\textbf{Web Technical Overview:}\\
\textit{Rendering:} Three.js (isometric 3D) or Pixi.js (2.5D). \textit{Physics:} Rapier2D/3D (WASM). \textit{Networking:} Server-authoritative state synchronization over WebRTC with spatial interest management.

\newpage

\section{Platform-Wide Competitive Architecture Matrix}

\begin{table}[htbp]
\centering
\renewcommand{\arraystretch}{1.3}
\begin{tabularx}{\textwidth}{@{} >{\raggedright\arraybackslash}p{3cm} >{\raggedright\arraybackslash}X >{\raggedright\arraybackslash}X >{\raggedright\arraybackslash}X >{\raggedright\arraybackslash}p{2.5cm} @{}}
\toprule
\textbf{Game Title} & \textbf{Genre Archetype} & \textbf{Physics Engine} & \textbf{Netcode Model} & \textbf{Match Length} \\
\midrule
\textbf{Vector Brawl} & Active Ragdoll Brawler & Rapier2D (WASM) & Rollback (WebRTC) & 2--3 mins \\
\textbf{Ballistic Traj.} & Turn-Based Archery & Custom Integrator & Auth. (WebSocket) & 1--2 mins \\
\textbf{Tether Sprint} & Momentum Grapple Race & Matter.js & Interp. Sync (WS) & 1--2 mins \\
\textbf{Stick Commander} & Lane-Pushing Micro-RTS & ECS Engine & Lockstep (WebRTC) & 5--10 mins \\
\textbf{Kinetic Parkour} & Flow Speedrunning & Kinematic Custom & Input-Valid (WS) & 1--3 mins \\
\textbf{Scope \& Signal} & Asymmetric Sniper Duel & Raycast Worker & Auth. Raycast (WS) & 2--4 mins \\
\textbf{Demo Ragdoll} & Physics Joust / Derby & Box2D (WASM) & State Sync (WS) & 1--2 mins \\
\textbf{Kinetic Vault} & Precision Athletics & Planck.js & State Broadcast & 1 min \\
\textbf{Flow-State Dojo} & Frame-Data Martial Arts & Custom Hitbox FSM & Rollback (WASM) & 1--2 mins \\
\textbf{Corporate Ladder} & Environmental Brawler & Rapier2D (WASM) & Auth. State (WebRTC) & 3--5 mins \\
\bottomrule
\end{tabularx}
\end{table}

\section{Key Legal Checklist for ``Stickworld Tournament''}

\begin{enumerate}
    \item \textbf{Independent Asset Creation:} Generate 100\% of all audio (SFX/BGM), vector line art, UI elements, and shaders in-house or via licensed libraries. Do not extract SWF files or asset bundles from legacy Flash or mobile titles.
    \item \textbf{Trademark Cleansing:} Run thorough trademark clearances on all 10 game titles and your main platform name across major jurisdictions (USPTO, EUIPO, WIPO). Ensure zero naming overlap with existing franchises.
    \item \textbf{No Direct Code Porting:} Re-engineer all physics setups and controllers from standard mathematical formulas and public library documentation rather than decompiling existing game source code.
\end{enumerate}

\end{document}